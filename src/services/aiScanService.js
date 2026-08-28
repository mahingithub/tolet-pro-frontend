/**
 * aiScanService.js — one client for the document scanner.
 * ──────────────────────────────────────────────────────────────────────────
 * Two screens scan: the bulk খাতা reader (many tenants at once) and the
 * per-seat intake form (one tenant, filling in the form the landlord is
 * already looking at). They call the SAME endpoint with the same shapes, so
 * the call lives here rather than being written twice — a second copy of "how
 * we talk to the scanner" is exactly how the scanner ended up on its own
 * booking-creation path and orphaned every lease it wrote.
 */

import { getCurrentToken } from './authService';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

/** Read a File into the full data-URL the scan endpoint accepts. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Send one page to the scanner.
 *
 * @param {object} args
 * @param {string} args.imageBase64  full data-URL; the server strips the prefix
 * @param {string} [args.mimeType]
 * @param {'khata'|'form'} [args.mode]
 *   khata → a rent ledger page: many tenants, but only names, rooms and rent.
 *   form  → an admission form: ONE tenant, with nearly every field on it.
 * @param {object} [args.defaultSettings]
 * @returns {Promise<{tenants: object[], rawText: string, parseError?: boolean}>}
 */
export async function scanDocument({ imageBase64, mimeType = 'image/jpeg', mode = 'khata', defaultSettings = {} }) {
  const token = getCurrentToken();
  const res = await fetch(`${BASE}/api/ai/scan-ledger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ imageBase64, mimeType, mode, defaultSettings }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Scan a single admission form and return it as a tenant-profile patch, ready
 * to merge into the intake form the landlord already has open.
 *
 * Returns `null` when the page yielded nothing readable — the caller keeps
 * whatever the landlord had typed rather than wiping it with blanks.
 */
export async function scanTenantForm(file) {
  const imageBase64 = await fileToDataUrl(file);
  const { tenants } = await scanDocument({
    imageBase64,
    mimeType: file.type || 'image/jpeg',
    mode: 'form',
  });
  const t = Array.isArray(tenants) ? tenants[0] : null;
  if (!t) return null;

  // Only the keys a tenant profile owns, and only the ones the page actually
  // had. A blank on the form must not overwrite something already typed.
  const patch = {};
  const put = (k, val) => { if (String(val || '').trim()) patch[k] = String(val).trim(); };

  put('name', t.name);
  put('phone', t.phone);
  put('moveInDate', t.moveInDate);
  Object.entries(t.tenantProfile || {}).forEach(([k, val]) => put(k, val));

  return { patch, raw: t };
}
