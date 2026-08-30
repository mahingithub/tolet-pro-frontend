/*
 * buildingScope.js
 * ──────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for "which bookings belong to the building I'm
 * looking at".
 *
 * THE BUG THIS FILE REPLACES
 * The same six-line filter was copy-pasted into BookingsTab, RentTab,
 * DashboardTab (twice) and HostDashboard (twice), and every copy joined on the
 * property NAME:
 *
 *     bookings.filter(b => b.property === bldg.name)
 *
 * A lease whose typed name didn't match a building character-for-character
 * matched nothing, and — because the "all buildings" branch filtered the same
 * way — appeared on no screen at all. The row was in the database. The landlord
 * saw a success toast and then an empty list, which reads as "the save failed".
 * Picking Hostel or Single Room on the Add Tenant form cleared the pre-filled
 * building name, so it was those two formats that broke and flats that didn't.
 *
 * TWO RULES MAKE IT UNREPEATABLE
 *   1. Scoping is by `buildingId`. Names are for reading.
 *   2. With no building selected, NOTHING is filtered out. A booking that
 *      can't be placed shows up unassigned instead of disappearing — the
 *      failure mode is now visible rather than silent.
 *
 * `matchesLegacyName` exists only for rows written before the buildings/units
 * migration ran. It is a fallback for old data, never a way to place new data.
 */

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Pre-migration rows have no buildingId; fall back to the old name match. */
const matchesLegacyName = (booking, building) => (
  !booking?.buildingId && !!building && norm(booking?.property) === norm(building.name)
);

/** Does this booking belong to this building? Id first, legacy name second. */
export const bookingInBuilding = (booking, building) => {
  if (!building) return false;
  const bid = booking?.buildingId;
  if (bid) return String(bid) === String(building.id ?? building._id);
  return matchesLegacyName(booking, building);
};

/**
 * The bookings in scope for the current view.
 *
 * @param {Array}  bookings          all of the landlord's bookings
 * @param {Array}  buildings         the landlord's buildings (from the API)
 * @param {string} currentBuildingId the building being viewed, or null for all
 */
export const scopeBookings = (bookings, buildings, currentBuildingId) => {
  const list = Array.isArray(bookings) ? bookings : [];
  if (!currentBuildingId) {
    // Deliberately unfiltered. The old "all buildings" branch dropped anything
    // whose name didn't match, which is precisely how leases went missing.
    return list;
  }
  const building = (buildings || []).find(
    (b) => String(b.id ?? b._id) === String(currentBuildingId),
  );
  if (!building) return [];
  return list.filter((bk) => bookingInBuilding(bk, building));
};

// ── Building order ──────────────────────────────────────────────────────────
// Ground floor up, then room by room within a floor, then seat by seat within
// a room — the order a landlord walks their own building.
//
// Floor used to be free text on the booking ("3rd", "৩য়", "3"), which is why
// this could not be done before: three spellings of one floor sort three ways.
// Units carry an integer floor now, and a booking denormalises it, so a digit
// can be pulled back out reliably.
const floorRank = (b) => {
  const BN = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const s = String(b?.floorNumber ?? '').replace(/[০-৯]/g, (d) => BN[d] || d);
  const m = /-?\d+/.exec(s);
  // No floor recorded sorts last, so unlabelled rows never displace real ones.
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
};

// "101 · 102 · 110", not "101 · 110 · 102". Numeric where there are digits,
// locale-natural otherwise (for "A", "Shop-2" and the like).
const compareRoom = (a, b) => {
  const na = parseInt(String(a ?? '').replace(/\D/g, ''), 10);
  const nb = parseInt(String(b ?? '').replace(/\D/g, ''), 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Sort ANYTHING that carries `floorNumber` + `roomNumber` into building order:
 * expanded rent units, whole bookings, room groups. Ground floor up, then
 * 101 · 102 · 110 within the floor, then seat by seat inside a room.
 *
 * Every list of tenants the landlord reads — Rent Collection AND the Bookings
 * tenants view — goes through this, so the two screens can't disagree about
 * what order the building is in.
 *
 * Non-mutating: both screens derive their list every render.
 */
export const sortByBuildingOrder = (rows) => [...(rows || [])].sort((x, y) => (
  (floorRank(x) - floorRank(y))
  || compareRoom(x?.roomNumber, y?.roomNumber)
  // Same room ⇒ seats, in the order they were added to it.
  || String(x?.id ?? '').localeCompare(String(y?.id ?? ''), undefined, { numeric: true })
));

/** Rent Collection's original name for the same ordering. */
export const sortRentUnits = sortByBuildingOrder;

/**
 * Leases we could not place in any building — pre-migration rows whose name
 * matches nothing. Surfaced so the landlord can reassign them instead of
 * wondering where their tenant went.
 */
export const unassignedBookings = (bookings, buildings) => {
  const list = Array.isArray(bookings) ? bookings : [];
  const all = buildings || [];
  return list.filter((bk) => !bk?.buildingId && !all.some((b) => matchesLegacyName(bk, b)));
};
