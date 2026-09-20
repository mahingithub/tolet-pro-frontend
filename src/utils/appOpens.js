/**
 * appOpens.js — how many times this account has opened the app on this device.
 * ──────────────────────────────────────────────────────────────────────────
 * WHY A COUNT AND NOT A DATE.
 * It exists to answer one question: "has this person used the app enough that
 * asking them something is fair?" A timestamp cannot answer that — someone who
 * installed the app a month ago and opened it once is not a user. Three
 * separate launches is a deliberate return, which is the cheapest honest proof
 * we can get without asking.
 *
 * Its first caller is OfferOptInPrompt, which used to require a landlord to own
 * a property or a tenant to hold an active tenancy before it would ask about
 * WhatsApp offers. That gate was far narrower than it looked: most live bookings
 * carry no occupant row, so the majority of tenants were never asked at all.
 * They had not declined — the question never reached them, and the admin console
 * read the resulting silence as "31 never opted in".
 *
 * PER ACCOUNT, NOT PER DEVICE. A shared phone is normal here, and one person's
 * familiarity with the app is not a reason to start asking the next person
 * things. Keyed by user id for the same reason the "already asked" record is.
 *
 * SURVIVES LOGOUT, like that record — the prefix is registered in
 * services/authService.js → DEVICE_KEEP_PREFIXES. Otherwise signing out would
 * reset the count and a user who signs in and out would never reach three.
 */

const KEY_PREFIX = 'tolet_pro::app_opens';

const keyFor = (userId) => `${KEY_PREFIX}::${userId}`;

// Counting stops here. The only question anyone asks of this value is "is it at
// least N", so storing 4 and storing 900 are the same answer — and a number
// that climbs forever is a number that eventually looks like tracking.
const CEILING = 10;

// Already counted in THIS page load. `AppOpenReporter`'s effect can run more
// than once for a single launch — React StrictMode double-invokes it in
// development, and an auth refresh re-runs it in production — and neither is a
// new app open. Module scope, so it resets exactly when the page does, which is
// precisely the lifetime of one launch.
const countedThisSession = new Set();

/** How many launches this account has made. 0 when unknown or unavailable. */
export function appOpenCount(userId) {
  if (!userId) return 0;
  try {
    return Number(window.localStorage.getItem(keyFor(userId))) || 0;
  } catch {
    // Private browsing / storage disabled. Reporting 0 keeps every count-gated
    // prompt quiet rather than firing it on every single launch, which is the
    // safer direction to be wrong in.
    return 0;
  }
}

/**
 * Record one launch. Idempotent within a page load.
 * @returns {number} the count after recording
 */
export function recordAppOpen(userId) {
  if (!userId) return 0;
  const current = appOpenCount(userId);
  if (countedThisSession.has(String(userId))) return current;
  countedThisSession.add(String(userId));

  if (current >= CEILING) return current;
  const next = current + 1;
  try {
    window.localStorage.setItem(keyFor(userId), String(next));
  } catch {
    return current;
  }
  return next;
}

/** Has this account opened the app at least `n` times? */
export const hasOpenedAtLeast = (userId, n) => appOpenCount(userId) >= n;
