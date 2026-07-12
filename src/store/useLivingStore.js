import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    { id: uid(), type: 'electricity', amount: 3200, dueDate: dayThis(25), status: 'unpaid', paidDate: null, reminder: true },
    { id: uid(), type: 'gas', amount: 1050, dueDate: dayThis(10), status: 'paid', paidDate: dayThis(8), reminder: false },
    { id: uid(), type: 'water', amount: 620, dueDate: dayThis(Math.min(28, now.getDate() + 2)), status: 'unpaid', paidDate: null, reminder: true },
    { id: uid(), type: 'internet', amount: 1500, dueDate: dayThis(5), status: 'paid', paidDate: dayThis(4), reminder: false },
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
    budgets: { grocery: 4000, meal: 8000 }, // monthly caps → drive budget reminders
    expenses,
    groceries,
    meals,
    bills,
    settlements,
    activities,
  };
}

const seed = buildSeed();

const useLivingStore = create(
  persist(
    (set, get) => ({
      _v: STORE_VERSION,
      ...seed,

      // ── activity log ──────────────────────────────────────────────────
      pushActivity: (type, title, detail) =>
        set((s) => ({
          activities: [{ id: uid(), type, title, detail, date: new Date().toISOString() }, ...s.activities].slice(0, 60),
        })),

      // ── roommates ─────────────────────────────────────────────────────
      addRoommate: (name, color) =>
        set((s) => ({ roommates: [...s.roommates, { id: uid(), name: name.trim() || 'Roommate', color: color || '#64748b', isMe: false }] })),

      setMyName: (name) =>
        set((s) => ({ roommates: s.roommates.map((r) => (r.isMe ? { ...r, name: name || r.name } : r)) })),

      // ── expenses ──────────────────────────────────────────────────────
      addExpense: (exp) => {
        const id = uid();
        set((s) => ({ expenses: [{ id, receipt: null, shares: {}, ...exp }, ...s.expenses] }));
        get().pushActivity('expense', 'Expense added', `${exp.note || exp.category} · ৳${Number(exp.amount).toLocaleString('en-BD')}`);
        return id;
      },
      updateExpense: (id, patch) => set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      // ── meals + grocery pot ───────────────────────────────────────────
      setMeal: (dateISO, roommateId, meal, value) =>
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
        }),
      addGrocery: (g) => {
        set((s) => ({ groceries: [{ id: uid(), date: new Date().toISOString(), ...g }, ...s.groceries] }));
        get().pushActivity('meal', 'Grocery added', `${g.note || 'Meal groceries'} · ৳${Number(g.amount).toLocaleString('en-BD')}`);
      },
      deleteGrocery: (id) => set((s) => ({ groceries: s.groceries.filter((g) => g.id !== id) })),

      // ── bills ─────────────────────────────────────────────────────────
      addBill: (bill) => {
        set((s) => ({ bills: [...s.bills, { id: uid(), status: 'unpaid', paidDate: null, reminder: true, ...bill }] }));
        get().pushActivity('bill', 'Bill added', `${bill.type} · ৳${Number(bill.amount).toLocaleString('en-BD')}`);
      },
      markBillPaid: (id) => {
        const bill = get().bills.find((b) => b.id === id);
        set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, status: 'paid', paidDate: new Date().toISOString() } : b)) }));
        if (bill) get().pushActivity('bill', 'Bill paid', `${bill.type} · ৳${Number(bill.amount).toLocaleString('en-BD')}`);
      },
      markBillUnpaid: (id) => set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, status: 'unpaid', paidDate: null } : b)) })),
      toggleBillReminder: (id) => set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, reminder: !b.reminder } : b)) })),

      // ── settlements ───────────────────────────────────────────────────
      addSettlement: (st) => {
        const { roommates } = get();
        const fromR = roommates.find((r) => r.id === st.from);
        const toR = roommates.find((r) => r.id === st.to);
        set((s) => ({ settlements: [{ id: uid(), date: new Date().toISOString(), ...st }, ...s.settlements] }));
        get().pushActivity(
          'settlement',
          'Settlement completed',
          `${fromR?.name || 'Someone'} paid ${toR?.name || 'someone'} ৳${Number(st.amount).toLocaleString('en-BD')} via ${st.method}`
        );
      },

      // ── budgets / rent ────────────────────────────────────────────────
      setRent: (rent) => set({ rent: Math.max(0, Number(rent) || 0) }),
      setBudgets: (patch) => set((s) => ({ budgets: { ...s.budgets, ...patch } })),
      setMonthlyIncome: (v) => set({ monthlyIncome: Math.max(0, Number(v) || 0) }),

      // ── danger zone ───────────────────────────────────────────────────
      resetDemoData: () => set({ ...buildSeed() }),
    }),
    {
      name: 'living-store',
      version: STORE_VERSION,
      partialize: (s) => ({
        _v: s._v,
        roommates: s.roommates,
        rent: s.rent,
        monthlyIncome: s.monthlyIncome,
        budgets: s.budgets,
        expenses: s.expenses,
        groceries: s.groceries,
        meals: s.meals,
        bills: s.bills,
        settlements: s.settlements,
        activities: s.activities,
      }),
    }
  )
);

export default useLivingStore;
