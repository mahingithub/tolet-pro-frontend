/**
 * marketplaceService.js — the tenant's side of the service marketplace.
 * ──────────────────────────────────────────────────────────────────────────
 * Browsing is PUBLIC and ordering is not, which is the whole shape of this
 * file. A guest can open /services, see who is nearby and ring them; placing an
 * order or leaving a review needs an account, because both create an obligation
 * between two named people.
 *
 * ─── THIS APP TALKS TO TWO SURFACES AND NEITHER IS THE PROVIDER'S ────────────
 *   /api/services/*          public browse — categories, nearby, one provider,
 *                            its reviews, and the contact ledger write
 *   /api/service-requests/*  the tenant's own orders, behind requireAuth
 *
 * The merchant's inbox (/api/merchant/requests) is a THIRD surface behind a
 * different token audience and is unreachable from here — a tenant token is
 * rejected by it outright. Nothing in this file should ever grow a path under
 * /merchant.
 *
 * ─── THE CATEGORY REGISTRY IS FETCHED, NEVER BUNDLED ─────────────────────────
 * config/serviceCategories.js on the server drives the provider's registration
 * form, the price editor, server-side validation AND this page. A copy baked
 * into this bundle would fork it, and the first category change would ship a
 * tenant card asking for a field that no longer exists.
 */

import { getCurrentToken } from './authService';

// Mirror bookingService: strip a trailing '/api' so the full '/api/…' path is
// written out at each call site and is greppable.
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

function toError(status, body) {
  const err = new Error(body.message || body.code || `অনুরোধ ব্যর্থ হয়েছে (HTTP ${status})।`);
  err.status = status;
  err.code = body.code;
  err.details = body.details;
  return err;
}

/**
 * @param {string} path
 * @param {object} [opts]
 * @param {'required'|'optional'|'none'} [opts.auth='none'] — `optional` sends
 *   the token when there is one and never fails without it, which is what the
 *   public browse endpoints want: a guest still counts as demand.
 */
async function call(path, { method = 'GET', body, auth = 'none', signal } = {}) {
  const token = auth === 'none' ? null : getCurrentToken?.();
  if (auth === 'required' && !token) {
    const err = new Error('আগে লগইন করুন।');
    err.status = 401;
    err.code = 'missing_token';
    throw err;
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw toError(res.status, data);
  return data;
}

/** Drop empty values so a blank thana never becomes `?thana=`. */
const qs = (params) => {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && String(v).trim() !== '') out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : '';
};

// ─── The registry ────────────────────────────────────────────────────────────

/**
 * Every category, in the light tile shape (id, label, blurb, icon, status,
 * interaction). 3.7 kB rather than the 23.5 kB full view, which carries the
 * provider registration fields this app has no use for.
 *
 * `status: 'all'` because the tenant grid shows PLANNED categories too — as a
 * "coming soon" tile that records demand. That demand gauge is how we decide
 * which category to open next, and hiding the tile would delete the signal.
 */
export const getServiceCategories = () =>
  call(`/services/categories${qs({ view: 'grid', status: 'all' })}`);

/**
 * ONE category, in full — including `providerFields` and every price row's
 * label and unit.
 *
 * Needed to turn a provider's raw `{ kg_12: 1450 }` into "১২ কেজি — ৳১৪৫০".
 * Resolves PLANNED categories too, so a provider registered under one we later
 * took out of the launch set still renders with real labels.
 */
export const getServiceCategory = (id) => call(`/services/categories/${id}`);

// ─── Browse ──────────────────────────────────────────────────────────────────

/**
 * Which category tiles are worth rendering HERE, with a count per category.
 * Lets a tile say "৪ জন কাছে আছে" instead of merely existing — and lets the
 * page avoid sending somebody into a category with nobody in it.
 */
export const getNearbyCategories = ({ lat, lng, thana, radius } = {}) =>
  call(`/services/nearby/categories${qs({ lat, lng, thana, radius })}`);

/**
 * Providers near the tenant, nearest band first.
 *
 * The response says `sortedByDistance` and carries an `origin` with a `source`
 * of 'gps' | 'thana_centroid' | 'thana_name'. Only 'gps' justifies printing a
 * distance to the tenant — a centroid is a neighbourhood guess, and a screen
 * that prints "৪০০ মিটার দূরে" off one is lying with a decimal point.
 */
export const getNearbyProviders = ({ category, lat, lng, thana, radius, limit } = {}) =>
  call(`/services/nearby${qs({ category, lat, lng, thana, radius, limit })}`);

export const getProvider = (id) => call(`/services/providers/${id}`);

export const getProviderReviews = (id, limit) =>
  call(`/services/providers/${id}/reviews${qs({ limit })}`);

// ─── The connection ledger ───────────────────────────────────────────────────

/**
 * Record that a card was opened, or that ফোন করুন was tapped.
 *
 * For the four contact-tier categories — গৃহকর্মী, ইলেকট্রিশিয়ান, প্লাম্বার,
 * ইন্টারনেট — there are no orders at all, so this call IS the provider's entire
 * return-on-investment story for his registration fee. Failing to send it does
 * not break anything the tenant can see, which is exactly why it is easy to
 * forget: every call site swallows its own error and never blocks a `tel:`.
 *
 * `kind` may only be 'view' or 'call_tel'. Orders write their own ledger row
 * server-side, so a client cannot inflate a provider's order count.
 */
export const recordContact = (payload) =>
  call('/services/contact', { method: 'POST', auth: 'optional', body: payload })
    .catch(() => null);

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * Place an order or a structured callback.
 *
 * `clientRequestId` is not optional in practice: a double tap on a flaky
 * connection must not buy two cylinders, and the server returns the ORIGINAL
 * order with `duplicate: true` rather than an error the client would retry
 * again. Callers generate one per attempt and reuse it across retries.
 *
 * Prices are NOT sent. The server reads the provider's current price rows and
 * freezes them onto the order, so a client cannot name its own price.
 */
export const placeServiceRequest = (payload) =>
  call('/service-requests', { method: 'POST', auth: 'required', body: payload });

export const listMyServiceRequests = ({ open, limit } = {}) =>
  call(`/service-requests${qs({ open: open ? 1 : undefined, limit })}`, { auth: 'required' });

export const getMyServiceRequest = (id) =>
  call(`/service-requests/${id}`, { auth: 'required' });

export const cancelServiceRequest = (id, reason) =>
  call(`/service-requests/${id}/cancel`, { method: 'POST', auth: 'required', body: { reason } });

/**
 * Where the delivery has got to.
 *
 * The tenant watches the same dot the shopkeeper does — they are the one
 * waiting at the door. `track` is null until the shop actually sends somebody,
 * and `track.isOpen` says whether it is still worth polling; a watcher that
 * cannot tell a finished delivery from a stalled one polls forever.
 */
export const getDeliveryTrack = (requestId) =>
  call(`/service-requests/${requestId}/track`, { auth: 'required' });

// ─── Reviews ─────────────────────────────────────────────────────────────────

/**
 * Rate a shop, or replace the rating already there.
 *
 * Gated server-side on a row in the connection ledger — a completed order, or
 * for the contact-tier categories a recorded call. A 403 `not_entitled` is the
 * normal answer for somebody who has not dealt with this provider, and the
 * message on it explains which of the two is missing.
 */
export const rateProvider = ({ providerId, rating, comment }) =>
  call('/service-requests/reviews', {
    method: 'POST', auth: 'required', body: { providerId, rating, comment },
  });

export const getMyReview = (providerId) =>
  call(`/service-requests/reviews/mine${qs({ providerId })}`, { auth: 'required' });
