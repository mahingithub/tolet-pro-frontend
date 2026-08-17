/**
 * authService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Talks to the TO-LET PRO auth backend.
 *
 * OTP is delivered by the BACKEND via sms.net.bd — there is NO client-side
 * Firebase / reCAPTCHA anymore. The browser only posts the phone number and
 * the 6-digit code the user received by SMS.
 *
 * Signup:
 * 1.  POST /signup/start  {name, phone, password, role}      → 202 (OTP texted)
 * 2.  POST /signup/verify {phoneNumber, otp}                 → { token, user }
 *
 * Login (no OTP):
 * 1.  POST /login {phone, password}                          → { token, user }
 *
 * Forgot password:
 * 1.  POST /forgot-password {phoneNumber}                    → 202 (OTP texted)
 * 2.  POST /reset-password  {phoneNumber, otp, newPassword}  → 200
 */

import { readJson, writeJson, broadcast } from './_storage.js';
import { unsubscribeFromPushNotifications } from '../utils/pushSubscription.js';
import { directUpload, privateUpload } from './cloudinaryUpload.js';

const API_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/auth`
  : 'http://localhost:5000/api/auth';

const KEY_USER  = 'auth:user';
const KEY_TOKEN = 'auth:token';

// Legacy key left over from the old client-side session cap. Nothing writes it
// any more — purgeLegacySessionExpiry() deletes it. See the note there.
const KEY_LEGACY_EXPIRES = 'auth:expiresAt';

// localStorage keys that are DEVICE-level, not account-level. clearAllAppData()
// preserves ONLY these so a logout doesn't reset the user's language choice or
// re-trigger the PWA install banner.
const DEVICE_KEEP_KEYS = new Set([
  'tolet_lang',           // LanguageContext — chosen language
  'toletpro_app_banner_dismissed', // AppDownloadBanner — "don't show again"
  'welcome:login:hidden', // WelcomeRobotOverlay — "never show the login welcome again"
]);

// Same idea as DEVICE_KEEP_KEYS, but for families of keys whose full name isn't
// known up front because it carries an account id.
//
// `tolet_pro::tours_completed::<userId>` is the guided-tour record, and it is
// the reason this list exists. It is already scoped per account — user B's
// bucket is a different key from user A's, so B still gets their own tour on a
// shared browser — which means there is nothing to purge here for privacy, and
// deleting it on logout was an outright bug: every single logout reset the
// record, so the tour restarted from step 1 on the user's next login, forever.
// A "show this once" flag is worthless if it doesn't outlive a logout.
const DEVICE_KEEP_PREFIXES = [
  'tolet_pro::tours_completed', // TourContext — which guided tours are done
];

const isDeviceLevelKey = (k) =>
  DEVICE_KEEP_KEYS.has(k) || DEVICE_KEEP_PREFIXES.some((p) => k.startsWith(p));

const ADMIN_ROLES = ['support_agent', 'moderator', 'super_admin'];
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const getCurrentUser  = () => readJson(KEY_USER);
export const getCurrentToken = () => window.localStorage.getItem(KEY_TOKEN);

// `token` overrides the stored session token. Only logout needs it: it clears
// storage up front so the UI can flip immediately, and still has to authenticate
// its own best-effort revocation call afterwards.
async function api(path, { method = 'POST', body, auth: useAuth = false, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth) {
    const t = token || getCurrentToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.code || 'REQUEST_FAILED');
    err.code = data.code;
    err.details = data.details;
    err.status = res.status;
    // Backend ApiError includes a user-facing (Bangla) `message` — surface it
    // so callers can show the server's own error text instead of a raw code.
    err.serverMessage = data.message;
    throw err;
  }
  return data;
}

function persistSession({ token, user }) {
  window.localStorage.setItem(KEY_TOKEN, token);
  writeJson(KEY_USER, user);
  broadcast(KEY_USER);
}

// ─── Legacy client-side session cap (REMOVED) ───────────────────────────────
// The website used to stamp `auth:expiresAt` at login and wipe ALL local data
// the moment it passed, independently of whether the server still considered the
// session valid. That is a second, competing source of truth for "am I logged
// in", and it is why people got thrown out mid-use:
//
//   - The cap started at 7 days and was later widened to 365. But the stamp was
//     only ever written at LOGIN, and the old ensureSessionExpiry() explicitly
//     refused to overwrite an existing value. So every user who had logged in
//     under the 7-day rule kept a 7-day deadline sitting in localStorage, and
//     when it landed the background enforcer wiped their data and hard-navigated
//     them to /login — no matter how recently they had used the app.
//   - A successful /auth/refresh never touched the stamp, so simply staying
//     active could not push it out.
//
// A session's lifetime now lives in exactly one place: the server. The refresh
// token (30 days, rotated and slid forward on every use) decides how long a
// session lasts, and locally only an explicit logout ends it. All this function
// does is delete the stale key so the old deadline can never fire again.
export function purgeLegacySessionExpiry() {
  try { window.localStorage.removeItem(KEY_LEGACY_EXPIRES); } catch { /* ignore */ }
}

// 🧹 Wipe EVERY account-scoped key from localStorage, preserving only the
// device-level prefs in DEVICE_KEEP_KEYS / DEVICE_KEEP_PREFIXES. Used on logout
// ("all data deleted"), and when a DIFFERENT account signs in so account B can
// never inherit account A's cached dashboard / chat / profile data on the same
// browser.
export function clearAllAppData() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && !isDeviceLevelKey(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  } catch { /* ignore */ }
  // Notify same-tab + cross-tab subscribers that the auth/user state changed.
  try { broadcast(KEY_USER); } catch { /* ignore */ }
}

// ─── Signup ─────────────────────────────────────────────────────────────────
export const signupStart  = ({ name, phone, password, role = 'tenant' }) =>
  api('/signup/start', { body: { name, phone, password, role } });

export const signupVerify = async ({ phoneNumber, otp }) => {
  const data = await api('/signup/verify', { body: { phoneNumber, otp } });
  // Wipe any previous account's cached data BEFORE persisting the new session,
  // otherwise the freshly-mounted dashboard/chat reads stale fullName/phone/
  // threads from the prior user's storage slots.
  clearAllAppData();
  persistSession(data);
  return data.user;
};

// ─── Login ──────────────────────────────────────────────────────────────────
export const loginWithPassword = async ({ phone, password }) => {
  const data = await api('/login', { body: { phone, password } });
  // Only purge previous tenant-profile localStorage if the user actually
  // CHANGED. Same-user re-login on the same browser must NOT wipe their
  // offline cache — that was eating the profile data every time the user
  // logged back in. Different user → purge so account B never inherits
  // account A's cached fullName/phone.
  const prev   = getCurrentUser();
  const prevId = prev?.id || prev?._id;
  const nextId = data.user?.id || data.user?._id;
  if (!prevId || String(prevId) !== String(nextId)) {
    clearAllAppData();
  }
  persistSession(data);
  return data.user;
};

// ─── Forgot / Reset (OTP via sms.net.bd) ─────────────────────────────────────
// Step 1: request an OTP. Backend always returns 202 (constant response) so
// account existence is never leaked.
export const forgotPassword = ({ phoneNumber }) =>
  api('/forgot-password', { body: { phoneNumber } });

// Step 2: verify the OTP and set the new password in a single call.
export const resetPassword = ({ phoneNumber, otp, newPassword }) =>
  api('/reset-password', { body: { phoneNumber, otp, newPassword } });

// ─── Session ───────────────────────────────────────────────────────────────
export const fetchMe = () => api('/me', { method: 'GET', auth: true }).then((d) => d.user);

export const logout = () => {
  // Keep the token so the background revocation below can still authenticate
  // after storage is wiped.
  const token = getCurrentToken();

  // Full wipe (keeps only language + PWA prefs). Matches the product rule:
  // "on logout the data is gone". The AuthContext hard-reloads afterwards so
  // no stale in-memory state from this account survives either.
  //
  // This runs FIRST and synchronously. Signing out is a local decision — the
  // session is dead the moment we drop the token — so the UI must never wait
  // on the network to reflect it. Awaiting the two calls below meant a slow or
  // unreachable backend left the user parked on a still-logged-in dashboard
  // for seconds after they clicked, and the redirect only landed once the
  // requests settled.
  clearAllAppData();

  // Best-effort server-side cleanup: revoke the session and stop push for this
  // device. Deliberately fire-and-forget — the caller redirects immediately and
  // the page may well unload mid-flight, which is fine. Nothing the user sees
  // depends on the outcome, and failures are already non-fatal (an unrevoked
  // access token expires on its own).
  void (async () => {
    try { await unsubscribeFromPushNotifications({ token }); } catch { /* ignore */ }
    try { await api('/logout', { auth: true, token }); } catch { /* ignore */ }
  })();

  return { ok: true };
};

// ─── Profile mutations ──────────────────────────────────────────────────────
// Talks to the backend so the public landlord/tenant routes see the same
// data the dashboard is editing. The cached local user is refreshed
// from the server response — never from the optimistic patch object —
// so server-computed fields (trustScore, roles[]) stay authoritative.

export const updateMe = async (patch) => {
  // No token = no backend; fall back to the local-only behaviour so unit
  // tests + offline dev still work the way they used to.
  if (!getCurrentToken()) {
    const user = getCurrentUser();
    if (!user) return null;
    const updated = { ...user, ...patch };
    writeJson(KEY_USER, updated);
    broadcast(KEY_USER);
    return updated;
  }

  const data = await api('/me', { method: 'PATCH', body: patch, auth: true });
  writeJson(KEY_USER, data.user);
  broadcast(KEY_USER);
  return data.user;
};

// Idempotent — granting a role you already have is a no-op on the server.
export const addRole = async (role) => {
  const data = await api('/me/roles', { body: { role }, auth: true });
  writeJson(KEY_USER, data.user);
  broadcast(KEY_USER);
  return data.user;
};

// Switch the active UI role. Caller must already own `role`.
export const setActiveRole = async (role) => {
  const data = await api('/me/active-role', { body: { role }, auth: true });
  writeJson(KEY_USER, data.user);
  broadcast(KEY_USER);
  return data.user;
};

// Tenant verification submission — flips the verification block from
// 'unverified' → 'pending' and persists the doc booleans.
//   submitVerification({ photo: true, nidFront: true, nidBack: true,
//                        professionProof: false })
export const submitVerification = async (verification) => {
  const data = await api('/me/verification/submit', {
    body: { verification },
    auth: true,
  });
  writeJson(KEY_USER, data.user);
  broadcast(KEY_USER);
  return data.user;
};

// ─── Verification document upload (Direct Cloudinary Upload) ────────────────
// NID scans use privateUpload (Cloudinary type:'authenticated' — URL is useless
// without a signed token). Profile photo uses directUpload (public). The file
// goes straight from the browser to Cloudinary; only the resulting URL + public_id
// are sent to our backend via the /me/verification/direct-upload/:kind endpoint.
export const uploadVerificationDoc = async (kind, file, { onProgress } = {}) => {
  if (!(file instanceof Blob)) {
    throw Object.assign(new Error('Invalid file.'), { code: 'invalid_file' });
  }
  if (file.size > 5 * 1024 * 1024) {
    throw Object.assign(new Error('FILE_TOO_LARGE'), { code: 'file_too_large' });
  }

  const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED_MIMES.includes(file.type)) {
    throw Object.assign(
      new Error('JPG, PNG বা WEBP ছবি ব্যবহার করুন।'),
      { code: 'invalid_mime' },
    );
  }

  const currentUser = getCurrentUser();
  const userId = currentUser?._id || currentUser?.id || 'unknown';

  // NID documents are PRIVATE (authenticated) — photo is public.
  const isNid = kind === 'nidFront' || kind === 'nidBack';
  const publicIdMap = { photo: 'profile_photo', nidFront: 'nid_front', nidBack: 'nid_back' };
  const uploadFn = isNid ? privateUpload : directUpload;

  // 1. Upload directly to Cloudinary (zero server RAM).
  const result = await uploadFn(file, {
    folder:    `tolet-pro/verification/${userId}`,
    publicId:  publicIdMap[kind] || kind,
    onProgress: (pct) => {
      if (typeof onProgress === 'function') onProgress(Math.round(pct * 0.9));
    },
  });

  // 2. Persist the URL + publicId on the user document via the new endpoint.
  const data = await api(`/me/verification/direct-upload/${encodeURIComponent(kind)}`, {
    body: { secureUrl: result.secureUrl, publicId: result.publicId },
    auth: true,
  });
  if (data.user) {
    writeJson(KEY_USER, data.user);
    broadcast(KEY_USER);
  }
  if (typeof onProgress === 'function') onProgress(100);
  return data;
};


// ─── Avatar upload (Bug 1 Fix) ──────────────────────────────────────────────

// OPTION A — Dedicated avatar route (RECOMMENDED if backend has it)
// ─── Avatar upload (Direct Cloudinary Upload) ───────────────────────────────
// File goes straight from the browser to Cloudinary (zero server RAM), then we
// persist the resulting URL on the user doc via PATCH /me.
export const uploadAvatar = async (file, { onProgress } = {}) => {
  if (!(file instanceof Blob)) {
    throw Object.assign(new Error('Invalid file.'), { code: 'invalid_file' });
  }
  if (file.size > 5 * 1024 * 1024) {
    throw Object.assign(new Error('FILE_TOO_LARGE'), { code: 'file_too_large' });
  }

  // Read the current user to build the Cloudinary folder path.
  const currentUser = getCurrentUser();
  const userId = currentUser?._id || currentUser?.id || 'unknown';

  // 1. Upload directly to Cloudinary (the big bytes never touch our server).
  const result = await directUpload(file, {
    folder:    `tolet-pro/avatars/${userId}`,
    publicId:  'avatar',
    onProgress: (pct) => {
      // Scale to 0–90% for the upload phase; the remaining 10% is the save.
      if (typeof onProgress === 'function') onProgress(Math.round(pct * 0.9));
    },
  });

  // 2. Persist the new avatar URL on the user document.
  const user = await updateMe({ avatar: result.secureUrl });
  if (typeof onProgress === 'function') onProgress(100);
  return user;
};

// Legacy fallback kept for compatibility — now just delegates to the primary.
export const uploadAvatarFallback = uploadAvatar;


// ─── Backwards-compat shim ──────────────────────────────────────────────────
// AuthContext.jsx currently calls `login({ phone, password })`. Keep that API.
export const login = loginWithPassword;

export const loginAsDemoAdmin = async () => {
  throw new Error('DEMO_LOGIN_DISABLED');
};