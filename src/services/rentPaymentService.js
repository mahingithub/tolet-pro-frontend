/**
 * rentPaymentService.js — HTTP client for /api/rent-payments.
 * ──────────────────────────────────────────────────────────────────────────
 * Tenant manual rent submissions ("I have paid") + landlord verification for
 * the V1 no-gateway rent flow. Same pattern as bookingService.js.
 * Screenshot proof uploads use FormData (field name 'file').
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

async function upload(path, formData) {
  const token = getCurrentToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
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

// ── Tenant ──────────────────────────────────────────────────────────────

/**
 * Submit a manual rent payment claim.
 * data: { bookingId, monthKey, monthLabel, amount, txnId, paymentDate,
 *         paymentMethodType, paymentMethodLabel, notes }
 */
export async function submitRentPayment(data) {
  const { submission } = await request('/api/rent-payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return submission;
}

/** Attach a payment screenshot to a submission. `file` is a File/Blob. */
export async function uploadRentPaymentScreenshot(id, file) {
  const fd = new FormData();
  fd.append('file', file);
  const { submission } = await upload(`/api/rent-payments/${id}/screenshot`, fd);
  return submission;
}

/** List the tenant's own submissions. */
export async function listTenantRentPayments() {
  const { submissions } = await request('/api/rent-payments/tenant');
  return submissions || [];
}

// ── Landlord ──────────────────────────────────────────────────────────────

/** List the landlord's submissions, optionally filtered by status. */
export async function listHostRentPayments(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const { submissions } = await request(`/api/rent-payments/host${qs}`);
  return submissions || [];
}

/** Approve a submission → writes the rent ledger + generates a receipt. */
export async function approveRentPayment(id) {
  return request(`/api/rent-payments/${id}/approve`, { method: 'POST' });
}

/** Reject a submission with an optional reason. */
export async function rejectRentPayment(id, reason) {
  const { submission } = await request(`/api/rent-payments/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || '' }),
  });
  return submission;
}

/** Delete a reviewed (approved/rejected) submission from the landlord's history. */
export async function deleteRentPayment(id) {
  return request(`/api/rent-payments/${id}`, { method: 'DELETE' });
}
