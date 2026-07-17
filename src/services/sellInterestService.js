/**
 * sellInterestService.js — records "I am interested in selling my property"
 * clicks while self-service selling is Coming Soon (see the SALE_INTENT_ENABLED
 * flag in constants/listingIntents.js).
 * ──────────────────────────────────────────────────────────────────────────
 * No form / PII is collected here. The backend attaches the logged-in user's
 * account name + phone automatically (for agency follow-up); guests are counted
 * anonymously. Auth is OPTIONAL — we send the Bearer token when we have one so
 * the click is attributed, but the endpoint also accepts anonymous clicks.
 */

import { getCurrentToken } from './authService';

// Mirror bookingService: strip a trailing '/api' so we can prefix the full
// '/api/…' path ourselves.
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

/**
 * Record one interest click.
 * @param {object} [opts]
 * @param {string} [opts.source='add_property'] where the click came from
 * @param {'sell'|'buy'} [opts.kind='sell']
 * @returns {Promise<object>} the recorded interest ({ ok, interest })
 */
export async function recordSellInterest({ source = 'add_property', kind = 'sell' } = {}) {
  const token = getCurrentToken?.();
  const res = await fetch(`${BASE}/api/sell-interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ source, kind }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  return res.json();
}
