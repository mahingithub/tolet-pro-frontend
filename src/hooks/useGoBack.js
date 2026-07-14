import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useGoBack — a robust "Back" action that returns the user to the *actual*
 * previous in-app page instead of blindly guessing.
 *
 * Why this exists
 * ───────────────
 * Sprinkling `navigate(-1)` around the app is fragile:
 *   • On a fresh load / deep link / PWA launch / shared URL there is no
 *     in-app history, so `navigate(-1)` either dead-ends or hands control to
 *     the browser, which then leaves the app (or the catch-all route bounces
 *     the user to "/").
 *   • `window.history.length` is unreliable — it counts entries from *other*
 *     sites in the same tab and never shrinks, so a `length > N` guard can
 *     send the user back to whatever page they were on *before* our app.
 *
 * The reliable signal is the navigation index that React Router maintains on
 * `window.history.state.idx`: it starts at 0 for the first entry and
 * increments on every push. When `idx > 0` there is a genuine previous page
 * inside our app, so `navigate(-1)` returns to it. When `idx === 0` there is
 * nothing to go back to, so we route to a sensible fallback instead of the
 * home page (each caller passes the fallback that makes sense for its page).
 *
 * @param {string} [fallback='/'] Route to use only when there is no in-app
 *   history to go back to (e.g. a dashboard or the relevant listing page).
 * @returns {() => void} A stable callback to wire onto a Back button.
 *
 * @example
 *   const goBack = useGoBack('/tenant-dashboard');
 *   <button onClick={goBack} aria-label="Back">…</button>
 */
export default function useGoBack(fallback = '/') {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = window.history.state?.idx ?? 0;
    if (idx > 0) {
      // There is a real previous entry in our app — go to it.
      navigate(-1);
    } else {
      // First entry in this session: nothing to go back to. Route to the
      // page's fallback and replace so this dead-end doesn't linger in the
      // stack (mirrors what a working "back" would have felt like).
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback]);
}
