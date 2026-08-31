/*
 * tenantRent.js — ONE source of truth for everything the tenant sees about rent.
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * The overview and the Payments tab used to answer the same questions with
 * two different pieces of code:
 *
 *   • the overview read `getBookingRentSnapshot` (ledger-driven, per lease),
 *   • the Payments tab summed raw receipt rows (`Σ totalPaid`, `Σ balance`)
 *     across every receipt the tenant had ever received.
 *
 * Those two answers cannot agree, and they didn't: one screen said the month
 * cost ৳6,000 while the other showed ৳45,600 for it. The ৳45,600 was the whole
 * FLAT's rent — a receipt written against the booking instead of against the
 * occupant — and nothing in the UI could tell the difference, because receipts
 * were matched to a lease by comparing the property NAME string.
 *
 * So the rules live here, once:
 *
 *   1. A tenant's money is scoped to THEIR OWN row. On a shared unit that is
 *      `booking.members[mine]` (their rent, their service charge, their
 *      ledger) — never the booking's whole-unit figures.
 *   2. The LEDGER is the truth about what a month costs and what has been
 *      settled. A receipt is a *document* about a payment, not the payment;
 *      it is only consulted for months the ledger says nothing about (legacy
 *      rows recorded before the ledger existed).
 *   3. Receipts belong to a lease by `bookingId` (+ `memberId`), never by
 *      property title. Two rooms in one building share a title; they do not
 *      share rent.
 *   4. A tenancy is identified to the tenant by HOUSE · FLOOR · ROOM · SEAT,
 *      because "White-house" is not an address when you rent one room of it.
 *
 * Everything here is pure — no React, no network — so the overview, the
 * Payments tab, the rent card and Smart Alerts all import the same answers.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Payment rails
// ─────────────────────────────────────────────────────────────────────────────

/** The rails TO-LET PRO supports. Mirrors PaymentMethod.PAYMENT_TYPES. */
export const PAYMENT_RAILS = ['bkash', 'nagad', 'rocket', 'bank'];

/**
 * The channels offered when RECORDING money that has already changed hands —
 * an advance handed over at move-in, or an inquiry converted into a booking.
 * Stored verbatim on the booking/member as a display string, which is why this
 * list is capitalised and includes Cash, unlike PAYMENT_RAILS above (the
 * landlord's own payout accounts).
 *
 * Lives here rather than inside HostDashboard because SeatTenantModal needs the
 * same list, and importing it from its own parent would be a cycle.
 */
export const ADVANCE_PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Cash'];

/**
 * Presentation for each rail — ONE definition, so bKash is pink and Nagad is
 * orange on every screen. Previously each component carried its own copy and
 * they had drifted (different labels, some missing Rocket entirely, which is
 * why a landlord with three accounts showed only two to the tenant).
 */
export const PAYMENT_METHOD_META = {
  bkash:  { label: 'bKash',  bn: 'বিকাশ',  icon: 'smartphone', tint: 'bg-pink-50 text-pink-600 border-pink-100',       ring: 'ring-pink-300',   dot: 'bg-pink-500' },
  nagad:  { label: 'Nagad',  bn: 'নগদ',    icon: 'smartphone', tint: 'bg-orange-50 text-orange-600 border-orange-100', ring: 'ring-orange-300', dot: 'bg-orange-500' },
  rocket: { label: 'Rocket', bn: 'রকেট',   icon: 'smartphone', tint: 'bg-violet-50 text-violet-600 border-violet-100', ring: 'ring-violet-300', dot: 'bg-violet-500' },
  bank:   { label: 'Bank',   bn: 'ব্যাংক', icon: 'landmark',   tint: 'bg-blue-50 text-blue-600 border-blue-100',       ring: 'ring-blue-300',   dot: 'bg-blue-500' },
};

/** Meta for a rail, tolerant of casing/unknown values (falls back to bank). */
export const methodMeta = (type) =>
  PAYMENT_METHOD_META[String(type || '').toLowerCase()] || PAYMENT_METHOD_META.bank;

/** Display label for a rail, localised. */
export const methodLabel = (type, language) => {
  const meta = PAYMENT_METHOD_META[String(type || '').toLowerCase()];
  if (!meta) return String(type || '');
  return language === 'বাংলা' ? meta.bn : meta.label;
};

/**
 * Sort + de-duplicate a landlord's methods for display: default first, then
 * the canonical rail order, so the tabs never reshuffle between renders or
 * between the Payments tab and the submit modal.
 */
export const sortPaymentMethods = (methods = []) => {
  const rank = (m) => {
    const i = PAYMENT_RAILS.indexOf(String(m?.type || '').toLowerCase());
    return i === -1 ? PAYMENT_RAILS.length : i;
  };
  return [...(methods || [])]
    .filter((m) => m && m.isActive !== false)
    .sort((a, b) => (b.isDefault === true) - (a.isDefault === true) || rank(a) - rank(b));
};

// ─────────────────────────────────────────────────────────────────────────────
// Small shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const MS_DAY = 86400000;

const idOf = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return String(v._id || v.id || '');
  return String(v);
};

const txt = (v) => String(v ?? '').trim();
const num = (v) => Math.max(0, Number(v) || 0);

const startOfDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

export const monthKeyOf = (year, monthIndex) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

export const currentMonthKey = (d = new Date()) => monthKeyOf(d.getFullYear(), d.getMonth());

export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_BN = ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগ', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];
export const monthNames = (language) => (language === 'বাংলা' ? MONTHS_BN : MONTHS_EN);

/** `৳6,000` with the app's usual Indian grouping. */
export const fmtTk = (n, language) =>
  `৳${Number(n || 0).toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-IN')}`;

// ─────────────────────────────────────────────────────────────────────────────
// Which row of this booking is MINE?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The viewer's own member row on a shared unit, or null on a classic
 * single-tenant lease.
 *
 * The backend already tells us which one it is (`myMembership.memberId`, set by
 * booking.controller.listTenantBookings) — we use that rather than guessing.
 * The old guess was "the first member that still has a ledger object", which
 * worked only because co-tenants' ledgers happen to be stripped from the
 * payload; the day that response shape changes, a tenant starts reading
 * somebody else's rent.
 */
export const resolveMyMember = (booking) => {
  if (!booking || !Array.isArray(booking.members) || booking.members.length === 0) return null;
  const mineId = idOf(booking.myMembership?.memberId);
  if (mineId) return booking.members.find((m) => idOf(m?.id || m?._id) === mineId) || null;
  // Legacy payloads without myMembership: fall back to the only row that still
  // carries a ledger (the server strips co-tenants' ledgers).
  return booking.members.find((m) => m && m.ledger && typeof m.ledger === 'object') || null;
};

/**
 * Where this tenancy physically is: house · floor · room · seat.
 * Member labels win over the booking's, because on a shared unit the booking's
 * floor/room describe the whole flat while the member's describe the seat the
 * tenant actually pays for.
 */
export const resolveUnit = (booking, member = undefined) => {
  const mine = member === undefined ? resolveMyMember(booking) : member;
  const mm = booking?.myMembership || null;
  return {
    house: txt(booking?.property),
    location: txt(booking?.location),
    floor: txt(mm?.floor) || txt(mine?.floor) || txt(booking?.floorNumber),
    room: txt(mm?.roomLabel) || txt(mine?.roomLabel) || txt(booking?.roomNumber),
    seat: txt(mm?.seatLabel) || txt(mine?.seatLabel),
    rentType: txt(mm?.rentType) || txt(mine?.rentType) || (txt(booking?.roomNumber) ? 'room' : 'flat'),
  };
};

// A host types a floor as "3", "3rd", "Ground" or "৩" — only add the word
// "Floor" when the value is a bare number, so we never print "Floor 3rd Floor".
const floorText = (v, bn) => {
  const s = txt(v);
  if (!s) return '';
  if (/^[0-9০-৯]+$/.test(s)) return bn ? `${s} তলা` : `Floor ${s}`;
  return s;
};
const roomText = (v, bn) => {
  const s = txt(v);
  if (!s) return '';
  if (/^(room|রুম|flat|ফ্ল্যাট|unit)\b/i.test(s)) return s;
  return bn ? `রুম ${s}` : `Room ${s}`;
};
const seatText = (v, bn) => {
  const s = txt(v);
  if (!s) return '';
  if (/^(seat|সিট|bed)\b/i.test(s)) return s;
  return bn ? `সিট ${s}` : `Seat ${s}`;
};

/**
 * The unit as chip-sized parts, e.g. ['Floor 3', 'Room 301', 'Seat B'].
 * Rendered as separate pills next to the house name.
 */
export const unitParts = (booking, language, member = undefined) => {
  const bn = language === 'বাংলা';
  const u = resolveUnit(booking, member);
  return [floorText(u.floor, bn), roomText(u.room, bn), seatText(u.seat, bn)].filter(Boolean);
};

/**
 * One-line address for a tenancy: `White-house · Floor 3 · Room 301`.
 * This is the label every tenant-facing surface uses to name a lease, so two
 * rooms in the same building are never two identical-looking cards again.
 */
export const formatUnitLabel = (booking, language, member = undefined) => {
  const bn = language === 'বাংলা';
  const u = resolveUnit(booking, member);
  const house = u.house || (bn ? 'আপনার বাসা' : 'Your rental');
  return [house, ...unitParts(booking, language, member)].join(' · ');
};

/** Same idea for a receipt, which snapshots its own unit fields. */
export const receiptUnitLabel = (receipt, language) => {
  const bn = language === 'বাংলা';
  const house = txt(receipt?.propertyTitle) || (bn ? 'আপনার বাসা' : 'Your rental');
  const parts = [
    floorText(receipt?.floorNumber, bn),
    roomText(receipt?.roomNumber, bn),
    seatText(receipt?.seatLabel, bn),
  ].filter(Boolean);
  return [house, ...parts].join(' · ');
};

/**
 * A stable key for "which tenancy is this" — used by the Payments tab filter.
 * The booking id is the identity; the member id splits a shared unit into the
 * individual seats. Property title is NOT part of it (that was the bug).
 */
export const leaseKey = (booking) => {
  const b = idOf(booking?.id || booking?._id);
  const m = idOf(booking?.myMembership?.memberId || booking?.memberId);
  return m ? `${b}:${m}` : b;
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalising a booking into "my tenancy"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Overlay the viewer's own member row onto the booking so every downstream
 * reader sees THEIR rent, THEIR service charge and THEIR ledger — never the
 * whole unit's. Classic single-tenant leases pass through unchanged.
 *
 * Also attaches `unit` (house/floor/room/seat) and `leaseKey` so no component
 * has to re-derive them.
 */
export const normalizeTenantBooking = (booking) => {
  if (!booking) return booking;
  const mine = resolveMyMember(booking);
  // The server already resolved "my rent / my unit" in listTenantBookings
  // (myMembership). Prefer it, so the two sides can't apply different
  // fallback rules to a member row that left a field blank.
  const mm = booking.myMembership || null;
  const base = mine
    ? {
        ...booking,
        ledger: mine.ledger || {},
        monthlyRent: Number(mm?.monthlyRent) || Number(mine.monthlyRent) || Number(booking.monthlyRent) || 0,
        serviceCharge: mm?.serviceCharge != null
          ? Number(mm.serviceCharge) || 0
          : (Number(mine.serviceCharge) || Number(booking.serviceCharge) || 0),
        securityDeposit: mine.securityDeposit != null ? Number(mine.securityDeposit) || 0 : Number(booking.securityDeposit) || 0,
        memberId: idOf(mine.id || mine._id),
        tenant: booking.tenant || mine.name,
      }
    : { ...booking, memberId: null };
  base.unit = resolveUnit(booking, mine);
  base.leaseKey = leaseKey(base);
  return base;
};

/** Map a whole list, keeping the caller free of the member plumbing. */
export const normalizeTenantBookings = (rows = []) => (rows || []).map(normalizeTenantBooking);

// ─────────────────────────────────────────────────────────────────────────────
// One person lives in one place
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When this tenancy began, for the viewer. Mirrors tenancy.service.js on the
 * server: their own move-in beats the lease's start date (on a shared unit the
 * lease may predate them by years), which beats when the record was created.
 */
export const tenancyStartedAt = (booking) => {
  const mine = resolveMyMember(booking);
  const candidates = [mine?.joinDate, booking?.leaseStart, booking?.createdAt];
  for (const c of candidates) {
    const d = c ? new Date(c) : null;
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

/** Newest tenancy first. `createdAt` is the tie-break, not the signal. */
export const sortByRecency = (bookings = []) => [...(bookings || [])].sort((a, b) => {
  const at = tenancyStartedAt(a).getTime();
  const bt = tenancyStartedAt(b).getTime();
  if (bt !== at) return bt - at;
  return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
});

/**
 * SPLIT A TENANT'S BOOKINGS INTO "HOME" AND "USED TO LIVE THERE".
 *
 * A person lives in one place. When several tenancies are open at once it is
 * not because they rent four homes — it is because they moved and nobody
 * stamped the old rows: the previous landlord has no reason to think about a
 * tenant who has gone, and until now the tenant had no button. So the dashboard
 * showed four rent cards and added up four sets of dues.
 *
 * The most recently started tenancy is home. Everything else is history —
 * KEPT, labelled, and still holding its own rent ledger and receipts, because
 * a tenant who moved in March still needs last year's receipts and a card that
 * silently vanished reads as lost data.
 *
 * The server answers this too (`isCurrentHome`, set in listTenantBookings) and
 * that answer wins when present; the local ordering is the fallback for a
 * cached payload written by an older build.
 *
 * NOTE ON BEING WRONG: someone who genuinely holds two lets at once — a shop
 * and a home — sees the older one filed as a previous home. Their landlord can
 * re-add them, and no history is lost either way. That trade is deliberate and
 * matches what the server already does when a tenant joins somewhere new
 * (tenancy.service.closeOtherTenancies).
 */
export const resolveTenancies = (bookings = []) => {
  const rows = normalizeTenantBookings(
    (bookings || []).filter((b) => b && b.status !== 'cancelled' && !b.deletedAt),
  );

  const ended = rows.filter((b) => b.isPastTenancy);
  const open = rows.filter((b) => !b.isPastTenancy);

  // Trust the server's answer when it gave one.
  let current = open.find((b) => b.isCurrentHome) || null;
  if (!current && open.length) current = sortByRecency(open)[0];

  const superseded = open
    .filter((b) => b !== current)
    .map((b) => ({ ...b, isSupersededTenancy: true }));

  // Previous homes, most recently left first.
  const previous = sortByRecency([...superseded, ...ended]);

  return {
    current,
    previous,
    /** What the rent flow acts on: exactly one tenancy, or none. */
    active: current ? [current] : [],
    /** True when we INFERRED the move rather than the landlord stamping it. */
    hasUnstampedMoves: superseded.length > 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Receipts → leases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Does this receipt document a payment on this tenancy?
 *
 * By id, always. Receipts written before bookings carried ids on them fall back
 * to the property title — but ONLY those, so a modern per-room receipt can
 * never be claimed by the room next door just because the building matches.
 */
export const receiptBelongsToBooking = (receipt, booking) => {
  if (!receipt || !booking) return false;
  const rBooking = idOf(receipt.bookingId);
  const bId = idOf(booking.id || booking._id);

  if (rBooking) {
    if (!bId || rBooking !== bId) return false;
    const rMember = idOf(receipt.memberId);
    const bMember = idOf(booking.memberId || booking.myMembership?.memberId);
    // A member's receipt belongs to that member alone.
    if (rMember) return !!bMember && rMember === bMember;
    // A whole-unit receipt (no memberId) belongs to the lease itself. The
    // backend only ever hands a tenant receipts addressed to them, so this
    // stays scoped to the viewer.
    return true;
  }

  // Legacy row with no bookingId at all.
  const title = txt(receipt.propertyTitle);
  return !!title && title === txt(booking.property);
};

/** Every receipt for one tenancy, newest month first. */
export const receiptsForBooking = (receipts = [], booking) =>
  (receipts || [])
    .filter((r) => receiptBelongsToBooking(r, booking))
    .sort((a, b) => txt(b.monthKey).localeCompare(txt(a.monthKey)));

/**
 * Attach the tenancy each receipt came from, so a receipt card can print
 * "White-house · Floor 3 · Room 301" even for legacy rows that never
 * snapshotted a floor/room of their own.
 */
export const decorateReceipts = (receipts = [], bookings = []) =>
  (receipts || []).map((r) => {
    const owner = (bookings || []).find((b) => receiptBelongsToBooking(r, b)) || null;
    return {
      ...r,
      leaseKey: owner ? leaseKey(owner) : `receipt:${txt(r.propertyTitle) || idOf(r.bookingId) || r.id}`,
      floorNumber: txt(r.floorNumber) || txt(owner?.unit?.floor) || txt(owner?.floorNumber),
      roomNumber: txt(r.roomNumber) || txt(owner?.unit?.room) || txt(owner?.roomNumber),
      seatLabel: txt(r.seatLabel) || txt(owner?.unit?.seat),
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// The rent snapshot — what a lease owes, month by month
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Twelve months of rent status for ONE tenancy in ONE calendar year.
 *
 * Returns:
 *   months[]    → { key, monthIndex, status, perMonth, paidAmt, remaining, dueDate, inLease }
 *                 status ∈ paid | partial | submitted | overdue | due | upcoming | inactive
 *   paidCount   → months settled inside the lease this year
 *   activeCount → months of this year the lease covers
 *   outstanding → unpaid rent up to and including this month
 *   paidInYear  → money settled this year on this tenancy
 *   current     → this month's row + `daysLate` (only for the current year)
 *
 * The LEDGER decides. A receipt is only read for a month the ledger is silent
 * about, and even then its paid amount is clamped to the month's obligation —
 * a receipt written for the whole flat cannot make one occupant's ৳6,000 month
 * look like a ৳45,600 one.
 */
export function getBookingRentSnapshot(booking, receipts = [], year, today = new Date()) {
  const rent = num(booking?.monthlyRent);
  const service = num(booking?.serviceCharge);
  const perMonth = rent + service;
  const dueDay = Math.min(Math.max(Number(booking?.rentDueDay) || 5, 1), 28);
  const grace = num(booking?.gracePeriodDays);
  const ledger = booking?.ledger || {};
  const t0 = startOfDay(today) || new Date();

  // Receipts for THIS tenancy only — by id, not by property name.
  const rcptByMonth = {};
  for (const r of receiptsForBooking(receipts, booking)) {
    if (r?.monthKey) rcptByMonth[r.monthKey] = r;
  }

  const monthFloor = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? new Date(d.getFullYear(), d.getMonth(), 1) : null;
  };
  const leaseStartMonth = monthFloor(booking?.leaseStart);
  const leaseEndMonth = monthFloor(booking?.leaseEnd);

  const months = [];
  let paidCount = 0;
  let activeCount = 0;
  let outstanding = 0;
  let paidInYear = 0;

  for (let m = 0; m < 12; m++) {
    const key = monthKeyOf(year, m);
    const monthStart = new Date(year, m, 1);
    const dueDate = new Date(year, m, dueDay);
    const inLease =
      (!leaseStartMonth || monthStart >= leaseStartMonth) &&
      (!leaseEndMonth || monthStart <= leaseEndMonth);

    const entry = ledger[key] || null;
    const rcpt = rcptByMonth[key] || null;

    let status;
    let paidAmt = 0;

    if (entry) {
      // ── Ledger truth ──────────────────────────────────────────────────────
      const settled = entry.paid === true || entry.status === 'full' || entry.status === 'partial';
      paidAmt = settled ? num(entry.amount) : 0;
      if (entry.paid === true || entry.status === 'full') {
        status = 'paid';
        // Older entries recorded the status without an amount. The month is
        // settled, so the money that settled it is the month's own total —
        // showing ৳0 against a paid month reads as a lost payment.
        if (paidAmt === 0) paidAmt = perMonth;
      } else if (entry.status === 'partial') {
        // A "partial" carrying no money is not a payment; let the calendar
        // decide whether it is upcoming, due or overdue.
        status = paidAmt > 0 ? 'partial' : null;
      } else if (entry.status === 'submitted') {
        status = 'submitted';
      } else {
        status = null; // 'due'/'overdue'/'scheduled' → decided below
      }
    } else if (rcpt) {
      // ── Legacy fallback: a receipt with no ledger row behind it ────────────
      // Clamp to the month's obligation: the receipt may have been written
      // against the whole unit, and it must not inflate this tenant's month.
      const rPaid = num(rcpt.totalPaid);
      paidAmt = perMonth > 0 ? Math.min(rPaid, perMonth) : rPaid;
      const rBalance = rcpt.balance != null ? Number(rcpt.balance) : num(rcpt.totalDue) - rPaid;
      status = rcpt.status === 'full' || rBalance <= 0 ? 'paid' : 'partial';
    }

    const remaining = Math.max(perMonth - paidAmt, 0);

    if (!inLease) {
      status = 'inactive';
    } else if (!status) {
      const graceEnd = new Date(dueDate);
      graceEnd.setDate(graceEnd.getDate() + grace);
      if (t0 > graceEnd) status = 'overdue';
      else if (t0 >= dueDate) status = 'due';
      else status = 'upcoming';
    }

    if (inLease) {
      activeCount += 1;
      paidInYear += paidAmt;
      if (status === 'paid') paidCount += 1;
      const isPastOrCurrent =
        year < t0.getFullYear() || (year === t0.getFullYear() && m <= t0.getMonth());
      // A submitted claim is not money yet, but chasing the tenant for rent
      // they have already filed proof of is worse than waiting a day.
      if (isPastOrCurrent && status !== 'paid' && status !== 'submitted') outstanding += remaining;
    }

    months.push({
      key,
      monthIndex: m,
      status,
      perMonth,
      paidAmt,
      remaining,
      dueDate,
      inLease,
      receipt: rcpt,
    });
  }

  let current = null;
  if (year === t0.getFullYear()) {
    const cm = months[t0.getMonth()];
    const daysLate =
      cm.status === 'overdue' || cm.status === 'due'
        ? Math.max(Math.round((t0 - cm.dueDate) / MS_DAY), 0)
        : 0;
    current = { ...cm, daysLate };
  }

  return { months, paidCount, activeCount, outstanding, paidInYear, perMonth, current };
}

/** Total outstanding rent across every active tenancy, for "Due Amount". */
export function computeTenantDue(bookings = [], receipts = [], today = new Date()) {
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const y = base.getFullYear();
  let due = 0;
  for (const b of bookings || []) {
    if (!b || b.status === 'cancelled' || b.deletedAt) continue;
    due += getBookingRentSnapshot(b, receipts, y, base).outstanding;
  }
  return due;
}

// ─────────────────────────────────────────────────────────────────────────────
// The one summary both tabs render from
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything the overview and the Payments tab need, computed once.
 *
 * The two screens used to compute their headline numbers separately and
 * disagreed. They now render the SAME object, so "Due Amount" on the overview
 * and "Outstanding" in Payments are the same number by construction — not by
 * two pieces of code happening to agree.
 *
 * @param {object[]} bookings  active tenancies, already normalized
 * @param {object[]} receipts  the tenant's receipts
 * @param {number}   year      calendar year the Payments tab is showing
 * @param {Date}     today
 */
export function buildTenantRentSummary({ bookings = [], receipts = [], year, today = new Date() } = {}) {
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const activeYear = Number(year) || base.getFullYear();

  const leases = (bookings || [])
    .filter((b) => b && b.status !== 'cancelled' && !b.deletedAt)
    .map((b) => {
      const snapshot = getBookingRentSnapshot(b, receipts, activeYear, base);
      // "Due now" always means the CURRENT year — a tenant browsing 2025
      // should still see today's real balance on the KPI strip.
      const liveSnapshot =
        activeYear === base.getFullYear()
          ? snapshot
          : getBookingRentSnapshot(b, receipts, base.getFullYear(), base);
      return {
        booking: b,
        key: leaseKey(b),
        snapshot,
        outstanding: liveSnapshot.outstanding,
        receipts: receiptsForBooking(receipts, b),
      };
    });

  const outstanding = leases.reduce((s, l) => s + l.outstanding, 0);
  const paidInYear = leases.reduce((s, l) => s + l.snapshot.paidInYear, 0);
  const partialCount = leases.reduce(
    (s, l) => s + l.snapshot.months.filter((m) => m.status === 'partial').length,
    0,
  );
  const submittedCount = leases.reduce(
    (s, l) => s + l.snapshot.months.filter((m) => m.status === 'submitted').length,
    0,
  );

  // The oldest unsettled month across every tenancy — what to pay next.
  let nextDue = null;
  for (const l of leases) {
    for (const m of l.snapshot.months) {
      if (!m.inLease || m.remaining <= 0) continue;
      if (m.status === 'paid' || m.status === 'submitted' || m.status === 'upcoming') continue;
      if (!nextDue || m.key < nextDue.month.key) nextDue = { lease: l, month: m };
    }
  }

  const receiptsInYear = (receipts || []).filter((r) =>
    txt(r.monthKey).startsWith(`${activeYear}-`),
  ).length;

  return {
    year: activeYear,
    leases,
    outstanding,
    paidInYear,
    partialCount,
    submittedCount,
    nextDue,
    receiptsInYear,
    hasMultipleLeases: leases.length > 1,
  };
}
