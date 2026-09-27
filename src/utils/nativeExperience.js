import { isInsideNativeApp } from '../hooks/useAppInstall';

// Device navigation preference, deliberately separate from account permissions
// and the shared website defaultHome setting. Never contains account data.
export const NATIVE_EXPERIENCE_KEY = 'tlp:native-experience:v1';
// Where a deliberate "change how I use the app" goes: the two questions.
export const NATIVE_START_PATH = '/app/start';
// What a FIRST run opens on: what the app does, then one phone number. The
// questions are not asked here — a returning account already answers them, and
// a new one answers them inside signup where the name and password already are.
export const NATIVE_WELCOME_PATH = '/welcome';
const CHANGE_EVENT = 'native-experience-changed';
let cachedRaw;
let cachedExperience = null;
let memoryFallback = null;

export const isNativeApp = () => isInsideNativeApp();

const TENANT_MODES = ['living', 'search'];
// 'chosen'  — this person answered /app/start (or switched) on THIS phone.
// 'account' — we worked it out from their account, so the account may correct
//             it later (their saved home arrives with settings, or on a new
//             phone). A 'chosen' answer is never overwritten that way.
const SOURCES = ['chosen', 'account'];

export function validNativeExperience(value) {
  return value?.version === 1 && (
    (value.role === 'tenant' && TENANT_MODES.includes(value.mode)) ||
    (value.role === 'landlord' && value.mode === 'host')
  );
}

export function getNativeExperience() {
  if (!isNativeApp()) return null;
  let raw;
  try { raw = window.localStorage.getItem(NATIVE_EXPERIENCE_KEY); }
  catch { return memoryFallback; }
  if (raw === cachedRaw) return cachedExperience;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw);
    cachedExperience = validNativeExperience(parsed)
      ? {
        version: 1,
        role: parsed.role,
        mode: parsed.mode,
        // Which side of Living/search this person uses when they are a tenant.
        // Kept while they are on the landlord side so switching back restores it.
        tenantMode: TENANT_MODES.includes(parsed.tenantMode) ? parsed.tenantMode : undefined,
        source: SOURCES.includes(parsed.source) ? parsed.source : 'chosen',
      }
      : null;
  } catch { cachedExperience = null; }
  return cachedExperience;
}

export function saveNativeExperience(role, mode, source = 'chosen') {
  const previous = getNativeExperience();
  const tenantMode = role === 'tenant' && TENANT_MODES.includes(mode) ? mode : previous?.tenantMode;
  const preference = {
    version: 1,
    role,
    mode,
    ...(tenantMode ? { tenantMode } : {}),
    source: SOURCES.includes(source) ? source : 'chosen',
  };
  if (!validNativeExperience(preference)) throw new Error('Invalid app preference');
  if (!isNativeApp()) return null;
  memoryFallback = preference;
  try { window.localStorage.setItem(NATIVE_EXPERIENCE_KEY, JSON.stringify(preference)); }
  catch { /* The choice still works for this session when storage is unavailable. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return preference;
}

export function subscribeNativeExperience(callback) {
  const onStorage = (event) => {
    if (!event.key || event.key === NATIVE_EXPERIENCE_KEY) callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

// "Find a home" opens on the existing home page: it IS the search surface on a
// phone (MobileHome), and /properties/* hides the bottom rail.
export function getNativeHome(experience = getNativeExperience()) {
  if (!validNativeExperience(experience)) return NATIVE_START_PATH;
  return { living: '/living', search: '/', host: '/host-dashboard' }[experience.mode];
}

export const isLandlordRole = (role) => role === 'landlord' || role === 'host';

// ── The account's "open the app on" setting ↔ the app's own modes ──────────
// One preference, two vocabularies: the account (and the website) speak in
// HOME_SURFACES, the app in tenant modes. Kept here so the two can't drift.
export const surfaceForMode = (mode) => ({ living: 'living', search: 'explore', host: 'host' }[mode] || null);
export const modeForSurface = (surface) => ({ living: 'living', explore: 'search' }[surface] || null);

/**
 * Is the signed-in account's active role the side the app is currently set up
 * for? A dual-role user switching to Tenant from either dashboard must not be
 * left in the landlord app, and vice versa.
 */
export function roleMatchesExperience(experience, activeRole) {
  if (!validNativeExperience(experience)) return false;
  return experience.role === (isLandlordRole(activeRole) ? 'landlord' : 'tenant');
}

/**
 * The experience an account's active role should get. The tenant side keeps
 * whichever surface that person last used (Living or search) so switching
 * roles back and forth doesn't quietly move their home screen; failing that it
 * follows the home saved on the account, which is what makes a returning user
 * land on their usual screen on a brand-new phone.
 *
 * @returns {{role: string, mode: string}|null} null for admin-ish roles.
 */
export function experienceForRole(activeRole, { defaultHome, previous = getNativeExperience() } = {}) {
  if (isLandlordRole(activeRole)) return { role: 'landlord', mode: 'host' };
  if (activeRole !== 'tenant') return null;
  const remembered = previous?.role === 'tenant' ? previous.mode : previous?.tenantMode;
  const mode = TENANT_MODES.includes(remembered)
    ? remembered
    : (modeForSurface(defaultHome) || 'search');
  return { role: 'tenant', mode };
}

// An account that was already signed in before this screen existed is not asked
// again: its role (and the home saved on the account) already answer the question.
export function inferNativeExperience({ activeRole, defaultHome } = {}) {
  return experienceForRole(activeRole, { defaultHome });
}

/**
 * Where a completed sign-in lands, and what the device should hold when it does.
 *
 * The device's saved side is a PREFERENCE, not an identity. It used to be taken
 * as read after login, so a landlord signing in on a handset that had been
 * looked around as a tenant — a guest browse, a shared phone, a family member's
 * — was opened on the tenant home; App.jsx then corrected the device without
 * navigating, leaving them on the public homepage wearing the landlord rail.
 * The ACCOUNT decides the side, checked every time.
 *
 * It is only ever a correction, never a reset: `experienceForRole` keeps this
 * person's own tenant surface (Living vs search) when the side is unchanged.
 *
 * @param {object}  opts
 * @param {string}  opts.activeRole  the role the ACCOUNT came back with — not
 *                                   the one the login form happened to be set to
 * @param {string}  opts.defaultHome preferences.app.defaultHome
 * @param {boolean} opts.mayConfirm  true for a login, where a home worked out
 *                                   from the account is still only a guess and
 *                                   is worth one tap of agreement. False for a
 *                                   signup, which has just been asked outright.
 * @returns {{experience: object|null, confirm: {role: string, mode: string}|null}}
 *   `confirm` set → ask before acting. Otherwise `experience` is what the device
 *   now holds, and getNativeHome() turns it into the path to open.
 */
export function nativeLoginExperience({
  activeRole,
  defaultHome,
  mayConfirm = false,
  previous = getNativeExperience(),
} = {}) {
  if (roleMatchesExperience(previous, activeRole)) return { experience: previous, confirm: null };
  const inferred = experienceForRole(activeRole, { defaultHome, previous });
  // An admin-ish role has no app side at all; leave the device as it was.
  if (!inferred) return { experience: previous, confirm: null };
  // Nothing stored means this phone has never met this account, so everything
  // below came from the account rather than from the person in front of us.
  if (mayConfirm && !previous) return { experience: previous, confirm: inferred };
  // 'account': worked out, not answered — so the account's own saved home may
  // still correct it later (see App.jsx's mirror effect).
  return { experience: saveNativeExperience(inferred.role, inferred.mode, 'account'), confirm: null };
}

// Only internal destinations can be carried across authentication.
export function safeAppPath(path, fallback = '/') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) return fallback;
  return path;
}

export function nativeLoginUrl({ next, role, action } = {}) {
  const experience = getNativeExperience();
  const current = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  let target = safeAppPath(next || current);
  if (action && /^[a-zA-Z0-9:_-]{1,80}$/.test(action)) {
    const url = new URL(target, 'https://app.invalid');
    url.searchParams.set('authAction', action);
    target = url.pathname + url.search + url.hash;
  }
  const params = new URLSearchParams({ next: target });
  const selectedRole = experience?.role || role;
  if (selectedRole === 'tenant' || selectedRole === 'landlord') params.set('role', selectedRole);
  return `/login?${params.toString()}`;
}
