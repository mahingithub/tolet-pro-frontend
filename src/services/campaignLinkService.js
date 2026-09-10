/**
 * campaignLinkService.js — resolve a /r/<code> campaign short link.
 * ──────────────────────────────────────────────────────────────────────────
 * The link inside a promotional SMS or WhatsApp message points at
 * https://www.toletpro.rent/r/<code>, NOT at the API. That host is the one
 * verified in assetlinks.json, so on a phone with the app installed Android
 * opens the link inside the app (see DeepLinkHandler.jsx) and the session the
 * user already has is kept. A link straight to the API would always mean a
 * browser hop and a logged-out landing.
 *
 * Auth is OPTIONAL and deliberately so: the recipient of a re-engagement
 * campaign is usually signed out, and that is exactly who it is aimed at. The
 * token is sent when we have one only so the click is counted as "signed in";
 * the answer is identical either way.
 */

import { getCurrentToken } from './authService';

// Mirror sellInterestService: strip a trailing '/api' so we can prefix the full
// '/api/…' path ourselves.
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

/**
 * Resolve a campaign code to the in-app path it points at, counting the click.
 *
 * @param {string} code
 * @returns {Promise<{ path: string, campaign?: string, channel?: string }>}
 * @throws {Error} with `status` 404 when the code is dead or mistyped
 */
export async function resolveCampaignLink(code) {
  const token = getCurrentToken?.();
  const res = await fetch(`${BASE}/api/r/${encodeURIComponent(code)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
