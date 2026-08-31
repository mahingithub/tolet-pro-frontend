/**
 * hostOps — the operation log behind the landlord's offline writing.
 * ──────────────────────────────────────────────────────────────────────────
 * A landlord collects rent on foot: up the stairs, door to door, in buildings
 * where the signal dies on the third floor. Before this, those writes updated
 * the screen, showed a "রিসিট পাঠানো হয়েছে" toast, and were fired at the server
 * as `.catch(console.warn)` — so with no network the landlord was TOLD the rent
 * was recorded, and thirty seconds later the booking poll overwrote it with the
 * server's copy and the payment was gone. Silently.
 *
 * Every write is now one operation that knows two things about itself:
 *
 *   LOCAL[action](world, op) → the new { bookings, units } on THIS phone
 *   SEND[action](op)         → the request that tells the server
 *
 * Two rules, the same as the Living wallet's queue (store/livingOps.js):
 *
 *  1. **LOCAL must be pure and replayable.** Every server refresh throws local
 *     state away and re-applies whatever is still queued on top, so LOCAL may
 *     not read the clock or mint an id — everything variable is frozen into the
 *     op when it is created.
 *  2. **Ids are minted HERE, not by the server.** A tenant written down with no
 *     network gets a real MongoDB ObjectId immediately, so rent collected
 *     against that seat while still offline points at the same person once both
 *     reach the server. The alternative — a placeholder id rewritten later — is
 *     how ledgers lose money.
 *
 * What the server still decides on its own: whether the seat is free. A
 * placement that was queued while someone else took the last seat comes back
 * refused, with the reason, rather than being forced through.
 */
import { applyPaymentToEntry } from '../utils/rentLedger';
import {
  updateLedger, undoLedger, updateMemberLedger, undoMemberLedger,
  updateBookingSettings, updateMember, cancelBooking,
} from '../services/bookingService';
import { createUnit, updateUnit, addTenantToUnit } from '../services/buildingService';

/**
 * A real MongoDB ObjectId: 4-byte timestamp + 8 random bytes, hex. The server
 * accepts it as the document's `_id`, which is what lets a room or a tenant
 * created offline be the same row the server ends up holding.
 */
export const newObjectId = () => {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const rand = crypto.getRandomValues(new Uint8Array(8));
  return ts + [...rand].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const newOpId = () => `op_${newObjectId()}`;

const num = (v) => Math.max(0, Number(v) || 0);

// A booking is addressed by its serialised `id`, but callers that still hold a
// raw document may pass `_id`. Both are the same value; matching on either
// keeps an operation from silently applying to nothing.
const isBooking = (b, id) => String(b.id) === String(id) || String(b._id || '') === String(id);

// Replace one booking in the list, leaving the rest untouched.
const mapBooking = (world, bookingId, fn) => ({
  ...world,
  bookings: (world.bookings || []).map((b) => (isBooking(b, bookingId) ? fn(b) : b)),
});

// Replace one member inside one booking.
const mapMember = (world, bookingId, memberId, fn) =>
  mapBooking(world, bookingId, (b) => ({
    ...b,
    members: (b.members || []).map((m) => (String(m.id) === String(memberId) ? fn(m) : m)),
  }));

// Where a month's money lives: a specific occupant's ledger, or the booking's
// own for a single-tenant lease.
const writeLedger = (world, { bookingId, memberId }, monthKey, entry) => {
  const put = (holder) => {
    const ledger = { ...(holder.ledger || {}) };
    if (entry === null) delete ledger[monthKey];
    else ledger[monthKey] = entry;
    return { ...holder, ledger };
  };
  return memberId
    ? mapMember(world, bookingId, memberId, put)
    : mapBooking(world, bookingId, put);
};

const readLedger = (world, { bookingId, memberId }, monthKey) => {
  const booking = (world.bookings || []).find((b) => isBooking(b, bookingId));
  if (!booking) return undefined;
  const holder = memberId
    ? (booking.members || []).find((m) => String(m.id) === String(memberId))
    : booking;
  return holder && holder.ledger ? holder.ledger[monthKey] : undefined;
};

// ── what each operation does to THIS phone ───────────────────────────────────
export const LOCAL = {
  /**
   * Rent received. The op stores the INCREMENT, never the resulting total, and
   * recomputes through the same helper the server uses — so when this replays
   * on top of a fresh snapshot (the tenant's own payment landed in the
   * meantime), the month adds up correctly instead of overwriting.
   */
  payRent: (world, op) => {
    const { bookingId, memberId, monthKey, amount, expected, meta } = op.args;
    const existing = readLedger(world, op.args, monthKey);
    const entry = applyPaymentToEntry(existing, { amount, expected, meta: meta || {} });
    return writeLedger(world, { bookingId, memberId }, monthKey, entry);
  },

  /** Marked outstanding, with the note and the date the landlord was promised. */
  markDue: (world, op) => {
    const { monthKey, expected, dueNote, expectedPayBy } = op.args;
    return writeLedger(world, op.args, monthKey, {
      paid: false, status: 'due', dueNote: dueNote || '', expectedPayBy: expectedPayBy || '',
      amount: 0, balance: num(expected),
    });
  },

  /** The record was a mistake — remove the month entirely. */
  undoRent: (world, op) => writeLedger(world, op.args, op.args.monthKey, null),

  /** Rent rate / due day / late fee on the lease itself. */
  updateBookingFields: (world, op) =>
    mapBooking(world, op.args.bookingId, (b) => ({ ...b, ...op.args.patch })),

  /** One occupant's own terms — their rent, their seat label, their status. */
  updateMemberFields: (world, op) =>
    mapMember(world, op.args.bookingId, op.args.memberId, (m) => ({ ...m, ...op.args.patch })),

  cancelBooking: (world, op) => ({
    ...world,
    bookings: (world.bookings || []).filter((b) => !isBooking(b, op.args.bookingId)),
  }),

  /**
   * A new tenant in a room. The room may already hold a lease (another seat in
   * the same hostel room) — then this is one more occupant on it; otherwise the
   * lease itself starts here, with the id this phone minted.
   */
  addTenant: (world, op) => {
    const { bookingId, member, booking } = op.args;
    const existing = (world.bookings || []).find((b) => isBooking(b, bookingId));
    if (existing) {
      return mapBooking(world, bookingId, (b) => ({
        ...b,
        // Never twice: a replay of a placement we already hold must not seat
        // the same person again.
        members: (b.members || []).some((m) => String(m.id) === String(member.id))
          ? b.members
          : [...(b.members || []), member],
      }));
    }
    return { ...world, bookings: [...(world.bookings || []), { ...booking, id: bookingId, members: [member] }] };
  },

  /** A room added to a building. */
  createUnit: (world, op) => {
    const { unit } = op.args;
    if ((world.units || []).some((u) => String(u.id) === String(unit.id))) return world;
    return { ...world, units: [...(world.units || []), unit] };
  },

  /** A room's rent, seats or labels. */
  updateUnitFields: (world, op) => ({
    ...world,
    units: (world.units || []).map((u) => (String(u.id) === String(op.args.unitId) ? { ...u, ...op.args.patch } : u)),
  }),
};

// ── what each operation says to the server ───────────────────────────────────
// The ledger calls send `amountReceived` (this payment) alongside the resulting
// totals: the server folds the increment into the month itself, so the two
// sides cannot disagree about what has been collected.
export const SEND = {
  payRent: (op, world) => {
    const { bookingId, memberId, monthKey, amount, expected, meta, monthLabel } = op.args;
    // `amountReceived` is what arrived THIS time and is the authoritative
    // figure: the server adds it to whatever the month already holds. The
    // totals below are only a snapshot for readers that predate that field —
    // they are never what the money is computed from.
    const current = readLedger(world, op.args, monthKey) || {};
    const body = {
      ...(meta || {}),
      paid: true,
      status: current.status || 'partial',
      amount: num(current.amount),
      balance: num(current.balance),
      amountReceived: num(amount),
      monthLabel,
      totalDue: num(expected),
    };
    return memberId
      ? updateMemberLedger(bookingId, memberId, monthKey, body, op.opId)
      : updateLedger(bookingId, monthKey, body, op.opId);
  },
  markDue: (op) => {
    const { bookingId, memberId, monthKey, expected, dueNote, expectedPayBy, monthLabel } = op.args;
    const body = {
      paid: false, status: 'due', dueNote: dueNote || '', expectedPayBy: expectedPayBy || '',
      amount: 0, balance: num(expected), amountReceived: 0, monthLabel, totalDue: num(expected),
    };
    return memberId
      ? updateMemberLedger(bookingId, memberId, monthKey, body, op.opId)
      : updateLedger(bookingId, monthKey, body, op.opId);
  },
  undoRent: (op) => {
    const { bookingId, memberId, monthKey } = op.args;
    return memberId
      ? undoMemberLedger(bookingId, memberId, monthKey, op.opId)
      : undoLedger(bookingId, monthKey, op.opId);
  },
  updateBookingFields: (op) => updateBookingSettings(op.args.bookingId, op.args.patch, op.opId),
  updateMemberFields: (op) => updateMember(op.args.bookingId, op.args.memberId, op.args.patch, op.opId),
  cancelBooking: (op) => cancelBooking(op.args.bookingId, op.opId),
  addTenant: (op) => addTenantToUnit(op.args.unitId, { ...op.args.payload, id: op.args.member.id, bookingId: op.args.bookingId }, op.opId),
  createUnit: (op) => createUnit(op.args.buildingId, { ...op.args.payload, id: op.args.unit.id }, op.opId),
  updateUnitFields: (op) => updateUnit(op.args.unitId, op.args.patch, op.opId),
};

// ── queue bookkeeping ────────────────────────────────────────────────────────

/**
 * Add an operation to the queue, folding it into what is already there.
 *
 * Rent is the case that matters: two payments toward the same month must stay
 * two increments (৳3,000 then ৳2,000 is ৳5,000 collected, not ৳2,000), so
 * `payRent` is never merged. Everything else here writes absolute values, where
 * the last instruction is the whole truth.
 */
export function mergeOp(queue, op) {
  const sameTarget = (a, b) =>
    a.action === b.action
    && String(a.args.bookingId || a.args.unitId || '') === String(b.args.bookingId || b.args.unitId || '')
    && String(a.args.memberId || '') === String(b.args.memberId || '')
    && String(a.args.monthKey || '') === String(b.args.monthKey || '');

  // Undoing a month wipes out any queued payment for it — the landlord is
  // correcting a mistake they made moments ago, not asking us to send it first.
  if (op.action === 'undoRent') {
    const cleaned = queue.filter(
      (o) => !(['payRent', 'markDue'].includes(o.action) && sameTarget({ ...o, action: o.action }, { ...op, action: o.action })),
    );
    return [...cleaned, op];
  }

  // Patches to the same row: layer them into the queued one.
  if (['updateBookingFields', 'updateMemberFields', 'updateUnitFields'].includes(op.action)) {
    const at = queue.findIndex((o) => sameTarget(o, op));
    if (at >= 0) {
      const merged = { ...queue[at], args: { ...queue[at].args, patch: { ...queue[at].args.patch, ...op.args.patch } }, at: op.at };
      return queue.map((o, i) => (i === at ? merged : o));
    }
  }

  return [...queue, op];
}

/**
 * Which row an operation was about, in words. A refused write has to name its
 * subject: "the seat is full" tells a landlord with seventy rooms nothing they
 * can act on, and by the time the queue reports it they have moved on to the
 * next floor.
 */
export const opSubject = (op) => {
  const a = (op && op.args) || {};
  if (op?.action === 'addTenant') return a.payload?.name || a.member?.name || '';
  if (op?.action === 'createUnit') return a.unit?.roomNumber ? `${a.unit.roomNumber}` : '';
  if (a.monthKey) return a.monthLabel || a.monthKey;
  return '';
};

/** Every booking / member / unit / month the queue is still holding. */
export function pendingKeys(queue = []) {
  const keys = new Set();
  queue.forEach((op) => {
    const a = op.args || {};
    if (a.bookingId) keys.add(`booking:${a.bookingId}`);
    if (a.unitId) keys.add(`unit:${a.unitId}`);
    if (a.memberId) keys.add(`member:${a.memberId}`);
    if (a.member?.id) keys.add(`member:${a.member.id}`);
    if (a.unit?.id) keys.add(`unit:${a.unit.id}`);
    // The cell a landlord actually looks at: this person, this month.
    if (a.monthKey) keys.add(`rent:${a.memberId || a.bookingId}:${a.monthKey}`);
  });
  return keys;
}

/**
 * Apply ONE already-queued operation to a world.
 *
 * Kept separate from queueing on purpose. React may call a `setState(prev => …)`
 * updater more than once for a single event — it does exactly that in
 * StrictMode — so an updater that also enqueues would record the same rent
 * payment twice. Queue first, then hand the op to this: it is pure, and calling
 * it twice with the same op produces the same world.
 */
export function applyOp(world, op) {
  return LOCAL[op.action] ? LOCAL[op.action](world, op) : world;
}

/** Replay the queue on top of a fresh server snapshot. */
export function replayInto(world, queue = []) {
  return queue.reduce((acc, op) => {
    try {
      return LOCAL[op.action] ? LOCAL[op.action](acc, op) : acc;
    } catch {
      // A queued op whose target the server no longer has. The flush will get a
      // real answer about it; until then it simply doesn't paint.
      return acc;
    }
  }, world);
}
