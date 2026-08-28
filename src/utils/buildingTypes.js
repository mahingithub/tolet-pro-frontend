/*
 * buildingTypes.js
 * ──────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for how a building is classified and how that
 * classification is written on screen.
 *
 * THREE RESIDENTIAL TYPES
 *   Flat · Hostel · Single Room
 *
 * Family vs bachelor is NOT one of them. One building routinely holds flat 101
 * for a family, 102 for bachelors and 103 for either, so "suitable for" belongs
 * to each FLAT — see Unit.suitableFor. Classifying the whole building would
 * have forced a landlord to split one Green View into two buildings that do not
 * exist.
 *
 * Keep in step with models/Building.js — that file holds the enum this mirrors.
 */

// `rentedAs` decides which booking flow a building ever opens, and it is
// derived from the type, not chosen separately for flats.
export const RESIDENTIAL_TYPES = [
  {
    id: 'flat',
    en: 'Flat',
    bn: 'ফ্ল্যাট',
    hintEn: 'Whole flats let to one tenant each',
    hintBn: 'পুরো ফ্ল্যাট — একজন ভাড়াটিয়া',
    rentedAs: 'flat',
    // Whole-unit lets are never subdivided, so the wizard does not ask.
    canChooseRentedAs: false,
  },
  {
    id: 'hostel',
    en: 'Hostel',
    bn: 'হোস্টেল',
    hintEn: 'Rooms divided into seats',
    hintBn: 'রুমে সিট ভাগ করা',
    rentedAs: 'seat',
    // A hostel is usually let by seat but can be let by whole room.
    canChooseRentedAs: true,
  },
  {
    id: 'single_room',
    en: 'Single Room',
    bn: 'সিঙ্গেল রুম',
    hintEn: 'Individual rooms let out',
    hintBn: 'আলাদা আলাদা রুম ভাড়া',
    rentedAs: 'room',
    canChooseRentedAs: true,
  },
];

// The withdrawn revision briefly classified buildings as family_flat /
// bachelor_flat. Read those as plain 'flat' so a database migrated by that
// version still renders correctly; the migration rewrites the stored value and
// moves the distinction down onto each unit.
const LEGACY_SUB_CATEGORY = { family_flat: 'flat', bachelor_flat: 'flat' };

export const normaliseSubCategory = (sub) => LEGACY_SUB_CATEGORY[sub] || sub || '';

export const residentialTypeById = (id) =>
  RESIDENTIAL_TYPES.find((t) => t.id === normaliseSubCategory(id)) || null;

/** True when this type is let whole (a flat) rather than subdivided. */
export const isFlatType = (sub) => {
  const t = residentialTypeById(sub);
  return !!t && t.rentedAs === 'flat';
};

/**
 * How a building's type is written on a card, a filter pill or a summary row.
 * Commercial has no sub-categories yet, so it reads as its category.
 */
export const buildingTypeLabel = (building, isBn = false) => {
  if (!building) return '';
  if (building.category === 'commercial') return isBn ? 'কমার্শিয়াল' : 'Commercial';
  const t = residentialTypeById(building.subCategory);
  if (!t) return isBn ? 'আবাসিক' : 'Residential';
  return isBn ? t.bn : t.en;
};

/** Tailwind classes per type, so a card reads at a glance. */
export const buildingTypeColor = (building) => {
  if (building?.category === 'commercial') return 'bg-violet-50 text-violet-700 border-violet-200';
  switch (normaliseSubCategory(building?.subCategory)) {
    case 'hostel':        return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'single_room':   return 'bg-sky-50 text-sky-700 border-sky-200';
    default:              return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
};

// ── Suitable For — a property of the FLAT, not the building ─────────────────
// Green View can hold flat 101 for a family, 102 for bachelors and 103 for
// either. Asked when a flat is created, stored on Unit.suitableFor.
//
// Classification, search/filter, card labels and future house rules only.
// Nothing structural reads it: a family flat and a bachelor flat run the exact
// same Unit → Booking → tenant → ledger path.
export const SUITABLE_FOR = [
  { id: 'family',   en: 'Family',   bn: 'ফ্যামিলি' },
  { id: 'bachelor', en: 'Bachelor', bn: 'ব্যাচেলর' },
  { id: 'both',     en: 'Both',     bn: 'উভয়' },
];

/** Picker wording — "Family" / "Bachelor" / "Both". */
export const suitableForLabel = (id, isBn = false) => {
  const t = SUITABLE_FOR.find((s) => s.id === id);
  return t ? (isBn ? t.bn : t.en) : '';
};

/** Card wording — 'both' spells itself out so a glance is unambiguous. */
export const suitableForCardLabel = (id, isBn = false) => {
  if (id === 'both') return isBn ? 'ফ্যামিলি + ব্যাচেলর' : 'Family + Bachelor';
  return suitableForLabel(id, isBn);
};

/** Card chip colours, distinct from the building-type chip. */
export const suitableForColor = (id) => {
  switch (id) {
    case 'family':   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'bachelor': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'both':     return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:         return 'bg-gray-50 text-gray-500 border-gray-200';
  }
};

/** Wording for the unit a building holds — "flat" vs "room" vs "seat". */
export const unitNoun = (building, isBn = false) => {
  if (isFlatType(building?.subCategory)) return isBn ? 'ফ্ল্যাট' : 'Flat';
  return isBn ? 'রুম' : 'Room';
};
