/**
 * homeSurface — the one answer to "where does the app open?".
 * ──────────────────────────────────────────────────────────────────────────
 * That question used to be answered in four unconnected places, each with its
 * own rules: two boot effects in App.jsx (landlord → host dashboard; tenant with
 * a booking → tenant dashboard), the post-login redirect in LoginPage, and the
 * "Home" target in MobileBottomNav. Adding Living as a possible home meant
 * teaching all four the same new rule and hoping they stayed in step. They now
 * all call resolveHome() instead.
 *
 * The preference behind it (`preferences.app.defaultHome`) is deliberately a
 * SURFACE, not a role. "I am a tenant" and "my home base is my খাতা" are
 * different statements — a tenant who mostly tracks mess expenses and a tenant
 * hunting for a flat are the same role and want different first screens.
 *
 * 'auto' reproduces exactly what the app did before this existed, so nothing
 * moves under anyone until they choose.
 */

export const HOME_SURFACES = ['auto', 'living', 'tenant', 'host', 'explore'];

export const HOME_PATHS = {
  living: '/living',
  tenant: '/tenant-dashboard?tab=overview',
  host: '/host-dashboard',
  explore: '/',
};

/** The server role may be 'landlord' or 'host'; both mean the same side. */
export const isLandlordRole = (role) => role === 'landlord' || role === 'host';

/**
 * Does deciding the home screen require the "is this tenant in a booking?"
 * lookup? Only 'auto' cares. Asked separately so an explicit preference skips
 * a network round trip on every cold start — the lookup exists to guess, and
 * there is nothing left to guess once the user has told us.
 *
 * @param {string} defaultHome  the stored preference
 * @param {string} activeRole   the user's active role
 */
export function needsBookingLookup(defaultHome, activeRole) {
  return (defaultHome || 'auto') === 'auto' && activeRole === 'tenant';
}

/**
 * @param {object}   opts
 * @param {string}   opts.activeRole   'tenant' | 'landlord' | 'host' | null
 * @param {string[]} opts.roles        every role this account owns. Both
 *                                     dashboards are guarded by RequireAuth,
 *                                     which checks this superset rather than
 *                                     the active role — so this is what decides
 *                                     whether a dashboard is reachable at all.
 * @param {string}   opts.defaultHome  preferences.app.defaultHome
 * @param {boolean}  opts.hasBooking   is this tenant attached to a lease?
 *                                     Only consulted when defaultHome is 'auto'.
 * @returns {string} the path to open on
 */
export function resolveHome({ activeRole, roles = [], defaultHome = 'auto', hasBooking = false } = {}) {
  const owns = (r) => Array.isArray(roles) && roles.includes(r);
  // Fall back to the active role when `roles` wasn't passed, so older callers
  // and half-hydrated sessions still resolve sensibly.
  const canHost = owns('landlord') || owns('host') || isLandlordRole(activeRole);
  const canTenant = owns('tenant') || activeRole === 'tenant';

  // Sending someone to a dashboard they don't own is not a harmless mistake:
  // RequireAuth bounces a role-less visitor from /tenant-dashboard back to
  // /tenant-dashboard, which renders nothing at all. A stored preference can
  // outlive the role it named — someone drops their landlord role, or the
  // account is changed server-side — so every dashboard answer is checked
  // against what this account can actually open.
  switch (defaultHome) {
    case 'living':
      return HOME_PATHS.living;
    case 'explore':
      return HOME_PATHS.explore;
    case 'tenant':
      if (canTenant) return HOME_PATHS.tenant;
      return canHost ? HOME_PATHS.host : HOME_PATHS.explore;
    case 'host':
      if (canHost) return HOME_PATHS.host;
      return canTenant ? HOME_PATHS.tenant : HOME_PATHS.explore;
    case 'auto':
    default:
      if (isLandlordRole(activeRole)) return HOME_PATHS.host;
      // A tenant only gets their dashboard once a landlord has actually added
      // them to a lease; until then the public homepage is the useful screen.
      if (activeRole === 'tenant' && hasBooking) return HOME_PATHS.tenant;
      return HOME_PATHS.explore;
  }
}

/**
 * The surfaces this account can actually be sent to, in menu order. Shared by
 * the settings row and the in-app switcher so the two can never disagree about
 * what is on offer.
 *
 * @param {string[]} roles
 * @returns {string[]} subset of HOME_SURFACES
 */
export function availableSurfaces(roles = []) {
  const owns = (r) => Array.isArray(roles) && roles.includes(r);
  return [
    'living',
    ...(owns('tenant') ? ['tenant'] : []),
    ...(owns('landlord') || owns('host') ? ['host'] : []),
    'explore',
  ];
}

/**
 * Is `pathname` the user's chosen home? Used by the surfaces that need to drop
 * their "back" affordance — a home screen with a back arrow pointing at a page
 * the user never visited is a dead end, and on Android it swallows the gesture
 * that should minimise the app.
 */
export function isHomeSurface(pathname, surface) {
  const home = HOME_PATHS[surface];
  if (!home) return false;
  return pathname === home.split('?')[0];
}
