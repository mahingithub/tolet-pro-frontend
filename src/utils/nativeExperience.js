import { isInsideNativeApp } from '../hooks/useAppInstall';

// Device navigation preference, deliberately separate from account permissions
// and the shared website defaultHome setting. Never contains account data.
export const NATIVE_EXPERIENCE_KEY = 'tlp:native-experience:v1';
export const NATIVE_START_PATH = '/app/start';
const CHANGE_EVENT = 'native-experience-changed';
let cachedRaw;
let cachedExperience = null;
let memoryFallback = null;

export const isNativeApp = () => isInsideNativeApp();

const TENANT_MODES = ['living', 'search'];

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
      }
      : null;
  } catch { cachedExperience = null; }
  return cachedExperience;
}

export function saveNativeExperience(role, mode) {
  const previous = getNativeExperience();
  const tenantMode = role === 'tenant' && TENANT_MODES.includes(mode) ? mode : previous?.tenantMode;
  const preference = { version: 1, role, mode, ...(tenantMode ? { tenantMode } : {}) };
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
 * roles back and forth doesn't quietly move their home screen.
 *
 * @returns {{role: string, mode: string}|null} null for admin-ish roles.
 */
export function experienceForRole(activeRole, { defaultHome, previous = getNativeExperience() } = {}) {
  if (isLandlordRole(activeRole)) return { role: 'landlord', mode: 'host' };
  if (activeRole !== 'tenant') return null;
  const remembered = previous?.role === 'tenant' ? previous.mode : previous?.tenantMode;
  const mode = TENANT_MODES.includes(remembered)
    ? remembered
    : (defaultHome === 'living' ? 'living' : 'search');
  return { role: 'tenant', mode };
}

// An account that was already signed in before this screen existed is not asked
// again: its role (and a Living default home) already answer the question.
export function inferNativeExperience({ activeRole, defaultHome } = {}) {
  return experienceForRole(activeRole, { defaultHome });
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
