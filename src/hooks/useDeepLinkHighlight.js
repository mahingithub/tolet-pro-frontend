import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * useDeepLinkHighlight — makes a notification click land on the SPECIFIC row
 * it refers to, not just the right tab.
 *
 * The problem it solves
 * ─────────────────────
 * When the user taps a notification, `NotificationPanel` navigates to the
 * relevant dashboard tab and passes `location.state.highlightId` (the
 * inquiry / booking / rent / application / receipt id — i.e. the
 * notification's `data.targetId`). The dashboards already stamp a matching DOM
 * id on every list row:
 *
 *   HostDashboard :  #inquiry-<id>  #booking-<id>  #rent-<id>
 *   TenantDashboard: #application-<id>  #receipt-<id>  #payment-<id>
 *
 * …but nothing ever *read* `highlightId`, so the user was dropped at the top
 * of a tab and had to hunt for the item. This hook closes that gap: it finds
 * the row, scrolls it into view and flashes a highlight ring.
 *
 * Because the target list is usually fetched asynchronously, we can't assume
 * the row is in the DOM on the first tick — so we poll briefly until it shows
 * up (or give up after a few seconds).
 */

// Row-id prefixes the dashboards assign. A notification's targetId is matched
// against each so the hook stays tab-agnostic: whichever row exists wins.
const CANDIDATE_PREFIXES = ['inquiry', 'application', 'booking', 'rent', 'payment', 'receipt'];

const cssEscape = (value) => {
  const v = String(value);
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(v);
  }
  // Fallback: escape anything that isn't a safe identifier char.
  return v.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
};

/** Build a selector that matches any dashboard row carrying this target id. */
export const buildTargetSelector = (id) => {
  const safe = cssEscape(id);
  return [
    ...CANDIDATE_PREFIXES.map((p) => `#${p}-${safe}`),
    `[data-notif-target="${safe}"]`,
  ].join(',');
};

/**
 * Imperatively scroll to + briefly highlight the row for `id`. Safe to call
 * even if the row hasn't rendered yet — it polls for a short window.
 *
 * @param {string} id                 target row id (notification data.targetId)
 * @param {object} [opts]
 * @param {number} [opts.attempts=30] max poll attempts
 * @param {number} [opts.interval=150] ms between attempts
 * @returns {() => void} a cleanup fn that cancels any pending poll/timeout
 */
export const highlightNotifTarget = (id, { attempts = 30, interval = 150 } = {}) => {
  if (!id || typeof document === 'undefined') return () => {};

  const selector = buildTargetSelector(id);
  let tries = 0;
  let poll = null;
  let clearHighlight = null;

  const focus = () => {
    let el = null;
    try {
      el = document.querySelector(selector);
    } catch {
      el = null;
    }
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('notif-deeplink-highlight');
    clearHighlight = setTimeout(() => {
      el.classList.remove('notif-deeplink-highlight');
    }, 2600);
    return true;
  };

  if (!focus()) {
    poll = setInterval(() => {
      tries += 1;
      if (focus() || tries >= attempts) {
        clearInterval(poll);
        poll = null;
      }
    }, interval);
  }

  return () => {
    if (poll) clearInterval(poll);
    if (clearHighlight) clearTimeout(clearHighlight);
  };
};

/**
 * Hook form: watches `location.state.highlightId` and highlights the row on
 * navigation. Drop a single `useDeepLinkHighlight()` call into any screen that
 * renders notification-target rows (the dashboards).
 */
export default function useDeepLinkHighlight() {
  const location = useLocation();
  // Guard so we only act once per target — the dashboards re-navigate with
  // `replace` (to sync the ?tab= query) while preserving state, which would
  // otherwise re-trigger the scroll every time the user switches tabs.
  const handledIdRef = useRef(null);

  useEffect(() => {
    const id = location.state?.highlightId;
    if (!id) return undefined;
    if (handledIdRef.current === id) return undefined;
    handledIdRef.current = id;
    return highlightNotifTarget(id);
  }, [location.key, location.state]);
}
