// src/constants/propertyFields.js
//
// SINGLE SOURCE OF TRUTH for the intent + type specific listing fields
// ("specificDetails"). Consumed by BOTH the AddProperty wizard (create) and the
// HostDashboard edit modal (edit), so the two never drift apart.
//
// Field object shape: { key, kind, label, labelBn, options?, placeholder?, placeholderBn? }
//   kind: 'select' | 'toggle' | 'text' | 'number'
//
// NOTE on vocabulary: the maps below key a sale under 'purchase' (the wizard's
// INTENT_DATA key). The backend/API stores the canonical 'sale'. getDynamicFields
// accepts EITHER, so callers can pass whichever they have.

// Shared select options + repeated field objects — defined once, referenced below.
const FACING_OPTIONS = [
  { id: 'north', label: 'North', labelBn: 'উত্তর' },
  { id: 'south', label: 'South', labelBn: 'দক্ষিণ' },
  { id: 'east',  label: 'East',  labelBn: 'পূর্ব' },
  { id: 'west',  label: 'West',  labelBn: 'পশ্চিম' },
];
const F_FACING       = { key: 'facing', kind: 'select', label: 'Facing', labelBn: 'দিক', options: FACING_OPTIONS };
const F_LAND_MEASURE = { key: 'landMeasurement', kind: 'text', label: 'Land Measurement', labelBn: 'জমির পরিমাণ', placeholder: 'e.g. 5 katha', placeholderBn: 'যেমন ৫ কাঠা' };
const F_FRONT_ROAD   = { key: 'frontRoadWidth', kind: 'text', label: 'Front Road Width', labelBn: 'সামনের রাস্তার প্রস্থ', placeholder: 'e.g. 20 ft', placeholderBn: 'যেমন ২০ ফুট' };
const F_KHATIAN      = { key: 'khatian', kind: 'text', label: 'CS/RS Khatian', labelBn: 'সিএস/আরএস খতিয়ান', placeholder: 'Khatian / dag no.', placeholderBn: 'খতিয়ান / দাগ নম্বর' };
const F_TOTAL_FLOORS = { key: 'totalFloors', kind: 'number', label: 'Total Floors', labelBn: 'মোট তলা' };
const F_MAIN_ROAD    = { key: 'mainRoadFacing', kind: 'toggle', label: 'Main Road Facing', labelBn: 'প্রধান রাস্তার পাশে' };

// COMMON base fields per intent — apply to EVERY sub-type of that intent.
const SPECIFIC_FIELDS = {
  rent: [
    { key: 'tenantPreference', kind: 'select',
      label: 'Tenant Preference', labelBn: 'ভাড়াটিয়ার পছন্দ',
      options: [
        { id: 'family',   label: 'Family',   labelBn: 'পরিবার' },
        { id: 'bachelor', label: 'Bachelor', labelBn: 'ব্যাচেলর' },
        { id: 'any',      label: 'Any',      labelBn: 'যেকোনো' },
      ] },
    { key: 'floorLevel', kind: 'text',
      label: 'Floor Level', labelBn: 'কোন তলা',
      placeholder: 'e.g. 3rd of 6', placeholderBn: 'যেমন: ৬ তলার ৩য়' },
    { key: 'utilities', kind: 'text',
      label: 'Utilities Included', labelBn: 'অন্তর্ভুক্ত ইউটিলিটি',
      placeholder: 'Gas, water, service charge…', placeholderBn: 'গ্যাস, পানি, সার্ভিস চার্জ…' },
  ],
  // A sale is entirely type-specific — see SPECIFIC_FIELDS_BY_TYPE.purchase.
  purchase: [],
  // Only fire safety is common to all commercial; gas line + ducting are
  // restaurant-specific and live in SPECIFIC_FIELDS_BY_TYPE.commercial.restaurant.
  commercial: [
    { key: 'fireSafety', kind: 'toggle', label: 'Fire Safety Setup', labelBn: 'অগ্নি নিরাপত্তা ব্যবস্থা' },
  ],
};

// TYPE-SPECIFIC fields: intent -> type -> fields[]. Merged AFTER the common base
// at render time, so these appear in addition to the intent's base fields.
const SPECIFIC_FIELDS_BY_TYPE = {
  commercial: {
    restaurant: [
      { key: 'gasLine', kind: 'toggle', label: 'Commercial Gas Line', labelBn: 'বাণিজ্যিক গ্যাস লাইন' },
      { key: 'ducting', kind: 'toggle', label: 'Ducting / Exhaust Space', labelBn: 'ডাক্টিং / এক্সহস্ট স্পেস' },
      { key: 'kitchenArea', kind: 'text', label: 'Kitchen Area', labelBn: 'রান্নাঘরের আয়তন',
        placeholder: 'e.g. 200 sqft', placeholderBn: 'যেমন ২০০ বর্গফুট' },
      { key: 'seatingCapacity', kind: 'number', label: 'Seating Capacity', labelBn: 'আসন সংখ্যা' },
    ],
    office: [
      { key: 'floorPlan', kind: 'select', label: 'Floor Plan', labelBn: 'ফ্লোর প্ল্যান',
        options: [
          { id: 'open',  label: 'Open',  labelBn: 'ওপেন' },
          { id: 'cabin', label: 'Cabin', labelBn: 'কেবিন' },
          { id: 'mixed', label: 'Mixed', labelBn: 'মিশ্র' },
        ] },
      { key: 'meetingRooms', kind: 'number', label: 'Meeting Rooms', labelBn: 'মিটিং রুম' },
      { key: 'washrooms',    kind: 'number', label: 'Washrooms',     labelBn: 'ওয়াশরুম' },
      { key: 'backupPower',  kind: 'toggle', label: 'Generator / IPS', labelBn: 'জেনারেটর / IPS' },
    ],
    shop: [
      { key: 'frontageWidth', kind: 'text', label: 'Shutter width (ft)', labelBn: 'শাটার প্রস্থ (ফুট)' },
      F_MAIN_ROAD,
      { key: 'mezzanine', kind: 'toggle', label: 'Mezzanine', labelBn: 'মেজানিন' },
    ],
    showroom: [
      { key: 'frontageWidth', kind: 'text', label: 'Frontage Width', labelBn: 'সামনের প্রস্থ' },
      F_MAIN_ROAD,
      { key: 'glassFront', kind: 'toggle', label: 'Glass Front', labelBn: 'গ্লাস ফ্রন্ট' },
    ],
  },
  purchase: {
    land: [
      F_LAND_MEASURE,
      F_FRONT_ROAD,
      F_KHATIAN,
      { key: 'mutationDone', kind: 'toggle', label: 'Mutation / Namjari done', labelBn: 'নামজারি সম্পন্ন' },
      F_FACING,
    ],
    house: [
      F_LAND_MEASURE,
      F_FRONT_ROAD,
      F_KHATIAN,
      F_FACING,
      F_TOTAL_FLOORS,
    ],
    flat: [
      { key: 'floorLevel', kind: 'text', label: 'Floor Level', labelBn: 'কোন তলা',
        placeholder: 'e.g. 3rd of 6', placeholderBn: 'যেমন: ৬ তলার ৩য়' },
      F_TOTAL_FLOORS,
      F_FACING,
      { key: 'parking', kind: 'toggle', label: 'Parking', labelBn: 'পার্কিং' },
    ],
    building: [
      F_LAND_MEASURE,
      F_TOTAL_FLOORS,
      F_FRONT_ROAD,
    ],
    shop: [
      { key: 'frontageWidth', kind: 'text', label: 'Shutter width (ft)', labelBn: 'শাটার প্রস্থ (ফুট)' },
      F_MAIN_ROAD,
      { key: 'mezzanine', kind: 'toggle', label: 'Mezzanine', labelBn: 'মেজানিন' },
    ],
    restaurant: [
      { key: 'gasLine', kind: 'toggle', label: 'Commercial Gas Line', labelBn: 'বাণিজ্যিক গ্যাস লাইন' },
      { key: 'ducting', kind: 'toggle', label: 'Ducting / Exhaust Space', labelBn: 'ডাক্টিং / এক্সহস্ট স্পেস' },
      { key: 'kitchenArea', kind: 'text', label: 'Kitchen Area', labelBn: 'রান্নাঘরের আয়তন',
        placeholder: 'e.g. 200 sqft', placeholderBn: 'যেমন ২০০ বর্গফুট' },
      { key: 'seatingCapacity', kind: 'number', label: 'Seating Capacity', labelBn: 'আসন সংখ্যা' },
    ],
  },
  rent: {
    hostel: [
      { key: 'seatsPerRoom', kind: 'number', label: 'Seats per Room', labelBn: 'প্রতি রুমে আসন' },
      { key: 'genderPolicy', kind: 'select', label: 'Gender Policy', labelBn: 'লিঙ্গ নীতি',
        options: [
          { id: 'male',   label: 'Male',   labelBn: 'পুরুষ' },
          { id: 'female', label: 'Female', labelBn: 'মহিলা' },
          { id: 'any',    label: 'Any',    labelBn: 'যেকোনো' },
        ] },
    ],
    single_room: [
      { key: 'attachedBath',  kind: 'toggle', label: 'Attached Bathroom', labelBn: 'অ্যাটাচড বাথরুম' },
      { key: 'sharedKitchen', kind: 'toggle', label: 'Shared Kitchen',    labelBn: 'শেয়ার্ড রান্নাঘর' },
    ],
  },
};

// Merge the intent-common base fields with the selected type's extras.
// Accepts canonical 'sale' as well as the wizard's legacy 'purchase' key.
export function getDynamicFields(intent, type) {
  const key = intent === 'sale' ? 'purchase' : intent;
  return [
    ...(SPECIFIC_FIELDS[key] || []),
    ...(SPECIFIC_FIELDS_BY_TYPE[key]?.[type] || []),
  ];
}

export { SPECIFIC_FIELDS, SPECIFIC_FIELDS_BY_TYPE, FACING_OPTIONS };
