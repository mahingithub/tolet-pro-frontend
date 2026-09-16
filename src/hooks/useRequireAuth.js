import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isNativeApp, nativeLoginUrl } from '../utils/nativeExperience.js';

/**
 * useRequireAuth — gate an ACTION behind login.
 * ──────────────────────────────────────────────────────────────────────────
 * Guests can browse / search / view properties (including full-screen image
 * views) freely. But an *action* — saving a property, sending an inquiry,
 * messaging or calling a landlord/tenant — must require a signed-in account.
 *
 * Usage:
 *   const requireAuth = useRequireAuth();
 *   <button onClick={() => requireAuth(() => doTheAction())}>Save</button>
 *
 * When authenticated it runs `cb` and returns true. When not, it sends the
 * user to /login?next=<current URL> (so they return to exactly where they
 * were after logging in) and returns false — the action never runs.
 *
 * This mirrors the inline `requireAuthFor` already used in PropertyDetails.jsx
 * and the /login?next= convention used by RequireAuth.jsx + LoginPage.jsx.
 */
export default function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (cb, { next, role, action } = {}) => {
      if (isAuthenticated) {
        if (typeof cb === 'function') cb();
        return true;
      }
      const destination = next || location.pathname + location.search + location.hash;
      if (isNativeApp()) {
        navigate(nativeLoginUrl({ next: destination, role, action }));
      } else {
        const params = new URLSearchParams({ next: destination });
        if (role) params.set('role', role);
        navigate(`/login?${params}`);
      }
      return false;
    },
    [isAuthenticated, navigate, location.pathname, location.search, location.hash],
  );
}
