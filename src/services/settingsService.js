'use strict';

/**
 * settingsService.js — the frontend gateway to the global settings hub.
 * ──────────────────────────────────────────────────────────────────────────
 * The backend stores every user setting under `User.preferences`, split into
 * cross-cutting flat fields + four scoped groups (notifications / app /
 * tenant / landlord). This service is the single place the UI reads and
 * writes them.
 *
 * Backend contract (see controllers/privacy.controller.js):
 *   GET   /api/users/me/preferences  → { preferences }
 *   PATCH /api/users/me/preferences  → { preferences }   (partial, deep-merged)
 *
 * Offline / unauthenticated → falls back to a namespaced localStorage cache
 * so the settings screen always renders and toggles feel instant. Writes are
 * cached immediately and pushed to the backend when a token is present.
 */

import { readJson, writeJson, broadcast, subscribe } from './_storage.js';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const CACHE_KEY = 'settings:preferences';

const getToken = () => window.localStorage.getItem('auth:token');

/**
 * Canonical default shape — mirrors the backend PreferencesSchema exactly.
 * Used to hydrate the UI before the network responds and to fill any gaps
 * from an older cached payload.
 */
export const DEFAULT_SETTINGS = {
  // Cross-cutting flat fields.
  aiLearningOptIn: false,
  marketingEmails: true,
  smsAlerts: true,
  callNotifications: true,
  theme: 'system',       // 'system' | 'light' | 'dark'
  language: 'en',        // 'en' | 'bn'

  // Notification controls.
  notifications: {
    push: true,
    email: true,
    sound: true,
    frequency: 'instant', // 'instant' | 'daily' | 'weekly'
    dnd: { enabled: false, from: '22:00', until: '08:00' },
    messages: true,
    bookings: true,
    payments: true,
    inquiries: true,
    visits: true,
    priceAlerts: true,
  },

  // Global app / display preferences.
  app: {
    currency: 'BDT',      // 'BDT' | 'USD'
    autoplayVideos: true,
    reduceMotion: false,
    defaultLandingRole: 'auto', // 'auto' | 'tenant' | 'landlord'
  },

  // Tenant-scope settings.
  tenant: {
    profileVisibility: 'public', // 'public' | 'private'
    showContactToLandlords: true,
    savedSearchAlerts: true,
    defaultCity: '',
    defaultArea: '',
    defaultBudgetMin: null,
    defaultBudgetMax: null,
    defaultPropertyType: 'any', // any | apartment | duplex | studio | sublet | commercial
  },

  // Landlord-scope settings.
  landlord: {
    inquiryNotifications: true,
    autoReplyEnabled: false,
    autoReplyMessage: '',
    showPhoneOnListings: true,
    instantBooking: false,
    allowVisitRequests: true,
    quietHours: { enabled: false, from: '22:00', until: '08:00' },
    defaultListingType: 'apartment', // apartment | duplex | studio | sublet | commercial
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Deep-merge `patch` onto `base` without mutating either. Arrays and scalars
 * from `patch` replace the base value; nested objects recurse. Used to layer
 * a server/cache payload on top of DEFAULT_SETTINGS so the UI never reads an
 * `undefined` nested field.
 */
export function mergeSettings(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!isObj(patch)) return out;
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    if (isObj(pv) && isObj(out[key])) {
      out[key] = mergeSettings(out[key], pv);
    } else if (pv !== undefined) {
      out[key] = pv;
    }
  }
  return out;
}

function authHeaders() {
  const t = getToken();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.code = data.code;
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

/** Read the locally cached settings (always fully-defaulted). */
export function getCachedSettings() {
  return mergeSettings(DEFAULT_SETTINGS, readJson(CACHE_KEY, null) || {});
}

function cache(settings) {
  writeJson(CACHE_KEY, settings);
  broadcast(CACHE_KEY);
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Fetch settings from the backend, always returning a fully-defaulted object.
 * Falls back to the local cache when unauthenticated or offline.
 * @returns {Promise<object>} complete settings object
 */
export async function getSettings() {
  if (!getToken()) return getCachedSettings();
  try {
    const data = await call('/users/me/preferences');
    const merged = mergeSettings(DEFAULT_SETTINGS, data.preferences || {});
    cache(merged);
    return merged;
  } catch {
    return getCachedSettings();
  }
}

/**
 * Persist a partial settings patch. The cache is updated immediately (so the
 * UI is instant/optimistic) and the backend is patched when authenticated.
 * @param {object} patch partial settings, same shape as DEFAULT_SETTINGS
 * @returns {Promise<object>} the complete, merged settings after the write
 */
export async function updateSettings(patch) {
  // Optimistic local merge + broadcast first.
  const optimistic = mergeSettings(getCachedSettings(), patch);
  cache(optimistic);

  if (!getToken()) return optimistic;

  try {
    const data = await call('/users/me/preferences', { method: 'PATCH', body: patch });
    const merged = mergeSettings(DEFAULT_SETTINGS, data.preferences || {});
    cache(merged);
    return merged;
  } catch (err) {
    // Keep the optimistic value locally; surface the error so callers can
    // decide whether to toast. The cache already reflects the intended state.
    if (err.status === 400) throw err; // validation — caller should show it
    return optimistic;
  }
}

/** Subscribe to cross-tab / same-tab settings changes. Returns an unsubscribe fn. */
export function onSettingsChanged(listener) {
  return subscribe(CACHE_KEY, listener);
}

// ─── Backwards-compatible aliases ───────────────────────────────────────────
// Older callers (and the previous SharedSettings implementation) imported
// getPreferences/setPreferences. Keep them working — same underlying store.

/** @deprecated use getSettings() */
export async function getPreferences() {
  const settings = await getSettings();
  return { preferences: settings };
}

/** @deprecated use updateSettings() */
export async function setPreferences(patch) {
  const settings = await updateSettings(patch);
  return { preferences: settings };
}
