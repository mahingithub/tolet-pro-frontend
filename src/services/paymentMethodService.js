/**
 * paymentMethodService.js — HTTP client for /api/payment-methods.
 * ──────────────────────────────────────────────────────────────────────────
 * Landlord manual-payment accounts (bKash / Nagad / Rocket / Bank) for the
 * V1 no-gateway rent flow. Same pattern as bookingService.js:
 *   • getCurrentToken() Bearer auth
 *   • VITE_API_BASE_URL or localhost:5000
 *   • named exports
 * QR uploads use FormData (never set Content-Type — the browser adds the
 * multipart boundary itself).
 */

import { getCurrentToken } from './authService';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

async function request(path, options = {}) {
  const token = getCurrentToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
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

// Multipart helper — no JSON Content-Type so the boundary is auto-set.
async function upload(path, formData, method = 'POST') {
  const token = getCurrentToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
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

// ── Landlord ──────────────────────────────────────────────────────────────

/** List the logged-in landlord's payment methods. */
export async function listMyPaymentMethods() {
  const { methods } = await request('/api/payment-methods');
  return methods || [];
}

/** Add a payment method. data: { type, accountHolderName, accountNumber, bankName?, branchName?, isDefault?, isActive? } */
export async function createPaymentMethod(data) {
  const { method } = await request('/api/payment-methods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return method;
}

/** Update a method — edit fields, toggle active, or set default. */
export async function updatePaymentMethod(id, data) {
  const { method } = await request(`/api/payment-methods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return method;
}

/** Delete a payment method (also removes its QR from Cloudinary). */
export async function deletePaymentMethod(id) {
  return request(`/api/payment-methods/${id}`, { method: 'DELETE' });
}

/** Upload / replace the QR image for a method. `file` is a File/Blob. */
export async function uploadPaymentMethodQr(id, file) {
  const fd = new FormData();
  fd.append('file', file);
  const { method } = await upload(`/api/payment-methods/${id}/qr`, fd);
  return method;
}

/** Remove the QR image from a method. */
export async function deletePaymentMethodQr(id) {
  const { method } = await request(`/api/payment-methods/${id}/qr`, { method: 'DELETE' });
  return method;
}

// ── Tenant ──────────────────────────────────────────────────────────────

/** Fetch the landlord's ACTIVE payment methods for a booking the tenant is on. */
export async function listPaymentMethodsForBooking(bookingId) {
  const { methods } = await request(`/api/payment-methods/booking/${bookingId}`);
  return methods || [];
}
