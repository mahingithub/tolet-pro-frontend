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

// v2 removed the built-in demo/seed data — the wallet now starts empty.
const STORE_VERSION = 2;

// A brand-new Roommate Wallet starts completely empty — no demo/seed data.
// The local planner contains only the current user ("You", the display name is
// overridden at render time with the authenticated user's name); every roommate,
// expense, bill, meal and settlement is added by the user themselves. When they
// create or join a shared household the server becomes the source of truth.
function blankWallet() {
  return {
    roommates: [{ id: 'me', name: 'You', color: '#ba0036', isMe: true }],
    rent: 0,
    monthlyIncome: 0,
    mealRate: 0, // 0 = auto (bazar ÷ meals); > 0 = fixed rate the manager set
    budgets: { grocery: 0, meal: 0 }, // monthly caps → drive budget reminders
    expenses: [],
    groceries: [],
    meals: [],
    bills: [],
    settlements: [],
    deposits: [],
    activities: [],
  };
}

const seed = blankWallet();

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
      // When false it's the on-device local planner (starts empty — blankWallet above).
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
          ...blankWallet(),
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
      // Dismiss the shared wallet. Requires the login password (verified
      // server-side). We do NOT swallow errors here: a wrong password must keep
      // the user in the household, so the caller surfaces the failure.
      leaveHousehold: async (password) => {
        await livingService.leaveHousehold(password);
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
      // Record a payment toward a bill. `amount` >= total → fully paid; 0 <
      // amount < total → partial ("half") payment; 0 → back to unpaid. The
      // server recomputes status from paidAmount; local mode mirrors that.
      payBill: (id, amount) => {
        const amt = Math.max(0, Number(amount) || 0);
        if (get().connected) { runRemote(get, livingService.updateBill(id, { paidAmount: amt })); return; }
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) return;
        const total = Number(bill.amount) || 0;
        const capped = Math.min(total, amt);
        const meId = get().myId || 'me';
        let status;
        let paidDate;
        if (capped <= 0) { status = 'unpaid'; paidDate = null; }
        else if (capped >= total) { status = 'paid'; paidDate = new Date().toISOString(); }
        else { status = 'partial'; paidDate = new Date().toISOString(); }
        set((s) => ({
          bills: s.bills.map((b) => (b.id === id ? { ...b, status, paidAmount: capped, paidDate, paidBy: b.paidBy || meId } : b)),
        }));
        const fmt = (n) => Number(n).toLocaleString('en-BD');
        const label = status === 'paid' ? 'Bill paid' : status === 'partial' ? 'Bill part-paid' : 'Bill updated';
        const detail = status === 'partial' ? `${bill.type} · ৳${fmt(capped)} / ৳${fmt(total)}` : `${bill.type} · ৳${fmt(capped || total)}`;
        get().pushActivity('bill', label, detail);
      },
      markBillPaid: (id) => {
        const bill = get().bills.find((b) => b.id === id);
        get().payBill(id, Number(bill?.amount) || 0);
      },
      markBillUnpaid: (id) => { get().payBill(id, 0); },
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
      // Clears the local planner back to an empty wallet (only "You").
      resetDemoData: () => {
        if (get().connected) return;
        set({ ...blankWallet() });
      },
    }),
    {
      name: 'living-store',
      version: STORE_VERSION,
      // v1 shipped a rich demo (fake roommates + expenses/bills/meals). v2 starts
      // empty, so wipe that demo out of any existing LOCAL planner. Connected
      // wallets hold real, server-synced data → leave them (they re-hydrate from
      // the server on next load anyway).
      migrate: (persisted, version) => {
        if (persisted && version < 2 && !persisted.connected) {
          return { ...persisted, _v: STORE_VERSION, ...blankWallet() };
        }
        return persisted;
      },
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
