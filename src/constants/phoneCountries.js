/**
 * The countries someone can sign up from: Bangladesh, plus the places
 * Bangladeshis most often live and work abroad, where they use a local SIM.
 *
 * MIRRORS tolet-pro-backend/utils/phoneCountries.js. The server sends an OTP
 * only to these dial codes and mobile shapes, so a country added here alone
 * would appear in the picker and then fail at "send code". The backend's
 * tests/phoneCountries.test.js bundles this file and fails if the two drift.
 *
 * `mobile` matches the national number — what follows the dial code, with no
 * trunk 0 — and `min`/`max` are its length in digits.
 */
export const PHONE_COUNTRIES = [
  { iso: 'BD', dial: '880', flag: '🇧🇩', en: 'Bangladesh', bn: 'বাংলাদেশ', mobile: /^1[3-9]\d{8}$/, min: 10, max: 10, example: '1712345678' },
  { iso: 'SA', dial: '966', flag: '🇸🇦', en: 'Saudi Arabia', bn: 'সৌদি আরব', mobile: /^5\d{8}$/, min: 9, max: 9, example: '512345678' },
  { iso: 'AE', dial: '971', flag: '🇦🇪', en: 'UAE', bn: 'সংযুক্ত আরব আমিরাত', mobile: /^5[024-68]\d{7}$/, min: 9, max: 9, example: '501234567' },
  { iso: 'QA', dial: '974', flag: '🇶🇦', en: 'Qatar', bn: 'কাতার', mobile: /^[3567]\d{7}$/, min: 8, max: 8, example: '33123456' },
  { iso: 'KW', dial: '965', flag: '🇰🇼', en: 'Kuwait', bn: 'কুয়েত', mobile: /^[4569]\d{7}$/, min: 8, max: 8, example: '50012345' },
  { iso: 'OM', dial: '968', flag: '🇴🇲', en: 'Oman', bn: 'ওমান', mobile: /^[79]\d{7}$/, min: 8, max: 8, example: '92123456' },
  { iso: 'BH', dial: '973', flag: '🇧🇭', en: 'Bahrain', bn: 'বাহরাইন', mobile: /^[36]\d{7}$/, min: 8, max: 8, example: '36001234' },
  { iso: 'MY', dial: '60', flag: '🇲🇾', en: 'Malaysia', bn: 'মালয়েশিয়া', mobile: /^1\d{8,9}$/, min: 9, max: 10, example: '123456789' },
  { iso: 'SG', dial: '65', flag: '🇸🇬', en: 'Singapore', bn: 'সিঙ্গাপুর', mobile: /^[89]\d{7}$/, min: 8, max: 8, example: '81234567' },
  { iso: 'IN', dial: '91', flag: '🇮🇳', en: 'India', bn: 'ভারত', mobile: /^[6-9]\d{9}$/, min: 10, max: 10, example: '8123456789' },
  { iso: 'MV', dial: '960', flag: '🇲🇻', en: 'Maldives', bn: 'মালদ্বীপ', mobile: /^[79]\d{6}$/, min: 7, max: 7, example: '7712345' },
  { iso: 'GB', dial: '44', flag: '🇬🇧', en: 'United Kingdom', bn: 'যুক্তরাজ্য', mobile: /^7\d{9}$/, min: 10, max: 10, example: '7400123456' },
  { iso: 'IT', dial: '39', flag: '🇮🇹', en: 'Italy', bn: 'ইতালি', mobile: /^3\d{8,9}$/, min: 9, max: 10, example: '3123456789' },
  { iso: 'US', dial: '1', flag: '🇺🇸', en: 'USA / Canada', bn: 'যুক্তরাষ্ট্র / কানাডা', mobile: /^[2-9]\d{2}[2-9]\d{6}$/, min: 10, max: 10, example: '2015550123' },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

/** The listed country with this ISO code, or Bangladesh. */
export function findPhoneCountry(iso) {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) || DEFAULT_PHONE_COUNTRY;
}

/**
 * Reduce whatever was typed or pasted to the national number for `country`:
 * separators dropped, a trunk 0 dropped, and the dial code dropped when the
 * number was written with it. All of these become `81234567` for Singapore:
 *   `81234567` · `+65 8123 4567` · `0065 8123 4567` · `6581234567`
 * and for Bangladesh, as before: `01712345678` · `+880 1712-345678` → `1712345678`.
 *
 * The dial code only comes off when the digits are longer than a national
 * number can be. An Indian mobile can itself begin 91, and `9123456789` must
 * keep it.
 */
export function toNationalNumber(raw, country) {
  let digits = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.startsWith(country.dial) && digits.length > country.max) {
    digits = digits.slice(country.dial.length).replace(/^0+/, '');
  }
  return digits;
}

/** Longest dial code first, so `+880…` can never be read as a shorter code. */
const BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/**
 * The listed country a number written in full international form is a mobile
 * in — `+65 8123 4567`, `0065 8123 4567`, `+44 (0)7400 123456` — so a pasted
 * or autofilled number can switch the picker instead of being read as a
 * malformed Bangladeshi one. Null unless the number starts `+` or `00` and is
 * complete.
 */
export function countryFromInternational(raw) {
  const s = String(raw || '').trim();
  if (!/^(\+|00)/.test(s)) return null;
  const digits = s.replace(/\D/g, '').replace(/^00/, '');
  return BY_DIAL_LENGTH.find((c) => (
    digits.startsWith(c.dial) && c.mobile.test(digits.slice(c.dial.length).replace(/^0+/, ''))
  )) || null;
}

/** `+<dial><national>` — the only shape the auth API accepts. */
export function toE164(national, country) {
  return `+${country.dial}${national}`;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** `81234567` → `৮১২৩৪৫৬৭`, for examples inside Bangla copy. */
export function toBnDigits(s) {
  return String(s).replace(/\d/g, (d) => BN_DIGITS[d]);
}
