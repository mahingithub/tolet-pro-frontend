/**
 * bookingService.js — HTTP client for the /api/bookings endpoints.
 * ──────────────────────────────────────────────────────────────────────────
 * Follows the same pattern as inquiryService.js / chatService.js:
 *   • Uses getCurrentToken() for Bearer auth
 *   • Falls back to import.meta.env.VITE_API_BASE_URL or localhost:5000
 *   • Named exports (not a class)
 */

import { getCurrentToken } from './authService';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '');
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

// ── Booking CRUD ────────────────────────────────────────────────────────────

/** Create a new booking (landlord converts an inquiry to a lease). */
export async function createBooking(data) {
  const { booking } = await request('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return booking;
}

/** List all bookings for the logged-in landlord. */
export async function listHostBookings() {
  const { bookings } = await request('/api/bookings/host');
  return bookings || [];
}

/** List all bookings for the logged-in tenant. */
export async function listTenantBookings() {
  const { bookings } = await request('/api/bookings/tenant');
  return bookings || [];
}

/** Mark a month as paid/partial/due in a booking's rent ledger. */
export async function updateLedger(bookingId, monthKey, data) {
  const { booking } = await request(`/api/bookings/${bookingId}/ledger/${monthKey}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return booking;
}

/** Undo a payment record (delete ledger entry + receipt). */
export async function undoLedger(bookingId, monthKey) {
  const { booking } = await request(`/api/bookings/${bookingId}/ledger/${monthKey}`, {
    method: 'DELETE',
  });
  return booking;
}

/** Update booking settings (autoReminder, rentDueDay, etc.). */
export async function updateBookingSettings(bookingId, data) {
  const { booking } = await request(`/api/bookings/${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return booking;
}

/** Delete / Exclude a booking — SOFT delete (status → 'cancelled' server-side). */
export async function cancelBooking(bookingId) {
  const { success } = await request(`/api/bookings/${bookingId}`, {
    method: 'DELETE',
  });
  return success;
}

// ── Multi-member occupants ────────────────────────────────────────────────

/** Add an occupant (member) to a booking. */
export async function addMember(bookingId, data) {
  const { booking } = await request(`/api/bookings/${bookingId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return booking;
}

/** Update an occupant's details (name, rent, space labels, status, …). */
export async function updateMember(bookingId, memberId, data) {
  const { booking } = await request(`/api/bookings/${bookingId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return booking;
}

/**
 * Remove an occupant. Soft move-out by default (keeps rent history); pass
 * { hard: true } to fully delete a member added by mistake.
 */
export async function removeMember(bookingId, memberId, { hard = false } = {}) {
  const qs = hard ? '?hard=true' : '';
  const { booking } = await request(`/api/bookings/${bookingId}/members/${memberId}${qs}`, {
    method: 'DELETE',
  });
  return booking;
}

/** Mark a month paid/partial/due in a specific member's rent ledger. */
export async function updateMemberLedger(bookingId, memberId, monthKey, data) {
  const { booking } = await request(`/api/bookings/${bookingId}/members/${memberId}/ledger/${monthKey}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return booking;
}

/** Undo a member's payment record for a month (deletes ledger entry + receipt). */
export async function undoMemberLedger(bookingId, memberId, monthKey) {
  const { booking } = await request(`/api/bookings/${bookingId}/members/${memberId}/ledger/${monthKey}`, {
    method: 'DELETE',
  });
  return booking;
}

/** A tenant self-joins a booking with an invite code. Returns { booking, memberId }. */
export async function joinByInvite(inviteCode) {
  return request('/api/bookings/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
}
