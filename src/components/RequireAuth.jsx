import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Route guard for any logged-in surface (e.g. /account/privacy).
 * Less strict than <RequireAdmin>; just requires *some* user.
 *
 * Optional `requireRole` prop scopes the gate further:
 *
 *   <RequireAuth requireRole="landlord">…</RequireAuth>
 *
 *   • If the user is signed in BUT doesn't have the required role,
 *     they get bounced to a sensible default landing page (the tenant
 *     dashboard) — *not* to /login, because they ARE logged in, just
 *     not authorised for this surface.
 *   • If the user IS signed in AND owns the role, we render `children`.
 *   • Unauthenticated users get the existing /login?next=… redirect.
 *
 * The role check looks at `roles[]` (the canonical superset), not the
 * single-valued `role`, so role switching mid-session works correctly.
 */
const RequireAuth = ({ children, requireRole }) => {
  const { isAuthenticated, roles, loggingOut } = useAuth();
  const location = useLocation();

  // A logout in progress is already navigating this page away. Redirecting to
  // /login here would only paint a login screen the user never asked for, on
  // top of the destination they're actually headed to. Render nothing and let
  // the pending navigation land.
  if (loggingOut) return null;

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    // Carry the role the destination needs into the login screen, so a visitor
    // who landed on a landlord surface doesn't get the tenant signup form and
    // have to notice the toggle. LoginPage reads ?role= and preselects it;
    // without this it always defaults to tenant.
    //
    // This matters most for the public landing pages: someone arriving from
    // /tenant-manager ("ভাড়ার খাতা") is a landlord and should be offered the
    // landlord side, while /living has no requireRole and correctly stays on
    // tenant — which is what a visitor from /meal-manager or /roommate-wallet
    // almost always is.
    const roleHint = requireRole ? `&role=${encodeURIComponent(requireRole)}` : '';
    return <Navigate to={`/login?next=${next}${roleHint}`} replace />;
  }

  if (requireRole && Array.isArray(roles) && !roles.includes(requireRole)) {
    // Sensible default — drop them somewhere they're allowed.
    return <Navigate to="/tenant-dashboard" replace />;
  }

  return children;
};

export default RequireAuth;
