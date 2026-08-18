import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { isOnBackGuardEntry } from './useBackGuard';

/**
 * useTabHistory — makes a tabbed page behave like a real stack of pages for the
 * Back button (hardware Back on Android, the swipe gesture on iOS, and the
 * browser's Back arrow on desktop all end up here).
 *
 * The problem it replaces
 * ──────────────────────
 * The dashboards used to keep the active tab in `useState` and mirror it into
 * the URL with `navigate('?tab=x', { replace: true })`. Two things broke:
 *
 *   1. `replace` overwrites the current history entry, so moving
 *      Dashboard → Bookings created NO entry. Pressing Back from Bookings
 *      skipped the dashboard entirely and left the page (usually to the public
 *      home page) — the landlord lost their place.
 *   2. The state and the URL were two sources of truth kept in sync by
 *      effects, each with its own list of "known" tabs. A tab missing from one
 *      list (documents / analytics / smartAlerts / aiInsights did miss it)
 *      meant Back could change the URL while the rendered tab stayed put.
 *
 * The model
 * ─────────
 * The URL is the ONLY source of truth: `activeTab` is derived from `?tab=`, so
 * a Back/Forward press re-renders the correct tab with no effect to run and no
 * chance of drifting out of sync.
 *
 * Switching tabs PUSHES an entry, so Back retraces the path the user actually
 * took (Rent → Bookings → Dashboard → whatever came before the dashboard),
 * which is what every native app does. The one exception keeps the stack from
 * growing without bound: if the target tab is the entry directly beneath the
 * current one, we go `-1` instead of pushing a duplicate. Bouncing
 * Dashboard ⇄ Bookings therefore stays 1 entry deep forever, and Forward still
 * works, exactly like a browser.
 *
 * `defaultTab` is the section root: it is what an unknown / missing `?tab=`
 * resolves to, so a Back press from it exits the dashboard instead of dead-
 * ending inside it.
 *
 * @param {object}   options
 * @param {string[]} options.tabs       Every valid tab id. Anything else in the
 *   URL falls back to `defaultTab`, so stale links can't render a blank page.
 * @param {string}   options.defaultTab The section root (e.g. 'dashboard').
 * @param {string}   [options.param='tab'] Query-string key to store the tab in.
 * @returns {[string, (tab: string) => void]} `[activeTab, setActiveTab]` — a
 *   drop-in replacement for the `useState` pair it supersedes.
 *
 * @example
 *   const [activeTab, setActiveTab] = useTabHistory({
 *     tabs: ['dashboard', 'bookings', 'rent'],
 *     defaultTab: 'dashboard',
 *   });
 */
export default function useTabHistory({ tabs, defaultTab, param = 'tab' }) {
  const location = useLocation();
  const navigate = useNavigate();
  // 'PUSH' | 'REPLACE' | 'POP' for the navigation that produced the current
  // location. The trail below cannot be maintained without it: a replace must
  // overwrite the entry we are standing on, a push must append after it.
  const navType = useNavigationType();

  // `tabs` is usually an inline array literal, so compare by content rather
  // than by reference or every callback below would be rebuilt each render.
  const tabKey = Array.isArray(tabs) ? tabs.join('|') : '';
  const isValid = useCallback(
    (tab) => !!tab && tabKey.split('|').includes(tab),
    [tabKey],
  );

  const urlTab = useMemo(
    () => new URLSearchParams(location.search).get(param),
    [location.search, param],
  );
  const activeTab = isValid(urlTab) ? urlTab : defaultTab;

  // Rewrite only the tab key so deep-link params ride along untouched.
  const urlForTab = useCallback(
    (tab) => {
      const params = new URLSearchParams(location.search);
      params.set(param, tab);
      return `${location.pathname}?${params.toString()}`;
    },
    [location.pathname, location.search, param],
  );

  // Some callers still ask for a tab through router state
  // (`navigate('/host-dashboard', { state: { activeTab: 'profile' } })`).
  // Promote that to the URL — with `replace`, so it costs no history entry —
  // and the rest of the hook has a single shape to reason about.
  const stateTab = location.state?.activeTab;
  useEffect(() => {
    const wanted = isValid(stateTab) ? stateTab : activeTab;
    if (urlTab === wanted) return;
    navigate(urlForTab(wanted), { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab, stateTab, activeTab]);

  /* ── TRAIL: which tab lives at each history entry we created ──────────────
     This used to be an array indexed by `window.history.state.idx`, which is
     NOT safe here. useBackGuard pushes its throwaway overlay entry with a raw
     `window.history.pushState({ ...base })`, so the new entry inherits the
     `idx` of the one beneath it AND React Router's own in-memory index never
     learns the push happened. Two different entries then claim one index, and
     the `navigate(-1)` shortcut in setActiveTab could fire against an entry
     that was never ours — walking the user clean out of the dashboard.

     `location.key` is the identity that actually holds: React Router mints one
     per entry, stores it in history state and restores it on Back/Forward. So
     keep an ordered trail of the entries this hook has seen plus a cursor at
     the current one, and only ever trust what the trail itself recorded.

     Guard entries need no special handling on the way in: a raw pushState
     clones the state beneath it, so the guard entry carries the SAME key and
     URL as the real entry it shadows and produces no location change at all.
     The one exception is setActiveTab replacing a guard entry — see the flag
     below. */
  const trailRef = useRef([]);
  const cursorRef = useRef(-1);
  // Set by setActiveTab just before it takes over an overlay's throwaway entry
  // with a `replace`. React Router reports that as REPLACE, but for the BROWSER
  // it is a new entry (the overlay's raw push is invisible to the router), so
  // the trail has to record it as a push or it would under-count by one and
  // misidentify everything beneath it.
  const consumedGuardEntryRef = useRef(false);

  useEffect(() => {
    const trail = trailRef.current;
    const seen = trail.findIndex((entry) => entry.key === location.key);

    if (seen >= 0) {
      // Back / Forward onto an entry we already know. Refresh the tab it holds
      // (a replace on it may have changed that) and move the cursor.
      trail[seen].tab = activeTab;
      cursorRef.current = seen;
      return;
    }

    const tookOverGuardEntry = consumedGuardEntryRef.current;
    consumedGuardEntryRef.current = false;

    if (navType === 'REPLACE' && !tookOverGuardEntry && cursorRef.current >= 0) {
      trail[cursorRef.current] = { key: location.key, tab: activeTab };
      return;
    }

    if (navType === 'POP' && !tookOverGuardEntry) {
      // Popped onto an entry we never recorded — a reload, a session restore,
      // or Forward after this page unmounted and wiped the trail. We know
      // nothing about what sits beneath us, so start over rather than guess.
      trail.length = 0;
      trail.push({ key: location.key, tab: activeTab });
      cursorRef.current = 0;
      return;
    }

    trail.length = cursorRef.current + 1; // a push invalidates the forward entries
    trail.push({ key: location.key, tab: activeTab });
    cursorRef.current = trail.length - 1;
  }, [activeTab, location.key, navType]);

  const setActiveTab = useCallback(
    (next) => {
      if (!isValid(next) || next === activeTab) return;

      // Navigating straight out of an open overlay — tapping a nav item in the
      // profile drawer is the everyday case, on desktop as much as on a phone.
      // REPLACE the throwaway entry that overlay pushed instead of stacking on
      // top of it: it is the entry we are standing on, so replacing it turns it
      // into this tab's entry and the page underneath stays exactly one Back
      // press away.
      //
      // It has to be ONE synchronous navigation. The previous version fired a
      // raw `window.history.back()` and then a `navigate()` from a
      // `setTimeout(…, 0)`, and that raced useBackGuard's cleanup: the same
      // click also closes the drawer, and because a history traversal is
      // applied asynchronously the guard still saw its own token on
      // `history.state` and fired a SECOND `history.back()`. Two pops from one
      // click dropped the user two entries below the dashboard — the public
      // home page — while the queued navigate() fired from an already-unmounted
      // component and did nothing. That is the "I tapped Tenants & Rent and
      // landed on the homepage" bug.
      //
      // Replacing also clears the guard token from `history.state`, so the
      // cleanup's own `history.state?.[GUARD_KEY] === token` test correctly
      // reads false and it stands down instead of popping.
      if (isOnBackGuardEntry()) {
        consumedGuardEntryRef.current = true;
        navigate(urlForTab(next), { replace: true });
        return;
      }

      // Returning to the entry right below us is a Back, not a new page. This
      // is what keeps Dashboard ⇄ Bookings ping-ponging 1 entry deep forever.
      // Trusted only for an entry the trail actually recorded, so it can never
      // reach past the tabs we own and leave the dashboard.
      const cursor = cursorRef.current;
      if (cursor > 0 && trailRef.current[cursor - 1]?.tab === next) {
        navigate(-1);
        return;
      }

      navigate(urlForTab(next));
    },
    [activeTab, isValid, navigate, urlForTab],
  );

  return [activeTab, setActiveTab];
}
