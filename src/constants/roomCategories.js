/**
 * roomCategories.js — SINGLE SOURCE OF TRUTH for property photo categories.
 * ──────────────────────────────────────────────────────────────────────────
 * Every property KIND shows only its own areas:
 *   • residential  → bedroom / bathroom / living / kitchen / balcony
 *   • office       → reception / workspace / cabin / meeting room / washroom
 *   • shop/showroom→ front (shutter) / inside floor / washroom / electric panel
 *   • restaurant   → front / dining hall / kitchen area / washroom
 *   • warehouse    → interior / entrance / loading area / washroom
 *   • land         → front view / surroundings / road view / mouza map
 *
 * A commercial listing therefore NEVER offers "bedroom" (which is what used to
 * leak in: the upload tab defaulted to 'bedroom' and there was no per-type
 * category set). AddProperty (create), HostDashboard (edit) and the listing
 * cards all import from here so the categories + labels stay identical.
 */
import {
  BedDouble, Bath, Home, Utensils, Camera, Building, Users, Coffee,
  Briefcase, Store, Layers, Zap, Navigation, Car, Leaf, MapPin, Map, Eye,
} from 'lucide-react';

// Property `type` → photo-category GROUP. (Mirrors the map that used to be
// duplicated across AddProperty + PropertyDetails.)
export const TYPE_GROUP_MAP = {
  flat: 'residential', apartment: 'residential', house: 'residential', mess: 'residential',
  villa: 'residential', other_buy: 'residential', sublet: 'residential', hostel: 'residential',
  single_room: 'residential', building: 'residential', duplex: 'residential',
  studio: 'residential', penthouse: 'residential', independent: 'residential',
  office: 'office', office_room: 'office', office_space: 'office',
  land: 'land', plot: 'land',
  shop: 'commercial_shop', mall_shop: 'commercial_shop', showroom: 'commercial_shop', other_commercial: 'commercial_shop',
  restaurant: 'restaurant', restaurant_space: 'restaurant',
  warehouse: 'warehouse', shed: 'warehouse',
};

// Per-GROUP photo categories (id + English/Bangla label + icon).
export const ROOM_TYPES_BY_GROUP = {
  residential: [
    { id: 'bedroom',  label: 'Bedroom',     labelBn: 'শোবার ঘর', icon: BedDouble },
    { id: 'bathroom', label: 'Bathroom',    labelBn: 'বাথরুম',   icon: Bath },
    { id: 'living',   label: 'Living Room', labelBn: 'বসার ঘর',  icon: Home },
    { id: 'kitchen',  label: 'Kitchen',     labelBn: 'রান্নাঘর', icon: Utensils },
    { id: 'balcony',  label: 'Balcony',     labelBn: 'বারান্দা', icon: Eye },
    { id: 'other',    label: 'Other',       labelBn: 'অন্যান্য', icon: Camera },
  ],
  office: [
    { id: 'reception',    label: 'Reception',    labelBn: 'রিসেপশন',    icon: Users },
    { id: 'workspace',    label: 'Workspace',    labelBn: 'কর্মক্ষেত্র', icon: Building },
    { id: 'cabin',        label: 'Cabin',        labelBn: 'কেবিন',      icon: Briefcase },
    { id: 'meeting_room', label: 'Meeting Room', labelBn: 'মিটিং রুম',   icon: Coffee },
    { id: 'washroom',     label: 'Washroom',     labelBn: 'ওয়াশরুম',    icon: Bath },
    { id: 'other',        label: 'Other',        labelBn: 'অন্যান্য',    icon: Camera },
  ],
  commercial_shop: [
    { id: 'front_view',     label: 'Front / Shutter', labelBn: 'শাটার/ফ্রন্ট',     icon: Store },
    { id: 'inside_floor',   label: 'Inside Floor',    labelBn: 'ভেতরের ফ্লোর',     icon: Layers },
    { id: 'washroom',       label: 'Washroom',        labelBn: 'ওয়াশরুম',         icon: Bath },
    { id: 'electric_panel', label: 'Electric Panel',  labelBn: 'ইলেকট্রিক প্যানেল', icon: Zap },
    { id: 'other',          label: 'Other',           labelBn: 'অন্যান্য',         icon: Camera },
  ],
  restaurant: [
    { id: 'front_view',   label: 'Front / Shutter', labelBn: 'শাটার/ফ্রন্ট', icon: Store },
    { id: 'inside_hall',  label: 'Dining Hall',     labelBn: 'ভেতরের হল',    icon: Utensils },
    { id: 'kitchen_area', label: 'Kitchen Area',    labelBn: 'কিচেন এরিয়া',  icon: Coffee },
    { id: 'washroom',     label: 'Washroom',        labelBn: 'ওয়াশরুম',      icon: Bath },
    { id: 'other',        label: 'Other',           labelBn: 'অন্যান্য',      icon: Camera },
  ],
  warehouse: [
    { id: 'inside_view',  label: 'Interior',        labelBn: 'ভেতরের ভিউ',   icon: Building },
    { id: 'entrance',     label: 'Entrance / Gate', labelBn: 'প্রবেশপথ/গেট', icon: Navigation },
    { id: 'loading_area', label: 'Loading Area',    labelBn: 'লোডিং এরিয়া',  icon: Car },
    { id: 'washroom',     label: 'Washroom',        labelBn: 'ওয়াশরুম',      icon: Bath },
    { id: 'other',        label: 'Other',           labelBn: 'অন্যান্য',      icon: Camera },
  ],
  land: [
    { id: 'front_view',   label: 'Front View',   labelBn: 'সামনের দিক',    icon: Eye },
    { id: 'surroundings', label: 'Surroundings', labelBn: 'চারপাশের ভিউ',  icon: Leaf },
    { id: 'road_view',    label: 'Road View',    labelBn: 'সামনের রাস্তা', icon: MapPin },
    { id: 'map',          label: 'Mouza Map',    labelBn: 'মৌজা ম্যাপ',    icon: Map },
    { id: 'other',        label: 'Other',        labelBn: 'অন্যান্য',      icon: Camera },
  ],
};

/**
 * Resolve the photo categories for a listing. Uses the `type` first; before a
 * type is chosen it falls back to the intent (commercial → shop-style, else
 * residential) so the upload tabs are always sensible.
 */
export function getRoomTypes(intent, type) {
  const group = TYPE_GROUP_MAP[type] || (intent === 'commercial' ? 'commercial_shop' : 'residential');
  return ROOM_TYPES_BY_GROUP[group] || ROOM_TYPES_BY_GROUP.residential;
}

/** First (default) category id for a listing — used to seed the active tab. */
export function firstRoomTypeId(intent, type) {
  return getRoomTypes(intent, type)[0]?.id || 'other';
}

// Flat id → { en, bn } label map for DISPLAY (cards, galleries, photo tour).
// Built from the groups above + a few legacy/alias ids so old listings that
// were tagged with the previous vocabulary still read correctly.
const _pairs = {};
Object.values(ROOM_TYPES_BY_GROUP).forEach((arr) =>
  arr.forEach((r) => { _pairs[r.id] = { en: r.label, bn: r.labelBn }; }),
);
export const ROOM_LABELS = {
  ..._pairs,
  cover:        { en: 'Cover Photo',   bn: 'কভার ছবি' },
  // legacy / alias ids from earlier versions of the taxonomy
  meeting:      { en: 'Meeting Room',  bn: 'মিটিং রুম' },
  toilet:       { en: 'Washroom',      bn: 'ওয়াশরুম' },
  drawing:      { en: 'Living Room',   bn: 'বসার ঘর' },
  hall:         { en: 'Hall',          bn: 'হল' },
  plot_area:    { en: 'Plot Area',     bn: 'প্লটের এরিয়া' },
  surrounding:  { en: 'Surroundings',  bn: 'চারপাশের ভিউ' },
};

/** Human-readable label for a room id (falls back to a title-cased id). */
export function roomLabel(id, isBn = false) {
  const m = ROOM_LABELS[id || 'other'];
  if (m) return isBn ? m.bn : m.en;
  return String(id || 'Photo').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
