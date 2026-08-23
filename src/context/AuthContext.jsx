import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  getCurrentUser,
  getCurrentToken,
  fetchMe,
  login as svcLogin,
  loginAsDemoAdmin as svcLoginAsDemoAdmin,
  logout as svcLogout,
  updateMe as svcUpdateMe,
  addRole as svcAddRole,
  setActiveRole as svcSetActiveRole,
  submitVerification as svcSubmitVerification,
  isAdminRole,
  purgeLegacySessionExpiry,
} from '../services/authService.js';
import { subscribe } from '../services/_storage.js';
import { isSessionTerminated } from '../utils/fetchInterceptor.js';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  // Boot straight from the cached session. There is no client-side expiry check
  // any more: the server owns session lifetime (see purgeLegacySessionExpiry).
  const [user, setUser] = useState(() => getCurrentUser());

  // True from the moment a logout starts until the page navigates away. Lets
  // route guards suppress their /login redirect during the teardown window.
  const [loggingOut, setLoggingOut] = useState(false);

  // On boot, if a token exists, validate it server-side via /me. The session is
  // only torn down when the SERVER says it is finished (a revoked/expired
  // refresh token, a deleted account, a security revocation) so stale data can't
  // impersonate a real account. Everything else — offline, a 5xx, a rate-limited
  // refresh — keeps the cached session and retries.
  //
  // RACE GUARD: we capture the token at the start of the effect. If a user
  // manually logs in while /me is still pending, the localStorage token gets
  // swapped to a fresh one. We must NOT then logout based on the old failing
  // call — that was killing fresh logins immediately and forcing the user back
  // to the login screen.
  useEffect(() => {
    // One-off cleanup of the old client-side session cap. Its stale stamps were
    // wiping storage and hard-navigating people to /login while their server
    // session was still perfectly alive. See purgeLegacySessionExpiry().
    purgeLegacySessionExpiry();

    const initialToken = getCurrentToken();
    if (!initialToken) return undefined;

    let cancelled = false;
    let retryTimer = null;
    let attempt = 0;

    const validate = () => {
      fetchMe()
        .then((u) => { if (!cancelled) setUser(u); })
        .catch((err) => {
          if (cancelled) return;
          // If the token in localStorage changed (or was cleared) while /me
          // was pending, treat the failure as belonging to the previous
          // session. The new session is the source of truth — leave it alone.
          if (getCurrentToken() !== initialToken) return;

          // Anything that isn't a 401 — offline, a backend restart, a 5xx — has
          // nothing to say about whether the session is valid. Keep the cached
          // session from the useState initializer above.
          if (err?.status !== 401) return;

          // A 401 that reaches here has ALREADY been through the fetch
          // interceptor, which tried to refresh the access token and replay the
          // call. So the question is not "did this request fail" but "did the
          // server tell us the session is over".
          //
          // Only a definitive answer ends the session. A refresh that failed for
          // a transient reason (offline, a 429 from the refresh limiter, a
          // backend restart, the refresh cookie momentarily not being sent) must
          // NOT log the user out — treating those as fatal is exactly why people
          // were being thrown back to the login screen mid-session.
          if (isSessionTerminated()) {
            svcLogout();
            setUser(null);
            return;
          }

          // Transient. Keep the session and retry with backoff, so a blip
          // resolves itself instead of leaving the app in a half-authed state.
          attempt += 1;
          if (attempt <= 5) {
            const delay = Math.min(30_000, 2_000 * (2 ** (attempt - 1)));
            retryTimer = window.setTimeout(validate, delay);
          }
        });
    };

    validate();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  // Keep state in sync with localStorage broadcasts from authService.
  useEffect(() => {
    const refresh = () => setUser(getCurrentUser());
    return subscribe('auth:user', refresh);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const u = await fetchMe();
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // ─── Multi-role helpers ────────────────────────────────────────────────
  // `roles` is the canonical superset granted to this user; `activeRole`
  // is whichever one the UI currently treats as primary (mirrors
  // `user.role` on the backend). The Navbar mode pill flips this.
  const value = useMemo(() => {
    const roles = Array.isArray(user?.roles) && user.roles.length
      ? user.roles
      : (user?.role ? [user.role] : []);
    const activeRole = user?.role || roles[0] || null;

    return {
      user,
      isAuthenticated: !!user,
      isAdmin: !!user && roles.some(isAdminRole),
      // ── New: multi-role surface ──────────────────────────────────────
      roles,
      activeRole,
      hasRole: (r) => roles.includes(r),
      // ──────────────────────────────────────────────────────────────────
      login: async (input, requestedRole) => {
        let u = await svcLogin(input);

        const loggedInRoles = Array.isArray(u?.roles) && u.roles.length ? u.roles : (u?.role ? [u.role] : []);

        // ── Role gate ───────────────────────────────────────────────────────
        // The login screen asks which side the user is signing in on. If the
        // account doesn't own that role the login must FAIL LOUDLY, not hand
        // back a session for the other side: a tenant-only account picking
        // "Landlord" used to log in fine and then get silently bounced from
        // /host-dashboard to /tenant-dashboard by <RequireAuth requireRole>,
        // with no hint as to why. Admin-type accounts are exempt — they sign in
        // through this same form and get routed to the admin panel.
        if (requestedRole
          && !loggedInRoles.some(isAdminRole)
          && !loggedInRoles.includes(requestedRole)) {
          // svcLogin has already persisted the token, so tear the session back
          // down — a rejected login must not leave a usable one behind.
          try { await svcLogout(); } catch { /* storage is cleared regardless */ }
          setUser(null);
          const err = new Error('ROLE_MISMATCH');
          err.code = 'ROLE_MISMATCH';
          err.requestedRole = requestedRole;
          err.actualRoles = loggedInRoles;
          throw err;
        }

        // They own the requested role but it isn't the active one — switch, so
        // the UI opens on the side they picked.
        if (requestedRole && loggedInRoles.includes(requestedRole) && u.role !== requestedRole) {
           try {
             u = await svcSetActiveRole(requestedRole);
           } catch (e) {
             console.warn('Failed to set active role on login:', e);
           }
        }
        
        setUser(u);
        
        // ওয়েলকাম রোবট শুধু tenant/landlord-এর জন্য — admin-জাতীয় role
        // (super_admin / moderator / support_agent) হলে dispatch-ই হবে না।
        if (u && !loggedInRoles.some(isAdminRole)) {
          window.dispatchEvent(
            new CustomEvent('triggerWelcomeRobot', {
              detail: { role: u.role, name: u.name, type: 'login' },
            }),
          );
        }
        return u;
      },
      loginAsDemoAdmin: async () => {
        const u = await svcLoginAsDemoAdmin();
        setUser(u);
        // অ্যাডমিন প্যানেলে ওয়েলকাম রোবট দেখানো হয় না, তাই এখানে dispatch নেই।
        return u;
      },
      loggingOut,
      logout: async () => {
        // Mark the logout as in flight BEFORE the session disappears. Clearing
        // the user re-renders every <RequireAuth> on screen, and a dashboard
        // that suddenly has no user would redirect to /login?next=<dashboard>
        // — a login screen nobody asked for, flashed up for however long the
        // SPA navigation below takes to commit. RequireAuth checks this flag and
        // holds its redirect instead.
        setLoggingOut(true);
        svcLogout();
        setUser(null);
        
        // Navigate directly to the login screen without a full page reload.
        navigate('/login', { replace: true });
        
        // Reset logging out flag after a short delay to allow the navigation to land
        setTimeout(() => setLoggingOut(false), 100);
      },
      updateMe: async (patch) => {
        const u = await svcUpdateMe(patch);
        setUser(u);
        return u;
      },
      // Grant the current user a new role (e.g. tenant → also landlord).
      // Idempotent server-side.
      addRole: async (role) => {
        const u = await svcAddRole(role);
        setUser(u);
        return u;
      },
      // Flip the UI's active role. Caller must already own `role`.
      setActiveRole: async (role) => {
        const u = await svcSetActiveRole(role);
        setUser(u);
        return u;
      },
      // Tenant verification round-trip.
      submitVerification: async (verification) => {
        const u = await svcSubmitVerification(verification);
        setUser(u);
        return u;
      },
      refresh,
    };
  }, [user, refresh, loggingOut, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};