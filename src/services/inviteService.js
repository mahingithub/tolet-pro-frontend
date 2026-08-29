/**
 * inviteService.js — HTTP client for /api/invite (tenant self-onboarding).
 * ──────────────────────────────────────────────────────────────────────────
 * Same pattern as bookingService.js: getCurrentToken() for Bearer auth, named
 * exports, VITE_API_BASE_URL with a localhost fallback.
 *
 * One thing here is different and worth naming: `resolveInvite` is the only
 * call in this file that works WITHOUT a token. The link a tenant taps may
 * arrive on a phone with no account yet, and the app has to be able to render
 * "Welcome to Green View — room 203" before asking anyone to sign up. Every
 * other call sends auth.
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

// ── Landlord: share tokens ──────────────────────────────────────────────────

/** The building's universal invite. Mints the token on first call. */
export async function getBuildingInvite(buildingId) {
  const { invite } = await request(`/api/invite/building/${buildingId}`);
  return invite;
}

/** One room's invite. Mints the token on first call. */
export async function getUnitInvite(unitId) {
  const { invite } = await request(`/api/invite/unit/${unitId}`);
  return invite;
}

/** Issue a new token. Every QR already printed from the old one stops working. */
export async function revokeBuildingInvite(buildingId) {
  const { invite } = await request(`/api/invite/building/${buildingId}/revoke`, { method: 'POST' });
  return invite;
}

export async function revokeUnitInvite(unitId) {
  const { invite } = await request(`/api/invite/unit/${unitId}/revoke`, { method: 'POST' });
  return invite;
}

/** Stop / resume accepting new tenants through the universal link. */
export async function setBuildingInviteEnabled(buildingId, enabled) {
  const { enabled: next } = await request(`/api/invite/building/${buildingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
  return next;
}

// ── Landlord: the pending queue ─────────────────────────────────────────────

/** Submissions waiting on the landlord. status: 'pending' | 'approved' | 'rejected'. */
export async function listOnboardings(status = 'pending') {
  const { onboardings } = await request(`/api/invite/onboardings?status=${encodeURIComponent(status)}`);
  return onboardings || [];
}

export async function approveOnboarding(id) {
  return request(`/api/invite/onboardings/${id}/approve`, { method: 'POST' });
}

export async function rejectOnboarding(id, reason = '') {
  return request(`/api/invite/onboardings/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ── Tenant ──────────────────────────────────────────────────────────────────

/**
 * What's behind this link. PUBLIC — deliberately callable while logged out.
 * Returns { scope, buildingName, hostName, needsApproval, unit? , rooms? }.
 */
export async function resolveInvite(token) {
  const { invite } = await request(`/api/invite/resolve/${encodeURIComponent(token)}`);
  return invite;
}

/** The completed form. Requires a login. */
export async function submitOnboarding(token, payload) {
  const { onboarding } = await request(`/api/invite/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return onboarding;
}

/** The tenant's own submissions and where each one stands. */
export async function listMySubmissions() {
  const { submissions } = await request('/api/invite/my-submissions');
  return submissions || [];
}

// ── Tenant: shifting room inside a building they are already in ─────────────

/**
 * Where this tenant could move to. Returns the building they are currently in,
 * the room they are in now, and every active room with its vacancy — the same
 * list the QR picker shows, from the same helper, so a room cannot look free on
 * one screen and full on the other.
 */
export async function getShiftOptions(bookingId) {
  const { shift } = await request(`/api/invite/shift/${encodeURIComponent(bookingId)}/rooms`);
  return shift;
}

/**
 * "I have moved to 204." Their name, phone, NID, photo and emergency contact
 * come off the row they are already on — the server carries them across, so
 * this only sends what actually changed. Waits for the landlord, like any
 * building-scoped claim.
 */
export async function requestShift(payload) {
  const { onboarding } = await request('/api/invite/shift', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return onboarding;
}
