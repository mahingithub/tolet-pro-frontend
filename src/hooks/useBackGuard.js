import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Marker written onto the history entry a guard owns. Exported as a predicate
// so navigation code can recognise "we are standing on a throwaway overlay
// entry" without duplicating the key. See isOnBackGuardEntry below.
const GUARD_KEY = 'tlpBackGuard';

/**
 * True when the current history entry is one an overlay pushed.
 *
 * Navigating while an overlay is open (tapping a nav item in the drawer is the
 * common one) should REPLACE that entry rather than push past it — otherwise
 * the throwaway entry is stranded mid-stack and the next Back press appears to
 * do nothing. Consumers: hooks/useTabHistory.js, useOverlayNavigate below.
 *
 * @returns {boolean}
 */
export function isOnBackGuardEntry() {
  return !!window.history.state?.[GUARD_KEY];
}

/**
 * useOverlayNavigate — `useNavigate` for links that live INSIDE an overlay.
 *
 * Use it anywhere a control both closes an overlay and routes somewhere else
 * (the drawer's Messages / Support entries, "go to the public site" in the
 * logo popup). It swallows the overlay's throwaway history entry so Back from
 * the destination lands on the real page in one press instead of two.
 *
 * Identical to `navigate` otherwise; pass an explicit `replace` to override.
 *
 * @returns {(to: string | number, options?: object) => void}
 */
export function useOverlayNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to, options = {}) => {
      if (typeof to === 'number') { navigate(to); return; }
      navigate(to, { ...options, replace: options.replace ?? isOnBackGuardEntry() });
    },
    [navigate],
  );
}

/**
 * useBackGuard — lets an open overlay (modal, drawer, bottom sheet, lightbox)
 * absorb one Back press instead of letting it navigate the page away.
 *
 * Why
 * ───
 * On a phone the hardware Back button / edge-swipe is how people close things.
 * Without a guard, Back on an open modal unmounts the whole page and the user
 * is thrown out of the dashboard — and if they come Forward again the modal is
 * gone anyway. Desktop users hit the same thing with the browser's Back arrow.
 *
 * How
 * ───
 * While the overlay is open we push one history entry that changes nothing
 * visually. Back pops it, `popstate` fires, and we call `onClose` — the page
 * never navigates. If the user instead closes the overlay from the UI (an X, a
 * backdrop tap, Escape) the effect's cleanup calls `history.back()` to retire
 * that entry, so a later Back press isn't silently swallowed.
 *
 * Nested overlays
 * ───────────────
 * Each guard tags its entry with a unique token and only reacts when the entry
 * being popped is its own, so a modal opened on top of a drawer closes just the
 * modal; the next Back closes the drawer. Without the token both listeners
 * would fire on the same pop and the whole stack would collapse at once.
 *
 * @param {boolean}    isOpen    Whether the overlay is currently visible.
 * @param {() => void} onClose   Called when Back is pressed while it is open.
 *   May be recreated every render — it is always read through a ref, so a new
 *   identity never re-pushes the entry.
 *
 * @example
 *   const [open, setOpen] = useState(false);
 *   useBackGuard(open, () => setOpen(false));
 */
export default function useBackGuard(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Bumped per guard instance so nested overlays never answer each other's pop.
  const tokenRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const token = `bg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    tokenRef.current = token;

    // Spread the existing state so React Router's own bookkeeping (`idx`,
    // `usr`, `key`) survives; a bare object would leave `idx` undefined and
    // break every later push, plus useGoBack's "is there a previous page" test.
    const base = window.history.state || {};
    window.history.pushState({ ...base, [GUARD_KEY]: token }, '');

    const onPop = () => {
      // Our entry is gone from the stack, so nothing is left to clean up.
      tokenRef.current = null;
      onCloseRef.current?.();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed from the UI while our entry is still on top → retire it.
      // Skipped when the guard already answered a pop, and when a real
      // navigation replaced or moved past our entry (going back then would
      // undo that navigation).
      if (tokenRef.current === token && window.history.state?.[GUARD_KEY] === token) {
        tokenRef.current = null;
        window.history.back();
      }
    };
  }, [isOpen]);
}
