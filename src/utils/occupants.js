/*
 * occupants.js
 * ──────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for "who is actually living in this booking, and how
 * many of them are there".
 *
 * THE BUG THIS FILE REPLACES
 * Two different fields were being read as if they were the answer, and neither
 * one was:
 *
 *   booking.tenantsCount — a number the landlord types ONCE on the New Lease
 *     form. It is never updated when a seat is filled or vacated, and bookings
 *     created from a room (placeTenantInUnit) never set it at all. A hostel
 *     room with two occupants therefore rendered "1 Tenant", because
 *     `undefined || 1` is 1. The card contradicted the seat list inside it.
 *
 *   booking.tenant — the name typed at lease creation. For a SEAT building the
 *     server deliberately leaves it EMPTY (`tenant: isSeat ? '' : input.name`),
 *     because a hostel room has no single tenant. The card then showed no name
 *     at all, and there was no way to tell who was in the room without opening
 *     it. It also goes stale on flats: when a tenant joins with the invite code
 *     they become a member, and members[] is what every other screen reads.
 *
 * THE RULE
 * members[] is the occupancy record. It is the same array the rent ledger, the
 * capacity check and the tenant app all read, so anything derived from it can't
 * disagree with them. `tenantsCount` / `tenant` survive ONLY as the fallback
 * for legacy bookings that have no members[] at all.
 *
 * CAPACITY IS SEATS, NOT HEADS — mirrors seatsTaken() in the backend's
 * tenancy.service.js. One member row with seatsBooked = 4 fills a 4-seat room
 * by itself; counting heads there reports free seats that do not exist.
 */

/** Everyone still living here. A moved-out member is history, not an occupant. */
export const activeMembers = (booking) => (Array.isArray(booking?.members)
  ? booking.members.filter((m) => m && m.status !== 'moved-out')
  : []);

/**
 * How many SEATS this booking holds — the number that has to agree with the
 * server's capacity check. Rows written before seatsBooked existed are single
 * seats, hence the `|| 1`.
 */
export const seatsTaken = (booking) => activeMembers(booking)
  .reduce((n, m) => n + (Number(m.seatsBooked) || 1), 0);

/**
 * The occupant count to SHOW. Seats where there are members; the landlord's
 * typed headcount only for a legacy booking that has none.
 */
export const occupantCount = (booking) => {
  const seats = seatsTaken(booking);
  if (seats > 0) return seats;
  return Math.max(1, Number(booking?.tenantsCount) || 1);
};

/** Every occupant's name, in seat order. Empty for a legacy booking. */
export const occupantNames = (booking) => activeMembers(booking)
  .map((m) => String(m?.name || '').trim())
  .filter(Boolean);

/**
 * The person a card should be labelled with, and the picture it should show.
 *
 * The first active member wins over booking.tenant, because when someone joins
 * with the invite code THEY are the occupant and the typed name is a stale
 * snapshot. Falls back to the booking's own fields for legacy rows, and to a
 * plain "Tenant" so a card is never blank.
 */
export const primaryOccupant = (booking, language) => {
  const isBn = language === 'বাংলা';
  const first = activeMembers(booking)[0] || null;
  const name = String(first?.name || booking?.tenant || '').trim()
    || (isBn ? 'ভাড়াটিয়া' : 'Tenant');
  return {
    name,
    avatar: first?.avatar || booking?.tenantAvatar || '',
    phone: first?.phone || booking?.tenantPhone || '',
    init: (name.charAt(0) || '?').toUpperCase(),
    // True when the name came from a real member row rather than the typed
    // snapshot — the caller can trust it is current.
    fromMember: !!first,
  };
};

/**
 * "মামুনুর রশীদ, hello world" — who is in this unit, for a one-line summary.
 * Caps the list so a twelve-seat room doesn't run off the card; the remainder
 * is reported as "+N".
 */
export const occupantSummary = (booking, language, max = 2) => {
  const isBn = language === 'বাংলা';
  const names = occupantNames(booking);
  if (names.length === 0) {
    const solo = String(booking?.tenant || '').trim();
    return solo || (isBn ? 'কেউ নেই' : 'No one yet');
  }
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
};
