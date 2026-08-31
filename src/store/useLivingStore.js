import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import livingService from '../services/livingService';
import { ACTIVITY, LOCAL, SEND, SOLO_ACTIONS, TMP_PREFIX, isSoloOp, mergeOp, uid } from './livingOps';

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
// v5 put the solo wallet through that same queue, so it is backed up too.
const STORE_VERSION = 5;

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
 * Offline-FIRST, and backed up. Every write lands on this phone immediately and
 * is then queued for the server exactly like the joint wallet's — the network is
 * never in the way of writing a খরচ down. It used to stop there, device-local by
 * design, which meant reinstalling the app or signing in on another phone lost
 * the ledger. It now syncs, so the খাতা follows the account.
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

// Is there an account to sync to? The solo খাতা works perfectly well without
// one — a guest just keeps writing to the phone, and `hydrateSolo` uploads the
// lot the first time they sign in.
const isLoggedIn = () => !!window.localStorage.getItem('auth:token');

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
       * The single write path for BOTH wallets.
       *
       * Applies the change locally first (so the UI is instant, online or not),
       * then queues it and tries to send. Returns the new row's id for callers
       * that need one.
       *
       * The two wallets differ in exactly two ways here, and nowhere else:
       *
       *   • WHO MAY QUEUE. The shared wallet only syncs once it is a real
       *     server-side household; the solo খাতা syncs as soon as there is an
       *     account to attach it to.
       *   • WHAT THE NEW ROW'S ID IS. A joint create gets a throwaway `tmp_` id
       *     the server replaces (member ids are server-minted and the whole
       *     ledger points at them). A solo create gets a permanent id this phone
       *     mints and the server adopts — one writer, nothing to coordinate.
       */
      _apply: (action, args) => {
        const solo = SOLO_ACTIONS.has(action);
        const op = {
          opId: uid(),
          action,
          args,
          ...(solo ? { newId: uid() } : { tmpId: `${TMP_PREFIX}${uid()}` }),
          meId: get().myId || 'me',
          at: new Date().toISOString(),
        };
        set(LOCAL[action](get(), op));
        const rowId = op.newId || op.tmpId;

        if (solo ? !isLoggedIn() : !get().connected) {
          // Nothing to sync to yet. The joint local planner keeps its own
          // activity log here (a connected wallet gets that written by the
          // server instead); the solo খাতা has no activity feed.
          if (!solo) {
            const line = ACTIVITY[action]?.(op, get());
            if (line) get().pushActivity(...line);
          }
          return rowId;
        }

        set((s) => ({ outbox: mergeOp(s.outbox, op) }));
        get().flushOutbox();
        return rowId;
      },

      /**
       * Send whatever is queued, oldest first, and stop at the first sign the
       * network is gone — order matters, so a failure must not let later
       * operations jump the queue.
       */
      flushOutbox: async () => {
        if (get().flushing) return;
        if (!get().outbox.length || looksOffline()) return;
        if (!isLoggedIn()) return;

        set({ flushing: true });
        try {
          // Re-read the queue each pass: the user can add more while we send.
          while (get().outbox.length) {
            const op = get().outbox[0];
            const solo = isSoloOp(op);
            const drop = () => set((s) => ({ outbox: s.outbox.filter((o) => o.opId !== op.opId) }));

            // A joint op left over from a household this phone is no longer in
            // has nowhere to go. _clearHousehold already prunes these; this is
            // the belt to that braces, so one stale op can't wedge the queue.
            if (!solo && !get().connected) { drop(); continue; }

            let result;
            try {
              result = await SEND[op.action](op);
            } catch (e) {
              // No answer at all, or the server having a bad moment → keep the
              // operation and try again on the next trigger.
              if (e?.offline || e?.retryable) return;
              // The server answered and refused: the row was deleted by a
              // roommate, or the data is no longer valid. Retrying would fail
              // forever, so drop it, say so once, and re-read the truth.
              drop();
              toast.error(e?.message || 'একটি পরিবর্তন সেভ করা যায়নি।');
              await (solo ? get().hydrateSolo() : get().hydrateHousehold());
              // eslint-disable-next-line no-continue
              continue;
            }
            // Drop it BEFORE applying the snapshot — the snapshot already
            // contains this operation, and the apply replays what is left.
            drop();
            if (solo) {
              if (result?.ledger) get().applySolo(result.ledger);
            } else if (result?.household) {
              get().applyHousehold(result.household);
            } else {
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
        // Joint ops only. A solo op replayed here would apply a second time to
        // `state.solo`, which this snapshot never touched — doubling a খরচ the
        // user entered once.
        get().outbox.filter((op) => !isSoloOp(op)).forEach((op) => {
          try {
            set(LOCAL[op.action](get(), op));
          } catch {
            /* a queued op whose target the server no longer has — flush will settle it */
          }
        });
      },

      // Drop back to a fresh local planner (used after leaving a household).
      // The queue's JOINT operations go with it — they belonged to a wallet this
      // phone is no longer part of — but anything queued for the private খাতা
      // stays: it has nothing to do with the household being left.
      _clearHousehold: () =>
        set((s) => ({
          connected: false,
          householdId: null,
          householdName: '',
          inviteCode: '',
          isOwner: false,
          myId: 'me',
          hydrating: false,
          outbox: s.outbox.filter(isSoloOp),
          flushing: false,
          ...blankWallet(),
        })),

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
      // Every action goes through `_apply`, exactly like the joint wallet: the
      // phone first, the queue second. See blankSolo() above.
      solo: blankSolo(),

      // When this phone last agreed with the server about the solo খাতা, and
      // whose খাতা that was. `null` means "the server has never seen this
      // ledger", which is what tells hydrateSolo to UPLOAD rather than
      // download — the one-time path that carries an existing on-device খাতা
      // (or a guest's) up to the account without losing a row.
      soloSyncedAt: null,
      soloUserId: null,

      // Replace the solo slice from a server ledger, then put back whatever
      // this phone has written but not yet sent.
      applySolo: (l) => {
        set({
          solo: {
            opening: l.opening || 0,
            budget: l.budget || 0,
            people: l.people || [],
            entries: l.entries || [],
          },
          soloSyncedAt: new Date().toISOString(),
          soloUserId: l.userId || get().soloUserId,
        });
        get().outbox.filter(isSoloOp).forEach((op) => {
          try {
            set(LOCAL[op.action](get(), op));
          } catch {
            /* a queued op whose target the server no longer has — flush will settle it */
          }
        });
      },

      /**
       * Reconcile the solo খাতা with the server. Never destructive on failure:
       * a refused or unanswered request leaves the phone's copy exactly as it
       * is, which is the whole point of writing locally first.
       *
       * Three cases, in the order they are decided:
       *
       *   1. This phone has a খাতা the server has never seen (`soloSyncedAt`
       *      is null and there is something to send) → MERGE it up. Covers the
       *      user upgrading into a version that syncs, a guest who just signed
       *      in, and a second device that was written on before it ever synced.
       *      The server unions by row id, so neither side loses anything.
       *   2. A different account is signing in on this phone → take the
       *      server's ledger as-is. Merging here would hand one person's খরচ
       *      to another.
       *   3. Otherwise → download and replay whatever is still queued on top.
       */
      hydrateSolo: async (signal) => {
        if (!isLoggedIn()) return; // guest → the phone is the whole story, for now
        try {
          const { ledger } = await livingService.getSolo(signal);
          const local = get().solo || blankSolo();
          const sameUser = !get().soloUserId || !ledger || get().soloUserId === ledger.userId;
          const hasLocalWriting =
            local.entries.length > 0 || local.people.length > 0 || !!local.opening || !!local.budget;

          if (!get().soloSyncedAt && hasLocalWriting && sameUser) {
            const { ledger: merged } = await livingService.mergeSolo(local);
            if (merged) get().applySolo(merged);
          } else if (ledger) {
            if (!sameUser) set({ solo: blankSolo(), outbox: get().outbox.filter((o) => !isSoloOp(o)) });
            get().applySolo(ledger);
          } else {
            // The account has no ledger yet and this phone has nothing to send.
            // Record the handshake so the next write goes straight to the queue.
            set({ soloSyncedAt: new Date().toISOString() });
          }
        } catch {
          return; // offline / hiccup → keep the phone's copy
        }
        // A successful read proves the network is back — send what's waiting.
        get().flushOutbox();
      },

      // People I lend to / borrow from. A "friend profile" exists so the same
      // person's দেনা-পাওনা never gets written under two spellings of a name.
      addPerson: (person) => get()._apply('soloAddPerson', { person }),
      updatePerson: (id, patch) => get()._apply('soloUpdatePerson', { id, patch }),
      // Removes the person AND every entry tied to them — a lend/borrow row is
      // meaningless without the person it points at. The UI confirms the count
      // (and warns about an unsettled balance) before calling this.
      removePerson: (id) => get()._apply('soloRemovePerson', { id }),

      addSoloEntry: (entry) => get()._apply('soloAddEntry', { entry }),
      updateSoloEntry: (id, patch) => get()._apply('soloUpdateEntry', { id, patch }),
      deleteSoloEntry: (id) => get()._apply('soloDeleteEntry', { id }),

      // Cash already in hand before the খাতা started, so "হাতে আছে" is real.
      // Sent as absolute values, never increments, so a replayed queue lands on
      // the same number rather than adding to it.
      setSoloOpening: (v) => get()._apply('soloConfig', { patch: { opening: Number(v) || 0 } }),
      setSoloBudget: (v) => get()._apply('soloConfig', { patch: { budget: Math.max(0, Number(v) || 0) } }),
      resetSolo: () => get()._apply('soloReset', {}),

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
        // v5: the solo খাতা started syncing. Leaving `soloSyncedAt` null is the
        // migration: it marks this device's existing ledger as "the server has
        // never seen this", so the next hydrateSolo uploads it instead of
        // overwriting it with an empty one. Nothing is converted or moved.
        if (version < 5) next = { ...next, soloSyncedAt: null, soloUserId: null };
        return { ...next, _v: STORE_VERSION };
      },
      partialize: (s) => ({
        _v: s._v,
        mode: s.mode,
        solo: s.solo,
        // Without these two the app would forget it had ever synced and try to
        // merge the whole ledger up again on every cold start.
        soloSyncedAt: s.soloSyncedAt,
        soloUserId: s.soloUserId,
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
//
// The boot pass also reconciles the solo খাতা. That is what backs up a ledger
// written before this device ever synced (or while signed out) without waiting
// for the user to happen to open the Living tab — the exact case where "I lost
// everything when I reinstalled" used to happen.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useLivingStore.getState().flushOutbox();
    useLivingStore.getState().hydrateSolo();
  });
  window.setTimeout(() => {
    useLivingStore.getState().flushOutbox();
    useLivingStore.getState().hydrateSolo();
  }, 4000);
}

export default useLivingStore;
