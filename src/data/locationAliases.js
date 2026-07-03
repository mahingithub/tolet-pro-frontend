/**
 * locationAliases.js — Bilingual (English ↔ Bengali) location dictionary
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *   Hosts save a property's location in whichever language they used in the
 *   Add-Property wizard — and because the app defaults to Bengali, most GPS
 *   auto-filled listings are stored in Bengali (e.g. "দত্তপাড়া, সাভার, ঢাকা").
 *   Search matching is a plain lowercased substring/regex, so an English query
 *   ("Savar, Dhaka") could never hit that Bengali text (and vice-versa).
 *
 *   This module maps place names across the two languages so a query token in
 *   either language also matches its counterpart. It powers:
 *     • the frontend client-side fallback (Propertyservice.applyFilters)
 *     • the mobile feed's popular-area filter (MobileHome)
 *
 *   The backend has a CommonJS mirror of the SAME groups at
 *   tolet-pro-backend/utils/locationAliases.js — keep the two in sync.
 *
 *   Numbered areas (Dhanmondi 27, Mirpur 10, Uttara Sector 7) are handled by
 *   transliterating Bengali ↔ English digits at match time, so "10" also
 *   matches "১০".
 */

// Each inner array is a set of equivalent spellings for ONE place across
// languages / romanisations. Any term is treated as a synonym of the others.
export const LOCATION_ALIAS_GROUPS = [
  // ── Divisions ──
  ['dhaka', 'ঢাকা'],
  ['chittagong', 'chattogram', 'চট্টগ্রাম'],
  ['sylhet', 'সিলেট'],
  ['rajshahi', 'রাজশাহী'],
  ['khulna', 'খুলনা'],
  ['barishal', 'barisal', 'বরিশাল'],
  ['rangpur', 'রংপুর'],
  ['mymensingh', 'ময়মনসিংহ'],

  // ── Dhaka division districts ──
  ['faridpur', 'ফরিদপুর'],
  ['gazipur', 'গাজীপুর'],
  ['gopalganj', 'গোপালগঞ্জ'],
  ['kishoreganj', 'কিশোরগঞ্জ'],
  ['madaripur', 'মাদারীপুর'],
  ['manikganj', 'মানিকগঞ্জ'],
  ['munshiganj', 'মুন্সীগঞ্জ'],
  ['narayanganj', 'নারায়ণগঞ্জ'],
  ['narsingdi', 'নরসিংদী'],
  ['rajbari', 'রাজবাড়ী'],
  ['shariatpur', 'শরীয়তপুর'],
  ['tangail', 'টাঙ্গাইল'],

  // ── Chittagong division districts ──
  ['bandarban', 'বান্দরবান'],
  ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া'],
  ['chandpur', 'চাঁদপুর'],
  ['comilla', 'কুমিল্লা'],
  ['feni', 'ফেনী'],
  ['khagrachari', 'খাগড়াছড়ি'],
  ['lakshmipur', 'লক্ষ্মীপুর'],
  ['noakhali', 'নোয়াখালী'],
  ['rangamati', 'রাঙ্গামাটি'],

  // ── Sylhet division districts ──
  ['habiganj', 'হবিগঞ্জ'],
  ['moulvibazar', 'মৌলভীবাজার'],
  ['sunamganj', 'সুনামগঞ্জ'],

  // ── Rajshahi division districts ──
  ['bogura', 'বগুড়া'],
  ['chapainawabganj', 'চাঁপাইনবাবগঞ্জ'],
  ['joypurhat', 'জয়পুরহাট'],
  ['naogaon', 'নওগাঁ'],
  ['natore', 'নাটোর'],
  ['pabna', 'পাবনা'],
  ['sirajganj', 'সিরাজগঞ্জ'],

  // ── Khulna division districts ──
  ['bagerhat', 'বাগেরহাট'],
  ['chuadanga', 'চুয়াডাঙ্গা'],
  ['jashore', 'jessore', 'যশোর'],
  ['jhenaidah', 'ঝিনাইদহ'],
  ['kushtia', 'কুষ্টিয়া'],
  ['magura', 'মাগুরা'],
  ['meherpur', 'মেহেরপুর'],
  ['narail', 'নড়াইল'],
  ['satkhira', 'সাতক্ষীরা'],

  // ── Barishal division districts ──
  ['barguna', 'বরগুনা'],
  ['bhola', 'ভোলা'],
  ['jhalokati', 'ঝালকাঠি'],
  ['patuakhali', 'পটুয়াখালী'],
  ['pirojpur', 'পিরোজপুর'],

  // ── Rangpur division districts ──
  ['dinajpur', 'দিনাজপুর'],
  ['gaibandha', 'গাইবান্ধা'],
  ['kurigram', 'কুড়িগ্রাম'],
  ['lalmonirhat', 'লালমনিরহাট'],
  ['nilphamari', 'নীলফামারী'],
  ['panchagarh', 'পঞ্চগড়'],
  ['thakurgaon', 'ঠাকুরগাঁও'],

  // ── Mymensingh division districts ──
  ['jamalpur', 'জামালপুর'],
  ['netrokona', 'নেত্রকোনা'],
  ['sherpur', 'শেরপুর'],

  // ── Dhaka thanas / upazilas ──
  ['savar', 'সাভার'],
  ['ashulia', 'আশুলিয়া'],
  ['keraniganj', 'কেরানীগঞ্জ'],
  ['dhamrai', 'ধামরাই'],
  ['nawabganj', 'নবাবগঞ্জ'],
  ['dohar', 'দোহার'],

  // ── Popular Dhaka neighbourhoods ──
  ['dhanmondi', 'ধানমন্ডি'],
  ['gulshan', 'গুলশান'],
  ['banani', 'বনানী'],
  ['uttara', 'উত্তরা'],
  ['bashundhara', 'বসুন্ধরা'],
  ['mirpur', 'মিরপুর'],
  ['mohammadpur', 'মোহাম্মদপুর'],
  ['baridhara', 'বারিধারা'],
  ['niketan', 'niketon', 'নিকেতন'],
  ['motijheel', 'মতিঝিল'],
  ['mohakhali', 'মহাখালী'],
  ['tejgaon', 'তেজগাঁও'],
  ['rampura', 'রামপুরা'],
  ['badda', 'বাড্ডা'],
  ['khilgaon', 'খিলগাঁও'],
  ['malibagh', 'মালিবাগ'],
  ['shyamoli', 'শ্যামলী'],
  ['lalmatia', 'লালমাটিয়া'],
  ['wari', 'ওয়ারী'],
  ['azimpur', 'আজিমপুর'],
  ['jigatola', 'জিগাতলা'],
  ['purbachal', 'পূর্বাচল'],
  ['adabar', 'আদাবর'],
  ['hazaribagh', 'হাজারীবাগ'],
  ['pallabi', 'পল্লবী'],
  ['khilkhet', 'খিলক্ষেত'],

  // ── Savar sub-areas (the reported bug's neighbourhood) ──
  ['dattapara', 'দত্তপাড়া'],
  ['hemayetpur', 'হেমায়েতপুর'],
  ['nabinagar', 'নবীনগর'],

  // ── Structural address words that show up inside area strings ──
  ['sector', 'সেক্টর'],
  ['road', 'রোড'],
  ['block', 'ব্লক'],
  ['bangladesh', 'বাংলাদেশ'],
];

// term (lowercased) → Set of its cross-spelling synonyms.
const ALIAS_MAP = (() => {
  const map = new Map();
  for (const group of LOCATION_ALIAS_GROUPS) {
    const terms = group.map((s) => String(s).toLowerCase());
    for (const term of terms) {
      const set = map.get(term) || new Set();
      for (const other of terms) if (other !== term) set.add(other);
      map.set(term, set);
    }
  }
  return map;
})();

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

// Return the Bengali↔English digit transliterations of a token (only the ones
// that actually differ from the input). "10" → ["১০"], "১০" → ["10"].
function digitVariants(token) {
  const out = [];
  const toEn = token.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  const toBn = token.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
  if (toEn !== token) out.push(toEn);
  if (toBn !== token) out.push(toBn);
  return out;
}

/**
 * Expand a single query token into every spelling we should match against:
 * the token itself, its bilingual synonyms, and their digit transliterations.
 */
export function expandLocationToken(token) {
  const t = String(token || '').toLowerCase().trim();
  if (!t) return [];
  const out = new Set([t]);
  const aliases = ALIAS_MAP.get(t);
  if (aliases) aliases.forEach((a) => out.add(a));
  // Numbered areas: add digit transliterations of the token AND each alias.
  for (const v of Array.from(out)) for (const d of digitVariants(v)) out.add(d);
  return Array.from(out);
}

// Split a query the same way the backend's tokenizer does.
function tokenizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((t) => t.replace(/^[-_/]+|[-_/]+$/g, ''))
    .filter((t) => t.length > 0);
}

/**
 * True when EVERY token in `query` is found somewhere in `haystack`, matching
 * either the token itself OR any of its bilingual / digit synonyms. Mirrors the
 * backend's per-token AND semantics so the client-side fallback and mobile feed
 * agree with the server.
 *
 * @param {string} haystack  concatenated location text of a property
 * @param {string} query     the user's search string (either language)
 */
export function locationQueryMatches(haystack, query) {
  const hay = String(haystack || '').toLowerCase();
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;
  return tokens.every((tok) => expandLocationToken(tok).some((v) => hay.includes(v)));
}
