import { isBdMobile } from './validators.js';

/*
 * tenantFields.js
 * ──────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for what a tenant record holds and what actually
 * blocks a save.
 *
 * THE RULE THIS FILE ENFORCES
 * A tenant is a person, not a form. Not everyone has an NID. Not every
 * student carries a student ID. A day-labourer moving into a single room may
 * have none of it, and refusing to record them until they produce paperwork
 * means the landlord goes back to the খাতা. So:
 *
 *   ONLY FOUR THINGS EVER BLOCK A SAVE
 *     room/flat number · tenant name · mobile number · move-in date
 *
 * Everything else is optional. An ID becomes required ONLY because the user
 * said they have one — the আছে/নেই ("have it / don't") answer is the switch:
 *
 *     আছে  → the number is required, because they just said it exists
 *     নেই  → the field is not rendered at all and never validated
 *
 * There is deliberately no "Skip" button, no "I'll add it later" checkbox and
 * no optional-toggle next to each field. আছে / নেই is the whole decision, and
 * "নেই" is a complete, valid answer — not a deferral.
 *
 * WHY IT LIVES IN ITS OWN FILE
 * Three writers produce tenant records: the manual lease form, the AI ledger
 * scanner, and (later) the per-seat add-tenant flow. When each one carried its
 * own idea of "required", they drifted — which is how a hostel tenant could be
 * rejected on one screen and accepted on another. Every writer imports
 * `validateTenantProfile()` from here, so there is one rulebook.
 */

// ── Tenant type (পেশা) ──────────────────────────────────────────────────────
// Profession is NOT a proxy for "student". A flat holds employees, business
// owners and freelancers; a hostel holds all of them too. So the type is asked
// directly and it — not the property category — decides which professional
// fields appear. `orgLabel` / `idLabel` are what make the SAME two inputs read
// correctly for a university, a company and a shop.
export const TENANT_TYPES = [
  {
    id: 'student',
    en: 'Student',
    bn: 'শিক্ষার্থী',
    orgLabel: { en: 'Institution / University', bn: 'শিক্ষাপ্রতিষ্ঠান / বিশ্ববিদ্যালয়' },
    idLabel:  { en: 'Student ID',               bn: 'স্টুডেন্ট আইডি' },
    // Only a student is asked for a department.
    showDepartment: true,
  },
  {
    id: 'employee',
    en: 'Employee',
    bn: 'চাকরিজীবী',
    orgLabel: { en: 'Company / Organization', bn: 'প্রতিষ্ঠানের নাম' },
    idLabel:  { en: 'Employee ID',            bn: 'এমপ্লয়ি আইডি' },
  },
  {
    id: 'business',
    en: 'Business',
    bn: 'ব্যবসায়ী',
    orgLabel: { en: 'Business / Company Name',       bn: 'ব্যবসা / কোম্পানির নাম' },
    idLabel:  { en: 'Trade License / Business ID',   bn: 'ট্রেড লাইসেন্স / বিজনেস আইডি' },
  },
  {
    id: 'freelancer',
    en: 'Freelancer / Self-employed',
    bn: 'ফ্রিল্যান্সার / স্বনির্ভর',
    orgLabel: { en: 'Organization', bn: 'প্রতিষ্ঠান' },
    idLabel:  { en: 'Professional ID', bn: 'প্রফেশনাল আইডি' },
  },
  {
    id: 'other',
    en: 'Other',
    bn: 'অন্যান্য',
    orgLabel: { en: 'Organization', bn: 'প্রতিষ্ঠান' },
    idLabel:  { en: 'ID Number',    bn: 'আইডি নম্বর' },
    // 'Other' is not an answer on its own — it opens a box for the real one.
    showCustomLabel: true,
  },
];

export const tenantTypeById = (id) => TENANT_TYPES.find((t) => t.id === id) || null;

// ── Government ID ───────────────────────────────────────────────────────────
// NID / Passport is NEVER globally required. It is required only after the
// landlord answers "আছে" on this tenant's behalf.
export const GOVT_ID_TYPES = [
  { id: 'nid',      en: 'NID',      bn: 'জাতীয় পরিচয়পত্র' },
  { id: 'passport', en: 'Passport', bn: 'পাসপোর্ট' },
];

// A Bangladeshi NID number is 10 digits (Smart card), 13 (old), or 17 (old
// with the 4-digit birth year prefixed). Nothing else is a real NID, and those
// three lengths are unambiguous — so a typo in one is catchable.
export const isValidNid = (v) => /^(\d{10}|\d{13}|\d{17})$/.test(String(v || '').replace(/\D/g, ''));

// A BD passport number is nine characters: an e-passport is one letter then 8
// digits (A01234567); an older MRP is two letters then 7 (BX0123456). Lenient
// on case and spacing — the goal is to catch a slipped digit, not to reject an
// unusual but genuine document.
// The lookahead pins the total at nine, or `[A-Z]{1,2}\d{7,8}` would also
// accept a ten-character AB12345678.
export const isValidPassport = (v) => /^(?=[A-Z\d]{9}$)[A-Z]{1,2}\d{7,8}$/i
  .test(String(v || '').replace(/[\s-]/g, ''));

export const isValidGovtId = (type, value) => {
  if (type === 'nid') return isValidNid(value);
  if (type === 'passport') return isValidPassport(value);
  // An unknown type is not something to hold the tenant to.
  return true;
};

// The two answers every "…আছে?" question takes. `has` is a claim that the
// document exists, and is the ONLY thing that can make a number required.
export const HAS_STATUS = { HAS: 'has', NONE: 'none' };

export const MARITAL_STATUSES = [
  { id: 'single',   en: 'Single',   bn: 'অবিবাহিত' },
  { id: 'married',  en: 'Married',  bn: 'বিবাহিত' },
  { id: 'divorced', en: 'Divorced', bn: 'তালাকপ্রাপ্ত' },
  { id: 'widowed',  en: 'Widowed',  bn: 'বিধবা / বিপত্নীক' },
];

// ── The record ──────────────────────────────────────────────────────────────
// A blank tenant. Every field is a string so the form never has to deal with
// null vs '' vs undefined, and so a half-filled draft from the AI scanner
// round-trips through the same shape as a hand-typed one.
export const emptyTenantProfile = () => ({
  // The three person-level fields that block a save. (The fourth, the room /
  // flat number, belongs to the UNIT — it is validated by the lease form that
  // owns it, not here, because one room outlives many tenants.)
  name: '',
  phone: '',
  moveInDate: '',

  // Personal — optional, always. None of these can block a save.
  fatherName: '',
  dob: '',
  maritalStatus: '',
  permanentAddress: '',

  // Profession + the ID that goes with it.
  tenantType: '',
  tenantTypeOther: '',
  organization: '',
  department: '',
  professionalIdStatus: '',   // '' | 'has' | 'none'
  professionalIdNumber: '',

  // Government ID — gated behind আছে / নেই.
  govtIdStatus: '',           // '' | 'has' | 'none'
  govtIdType: '',             // 'nid' | 'passport'
  govtIdNumber: '',

  // Emergency contact — optional in full. A landlord who has only a number and
  // no name can save exactly that.
  emergencyName: '',
  emergencyRelation: '',
  emergencyAddress: '',
  emergencyPhone: '',

  // Landlord-captured photo. Distinct from the tenant's own profile picture:
  // once they join with the invite code this is deleted and their avatar wins.
  //
  // Stored as an AUTHENTICATED Cloudinary asset (same treatment as NID scans),
  // so the raw URL is useless on its own — the server signs it per request for
  // the landlord who owns the booking. `photoPublicId` is what makes that
  // signing possible, which is why both are kept.
  photoUrl: '',
  photoPublicId: '',
});

// Merge whatever a caller has (an AI-scanned draft, an old booking, a partial
// patch) onto the blank shape, dropping keys we don't own. Unknown/missing
// fields come back as '' rather than undefined.
export const toTenantProfile = (raw = {}) => {
  const base = emptyTenantProfile();
  Object.keys(base).forEach((k) => {
    const v = raw?.[k];
    if (v !== undefined && v !== null) base[k] = typeof v === 'string' ? v : String(v);
  });
  return base;
};

// ── Validation ──────────────────────────────────────────────────────────────
// Returns an array of field keys that block the save. Empty array = saveable.
//
// Read the length of this function as the point: there are exactly three
// person-level required fields, and two conditional ones that exist only
// because the user affirmatively said the document exists.
export const validateTenantProfile = (p = {}) => {
  const missing = [];
  const blank = (k) => !String(p?.[k] ?? '').trim();

  // The hard floor. Nothing else joins this list, ever.
  if (blank('name'))       missing.push('name');
  if (blank('phone'))      missing.push('phone');
  if (blank('moveInDate')) missing.push('moveInDate');

  // A mobile number is the one field where being ALMOST right is worse than
  // being empty: it is how the tenant's account is auto-linked, where every
  // rent reminder goes, and the number the landlord calls when something is
  // wrong. One transposed digit sends all of that to a stranger, silently.
  // So the shape is checked, not just the presence.
  if (!blank('phone') && !isBdMobile(p.phone)) missing.push('phone');

  // Optional, but a wrong emergency number is worse than none — it is only
  // ever used in the one situation where it must work.
  if (!blank('emergencyPhone') && !isBdMobile(p.emergencyPhone)) missing.push('emergencyPhone');

  // "আছে" is a promise that a number exists — so we hold them to it. "নেই"
  // and unanswered both fall straight through with nothing to validate.
  if (p.govtIdStatus === HAS_STATUS.HAS) {
    if (blank('govtIdType'))   missing.push('govtIdType');
    if (blank('govtIdNumber')) missing.push('govtIdNumber');
    // Shape-checked only once they have said which document it is. A wrong NID
    // is as useless as a wrong phone number, and the lengths are unambiguous.
    else if (p.govtIdType && !isValidGovtId(p.govtIdType, p.govtIdNumber)) {
      missing.push('govtIdNumber');
    }
  }
  if (p.professionalIdStatus === HAS_STATUS.HAS && blank('professionalIdNumber')) {
    missing.push('professionalIdNumber');
  }

  // Same shape of promise: "অন্যান্য" says the profession is something we didn't
  // list, so the box underneath is the actual answer. Saving 'other' with
  // nothing written stores a profession that says only "not one of the five".
  // Choosing no profession at all remains perfectly fine.
  if (p.tenantType === 'other' && blank('tenantTypeOther')) {
    missing.push('tenantTypeOther');
  }

  return missing;
};

// True when this tenant carries anything beyond the required minimum — drives
// the "অতিরিক্ত তথ্য" summary chip so a landlord can see at a glance whether a
// record is bare or filled in, without opening it.
export const hasExtraTenantInfo = (p = {}) => {
  const base = emptyTenantProfile();
  return Object.keys(base).some((k) => (
    k !== 'name' && k !== 'phone' && k !== 'moveInDate'
    && String(p?.[k] ?? '').trim() !== ''
  ));
};

// ── What a scan actually captured ───────────────────────────────────────────
// After reading a form, the landlord needs to know two things before saving:
// what came through, and what did NOT. "৭টি ঘর ভরা হয়েছে" answers the first and
// leaves the second to guesswork — so a blank permanent address looks the same
// as a field the page never had.
//
// A field answered "নেই" is NOT missing. It was answered. Only genuinely blank
// fields are reported as needing attention.
export const tenantFieldReport = (p = {}, isBn = false) => {
  const has = (k) => String(p?.[k] ?? '').trim() !== '';
  const L = (bn, en) => (isBn ? bn : en);
  const type = tenantTypeById(p.tenantType);

  const rows = [
    { key: 'name',             label: L('নাম', 'Name'), required: true },
    { key: 'phone',            label: L('মোবাইল নম্বর', 'Mobile number'), required: true },
    { key: 'moveInDate',       label: L('মুভ-ইন তারিখ', 'Move-in date'), required: true },
    { key: 'fatherName',       label: L('পিতার নাম', "Father's name") },
    { key: 'dob',              label: L('জন্ম তারিখ', 'Date of birth') },
    { key: 'maritalStatus',    label: L('বৈবাহিক অবস্থা', 'Marital status') },
    { key: 'permanentAddress', label: L('স্থায়ী ঠিকানা', 'Permanent address') },
    { key: 'tenantType',       label: L('পেশা', 'Profession') },
    {
      key: 'organization',
      label: type ? (isBn ? type.orgLabel.bn : type.orgLabel.en) : L('প্রতিষ্ঠান', 'Organization'),
    },
    // Only meaningful once we know they are a student.
    ...(p.tenantType === 'student'
      ? [{ key: 'department', label: L('ডিপার্টমেন্ট', 'Department') }]
      : []),
    {
      key: 'professionalIdNumber',
      label: type ? (isBn ? type.idLabel.bn : type.idLabel.en) : L('আইডি', 'ID'),
      // "নেই" is a complete answer — do not list it as missing.
      answered: p.professionalIdStatus === HAS_STATUS.NONE,
    },
    {
      key: 'govtIdNumber',
      label: L('NID / পাসপোর্ট', 'NID / Passport'),
      answered: p.govtIdStatus === HAS_STATUS.NONE,
    },
    { key: 'emergencyName',  label: L('জরুরি যোগাযোগ — নাম', 'Emergency contact — name') },
    { key: 'emergencyPhone', label: L('জরুরি যোগাযোগ — মোবাইল', 'Emergency contact — mobile') },
  ];

  const filled = [];
  const missing = [];
  rows.forEach((r) => {
    if (has(r.key)) filled.push(r);
    else if (!r.answered) missing.push(r);
  });
  return { filled, missing };
};

// Human label for the tenant's profession, for cards and lists. Falls back to
// the free-text answer when the type is 'other'.
export const tenantTypeLabel = (p = {}, isBn = false) => {
  if (p.tenantType === 'other') {
    return String(p.tenantTypeOther || '').trim() || (isBn ? 'অন্যান্য' : 'Other');
  }
  const t = tenantTypeById(p.tenantType);
  return t ? (isBn ? t.bn : t.en) : '';
};
