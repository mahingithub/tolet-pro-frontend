/**
 * livingOps — the operation log behind the shared wallet's offline writing.
 * ──────────────────────────────────────────────────────────────────────────
 * Every write in the Living tab is expressed once, as an *operation*:
 *
 *   { opId, action, args, tmpId, meId, at }
 *
 * and each operation knows two things about itself —
 *
 *   LOCAL[action](state, op) → the partial state it produces ON THIS PHONE
 *   SEND[action](op)         → the request that tells the server about it
 *
 * That split is what lets the same code serve three jobs: the on-device local
 * planner (LOCAL only), the connected wallet (LOCAL immediately, SEND after),
 * and the offline queue (LOCAL now, SEND whenever the network comes back).
 *
 * Two rules keep the queue honest:
 *
 *  1. **LOCAL must be pure and replayable.** Whenever a server snapshot lands,
 *     the store throws away local state and re-applies every operation still
 *     waiting in the queue on top of it. So LOCAL may not read the clock, roll
 *     an id, or depend on anything but (state, op) — everything variable is
 *     frozen into the op when it is created.
 *  2. **Rows created offline carry a temporary id** (`tmp_…`). The server
 *     issues the real one; when the snapshot arrives the temporary row is
 *     simply gone, replaced by the real one. `mergeOp` below makes sure no
 *     operation is ever sent to the server pointing at a `tmp_` id.
 */
import livingService from '../services/livingService';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const TMP_PREFIX = 'tmp_';
export const isTmpId = (id) => typeof id === 'string' && id.startsWith(TMP_PREFIX);

const num = (v) => Math.max(0, Number(v) || 0);
const dayKey = (d) => String(d).slice(0, 10);

// Base64 receipts never go to the server (16MB document cap); only short URLs
// survive. The local row keeps the full data URL so the phone still shows it.
const stripReceipt = (o) =>
  o && typeof o.receipt === 'string' && !/^https?:\/\//i.test(o.receipt) ? { ...o, receipt: null } : o;

// ── what each operation does to THIS phone ───────────────────────────────────
export const LOCAL = {
  addExpense: (s, op) => ({
    expenses: [
      {
        id: op.tmpId,
        receipt: null,
        shares: {},
        // The sheet doesn't send a date — it means "now". The server stamps its
        // own; without this the local row had no date at all and fell out of
        // every month filter.
        date: op.at,
        ...op.args.exp,
        createdBy: op.meId,
      },
      ...s.expenses,
    ],
  }),
  updateExpense: (s, op) => ({
    expenses: s.expenses.map((e) =>
      e.id === op.args.id ? { ...e, ...op.args.patch, editedBy: op.meId, editedAt: op.at } : e,
    ),
  }),
  deleteExpense: (s, op) => ({ expenses: s.expenses.filter((e) => e.id !== op.args.id) }),

  addBill: (s, op) => ({
    bills: [
      ...s.bills,
      { id: op.tmpId, status: 'unpaid', paidAmount: 0, paidDate: null, reminder: true, createdBy: op.meId, ...op.args.bill },
    ],
  }),
  updateBill: (s, op) => ({
    bills: s.bills.map((b) => (b.id === op.args.id ? { ...b, ...op.args.patch, editedBy: op.meId, editedAt: op.at } : b)),
  }),
  deleteBill: (s, op) => ({ bills: s.bills.filter((b) => b.id !== op.args.id) }),
  // Paying is its own operation because the local maths (status, paidDate) is
  // richer than the single field that goes over the wire.
  payBill: (s, op) => ({
    bills: s.bills.map((b) => {
      if (b.id !== op.args.id) return b;
      const total = num(b.amount);
      const paid = Math.min(total, num(op.args.amount));
      const status = paid <= 0 ? 'unpaid' : paid >= total ? 'paid' : 'partial';
      return { ...b, status, paidAmount: paid, paidDate: paid > 0 ? op.at : null, paidBy: b.paidBy || op.meId };
    }),
  }),
  // Absolute, not a toggle — replaying a toggle would flip it back.
  setBillReminder: (s, op) => ({
    bills: s.bills.map((b) => (b.id === op.args.id ? { ...b, reminder: !!op.args.reminder } : b)),
  }),

  setMeal: (s, op) => {
    const { date, roommateId, meal, value } = op.args;
    const key = dayKey(date);
    const existing = s.meals.find((m) => dayKey(m.date) === key && m.roommateId === roommateId);
    const v = Math.max(0, value);
    if (existing) {
      return {
        meals: s.meals.map((m) => (m.id === existing.id ? { ...m, [meal]: v, editedBy: op.meId, editedAt: op.at } : m)),
      };
    }
    return {
      meals: [
        ...s.meals,
        { id: op.tmpId, date: new Date(`${key}T12:00:00`).toISOString(), roommateId, breakfast: 0, lunch: 0, dinner: 0, [meal]: v, createdBy: op.meId },
      ],
    };
  },

  addGrocery: (s, op) => ({
    groceries: [{ id: op.tmpId, date: op.at, ...op.args.g, createdBy: op.meId }, ...s.groceries],
  }),
  deleteGrocery: (s, op) => ({ groceries: s.groceries.filter((g) => g.id !== op.args.id) }),

  addSettlement: (s, op) => ({
    settlements: [{ id: op.tmpId, date: op.at, ...op.args.st, createdBy: op.meId }, ...s.settlements],
  }),
  deleteSettlement: (s, op) => ({ settlements: s.settlements.filter((x) => x.id !== op.args.id) }),

  addDeposit: (s, op) => ({
    deposits: [{ id: op.tmpId, date: op.at, ...op.args.d, createdBy: op.meId }, ...s.deposits],
  }),
  deleteDeposit: (s, op) => ({ deposits: s.deposits.filter((x) => x.id !== op.args.id) }),

  updateConfig: (s, op) => {
    const p = op.args.patch || {};
    const out = {};
    if (p.rent !== undefined) out.rent = num(p.rent);
    if (p.monthlyIncome !== undefined) out.monthlyIncome = num(p.monthlyIncome);
    if (p.mealRate !== undefined) out.mealRate = num(p.mealRate);
    if (p.budgets) out.budgets = { ...s.budgets, ...p.budgets };
    return out;
  },

  // ── solo খাতা ─────────────────────────────────────────────────────────────
  // The rows the solo wallet creates keep `op.newId` — a plain id, no `tmp_`
  // prefix — because the server accepts the id this phone minted rather than
  // issuing its own. That is what lets an entry written in a dead zone keep the
  // same identity forever, and what makes merging two devices a union by id.
  soloAddPerson: (s, op) => ({
    solo: {
      ...s.solo,
      people: [
        ...s.solo.people,
        {
          id: op.newId,
          name: 'Friend',
          color: '#64748b',
          phone: '',
          note: '',
          createdAt: op.at,
          ...op.args.person,
        },
      ],
    },
  }),
  soloUpdatePerson: (s, op) => ({
    solo: {
      ...s.solo,
      people: s.solo.people.map((p) => (p.id === op.args.id ? { ...p, ...op.args.patch } : p)),
    },
  }),
  // Drops the person AND every entry tied to them — a ধার row is meaningless
  // without the person it points at. The server does the same on its copy.
  soloRemovePerson: (s, op) => ({
    solo: {
      ...s.solo,
      people: s.solo.people.filter((p) => p.id !== op.args.id),
      entries: s.solo.entries.filter((e) => e.personId !== op.args.id),
    },
  }),

  soloAddEntry: (s, op) => ({
    solo: {
      ...s.solo,
      entries: [
        {
          id: op.newId,
          type: 'expense',
          amount: 0,
          category: 'other',
          personId: null,
          note: '',
          method: 'cash',
          date: op.at,
          createdAt: op.at,
          ...op.args.entry,
        },
        ...s.solo.entries,
      ],
    },
  }),
  soloUpdateEntry: (s, op) => ({
    solo: {
      ...s.solo,
      entries: s.solo.entries.map((e) =>
        e.id === op.args.id ? { ...e, ...op.args.patch, editedAt: op.at } : e,
      ),
    },
  }),
  soloDeleteEntry: (s, op) => ({
    solo: { ...s.solo, entries: s.solo.entries.filter((e) => e.id !== op.args.id) },
  }),

  soloConfig: (s, op) => {
    const p = op.args.patch || {};
    const next = { ...s.solo };
    // `opening` is cash already in hand and may legitimately be negative;
    // `budget` is a cap and may not.
    if (p.opening !== undefined) next.opening = Number(p.opening) || 0;
    if (p.budget !== undefined) next.budget = num(p.budget);
    return { solo: next };
  },
  soloReset: (s) => ({ solo: { opening: 0, budget: 0, people: [], entries: [] } }),
};

// The solo actions, as a set — the store asks "is this op for the private
// খাতা?" on every write, replay and queue filter, and one list beats six
// string comparisons scattered around.
export const SOLO_ACTIONS = new Set([
  'soloAddPerson',
  'soloUpdatePerson',
  'soloRemovePerson',
  'soloAddEntry',
  'soloUpdateEntry',
  'soloDeleteEntry',
  'soloConfig',
  'soloReset',
]);

export const isSoloOp = (op) => SOLO_ACTIONS.has(op?.action);

// ── what each operation says to the server ───────────────────────────────────
export const SEND = {
  addExpense: (op) => livingService.addExpense({ ...stripReceipt(op.args.exp), date: op.args.exp.date || op.at }, op.opId),
  updateExpense: (op) => livingService.updateExpense(op.args.id, stripReceipt(op.args.patch), op.opId),
  deleteExpense: (op) => livingService.deleteExpense(op.args.id, op.opId),

  addBill: (op) => livingService.addBill(op.args.bill, op.opId),
  updateBill: (op) => livingService.updateBill(op.args.id, op.args.patch, op.opId),
  deleteBill: (op) => livingService.deleteBill(op.args.id, op.opId),
  payBill: (op) => livingService.updateBill(op.args.id, { paidAmount: num(op.args.amount) }, op.opId),
  setBillReminder: (op) => livingService.updateBill(op.args.id, { reminder: !!op.args.reminder }, op.opId),

  setMeal: (op) => livingService.setMeal(op.args, op.opId),

  addGrocery: (op) => livingService.addGrocery({ ...op.args.g, date: op.args.g.date || op.at }, op.opId),
  deleteGrocery: (op) => livingService.deleteGrocery(op.args.id, op.opId),

  addSettlement: (op) => livingService.addSettlement({ ...op.args.st, date: op.args.st.date || op.at }, op.opId),
  deleteSettlement: (op) => livingService.deleteSettlement(op.args.id, op.opId),

  addDeposit: (op) => livingService.addDeposit({ ...op.args.d, date: op.args.d.date || op.at }, op.opId),
  deleteDeposit: (op) => livingService.deleteDeposit(op.args.id, op.opId),

  updateConfig: (op) => livingService.updateConfig(op.args.patch, op.opId),

  // ── solo খাতা ─────────────────────────────────────────────────────────────
  // The create calls send `id: op.newId` in the body: the server stores the
  // phone's id verbatim, so there is no id to swap back afterwards.
  soloAddPerson: (op) => livingService.addSoloPerson({ ...op.args.person, id: op.newId }, op.opId),
  soloUpdatePerson: (op) => livingService.updateSoloPerson(op.args.id, op.args.patch, op.opId),
  soloRemovePerson: (op) => livingService.deleteSoloPerson(op.args.id, op.opId),

  soloAddEntry: (op) =>
    livingService.addSoloEntry({ ...op.args.entry, id: op.newId, date: op.args.entry.date || op.at }, op.opId),
  soloUpdateEntry: (op) => livingService.updateSoloEntry(op.args.id, op.args.patch, op.opId),
  soloDeleteEntry: (op) => livingService.deleteSoloEntry(op.args.id, op.opId),

  soloConfig: (op) => livingService.updateSolo(op.args.patch, op.opId),
  soloReset: (op) => livingService.resetSolo(op.opId),
};

// Activity lines are written by the server for a connected wallet; the local
// planner has no server, so it writes its own from here.
export const ACTIVITY = {
  addExpense: (op) => ['expense', 'Expense added', `${op.args.exp.note || op.args.exp.category} · ৳${num(op.args.exp.amount).toLocaleString('en-BD')}`],
  addBill: (op) => ['bill', 'Bill added', `${op.args.bill.type} · ৳${num(op.args.bill.amount).toLocaleString('en-BD')}`],
  addGrocery: (op) => ['meal', 'Grocery added', `${op.args.g.note || 'Meal groceries'} · ৳${num(op.args.g.amount).toLocaleString('en-BD')}`],
  addDeposit: (op, s) => {
    const who = s.roommates.find((r) => r.id === op.args.d.roommateId);
    return ['meal', 'Deposit added', `${who?.name || 'Someone'} deposited ৳${num(op.args.d.amount).toLocaleString('en-BD')}`];
  },
  addSettlement: (op, s) => {
    const from = s.roommates.find((r) => r.id === op.args.st.from);
    const to = s.roommates.find((r) => r.id === op.args.st.to);
    return ['settlement', 'Settlement completed', `${from?.name || 'Someone'} paid ${to?.name || 'someone'} ৳${num(op.args.st.amount).toLocaleString('en-BD')} via ${op.args.st.method}`];
  },
  payBill: (op, s) => {
    const bill = s.bills.find((b) => b.id === op.args.id);
    const total = num(bill?.amount);
    const paid = Math.min(total, num(op.args.amount));
    const fmt = (n) => Number(n).toLocaleString('en-BD');
    const label = paid >= total && total > 0 ? 'Bill paid' : paid > 0 ? 'Bill part-paid' : 'Bill updated';
    const detail = paid > 0 && paid < total ? `${bill?.type} · ৳${fmt(paid)} / ৳${fmt(total)}` : `${bill?.type} · ৳${fmt(paid || total)}`;
    return ['bill', label, detail];
  },
};

// ── queue bookkeeping ────────────────────────────────────────────────────────

// action → the args key holding the new entity, for the creates we can fold
// later edits back into.
const CREATES = {
  addExpense: 'exp',
  addBill: 'bill',
  addGrocery: 'g',
  addSettlement: 'st',
  addDeposit: 'd',
};

// Which create produced this id, if it is still waiting in the queue.
const pendingCreate = (outbox, id) =>
  isTmpId(id) ? outbox.find((o) => o.tmpId === id && CREATES[o.action]) : undefined;

const DELETE_OF = {
  deleteExpense: 'addExpense',
  deleteBill: 'addBill',
  deleteGrocery: 'addGrocery',
  deleteSettlement: 'addSettlement',
  deleteDeposit: 'addDeposit',
};

// An edit that can be folded INTO a pending create, as a patch of that entity.
const FOLD_INTO_CREATE = {
  updateExpense: (op) => op.args.patch,
  updateBill: (op) => op.args.patch,
  payBill: (op) => ({ paidAmount: num(op.args.amount) }),
  setBillReminder: (op) => ({ reminder: !!op.args.reminder }),
};

// Does this op point at a specific existing row?
const targetId = (op) => op.args?.id;

/**
 * Add an operation to the queue, folding it into what is already there.
 *
 * Without this, a row added and then corrected while offline would travel as
 * three separate requests, the middle two aimed at an id the server has never
 * heard of. Folding keeps the queue short and — more importantly — guarantees
 * every request that leaves this phone names a row the server knows.
 */
export function mergeOp(outbox, op) {
  const id = targetId(op);

  // 1. Deleting something that was never sent: drop the create and everything
  //    that touched it. The server never needs to hear about any of it.
  if (DELETE_OF[op.action] && pendingCreate(outbox, id)) {
    return outbox.filter((o) => o.tmpId !== id && targetId(o) !== id);
  }

  // 2. Editing something that was never sent: fold the change into the create.
  if (FOLD_INTO_CREATE[op.action] && pendingCreate(outbox, id)) {
    const patch = FOLD_INTO_CREATE[op.action](op);
    return outbox.map((o) =>
      o.tmpId === id ? { ...o, args: { ...o.args, [CREATES[o.action]]: { ...o.args[CREATES[o.action]], ...patch } } } : o,
    );
  }

  // 3. Editing the same row twice: merge into the queued edit rather than
  //    queueing a second one. Every one of these writes absolute values, so the
  //    last instruction is the whole truth.
  if (FOLD_INTO_CREATE[op.action] && id) {
    const at = outbox.findIndex((o) => o.action === op.action && targetId(o) === id);
    if (at >= 0) {
      const prev = outbox[at].args;
      const args = { ...prev, ...op.args };
      // A patch is a partial edit, so the two have to be layered, not replaced —
      // otherwise "rename the bill" then "change its due date" loses the rename.
      if (prev.patch || op.args.patch) args.patch = { ...prev.patch, ...op.args.patch };
      return outbox.map((o, i) => (i === at ? { ...o, args, at: op.at } : o));
    }
  }

  // 4. The same meal cell ticked again — one PUT per cell is enough.
  if (op.action === 'setMeal') {
    const at = outbox.findIndex(
      (o) =>
        o.action === 'setMeal' &&
        dayKey(o.args.date) === dayKey(op.args.date) &&
        o.args.roommateId === op.args.roommateId &&
        o.args.meal === op.args.meal,
    );
    if (at >= 0) return outbox.map((o, i) => (i === at ? { ...o, args: op.args, at: op.at } : o));
  }

  // 5. Config is one shared patch.
  if (op.action === 'updateConfig') {
    const at = outbox.findIndex((o) => o.action === 'updateConfig');
    if (at >= 0) {
      const prev = outbox[at].args.patch || {};
      const next = op.args.patch || {};
      const patch = { ...prev, ...next, ...(prev.budgets || next.budgets ? { budgets: { ...prev.budgets, ...next.budgets } } : {}) };
      return outbox.map((o, i) => (i === at ? { ...o, args: { patch }, at: op.at } : o));
    }
  }

  // 6. Same, for the solo খাতা's opening / budget. Both are absolute values, so
  //    the last instruction is the whole truth and dragging a budget slider
  //    leaves one queued write rather than thirty.
  if (op.action === 'soloConfig') {
    const at = outbox.findIndex((o) => o.action === 'soloConfig');
    if (at >= 0) {
      const patch = { ...(outbox[at].args.patch || {}), ...(op.args.patch || {}) };
      return outbox.map((o, i) => (i === at ? { ...o, args: { patch }, at: op.at } : o));
    }
  }

  // 7. A reset wipes the খাতা, so every solo write still queued behind it is
  //    about to be undone. Sending them first would be pure noise — and worse,
  //    a create that lands AFTER the reset would survive it.
  if (op.action === 'soloReset') {
    return [...outbox.filter((o) => !SOLO_ACTIONS.has(o.action)), op];
  }

  return [...outbox, op];
}

/**
 * Every row the queue is still holding — used to mark them "অপেক্ষায়" in the
 * lists. Meal cells have no stable row id offline, so they get a
 * `meal:<day>:<member>` key of their own.
 */
export function pendingKeys(outbox = []) {
  const keys = new Set();
  outbox.forEach((op) => {
    if (op.tmpId && CREATES[op.action]) keys.add(op.tmpId);
    // Solo creates keep a real id rather than a tmp_ one, so their pending
    // marker is that id — the same one the row already carries on screen.
    if (op.newId) keys.add(op.newId);
    const id = targetId(op);
    if (id) keys.add(id);
    if (op.action === 'setMeal') keys.add(`meal:${dayKey(op.args.date)}:${op.args.roommateId}`);
  });
  return keys;
}
