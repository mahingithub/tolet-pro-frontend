/**
 * useHostSyncStore — the landlord's offline write queue.
 * ──────────────────────────────────────────────────────────────────────────
 * Rent is collected on foot, in stairwells, where the signal dies. Every write
 * the host dashboard makes goes in here first: it is applied to the screen
 * immediately, kept in a persisted queue, and sent when the network allows.
 *
 * The queue holds OPERATIONS, not rows — see store/hostOps.js for why, and for
 * the LOCAL/SEND pair each one carries.
 *
 * Two things this store owns that the dashboard cannot:
 *
 *   • **Survival.** The queue is in localStorage, so an app killed in a dead
 *     zone still has this morning's collections when it reopens.
 *   • **Re-application.** The dashboard re-reads bookings from the server every
 *     30 seconds. That refresh used to overwrite an unsent payment and the
 *     money vanished off the screen; `replay()` puts the queue back on top of
 *     every snapshot, so a pending row stays visible until it is really saved.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { LOCAL, SEND, mergeOp, newOpId, opSubject, replayInto } from './hostOps';

const looksOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const useHostSyncStore = create(
  persist(
    (set, get) => ({
      // Operations written on this phone that the server hasn't confirmed.
      queue: [],
      flushing: false,
      // The last thing the server refused, kept so the dashboard can tell the
      // landlord in words instead of dropping the work silently.
      lastError: null,

      // How the queue reaches the dashboard's live state. Registered once by
      // HostDashboard on mount (never persisted — they are functions), so a
      // flush triggered by a reconnect or by boot works without the screen that
      // made the write being the one on top.
      _getWorld: null,
      _setWorld: null,
      _onServer: null,
      configure: ({ getWorld, setWorld, onServer }) =>
        set({ _getWorld: getWorld, _setWorld: setWorld, _onServer: onServer }),

      /**
       * `apply`, for callers that are not the dashboard itself — a modal deep in
       * the tree that has no access to the bookings list. It reads the live
       * world, applies the operation and writes it straight back, so a tenant
       * moved in from a modal appears on the rent register immediately, network
       * or no network.
       */
      applyLive: (action, args) => {
        const world = get()._getWorld?.() || { bookings: [], units: [] };
        const next = get().apply(action, args, world);
        get()._setWorld?.(next);
        return next;
      },

      /**
       * Record a write: apply it locally, queue it, try to send.
       *
       * @param action  a key of LOCAL/SEND in hostOps.js
       * @param args    everything the operation needs, frozen at write time
       * @param world   { bookings, units } as they stand right now
       * @returns the new world, for the caller to put into its own state
       */
      apply: (action, args, world) => {
        const op = { opId: newOpId(), action, args, at: new Date().toISOString() };
        const next = LOCAL[action](world, op);
        set((s) => ({ queue: mergeOp(s.queue, op) }));
        // The caller is about to set this into React state; let it land first so
        // the flush reads the world with this operation already in it.
        setTimeout(() => get().flush(), 0);
        return next;
      },

      /**
       * Queue a write whose local effect the caller has ALREADY made itself.
       * A few screens build their new state in ways the op can't express (a
       * lease edit that also renames the primary occupant, say). They keep that
       * code; the queue just takes responsibility for delivery — and `replay`
       * still re-applies the operation after a server refresh, so the change
       * doesn't disappear while it waits.
       */
      enqueue: (action, args) => {
        const op = { opId: newOpId(), action, args, at: new Date().toISOString() };
        set((s) => ({ queue: mergeOp(s.queue, op) }));
        setTimeout(() => get().flush(), 0);
        return op;
      },

      /**
       * Send what is queued, oldest first. Order matters — two payments toward
       * one month must arrive in the order they were taken — so a failure stops
       * the run rather than letting later operations overtake.
       */
      flush: async () => {
        if (get().flushing || !get().queue.length || looksOffline()) return;
        if (!window.localStorage.getItem('auth:token')) return;

        set({ flushing: true });
        try {
          while (get().queue.length) {
            const op = get().queue[0];
            const getWorld = get()._getWorld;
            const onServer = get()._onServer;
            const world = typeof getWorld === 'function' ? getWorld() : { bookings: [], units: [] };
            let result;
            try {
              result = await SEND[op.action](op, world);
            } catch (e) {
              // No answer, or the server having a bad moment → keep it and try
              // again on the next trigger.
              if (e?.offline || e?.retryable) return;
              // The server answered and refused: the seat filled up while we
              // were away, the row was deleted, the data is no longer valid.
              // Retrying would fail for ever, so drop it and say why — this is
              // the landlord's cue to look at that room again.
              set((s) => ({
                queue: s.queue.filter((o) => o.opId !== op.opId),
                lastError: {
                  message: e?.message || 'সেভ করা যায়নি।',
                  // Which row it was about — a landlord with seventy rooms
                  // cannot act on "the seat is full" alone.
                  subject: opSubject(op),
                  action: op.action,
                  args: op.args,
                  at: new Date().toISOString(),
                },
              }));
              // eslint-disable-next-line no-continue
              continue;
            }
            // Drop it BEFORE handing the response over: the server's copy
            // already contains this operation, and replay() puts back only what
            // is still waiting.
            set((s) => ({ queue: s.queue.filter((o) => o.opId !== op.opId) }));
            onServer?.(result, op);
          }
        } finally {
          set({ flushing: false });
        }
      },

      /** Put whatever is still queued back on top of a fresh server snapshot. */
      replay: (world) => replayInto(world, get().queue),

      clearError: () => set({ lastError: null }),

      /** Leaving the account behind — the queue belongs to that landlord. */
      reset: () => set({ queue: [], flushing: false, lastError: null }),
    }),
    {
      name: 'host-sync-outbox',
      version: 1,
      // `flushing` is deliberately NOT persisted: an app killed mid-send would
      // otherwise come back believing a flush is already running, and never
      // start another one.
      partialize: (s) => ({ queue: s.queue, lastError: s.lastError }),
    },
  ),
);

// ── when to try again ────────────────────────────────────────────────────────
// The dashboard flushes after every write and on each 30-second poll. These two
// cover the rest: the moment the device says it is back online, and once
// shortly after boot — so last night's collections go out even if the landlord
// opens the app on a different screen.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useHostSyncStore.getState().flush();
  });
  window.setTimeout(() => {
    useHostSyncStore.getState().flush();
  }, 5000);
}

export default useHostSyncStore;
