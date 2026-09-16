/**
 * listingLabels.js — the words for the fixed values listings and profiles carry.
 * ──────────────────────────────────────────────────────────────────────────
 * A listing stores `type: 'single_room'` and `furnishing: 'Unfurnished'`; a
 * landlord stores `houseRules: ['no_smoking']`. Those are ids — data, not text —
 * and printing them raw put "single_room" and "Unfurnished" on a page that was
 * otherwise in Bangla. Every surface that shows one of these values reads its
 * label from here, so the property page, both profiles and the dashboards say
 * the same Bangla word for the same thing.
 *
 * An id with no entry falls back to title-cased words ("loading_area" →
 * "Loading Area") rather than nothing, so a value added on the backend later
 * still reads as words — add it here to give it a Bangla label.
 *
 * Ids mirror the backend enums: models/Property.js (type, furnishing, status)
 * and models/User.js (preferredTenants, communication, houseRules, trustTier,
 * professionType).
 */

const prettify = (id) => String(id ?? '')
  .replace(/[_-]+/g, ' ')
  .trim()
  .replace(/\b\w/g, (c) => c.toUpperCase());

/** Build a `(id, isBn) => label` lookup. Ids match exactly, then lower-cased. */
const labeller = (map) => (id, isBn = false) => {
  if (id == null || id === '') return '';
  const m = map[id] ?? map[String(id).toLowerCase()];
  return m ? (isBn ? m.bn : m.en) : prettify(id);
};

// ── Listings ────────────────────────────────────────────────────────────────

export const PROPERTY_TYPE_LABELS = {
  flat:             { en: 'Flat',             bn: 'ফ্ল্যাট' },
  apartment:        { en: 'Flat',             bn: 'ফ্ল্যাট' },
  house:            { en: 'House',            bn: 'বাড়ি' },
  mess:             { en: 'Mess',             bn: 'মেস' },
  villa:            { en: 'Villa',            bn: 'ভিলা' },
  sublet:           { en: 'Sublet',           bn: 'সাবলেট' },
  hostel:           { en: 'Hostel',           bn: 'হোস্টেল' },
  single_room:      { en: 'Single Room',      bn: 'সিঙ্গেল রুম' },
  building:         { en: 'Building',         bn: 'বিল্ডিং' },
  office:           { en: 'Office',           bn: 'অফিস' },
  office_room:      { en: 'Office Room',      bn: 'অফিস রুম' },
  office_space:     { en: 'Office Space',     bn: 'অফিস স্পেস' },
  land:             { en: 'Land / Plot',      bn: 'জমি / প্লট' },
  plot:             { en: 'Plot',             bn: 'প্লট' },
  shop:             { en: 'Shop',             bn: 'দোকান' },
  mall_shop:        { en: 'Mall Shop',        bn: 'মার্কেটের দোকান' },
  showroom:         { en: 'Showroom',         bn: 'শোরুম' },
  restaurant:       { en: 'Restaurant',       bn: 'রেস্তোরাঁ' },
  restaurant_space: { en: 'Restaurant Space', bn: 'রেস্তোরাঁর জায়গা' },
  warehouse:        { en: 'Warehouse',        bn: 'গুদাম' },
  shed:             { en: 'Shed',             bn: 'শেড' },
  other_buy:        { en: 'Other',            bn: 'অন্যান্য' },
  other_commercial: { en: 'Other',            bn: 'অন্যান্য' },
};

export const FURNISHING_LABELS = {
  furnished:        { en: 'Furnished',      bn: 'সম্পূর্ণ আসবাবপত্র' },
  'semi-furnished': { en: 'Semi-Furnished', bn: 'আংশিক আসবাবপত্র' },
  unfurnished:      { en: 'Unfurnished',    bn: 'আসবাবপত্র ছাড়া' },
};

export const LISTING_CATEGORY_LABELS = {
  family:          { en: 'Family',            bn: 'ফ্যামিলি' },
  bachelor_male:   { en: 'Bachelor (Male)',   bn: 'ব্যাচেলর (পুরুষ)' },
  bachelor_female: { en: 'Bachelor (Female)', bn: 'ব্যাচেলর (মহিলা)' },
  student:         { en: 'Student',           bn: 'ছাত্র/ছাত্রী' },
  student_male:    { en: 'Student (Male)',    bn: 'ছাত্র' },
  student_female:  { en: 'Student (Female)',  bn: 'ছাত্রী' },
  ready_flat:      { en: 'Ready Flat',        bn: 'রেডি ফ্ল্যাট' },
  used:            { en: 'Used Property',     bn: 'পুরোনো প্রপার্টি' },
  new_project:     { en: 'New Project',       bn: 'নতুন প্রজেক্ট' },
  investment:      { en: 'Investment',        bn: 'বিনিয়োগ' },
  corporate:       { en: 'Corporate',         bn: 'কর্পোরেট' },
  startup:         { en: 'Startup',           bn: 'স্টার্টআপ' },
  retail:          { en: 'Retail',            bn: 'খুচরা ব্যবসা' },
  warehouse:       { en: 'Warehouse',         bn: 'গুদাম' },
};

export const LISTING_INTENT_LABELS = {
  rent:       { en: 'For Rent',   bn: 'ভাড়ার জন্য' },
  purchase:   { en: 'For Sale',   bn: 'বিক্রয়ের জন্য' },
  commercial: { en: 'Commercial', bn: 'কমার্শিয়াল' },
};

export const LISTING_STATUS_LABELS = {
  active: { en: 'Available', bn: 'পাওয়া যাচ্ছে' },
  paused: { en: 'Paused',    bn: 'বিরতিতে' },
  rented: { en: 'Rented',    bn: 'ভাড়া হয়েছে' },
  sold:   { en: 'Sold',      bn: 'বিক্রি হয়েছে' },
};

// ── Landlord preferences ────────────────────────────────────────────────────

export const PREFERRED_TENANT_LABELS = {
  family:     { en: 'Family',            bn: 'ফ্যামিলি' },
  bachelor_m: { en: 'Bachelor (Male)',   bn: 'ব্যাচেলর (পুরুষ)' },
  bachelor_f: { en: 'Bachelor (Female)', bn: 'ব্যাচেলর (মহিলা)' },
  student:    { en: 'Student',           bn: 'ছাত্র/ছাত্রী' },
  job_holder: { en: 'Job Holder',        bn: 'চাকরিজীবী' },
  business:   { en: 'Business Owner',    bn: 'ব্যবসায়ী' },
  anyone:     { en: 'Anyone',            bn: 'যে কেউ' },
};

export const CONTACT_METHOD_LABELS = {
  phone:       { en: 'Phone',       bn: 'ফোন' },
  whatsapp:    { en: 'WhatsApp',    bn: 'হোয়াটসঅ্যাপ' },
  sms:         { en: 'SMS',         bn: 'এসএমএস' },
  imo:         { en: 'imo',         bn: 'ইমো' },
  direct_call: { en: 'Direct Call', bn: 'সরাসরি কল' },
  caretaker:   { en: 'Caretaker',   bn: 'কেয়ারটেকার' },
  app_only:    { en: 'In-app only', bn: 'শুধু অ্যাপে' },
};

export const HOUSE_RULE_LABELS = {
  no_smoking:    { en: 'No smoking',            bn: 'ধূমপান নিষেধ' },
  no_pets:       { en: 'No pets',               bn: 'পোষা প্রাণী নিষেধ' },
  no_late_guest: { en: 'No late-night guests',  bn: 'রাতে অতিথি নিষেধ' },
  no_loud_music: { en: 'No loud music',         bn: 'উচ্চ শব্দে গান নিষেধ' },
  no_alteration: { en: 'No alterations',        bn: 'ঘরে কোনো পরিবর্তন নিষেধ' },
  keep_clean:    { en: 'Keep the place clean',  bn: 'পরিষ্কার-পরিচ্ছন্ন রাখতে হবে' },
  curfew_11pm:   { en: 'Back by 11 PM',         bn: 'রাত ১১টার মধ্যে ফিরতে হবে' },
  no_bachelor:   { en: 'No bachelors',          bn: 'ব্যাচেলর নিষেধ' },
  no_sublet:     { en: 'No subletting',         bn: 'সাবলেট দেওয়া নিষেধ' },
};

// ── People ──────────────────────────────────────────────────────────────────

export const TRUST_TIER_LABELS = {
  bronze:   { en: 'Bronze',   bn: 'ব্রোঞ্জ' },
  silver:   { en: 'Silver',   bn: 'সিলভার' },
  gold:     { en: 'Gold',     bn: 'গোল্ড' },
  platinum: { en: 'Platinum', bn: 'প্ল্যাটিনাম' },
};

export const PROFESSION_LABELS = {
  student:         { en: 'Student',       bn: 'ছাত্র/ছাত্রী' },
  job:             { en: 'Job Holder',    bn: 'চাকরিজীবী' },
  employed:        { en: 'Job Holder',    bn: 'চাকরিজীবী' },
  business:        { en: 'Business',      bn: 'ব্যবসায়ী' },
  'self-employed': { en: 'Self-employed', bn: 'নিজস্ব ব্যবসা' },
  doctor:          { en: 'Doctor',        bn: 'ডাক্তার' },
  other:           { en: 'Other',         bn: 'অন্যান্য' },
};

export const PAYMENT_METHOD_LABELS = {
  bkash:           { en: 'bKash',         bn: 'বিকাশ' },
  nagad:           { en: 'Nagad',         bn: 'নগদ' },
  rocket:          { en: 'Rocket',        bn: 'রকেট' },
  'bank transfer': { en: 'Bank Transfer', bn: 'ব্যাংক ট্রান্সফার' },
  bank_transfer:   { en: 'Bank Transfer', bn: 'ব্যাংক ট্রান্সফার' },
  bank:            { en: 'Bank',          bn: 'ব্যাংক' },
  cash:            { en: 'Cash',          bn: 'ক্যাশ' },
  cheque:          { en: 'Cheque',        bn: 'চেক' },
  card:            { en: 'Card',          bn: 'কার্ড' },
  other:           { en: 'Other',         bn: 'অন্যান্য' },
};

/** A listing's `division` is stored as a lower-case id ("dhaka"). */
export const DIVISION_LABELS = {
  dhaka:      { en: 'Dhaka',      bn: 'ঢাকা' },
  chittagong: { en: 'Chattogram', bn: 'চট্টগ্রাম' },
  chattogram: { en: 'Chattogram', bn: 'চট্টগ্রাম' },
  rajshahi:   { en: 'Rajshahi',   bn: 'রাজশাহী' },
  khulna:     { en: 'Khulna',     bn: 'খুলনা' },
  barishal:   { en: 'Barishal',   bn: 'বরিশাল' },
  barisal:    { en: 'Barishal',   bn: 'বরিশাল' },
  sylhet:     { en: 'Sylhet',     bn: 'সিলেট' },
  rangpur:    { en: 'Rangpur',    bn: 'রংপুর' },
  mymensingh: { en: 'Mymensingh', bn: 'ময়মনসিংহ' },
};

export const divisionLabel = labeller(DIVISION_LABELS);
export const propertyTypeLabel = labeller(PROPERTY_TYPE_LABELS);
export const furnishingLabel = labeller(FURNISHING_LABELS);
export const listingCategoryLabel = labeller(LISTING_CATEGORY_LABELS);
export const listingIntentLabel = labeller(LISTING_INTENT_LABELS);
export const listingStatusLabel = labeller(LISTING_STATUS_LABELS);
export const preferredTenantLabel = labeller(PREFERRED_TENANT_LABELS);
export const contactMethodLabel = labeller(CONTACT_METHOD_LABELS);
export const houseRuleLabel = labeller(HOUSE_RULE_LABELS);
export const trustTierLabel = labeller(TRUST_TIER_LABELS);
export const professionLabel = labeller(PROFESSION_LABELS);
export const paymentMethodLabel = labeller(PAYMENT_METHOD_LABELS);

// ── Time and money ──────────────────────────────────────────────────────────

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

/** Month name for a 0-based month index. */
export const monthName = (index, isBn = false) => (isBn ? MONTHS_BN : MONTHS_EN)[index] || '';

/** The suffix after a monthly price: "৳8,000/mo" · "৳8,000/মাস". */
export const perMonthLabel = (isBn = false) => (isBn ? '/মাস' : '/mo');
