import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import livingService from '../services/livingService';
import { ACTIVITY, LOCAL, SEND, TMP_PREFIX, mergeOp, uid } from './livingOps';

/**
 * useLivingStore — client-side data layer for the "Living / Roommate Wallet"
 * tab: the on-device local planner, the connected shared household, and the
 * solo খাতা, all in one persisted store (zustand's `persist` middleware,
 * mirroring src/store/usePropertyStore.js). The component tree never touches
 * localStorage directly.
 *
 * Everything is stored as plain, JSON-serialisable data (no icons / no React)
 * so the visual config (icons, colours, labels) lives in livingUtils.js and the
 * derived numbers (balances, reports) are computed on read, never stored.
 *
 * ── How a write works ──────────────────────────────────────────────────────
 * Every mutation goes through `_apply(action, args)`, which:
 *
 *   1. writes the change to THIS phone immediately (LOCAL in livingOps.js), so
 *      the screen never waits for a network round trip;
 *   2. for a connected wallet, queues the operation in `outbox` and tries to
 *      send it.
 *
 * If the send fails because there is no network, the operation simply stays in
 * the queue — the user's meal tick or bazar entry is already saved on the phone
 * and goes out the moment the connection returns. When a server snapshot lands,
 * `applyHousehold` replaces local state with it and replays whatever is still
 * queued on top, so a pending entry never disappears from under the user.
 */

// v2 removed the built-in demo/seed data — the wallet now starts empty.
// v3 added the SOLO wallet (living alone) alongside the joint/mess wallet.
// v4 added the offline write queue (`outbox`).
const STORE_VERSION = 4;

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

/**
 * The SOLO wallet — for someone living alone who just wants their own খাতা:
 * what they spent, what came in, and who they lent to / borrowed from. It is a
 * completely separate slice from the joint wallet above, so switching modes
 * never touches the other side's numbers.
 *
 * Deliberately DEVICE-LOCAL and never synced: a personal ledger is private, and
 * keeping it off the wire is what lets it work with no internet at all (the
 * `persist` middleware below writes it straight to localStorage).
 */
function blankSolo() {
  return {
    opening: 0, // cash already in hand before the first entry was logged
    budget: 0, // monthly spending cap (0 = off) → drives the budget meter
    people: [], // { id, name, color, phone, note, createdAt }
    entries: [], // { id, type, amount, category, personId, note, method, date }
  };
}

const seed = blankWallet();

// Is the browser telling us it has no connection? Only ever used to skip a
// pointless attempt — `navigator.onLine` lies often enough (captive portals,
// dead Wi-Fi) that the real proof of being offline is a failed request.
const looksOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// Fire a household-lifecycle call (create / join / leave / members). These are
// NOT queueable: they hand out server-generated member ids that the whole ledger
// references, so inventing one on a phone would corrupt every split that used it.
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

      // ── which wallet is on screen ─────────────────────────────────────
      // 'solo'  → my own খাতা (living alone)
      // 'joint' → the shared roommate / mess wallet
      // null    → not chosen yet; Living shows the picker first.
      // Switching is free and non-destructive: the two slices never overlap.
      mode: null,
      setLivingMode: (mode) => set({ mode: mode === 'solo' ? 'solo' : 'joint' }),

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

      // ── offline write queue ───────────────────────────────────────────
      // Operations written on this phone that the server hasn't confirmed yet.
      // Persisted with everything else, so closing the app — or the battery
      // dying — in the middle of a dead zone loses nothing.
      outbox: [],
      flushing: false,

      /**
       * The single write path for the whole wallet.
       *
       * Applies the change locally first (so the UI is instant, online or not),
       * then — for a connected wallet — queues it and tries to send. Returns the
       * new row's temporary id for callers that need one.
       */
      _apply: (action, args) => {
        const op = {
          opId: uid(),
          action,
          args,
          tmpId: `${TMP_PREFIX}${uid()}`,
          meId: get().myId || 'me',
          at: new Date().toISOString(),
        };
        set(LOCAL[action](get(), op));

        if (!get().connected) {
          // Local planner: nothing to sync, but it keeps its own activity log
          // (a connected wallet gets that written by the server instead).
          const line = ACTIVITY[action]?.(op, get());
          if (line) get().pushActivity(...line);
          return op.tmpId;
        }

        set((s) => ({ outbox: mergeOp(s.outbox, op) }));
        get().flushOutbox();
        return op.tmpId;
      },

      /**
       * Send whatever is queued, oldest first, and stop at the first sign the
       * network is gone — order matters, so a failure must not let later
       * operations jump the queue.
       */
      flushOutbox: async () => {
        if (get().flushing || !get().connected) return;
        if (!get().outbox.length || looksOffline()) return;
        if (!window.localStorage.getItem('auth:token')) return;

        set({ flushing: true });
        try {
          // Re-read the queue each pass: the user can add more while we send.
          while (get().outbox.length) {
            const op = get().outbox[0];
            let household;
            try {
              ({ household } = await SEND[op.action](op));
            } catch (e) {
              // No answer at all, or the server having a bad moment → keep the
              // operation and try again on the next trigger.
              if (e?.offline || e?.retryable) return;
              // The server answered and refused: the row was deleted by a
              // roommate, or the data is no longer valid. Retrying would fail
              // forever, so drop it, say so once, and re-read the truth.
              set((s) => ({ outbox: s.outbox.filter((o) => o.opId !== op.opId) }));
              toast.error(e?.message || 'একটি পরিবর্তন সেভ করা যায়নি।');
              await get().hydrateHousehold();
              // eslint-disable-next-line no-continue
              continue;
            }
            // Drop it BEFORE applying the snapshot — the snapshot already
            // contains this operation, and applyHousehold replays what is left.
            set((s) => ({ outbox: s.outbox.filter((o) => o.opId !== op.opId) }));
            if (household) get().applyHousehold(household);
            else {
              get()._clearHousehold();
              return;
            }
          }
        } finally {
          set({ flushing: false });
        }
      },

      // Replace all state from a serialized household (server-authoritative),
      // then put back whatever this phone has written but not yet sent — the
      // server's copy can't know about those, and they must not vanish.
      applyHousehold: (h) => {
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
        });
        get().outbox.forEach((op) => {
          try {
            set(LOCAL[op.action](get(), op));
          } catch {
            /* a queued op whose target the server no longer has — flush will settle it */
          }
        });
      },

      // Drop back to a fresh local planner (used after leaving a household).
      // The queue goes with it: those operations belonged to a wallet this
      // phone is no longer part of.
      _clearHousehold: () =>
        set({
          connected: false,
          householdId: null,
          householdName: '',
          inviteCode: '',
          isOwner: false,
          myId: 'me',
          hydrating: false,
          outbox: [],
          flushing: false,
          ...blankWallet(),
        }),

      // Load the caller's household from the server (call on mount + polling).
      // Never destructive on failure — keeps the last-known (offline) cache,
      // which is what makes the wallet readable with no connection at all.
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
          return;
        }
        // A successful read proves the network is back — send what's waiting.
        get().flushOutbox();
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
      // Deliberately NOT queued for offline. A member's id is the identity every
      // expense split, meal row and settlement points at, and only the server can
      // mint one. A phone that invented an id offline would hand out splits
      // referring to a person who doesn't exist yet. Adding a person to a shared
      // room therefore needs a connection; everything you then record about them
      // does not.
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

      // ── the ledger ────────────────────────────────────────────────────
      // Every one of these is the same shape: hand the operation to `_apply`,
      // which writes it to this phone and — when connected — queues it for the
      // server. There is no separate "online" branch any more, which is exactly
      // why they all keep working with the network gone.
      addExpense: (exp) => get()._apply('addExpense', { exp }),
      updateExpense: (id, patch) => get()._apply('updateExpense', { id, patch }),
      deleteExpense: (id) => get()._apply('deleteExpense', { id }),

      setMeal: (dateISO, roommateId, meal, value) =>
        get()._apply('setMeal', { date: dateISO, roommateId, meal, value }),
      addGrocery: (g) => get()._apply('addGrocery', { g }),
      deleteGrocery: (id) => get()._apply('deleteGrocery', { id }),

      addBill: (bill) => get()._apply('addBill', { bill }),
      // Edit a bill's details (type / amount / due date / reminder). Open to every
      // member — we just stamp who last edited it (editedBy).
      updateBill: (id, patch) => get()._apply('updateBill', { id, patch }),
      deleteBill: (id) => get()._apply('deleteBill', { id }),
      // Record a payment toward a bill. `amount` >= total → fully paid; 0 <
      // amount < total → partial ("half") payment; 0 → back to unpaid. The
      // amount is absolute, never an increment — which is what makes it safe for
      // two roommates to mark the same bill paid offline: the second one to
      // reach the server sets the same value, it doesn't add to it.
      payBill: (id, amount) => get()._apply('payBill', { id, amount: Math.max(0, Number(amount) || 0) }),
      markBillPaid: (id) => {
        const bill = get().bills.find((b) => b.id === id);
        get().payBill(id, Number(bill?.amount) || 0);
      },
      markBillUnpaid: (id) => { get().payBill(id, 0); },
      // Resolved to an absolute value here, not stored as "flip it" — a toggle
      // replayed twice would land back where it started.
      toggleBillReminder: (id) => {
        const bill = get().bills.find((b) => b.id === id);
        get()._apply('setBillReminder', { id, reminder: !(bill && bill.reminder) });
      },

      addSettlement: (st) => get()._apply('addSettlement', { st }),
      deleteSettlement: (id) => get()._apply('deleteSettlement', { id }),

      // mess deposits (জমা)
      addDeposit: (d) => get()._apply('addDeposit', { d }),
      deleteDeposit: (id) => get()._apply('deleteDeposit', { id }),

      // ── budgets / rent ────────────────────────────────────────────────
      setRent: (rent) => get()._apply('updateConfig', { patch: { rent: Math.max(0, Number(rent) || 0) } }),
      setBudgets: (patch) => get()._apply('updateConfig', { patch: { budgets: patch } }),
      setMonthlyIncome: (v) => get()._apply('updateConfig', { patch: { monthlyIncome: Math.max(0, Number(v) || 0) } }),
      // Fixed meal rate (৳/meal). Pass 0 to go back to auto (bazar ÷ meals).
      setMealRate: (v) => get()._apply('updateConfig', { patch: { mealRate: Math.max(0, Number(v) || 0) } }),

      // ── solo wallet (living alone) ────────────────────────────────────
      // Never goes to the server — see blankSolo() above. Every action is a
      // plain local `set`, so the whole solo wallet keeps working with the
      // phone in flight mode.
      solo: blankSolo(),

      // People I lend to / borrow from. A "friend profile" exists so the same
      // person's দেনা-পাওনা never gets written under two spellings of a name.
      addPerson: (person) => {
        const id = uid();
        set((s) => ({
          solo: {
            ...s.solo,
            people: [
              ...s.solo.people,
              {
                id,
                name: 'Friend',
                color: '#64748b',
                phone: '',
                note: '',
                createdAt: new Date().toISOString(),
                ...person,
              },
            ],
          },
        }));
        return id;
      },
      updatePerson: (id, patch) =>
        set((s) => ({
          solo: { ...s.solo, people: s.solo.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) },
        })),
      // Removes the person AND every entry tied to them — a lend/borrow row is
      // meaningless without the person it points at. The UI confirms the count
      // (and warns about an unsettled balance) before calling this.
      removePerson: (id) =>
        set((s) => ({
          solo: {
            ...s.solo,
            people: s.solo.people.filter((p) => p.id !== id),
            entries: s.solo.entries.filter((e) => e.personId !== id),
          },
        })),

      addSoloEntry: (entry) => {
        const id = uid();
        set((s) => ({
          solo: {
            ...s.solo,
            entries: [
              {
                id,
                type: 'expense',
                amount: 0,
                category: 'other',
                personId: null,
                note: '',
                method: 'cash',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                ...entry,
              },
              ...s.solo.entries,
            ],
          },
        }));
        return id;
      },
      updateSoloEntry: (id, patch) =>
        set((s) => ({
          solo: {
            ...s.solo,
            entries: s.solo.entries.map((e) =>
              e.id === id ? { ...e, ...patch, editedAt: new Date().toISOString() } : e
            ),
          },
        })),
      deleteSoloEntry: (id) =>
        set((s) => ({ solo: { ...s.solo, entries: s.solo.entries.filter((e) => e.id !== id) } })),

      // Cash already in hand before the খাতা started, so "হাতে আছে" is real.
      setSoloOpening: (v) => set((s) => ({ solo: { ...s.solo, opening: Number(v) || 0 } })),
      setSoloBudget: (v) => set((s) => ({ solo: { ...s.solo, budget: Math.max(0, Number(v) || 0) } })),
      resetSolo: () => set({ solo: blankSolo() }),

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
        if (!persisted) return persisted;
        let next = persisted;
        if (version < 2 && !next.connected) next = { ...next, ...blankWallet() };
        if (version < 3) {
          // v3 splits Living into two wallets. Someone already running a shared
          // wallet keeps it (no picker in their face on next open); a device
          // with nothing in it gets asked which way they live.
          const usedJoint =
            !!next.connected ||
            (next.roommates || []).length > 1 ||
            ['expenses', 'bills', 'meals', 'groceries', 'deposits', 'settlements'].some(
              (k) => (next[k] || []).length > 0
            );
          next = { ...next, mode: usedJoint ? 'joint' : null, solo: next.solo || blankSolo() };
        }
        // v4: the offline write queue. Nothing to convert — an upgrading device
        // has no pending work, because before v4 a write that failed was simply
        // dropped rather than kept.
        if (version < 4) next = { ...next, outbox: [] };
        return { ...next, _v: STORE_VERSION };
      },
      partialize: (s) => ({
        _v: s._v,
        mode: s.mode,
        solo: s.solo,
        // Queued work survives a reload, an app kill, and a flat battery — it is
        // the user's writing, and it hasn't reached anyone else yet.
        outbox: s.outbox,
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

// ── when to try the queue again ──────────────────────────────────────────────
// Living itself flushes on mount, on every poll and after each write. These two
// cover the rest: the moment the device says it's back online, and once shortly
// after boot — so work queued last night goes out even if the user opens the app
// on some other screen and never visits the wallet.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useLivingStore.getState().flushOutbox();
  });
  window.setTimeout(() => {
    useLivingStore.getState().flushOutbox();
  }, 4000);
}

export default useLivingStore;
