import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import livingService from '../services/livingService';

/**
 * useLivingStore — client-side data layer for the "Living / Roommate Wallet"
 * tab. TO-LET PRO has no roommate / shared-expense backend model yet, so this
 * tab is intentionally self-contained: all state lives here and is persisted to
 * localStorage (via zustand's `persist` middleware, mirroring the existing
 * src/store/usePropertyStore.js convention). Swapping this for a real API later
 * only means replacing the action bodies — the component tree never touches
 * localStorage directly.
 *
 * Everything is stored as plain, JSON-serialisable data (no icons / no React)
 * so the visual config (icons, colours, labels) lives in livingUtils.js and the
 * derived numbers (balances, reports) are computed on read, never stored.
 */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const STORE_VERSION = 1;

// ── date helpers used only for building the demo seed ──────────────────────
const iso = (d) => d.toISOString();
const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth();
const dayThis = (d, h = 12) => iso(new Date(Y, M, d, h, 0, 0));
const daysAgo = (n, h = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return iso(d);
};
// A fixed day in a month `back` months before the current one (0 = this month).
const monthAgo = (back, day, h = 12) => iso(new Date(Y, M - back, day, h, 0, 0));

// Roommates. `me` is always the current user; the display name is overridden
// at render time with the authenticated user's name when available.
const SEED_ROOMMATES = [
  { id: 'me', name: 'You', color: '#ba0036', isMe: true },
  { id: 'r2', name: 'Rakib', color: '#1B8553', isMe: false },
  { id: 'r3', name: 'Tanvir', color: '#2563eb', isMe: false },
  { id: 'r4', name: 'Sadia', color: '#D99B28', isMe: false },
];

const ALL = SEED_ROOMMATES.map((r) => r.id);

function buildSeed() {
  const expenses = [
    { id: uid(), category: 'groceries', amount: 2400, paidBy: 'me', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'Weekly bazaar — rice, veggies', receipt: null, date: dayThis(3) },
    { id: uid(), category: 'wifi', amount: 1200, paidBy: 'r2', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'Monthly broadband', receipt: null, date: dayThis(4) },
    { id: uid(), category: 'maid', amount: 2000, paidBy: 'r3', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'House help salary', receipt: null, date: dayThis(5) },
    { id: uid(), category: 'cleaning', amount: 900, paidBy: 'me', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'Cleaning supplies', receipt: null, date: dayThis(7) },
    { id: uid(), category: 'other', amount: 1600, paidBy: 'r4', splitWith: ['me', 'r2', 'r4'], splitType: 'equal', shares: {}, note: 'Kitchen utensils', receipt: null, date: dayThis(9) },
  ];

  const groceries = [
    { id: uid(), amount: 3000, paidBy: 'me', note: 'Rice, oil, lentils', date: dayThis(2) },
    { id: uid(), amount: 2200, paidBy: 'r2', note: 'Vegetables & fish', date: dayThis(8) },
    { id: uid(), amount: 1800, paidBy: 'r3', note: 'Chicken & spices', date: dayThis(13) },
  ];

  // Meals for the last 7 days — realistic-ish counts per roommate/day.
  const meals = [];
  const pattern = {
    me: [1, 1, 1],
    r2: [0, 1, 1],
    r3: [1, 1, 1],
    r4: [1, 0, 1],
  };
  for (let d = 0; d < 7; d++) {
    ALL.forEach((rid) => {
      const [b, l, s] = pattern[rid];
      // small daily variance so the report looks alive
      const jitter = (d + rid.length) % 3 === 0 ? 0 : 0;
      meals.push({
        id: uid(),
        date: daysAgo(d),
        roommateId: rid,
        breakfast: Math.max(0, b - jitter),
        lunch: l,
        dinner: s,
      });
    });
  }

  const bills = [
    { id: uid(), type: 'electricity', amount: 3200, dueDate: dayThis(25), status: 'unpaid', paidDate: null, reminder: true, paidBy: 'me', recurring: true, createdBy: 'me' },
    { id: uid(), type: 'gas', amount: 1050, dueDate: dayThis(10), status: 'paid', paidDate: dayThis(8), reminder: false, paidBy: 'r2', createdBy: 'r2' },
    { id: uid(), type: 'water', amount: 620, dueDate: dayThis(Math.min(28, now.getDate() + 2)), status: 'unpaid', paidDate: null, reminder: true, paidBy: 'r3', createdBy: 'r3' },
    { id: uid(), type: 'internet', amount: 1500, dueDate: dayThis(5), status: 'paid', paidDate: dayThis(4), reminder: false, paidBy: 'me', recurring: true, createdBy: 'me' },
  ];

  const settlements = [
    { id: uid(), from: 'r2', to: 'me', amount: 1500, method: 'bkash', note: 'Last month share', date: daysAgo(6) },
    { id: uid(), from: 'me', to: 'r3', amount: 800, method: 'cash', note: 'Maid balance', date: daysAgo(3) },
  ];

  // ── prior-month history — gives the Monthly Report trend real variation
  //    (kept modest + mostly settled so current balances stay realistic). ──
  expenses.push(
    { id: uid(), category: 'groceries', amount: 2100, paidBy: 'r2', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'Monthly bazaar', receipt: null, date: monthAgo(1, 6) },
    { id: uid(), category: 'wifi', amount: 1200, paidBy: 'me', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'Broadband', receipt: null, date: monthAgo(1, 4) },
    { id: uid(), category: 'maid', amount: 1900, paidBy: 'r3', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'House help', receipt: null, date: monthAgo(2, 5) },
    { id: uid(), category: 'other', amount: 1300, paidBy: 'me', splitWith: [...ALL], splitType: 'equal', shares: {}, note: 'Repairs', receipt: null, date: monthAgo(2, 12) }
  );
  groceries.push(
    { id: uid(), amount: 2500, paidBy: 'r4', note: 'Groceries', date: monthAgo(1, 8) },
    { id: uid(), amount: 2300, paidBy: 'me', note: 'Groceries', date: monthAgo(2, 10) }
  );
  bills.push(
    { id: uid(), type: 'electricity', amount: 2800, dueDate: monthAgo(1, 25), status: 'paid', paidDate: monthAgo(1, 22), reminder: false },
    { id: uid(), type: 'internet', amount: 1500, dueDate: monthAgo(1, 5), status: 'paid', paidDate: monthAgo(1, 4), reminder: false },
    { id: uid(), type: 'electricity', amount: 2650, dueDate: monthAgo(2, 25), status: 'paid', paidDate: monthAgo(2, 24), reminder: false }
  );
  settlements.push({ id: uid(), from: 'r4', to: 'me', amount: 1200, method: 'nagad', note: 'Prev month share', date: monthAgo(1, 28) });

  // Mess deposits (জমা) — money each member put into the shared meal fund.
  const deposits = [
    { id: uid(), roommateId: 'me', amount: 3000, note: 'মাসের জমা', createdBy: 'me', date: dayThis(2) },
    { id: uid(), roommateId: 'r2', amount: 3000, note: 'মাসের জমা', createdBy: 'r2', date: dayThis(2) },
    { id: uid(), roommateId: 'r3', amount: 2500, note: 'জমা', createdBy: 'r3', date: dayThis(3) },
    { id: uid(), roommateId: 'r4', amount: 2000, note: 'জমা', createdBy: 'r4', date: dayThis(5) },
  ];

  const activities = [
    { id: uid(), type: 'expense', title: 'Expense added', detail: 'Weekly bazaar · ৳2,400', date: dayThis(3) },
    { id: uid(), type: 'bill', title: 'Bill paid', detail: 'Internet · ৳1,500', date: dayThis(4) },
    { id: uid(), type: 'settlement', title: 'Settlement completed', detail: 'Rakib paid you ৳1,500 via bKash', date: daysAgo(6) },
    { id: uid(), type: 'meal', title: 'Meals updated', detail: 'Dinner count synced for 4 roommates', date: daysAgo(1) },
    { id: uid(), type: 'reminder', title: 'Reminder sent', detail: 'Electricity bill due soon', date: daysAgo(1, 9) },
    { id: uid(), type: 'settlement', title: 'Settlement completed', detail: 'You paid Tanvir ৳800 in cash', date: daysAgo(3) },
  ];

  return {
    roommates: [...SEED_ROOMMATES],
    rent: 18000,
    monthlyIncome: 60000, // household budget baseline used for the Savings figure
    mealRate: 0, // 0 = auto (bazar ÷ meals); > 0 = fixed rate the manager set
    budgets: { grocery: 4000, meal: 8000 }, // monthly caps → drive budget reminders
    expenses,
    groceries,
    meals,
    bills,
    settlements,
    deposits,
    activities,
  };
}

const seed = buildSeed();

// Base64 receipt images are never sent to the server (16MB doc cap); only
// short http(s) URLs survive. Local mode keeps the full data URL.
const stripReceipt = (o) =>
  o && typeof o.receipt === 'string' && !/^https?:\/\//i.test(o.receipt) ? { ...o, receipt: null } : o;

// Fire a connected mutation: call the API, then apply the server-authoritative
// household it returns. On failure, surface a toast (the local state is left
// untouched, so the next poll / retry can reconcile).
async function runRemote(get, promise) {
  try {
    const { household } = await promise;
    if (household) get().applyHousehold(household);
    else get()._clearHousehold();
  } catch (e) {
    toast.error(e?.message || 'সিঙ্ক ব্যর্থ হয়েছে। ইন্টারনেট চেক করুন।');
  }
}

const useLivingStore = create(
  persist(
    (set, get) => ({
      _v: STORE_VERSION,
      ...seed,

      // ── connected (household) mode ────────────────────────────────────
      // When `connected` is true the wallet is a real shared household on the
      // server: `myId` is my member id and all data below is server-owned.
      // When false it's the on-device local planner (the seed above).
      connected: false,
      householdId: null,
      householdName: '',
      inviteCode: '',
      isOwner: false,
      myId: 'me',
      hydrating: false,

      // Replace all state from a serialized household (server-authoritative).
      applyHousehold: (h) =>
        set({
          connected: true,
          householdId: h.id,
          householdName: h.name,
          inviteCode: h.inviteCode,
          isOwner: !!h.isOwner,
          myId: h.me || 'me',
          roommates: h.roommates || [],
          rent: h.rent || 0,
          monthlyIncome: h.monthlyIncome || 0,
          mealRate: h.mealRate || 0,
          budgets: h.budgets || { grocery: 0, meal: 0 },
          expenses: h.expenses || [],
          bills: h.bills || [],
          meals: h.meals || [],
          groceries: h.groceries || [],
          deposits: h.deposits || [],
          settlements: h.settlements || [],
          activities: h.activities || [],
          hydrating: false,
        }),

      // Drop back to a fresh local planner (used after leaving a household).
      _clearHousehold: () =>
        set({
          connected: false,
          householdId: null,
          householdName: '',
          inviteCode: '',
          isOwner: false,
          myId: 'me',
          hydrating: false,
          ...buildSeed(),
        }),

      // Load the caller's household from the server (call on mount + polling).
      // Never destructive on failure — keeps the last-known (offline) cache.
      hydrateHousehold: async (signal) => {
        if (!window.localStorage.getItem('auth:token')) return; // guest → stay local
        set({ hydrating: true });
        try {
          const { household } = await livingService.getHousehold(signal);
          if (household) get().applyHousehold(household);
          else if (get().connected) get()._clearHousehold(); // removed elsewhere
          else set({ connected: false, myId: 'me', hydrating: false });
        } catch {
          set({ hydrating: false });
        }
      },

      createHousehold: async (name) => {
        const { household } = await livingService.createHousehold(name);
        get().applyHousehold(household);
        return household;
      },
      joinHousehold: async (code) => {
        const { household } = await livingService.joinHousehold(code);
        get().applyHousehold(household);
        return household;
      },
      leaveHousehold: async () => {
        try { await livingService.leaveHousehold(); } catch { /* leave locally anyway */ }
        get()._clearHousehold();
      },
      regenerateCode: async () => {
        const { household } = await livingService.regenerateCode();
        get().applyHousehold(household);
        return household;
      },

      // ── activity log (local-only; server auto-logs its own) ───────────
      pushActivity: (type, title, detail) =>
        set((s) => ({
          activities: [{ id: uid(), type, title, detail, date: new Date().toISOString() }, ...s.activities].slice(0, 60),
        })),

      // ── roommates ─────────────────────────────────────────────────────
      addRoommate: (name, color) => {
        if (get().connected) { runRemote(get, livingService.addMember(name, color)); return; }
        set((s) => ({ roommates: [...s.roommates, { id: uid(), name: name.trim() || 'Roommate', color: color || '#64748b', isMe: false }] }));
      },
      removeRoommate: (id) => {
        if (get().connected) { runRemote(get, livingService.removeMember(id)); return; }
        set((s) => ({ roommates: s.roommates.filter((r) => r.id !== id) }));
      },
      // Only meaningful for the local planner — connected member names come
      // from each user's real account.
      setMyName: (name) => {
        if (get().connected) return;
        set((s) => ({ roommates: s.roommates.map((r) => (r.isMe ? { ...r, name: name || r.name } : r)) }));
      },

      // ── expenses ──────────────────────────────────────────────────────
      addExpense: (exp) => {
        if (get().connected) { runRemote(get, livingService.addExpense(stripReceipt(exp))); return undefined; }
        const id = uid();
        set((s) => ({ expenses: [{ id, receipt: null, shares: {}, createdBy: 'me', ...exp }, ...s.expenses] }));
        get().pushActivity('expense', 'Expense added', `${exp.note || exp.category} · ৳${Number(exp.amount).toLocaleString('en-BD')}`);
        return id;
      },
      updateExpense: (id, patch) => {
        if (get().connected) { runRemote(get, livingService.updateExpense(id, stripReceipt(patch))); return; }
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
      },
      deleteExpense: (id) => {
        if (get().connected) { runRemote(get, livingService.deleteExpense(id)); return; }
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
      },

      // ── meals + grocery pot ───────────────────────────────────────────
      setMeal: (dateISO, roommateId, meal, value) => {
        if (get().connected) { runRemote(get, livingService.setMeal({ date: dateISO, roommateId, meal, value })); return; }
        set((s) => {
          const dayKey = dateISO.slice(0, 10);
          const existing = s.meals.find((m) => m.date.slice(0, 10) === dayKey && m.roommateId === roommateId);
          const v = Math.max(0, value);
          if (existing) {
            return { meals: s.meals.map((m) => (m.id === existing.id ? { ...m, [meal]: v } : m)) };
          }
          return {
            meals: [
              ...s.meals,
              { id: uid(), date: new Date(dayKey + 'T12:00:00').toISOString(), roommateId, breakfast: 0, lunch: 0, dinner: 0, [meal]: v },
            ],
          };
        });
      },
      addGrocery: (g) => {
        if (get().connected) { runRemote(get, livingService.addGrocery(g)); return; }
        set((s) => ({ groceries: [{ id: uid(), date: new Date().toISOString(), createdBy: 'me', ...g }, ...s.groceries] }));
        get().pushActivity('meal', 'Grocery added', `${g.note || 'Meal groceries'} · ৳${Number(g.amount).toLocaleString('en-BD')}`);
      },
      deleteGrocery: (id) => {
        if (get().connected) { runRemote(get, livingService.deleteGrocery(id)); return; }
        set((s) => ({ groceries: s.groceries.filter((g) => g.id !== id) }));
      },

      // ── bills ─────────────────────────────────────────────────────────
      addBill: (bill) => {
        if (get().connected) { runRemote(get, livingService.addBill(bill)); return; }
        set((s) => ({ bills: [...s.bills, { id: uid(), status: 'unpaid', paidDate: null, reminder: true, createdBy: 'me', ...bill }] }));
        get().pushActivity('bill', 'Bill added', `${bill.type} · ৳${Number(bill.amount).toLocaleString('en-BD')}`);
      },
      // Edit a bill's details (type / amount / due date / reminder). Creator-only
      // in connected mode — the server enforces it too.
      updateBill: (id, patch) => {
        if (get().connected) { runRemote(get, livingService.updateBill(id, patch)); return; }
        set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
      },
      deleteBill: (id) => {
        if (get().connected) { runRemote(get, livingService.deleteBill(id)); return; }
        set((s) => ({ bills: s.bills.filter((b) => b.id !== id) }));
      },
      markBillPaid: (id) => {
        if (get().connected) { runRemote(get, livingService.updateBill(id, { status: 'paid' })); return; }
        const bill = get().bills.find((b) => b.id === id);
        const meId = get().myId || 'me';
        // Attribute the payment (default: me) so it flows into the balances ledger.
        set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, status: 'paid', paidDate: new Date().toISOString(), paidBy: b.paidBy || meId } : b)) }));
        if (bill) get().pushActivity('bill', 'Bill paid', `${bill.type} · ৳${Number(bill.amount).toLocaleString('en-BD')}`);
      },
      markBillUnpaid: (id) => {
        if (get().connected) { runRemote(get, livingService.updateBill(id, { status: 'unpaid' })); return; }
        set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, status: 'unpaid', paidDate: null } : b)) }));
      },
      toggleBillReminder: (id) => {
        if (get().connected) {
          const bill = get().bills.find((b) => b.id === id);
          runRemote(get, livingService.updateBill(id, { reminder: !(bill && bill.reminder) }));
          return;
        }
        set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, reminder: !b.reminder } : b)) }));
      },

      // ── settlements ───────────────────────────────────────────────────
      addSettlement: (st) => {
        if (get().connected) { runRemote(get, livingService.addSettlement(st)); return; }
        const { roommates } = get();
        const fromR = roommates.find((r) => r.id === st.from);
        const toR = roommates.find((r) => r.id === st.to);
        set((s) => ({ settlements: [{ id: uid(), date: new Date().toISOString(), createdBy: 'me', ...st }, ...s.settlements] }));
        get().pushActivity(
          'settlement',
          'Settlement completed',
          `${fromR?.name || 'Someone'} paid ${toR?.name || 'someone'} ৳${Number(st.amount).toLocaleString('en-BD')} via ${st.method}`
        );
      },
      deleteSettlement: (id) => {
        if (get().connected) { runRemote(get, livingService.deleteSettlement(id)); return; }
        set((s) => ({ settlements: s.settlements.filter((x) => x.id !== id) }));
      },

      // ── mess deposits (জমা) ────────────────────────────────────────────
      addDeposit: (d) => {
        if (get().connected) { runRemote(get, livingService.addDeposit(d)); return; }
        const who = get().roommates.find((r) => r.id === d.roommateId);
        set((s) => ({ deposits: [{ id: uid(), createdBy: 'me', date: new Date().toISOString(), ...d }, ...s.deposits] }));
        get().pushActivity('meal', 'Deposit added', `${who?.name || 'Someone'} deposited ৳${Number(d.amount).toLocaleString('en-BD')}`);
      },
      deleteDeposit: (id) => {
        if (get().connected) { runRemote(get, livingService.deleteDeposit(id)); return; }
        set((s) => ({ deposits: s.deposits.filter((x) => x.id !== id) }));
      },

      // ── budgets / rent ────────────────────────────────────────────────
      setRent: (rent) => {
        if (get().connected) { runRemote(get, livingService.updateConfig({ rent: Math.max(0, Number(rent) || 0) })); return; }
        set({ rent: Math.max(0, Number(rent) || 0) });
      },
      setBudgets: (patch) => {
        if (get().connected) { runRemote(get, livingService.updateConfig({ budgets: patch })); return; }
        set((s) => ({ budgets: { ...s.budgets, ...patch } }));
      },
      setMonthlyIncome: (v) => {
        if (get().connected) { runRemote(get, livingService.updateConfig({ monthlyIncome: Math.max(0, Number(v) || 0) })); return; }
        set({ monthlyIncome: Math.max(0, Number(v) || 0) });
      },
      // Fixed meal rate (৳/meal). Pass 0 to go back to auto (bazar ÷ meals).
      setMealRate: (v) => {
        const val = Math.max(0, Number(v) || 0);
        if (get().connected) { runRemote(get, livingService.updateConfig({ mealRate: val })); return; }
        set({ mealRate: val });
      },

      // ── danger zone (local planner only) ──────────────────────────────
      resetDemoData: () => {
        if (get().connected) return;
        set({ ...buildSeed() });
      },
    }),
    {
      name: 'living-store',
      version: STORE_VERSION,
      partialize: (s) => ({
        _v: s._v,
        connected: s.connected,
        householdId: s.householdId,
        householdName: s.householdName,
        inviteCode: s.inviteCode,
        isOwner: s.isOwner,
        myId: s.myId,
        roommates: s.roommates,
        rent: s.rent,
        monthlyIncome: s.monthlyIncome,
        mealRate: s.mealRate,
        budgets: s.budgets,
        expenses: s.expenses,
        groceries: s.groceries,
        meals: s.meals,
        bills: s.bills,
        settlements: s.settlements,
        deposits: s.deposits,
        activities: s.activities,
      }),
    }
  )
);

export default useLivingStore;
