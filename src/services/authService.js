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
import { isInstalledApp } from '../utils/platform.js';

const API_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/auth`
  : 'http://localhost:5000/api/auth';

const KEY_USER  = 'auth:user';
const KEY_TOKEN = 'auth:token';
const KEY_EXPIRES = 'auth:expiresAt';

// Website sessions persist for a full year so a freshly signed-up user isn't
// kicked back to the login screen while they're still using the app. Installed
// apps (native / standalone PWA) ignore this entirely and never time out: see
// isSessionExpired(). Keep this in sync with the backend token lifetime
// (jwtExpiresIn in config/env.js).
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// localStorage keys that are DEVICE-level, not account-level. clearAllAppData()
// preserves ONLY these so a logout / auto-expiry doesn't reset the user's
// language choice or re-trigger the PWA install banner.
const DEVICE_KEEP_KEYS = new Set([
  'tolet_lang',           // LanguageContext — chosen language
  'pwa:visits',           // InstallPrompt — visit counter
  'pwa:dismissed',        // InstallPrompt — "not now" memory
  'welcome:login:hidden', // WelcomeRobotOverlay — "never show the login welcome again"
]);

const ADMIN_ROLES = ['support_agent', 'moderator', 'super_admin'];
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const getCurrentUser  = () => readJson(KEY_USER);
export const getCurrentToken = () => window.localStorage.getItem(KEY_TOKEN);

async function api(path, { method = 'POST', body, auth: useAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth) {
    const t = getCurrentToken();
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
  stampSessionExpiry();
  broadcast(KEY_USER);
}

// ─── Session expiry (website only) ──────────────────────────────────────────
// Start the 7-day clock. Called every time a session is persisted (login /
// signup) so expiry is measured from login, not from first page load.
function stampSessionExpiry() {
  try {
    window.localStorage.setItem(KEY_EXPIRES, String(Date.now() + SESSION_TTL_MS));
  } catch { /* ignore */ }
}

// Backfill an expiry for sessions that predate this feature so already
// logged-in users still get a 7-day window (from now) rather than an immortal
// session. No-op when one already exists or there's no session.
export function ensureSessionExpiry() {
  try {
    if (getCurrentToken() && !window.localStorage.getItem(KEY_EXPIRES)) stampSessionExpiry();
  } catch { /* ignore */ }
}

// True when a WEBSITE session has passed its 7-day cap. Always false inside an
// installed app (native build / standalone PWA) — those keep the session until
// an explicit logout or uninstall, so the user's data is there on next launch.
export function isSessionExpired() {
  try {
    if (isInstalledApp()) return false;
    const raw = window.localStorage.getItem(KEY_EXPIRES);
    if (!raw) return false; // legacy session — ensureSessionExpiry() backfills it
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt)) return false;
    return Date.now() > expiresAt;
  } catch {
    return false;
  }
}

// 🧹 Wipe EVERY account-scoped key from localStorage, preserving only the
// device-level prefs in DEVICE_KEEP_KEYS. Used on logout and the 7-day auto-
// expiry ("all data deleted"), and when a DIFFERENT account signs in so
// account B can never inherit account A's cached dashboard / chat / profile
// data on the same browser.
export function clearAllAppData() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && !DEVICE_KEEP_KEYS.has(k)) toRemove.push(k);
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

export const logout = async () => {
  try { await unsubscribeFromPushNotifications(); } catch { /* ignore */ }
  try { await api('/logout', { auth: true }); } catch { /* ignore */ }
  // Full wipe (keeps only language + PWA prefs). Matches the product rule:
  // "on logout the data is gone". The AuthContext hard-reloads afterwards so
  // no stale in-memory state from this account survives either.
  clearAllAppData();
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

// ─── Verification document upload ───────────────────────────────────────────
export const uploadVerificationDoc = (kind, file, { onProgress } = {}) => {
  return new Promise((resolve, reject) => {
    const token = getCurrentToken();
    if (!token) {
      const err = new Error('NOT_LOGGED_IN');
      err.code = 'unauthenticated';
      return reject(err);
    }
    if (!(file instanceof Blob)) {
      const err = new Error('Invalid file.');
      err.code = 'invalid_file';
      return reject(err);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/me/verification/upload/${encodeURIComponent(kind)}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        }
      };
    }

    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (data.user) {
          writeJson(KEY_USER, data.user);
          broadcast(KEY_USER);
        }
        if (typeof onProgress === 'function') onProgress(100);
        resolve(data);
      } else {
        const err = new Error(data.message || `Upload failed (HTTP ${xhr.status}).`);
        err.code   = data.code;
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => {
      const err = new Error('NETWORK_ERROR');
      err.code = 'network_error';
      reject(err);
    };
    xhr.onabort = () => {
      const err = new Error('Upload cancelled.');
      err.code = 'upload_aborted';
      reject(err);
    };

    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
};

// ─── Avatar upload (Bug 1 Fix) ──────────────────────────────────────────────

// OPTION A — Dedicated avatar route (RECOMMENDED if backend has it)
export const uploadAvatar = (file, { onProgress } = {}) => {
  return new Promise((resolve, reject) => {
    const token = getCurrentToken();
    if (!token) {
      const err = new Error('NOT_LOGGED_IN');
      err.code = 'unauthenticated';
      return reject(err);
    }
    if (!(file instanceof Blob)) {
      const err = new Error('Invalid file.');
      err.code = 'invalid_file';
      return reject(err);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/me/avatar`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        }
      };
    }

    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (data.user) {
          writeJson(KEY_USER, data.user);
          broadcast(KEY_USER);
        }
        if (typeof onProgress === 'function') onProgress(100);
        resolve(data.user || data);
      } else {
        const err = new Error(data.message || `Upload failed (HTTP ${xhr.status}).`);
        err.code   = data.code;
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => {
      const err = new Error('NETWORK_ERROR');
      err.code = 'network_error';
      reject(err);
    };
    xhr.onabort = () => {
      const err = new Error('Upload cancelled.');
      err.code = 'upload_aborted';
      reject(err);
    };

    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
};

// OPTION B — Fallback via existing PATCH /me (if no /me/avatar route)
export const uploadAvatarFallback = (file, { onProgress } = {}) => {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      return reject(Object.assign(new Error('Invalid file.'), { code: 'invalid_file' }));
    }
    if (file.size > 5 * 1024 * 1024) {
      return reject(Object.assign(
        new Error('FILE_TOO_LARGE'),
        { code: 'file_too_large' },
      ));
    }

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.min(50, Math.round((e.loaded / e.total) * 50)));
      }
    };
    reader.onload = async () => {
      try {
        if (typeof onProgress === 'function') onProgress(70);
        const user = await updateMe({ avatar: reader.result });
        if (typeof onProgress === 'function') onProgress(100);
        resolve(user);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(
      Object.assign(new Error('FILE_READ_ERROR'), { code: 'read_error' }),
    );
    reader.readAsDataURL(file);
  });
};


// ─── Backwards-compat shim ──────────────────────────────────────────────────
// AuthContext.jsx currently calls `login({ phone, password })`. Keep that API.
export const login = loginWithPassword;

export const loginAsDemoAdmin = async () => {
  throw new Error('DEMO_LOGIN_DISABLED');
};