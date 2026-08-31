/**
 * buildingService.js — HTTP client for /api/buildings and /api/units.
 * ──────────────────────────────────────────────────────────────────────────
 * Buildings used to live inside the landlord's profile blob with client-made
 * ids that nothing referenced; a booking found its building by matching the
 * property NAME with `===`. They are real records now, and `booking.buildingId`
 * is the join — see models/Building.js for the bug that forced the change.
 *
 * Same shape as bookingService.js: getCurrentToken() for auth, named exports.
 */

import { getCurrentToken } from './authService';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

/**
 * `opId` is the offline queue's idempotency key (see store/hostOps.js). Sent as
 * a header so it works for DELETE too. The server applies each id once, so a
 * room or a tenant placement replayed after a dead zone lands exactly once.
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
    // No answer at all — the queue retries this later. A status code below
    // means the server DID answer, and a refusal must not be retried forever.
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
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }
  return res.json();
}

// ── Buildings ───────────────────────────────────────────────────────────────

/** Every building the landlord owns, with unit / seat / occupancy counts. */
export async function listBuildings() {
  const { buildings } = await request('/api/buildings');
  return buildings || [];
}

/**
 * Create a building. `rentedAs` LOCKS which booking form this building ever
 * opens — 'seat' means the seat flow and nothing else.
 * @param {{name, address, category, subCategory, rentedAs, defaultMonthlyRent, defaultServiceCharge, defaultRentDueDay}} data
 */
export async function createBuilding(data) {
  const { building } = await request('/api/buildings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return building;
}

/** Rename / re-address / change defaults. Renaming is safe now — it's a label. */
export async function updateBuilding(id, data) {
  const { building } = await request(`/api/buildings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return building;
}

/** Soft delete — archived, so historic leases still resolve their building. */
export async function archiveBuilding(id) {
  const { success } = await request(`/api/buildings/${id}`, { method: 'DELETE' });
  return success;
}

// ── Units (rooms) ───────────────────────────────────────────────────────────

/**
 * Rooms in building order (ground floor up, 101 · 102 · 110 within a floor),
 * each carrying its occupants and vacant seat count.
 */
export async function listUnits(buildingId) {
  const { building, units } = await request(`/api/buildings/${buildingId}/units`);
  return { building, units: units || [] };
}

/** Create a room. No tenant needed — a room exists before anyone lives in it. */
export async function createUnit(buildingId, data, opId) {
  const { unit } = await request(`/api/buildings/${buildingId}/units`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, opId);
  return unit;
}

/**
 * Create a whole floor at once: "101" to "109" is nine rooms sharing one set of
 * terms. Rooms that already exist are SKIPPED rather than failing the batch, so
 * widening a range later just adds the new ones.
 * @returns {Promise<{created:number, skipped:number, skippedRooms:string[], units:object[]}>}
 */
export async function createUnitsBulk(buildingId, data) {
  return request(`/api/buildings/${buildingId}/units/bulk`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUnit(unitId, data, opId) {
  const { unit } = await request(`/api/units/${unitId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, opId);
  return unit;
}

/** Archive a room. Refused while someone is still living in it. */
export async function archiveUnit(unitId) {
  const { success } = await request(`/api/units/${unitId}`, { method: 'DELETE' });
  return success;
}

// ── Tenants inside a unit ───────────────────────────────────────────────────
// Neither of these creates a room, and neither creates a second booking for a
// room that already has one. That is the whole rule: the unit is set up once,
// and people are added to it or swapped out of it.

/**
 * Put a tenant into this unit — an empty seat in a hostel room, or a vacant
 * flat. Creates the unit's single booking only if it doesn't have one yet.
 * @param {string} unitId
 * @param {{name, phone, moveInDate, tenantProfile, monthlyRent?}} data
 */
export async function addTenantToUnit(unitId, data, opId) {
  return request(`/api/units/${unitId}/tenants`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, opId);
}

/**
 * The occupant left; someone else takes the SAME seat. The room, its rent and
 * the seat are untouched — only the person changes, and the outgoing member is
 * kept (moved-out) so their rent history survives.
 */
export async function replaceTenantInUnit(unitId, memberId, data) {
  return request(`/api/units/${unitId}/tenants/${memberId}/replace`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * The SAME person, a DIFFERENT room — 203 moves to 206. The mirror image of
 * replace: there the room stays and the person changes; here the person stays
 * and the room changes.
 *
 * Nothing is retyped. Their account link, NID, photo and emergency contact are
 * carried across server-side from the row being left. Their RENT HISTORY is
 * not — it stays on the old room, which is where the question "what did they
 * pay for 203" belongs.
 *
 * @param {string} unitId    the room they are leaving
 * @param {string} memberId  their member row, or 'primary' for a legacy
 *                           whole-unit tenancy that predates members[]
 * @param {{toUnitId, moveInDate?, monthlyRent?, seatLabel?}} data
 */
export async function shiftTenantToUnit(unitId, memberId, data) {
  return request(`/api/units/${unitId}/tenants/${memberId}/shift`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
