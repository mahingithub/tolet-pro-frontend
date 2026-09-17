import { isNativeApp, safeAppPath } from './nativeExperience';

/**
 * "Look around freely, sign in to SAVE."
 * ──────────────────────────────────────────────────────────────────────────
 * The app lets a signed-out visitor walk the real screens — the Add Property
 * wizard, the rent ledger, the ledger forms — because a wall in front of them
 * teaches nothing about what the app does. The line is the WRITE: the moment
 * something would be stored, we ask for the account it would be stored under.
 *
 * The ask is dismissible on purpose. "Not now" leaves them exactly where they
 * were, still exploring; it is only that one save that did not happen.
 *
 * Two places call this, and between them they cover every write:
 *   • utils/fetchInterceptor.js — anything that would reach the server.
 *   • store/useLivingStore.js   — the ledger, which writes to the phone first
 *                                 and would otherwise save with no account.
 */
export const GUEST_SAVE_EVENT = 'guest:login-required';

/** A visitor inside the installed app with no session. */
export function isGuestInApp() {
  if (!isNativeApp()) return false;
  try { return !window.localStorage.getItem('auth:token'); } catch { return true; }
}

/**
 * @param {object} [opts]
 * @param {string} [opts.next]   where login should return them (defaults to here)
 * @param {string} [opts.action] short id of what they were saving, for the copy
 * @returns {boolean} true when the caller may go ahead with the write
 */
export function requireLoginToSave({ next, action } = {}) {
  if (!isGuestInApp()) return true;
  const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  window.dispatchEvent(new CustomEvent(GUEST_SAVE_EVENT, {
    detail: { next: safeAppPath(next || here), action: action || null },
  }));
  return false;
}
