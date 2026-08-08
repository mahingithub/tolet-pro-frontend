import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

  // Which tab lives at each history depth. React Router stamps a monotonic
  // `idx` on every entry, so this is a reliable map of the entries we created
  // — entries from other pages simply stay `undefined` and never false-match.
  const stackRef = useRef([]);
  useEffect(() => {
    // `idx` comes from history state, which survives reloads and can be
    // restored as a non-integer (or missing) after a session restore or a
    // cross-origin bounce. Truncating with a bad value throws
    // `RangeError: Invalid array length`, so normalise before using it.
    const rawIdx = window.history.state?.idx;
    const idx = Number.isInteger(rawIdx) && rawIdx >= 0 ? rawIdx : 0;
    stackRef.current.length = idx + 1; // a push invalidates the forward entries
    stackRef.current[idx] = activeTab;
  }, [activeTab, location.key]);

  const setActiveTab = useCallback(
    (next) => {
      if (!isValid(next) || next === activeTab) return;

      // Navigating straight out of an open overlay — tapping a nav item in the
      // mobile drawer is the everyday case. Take over the throwaway entry that
      // overlay pushed instead of stacking on top of it, or it would sit in the
      // middle of the stack and make one Back press look like a no-op.
      if (isOnBackGuardEntry()) {
        // Pop the throwaway drawer entry natively, then push the new tab entry 
        // to React Router so that the previous state is preserved in history.
        window.history.back();
        setTimeout(() => {
          navigate(urlForTab(next));
        }, 0);
        return;
      }

      const rawIdx = window.history.state?.idx;
      const idx = Number.isInteger(rawIdx) && rawIdx >= 0 ? rawIdx : 0;
      // Returning to the entry right below us is a Back, not a new page. This
      // is what keeps Dashboard ⇄ Bookings ping-ponging 1 entry deep forever.
      if (idx > 0 && stackRef.current[idx - 1] === next) {
        navigate(-1);
        return;
      }
      navigate(urlForTab(next));
    },
    [activeTab, isValid, navigate, urlForTab],
  );

  return [activeTab, setActiveTab];
}
