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
/**
 * `opId` is the offline queue's idempotency key, sent as a header so it works
 * for DELETE too and can never be mistaken for a field of the entity being
 * written. The server applies each id exactly once — which matters here because
 * a rent payment ACCUMULATES, so a write delivered twice would double the money.
 */
async function request(path, options = {}, opId) {
  const token = getCurrentToken();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opId ? { 'X-Op-Id': opId } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (cause) {
    // fetch only rejects when the request never got an answer — no network, the
    // server unreachable. The queue treats this as "try again later"; a status
    // code below means the server DID answer and is a real refusal.
    const err = new Error('নেটওয়ার্কে পৌঁছানো যায়নি।');
    err.offline = true;
    err.cause = cause;
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = body.code;
    // 5xx / 429 are the server having a bad moment, not a refusal of the write.
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }
  return res.json();
}

// ── Booking CRUD ────────────────────────────────────────────────────────────

/** Create a new booking (landlord converts an inquiry to a lease). */
export async function createBooking(data, opId) {
  const { booking } = await request('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  }, opId);
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
export async function updateLedger(bookingId, monthKey, data, opId) {
  const { booking } = await request(`/api/bookings/${bookingId}/ledger/${monthKey}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, opId);
  return booking;
}

/** Undo a payment record (delete ledger entry + receipt). */
export async function undoLedger(bookingId, monthKey, opId) {
  const { booking } = await request(`/api/bookings/${bookingId}/ledger/${monthKey}`, {
    method: 'DELETE',
  }, opId);
  return booking;
}

/** Update booking settings (autoReminder, rentDueDay, etc.). */
export async function updateBookingSettings(bookingId, data, opId) {
  const { booking } = await request(`/api/bookings/${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, opId);
  return booking;
}

/** Delete / Exclude a booking — SOFT delete (status → 'cancelled' server-side). */
export async function cancelBooking(bookingId, opId) {
  const { success } = await request(`/api/bookings/${bookingId}`, {
    method: 'DELETE',
  }, opId);
  return success;
}

// ── Multi-member occupants ────────────────────────────────────────────────

/** Add an occupant (member) to a booking. */
export async function addMember(bookingId, data, opId) {
  const { booking } = await request(`/api/bookings/${bookingId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, opId);
  return booking;
}

/** Update an occupant's details (name, rent, space labels, status, …). */
export async function updateMember(bookingId, memberId, data, opId) {
  const { booking } = await request(`/api/bookings/${bookingId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, opId);
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
export async function updateMemberLedger(bookingId, memberId, monthKey, data, opId) {
  const { booking } = await request(`/api/bookings/${bookingId}/members/${memberId}/ledger/${monthKey}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, opId);
  return booking;
}

/** Undo a member's payment record for a month (deletes ledger entry + receipt). */
export async function undoMemberLedger(bookingId, memberId, monthKey, opId) {
  const { booking } = await request(`/api/bookings/${bookingId}/members/${memberId}/ledger/${monthKey}`, {
    method: 'DELETE',
  }, opId);
  return booking;
}

/**
 * What the "Remind" confirm dialog shows before anything is sent: who, which
 * month, how much, and the default wording the landlord can then edit.
 *
 * The message text comes from the SERVER on purpose — it is the same builder
 * the 09:00 cron uses, so the dialog can never show wording that differs from
 * what actually goes out.
 *
 * @returns {Promise<{ok, monthKey, tenantName, amountDue, milestone, message,
 *                    alreadySent, alreadySentAt, channels}>}
 *          channels: { whatsapp: boolean, inApp: boolean } — what we can reach
 *          them on. `alreadySent` means this month's single manual reminder is
 *          already spent.
 */
export async function previewRentReminder(bookingId, { monthKey, memberId } = {}) {
  const qs = new URLSearchParams({
    ...(monthKey ? { monthKey } : {}),
    ...(memberId ? { memberId } : {}),
  }).toString();
  return request(`/api/bookings/${bookingId}/remind/preview${qs ? `?${qs}` : ''}`);
}

/**
 * Send a rent reminder to one occupant right now — the landlord's "Remind"
 * button, after they confirmed the dialog.
 *
 * Goes out on WhatsApp and the in-app notification ONLY. Never SMS: the app is
 * free to landlords, so a per-message cost cannot be triggered by a button.
 *
 * Allowed ONCE per tenant per rent month, forever — not a cooldown. A second
 * attempt comes back 429 `already_sent_this_month`.
 *
 * No `opId`: this is not a queued offline write. Sending needs the network by
 * definition, so a failure here is a real refusal to report, never something
 * to replay later.
 *
 * @param {string} bookingId
 * @param {{ monthKey?: string, memberId?: string|null, message?: string }} opts
 *        monthKey omitted → server picks the earliest unpaid month
 *        memberId omitted → the booking-level tenant (flat / single tenancy)
 *        message  omitted → the default wording from the preview
 * @returns {Promise<{ok, monthKey, milestone, tenantName, amountDue, customised, channels}>}
 *          channels: { inApp, whatsapp, sms } each 'sent' | 'queued' | 'failed' | 'skipped'
 * @throws  {Error} with `.status` and `.code` ('already_sent_this_month') — the
 *          message is Bengali and safe to show the landlord as-is.
 */
export async function sendRentReminder(bookingId, { monthKey, memberId, message } = {}) {
  return request(`/api/bookings/${bookingId}/remind`, {
    method: 'POST',
    body: JSON.stringify({
      ...(monthKey ? { monthKey } : {}),
      ...(memberId ? { memberId } : {}),
      ...(message ? { message } : {}),
    }),
  });
}

/** A tenant self-joins a booking with an invite code. Returns { booking, memberId }. */
export async function joinByInvite(inviteCode) {
  return request('/api/bookings/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
}
