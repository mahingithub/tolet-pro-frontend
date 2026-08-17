/**
 * generate-bd-geo.mjs — builds the full Bangladesh location dataset.
 * ─────────────────────────────────────────────────────────────────────────────
 * Run with:  node scripts/generate-bd-geo.mjs
 *
 * Merges THREE sources into src/data/bdGeo.js + src/data/bdAreas.js:
 *
 *   1. scripts/bd-geo/source/*.json — the official government geocode dump
 *      (8 divisions, 64 districts, 494 upazilas, 4540 union parishads, each
 *      with its Bengali name). This is the authoritative RURAL/administrative
 *      layer. It does NOT contain metropolitan police thanas: the Dhaka
 *      district entry lists only Savar/Dhamrai/Keraniganj/Nawabganj/Dohar, so
 *      Dhanmondi, Gulshan, Mirpur … are absent, as are all city neighbourhoods.
 *
 *   2. scripts/bd-geo/urban-*.json — the curated URBAN layer that fills that
 *      gap: metropolitan thanas of the city corporations plus the paras /
 *      mahallas / sectors / blocks / R-As people actually name when they let a
 *      flat (Dhanmondi 27, Uttara Sector 7, Bashundhara R/A Block C, …).
 *
 *   3. The legacy inline lists that used to live in AddProperty.jsx, so nothing
 *      a host could previously select ever disappears from the dropdown.
 *
 * Dedupe is by normalised name, and the FIRST writer wins for the Bengali
 * label — sources are merged official-first so government spellings dominate,
 * with the urban layer supplying everything the government dump has no row for.
 *
 * Stored values stay ENGLISH LABELS for `thana` / `area` and lowercase SLUGS
 * for `division` / `district`, matching what the API and existing listings
 * already use. Regenerating must never rename an existing listing's area.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(HERE, 'bd-geo', 'source');
const OUT = path.join(ROOT, 'src', 'data');

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Loose key for dedupe: "Cox's Bazar Sadar" and "coxs bazar sadar" collide. */
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, '');

/** phpMyAdmin export → the row array. */
const loadTable = (file) => {
  const json = JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
  const table = json.find((x) => x.type === 'table');
  if (!table) throw new Error(`no table block in ${file}`);
  return table.data;
};

const loadUrban = (file) =>
  JSON.parse(fs.readFileSync(path.join(HERE, 'bd-geo', file), 'utf8'));

// ─── 1. official administrative layer ────────────────────────────────────────

const rawDivisions = loadTable('bd_divisions.json');
const rawDistricts = loadTable('bd_districts.json');
const rawUpazilas = loadTable('bd_upazilas.json');
const rawUnions = loadTable('bd_unions.json');

// Division slugs the API already stores (Property.division is an enum of these).
// The dump spells Chattogram "Chattagram" and Barishal "Barisal".
const DIVISION_SLUG = {
  dhaka: 'dhaka',
  chattagram: 'chittagong',
  chattogram: 'chittagong',
  chittagong: 'chittagong',
  sylhet: 'sylhet',
  rajshahi: 'rajshahi',
  khulna: 'khulna',
  barisal: 'barishal',
  barishal: 'barishal',
  rangpur: 'rangpur',
  mymensingh: 'mymensingh',
};

const DIVISION_LABEL = {
  dhaka: { en: 'Dhaka', bn: 'ঢাকা' },
  chittagong: { en: 'Chittagong', bn: 'চট্টগ্রাম' },
  sylhet: { en: 'Sylhet', bn: 'সিলেট' },
  rajshahi: { en: 'Rajshahi', bn: 'রাজশাহী' },
  khulna: { en: 'Khulna', bn: 'খুলনা' },
  barishal: { en: 'Barishal', bn: 'বরিশাল' },
  rangpur: { en: 'Rangpur', bn: 'রংপুর' },
  mymensingh: { en: 'Mymensingh', bn: 'ময়মনসিংহ' },
};

// District slugs already stored by the app. Only the ones whose slug is not
// simply norm(name) need an entry.
const DISTRICT_SLUG_OVERRIDE = {
  // The dump spells the district "Barisal"; every listing in the DB and the
  // division enum use "barishal". Getting this wrong silently splits the
  // district into two, which is how the Barishal upazilas first showed up as
  // orphans during generation.
  barisal: 'barishal',
  coxsbazar: 'coxs_bazar',
  khagrachhari: 'khagrachari',
  khagrachari: 'khagrachari',
  chattogram: 'chattogram',
  chattagram: 'chattogram',
  chittagong: 'chattogram',
  brahamanbaria: 'brahmanbaria',
  netrokona: 'netrokona',
  netrakona: 'netrokona',
  nawabganj: 'chapainawabganj',
  moulvibazar: 'moulvibazar',
  maulvibazar: 'moulvibazar',
  jhalokati: 'jhalokati',
  jhalakathi: 'jhalokati',
  rangamati: 'rangamati',
  rangamatiparbatta: 'rangamati',
};

const districtSlug = (name) => {
  const k = norm(name);
  return DISTRICT_SLUG_OVERRIDE[k] || k;
};

/**
 * Display labels for the handful of districts where the dump's romanisation is
 * not the one the rest of the app already shows (searchData.js, the navbar
 * drawer, the division strip). Slugs are unaffected; this is purely the label a
 * host reads in the dropdown, and it must not drift between screens.
 */
const DISTRICT_LABEL_OVERRIDE = {
  coxs_bazar: "Cox's Bazar",
  khagrachari: 'Khagrachari',
  barishal: 'Barishal',
  jhalokati: 'Jhalokati',
};

/**
 * Romanisation collapse table for thana names.
 *
 * The government dump and the curated urban layer romanise the same upazila
 * differently often enough to matter: Faridgonj/Faridganj, Moheshkhali/
 * Maheshkhali, Ukhiya/Ukhia, Nokla/Nakla, Borhan Sddin/Borhanuddin. Left alone
 * the dropdown shows both, which is exactly the confusion we are trying to
 * remove. Each line is `districtSlug | canonical | variant, variant, …` and
 * every variant folds into the canonical (its areas included).
 *
 * The canonical is the modern spelling a Bangladeshi user is most likely to
 * type, which is usually — but NOT always — the urban layer's. The Bengali
 * label is identical either way, so this only affects the English display.
 *
 * Genuinely distinct neighbours are deliberately absent so they never merge:
 * Tejgaon vs Tejgaon I/A, Uttara East vs West, Tongi East vs West, Matlab
 * Uttar vs Dakshin, Nabinagar vs Nasirnagar, Ramganj vs Ramgati, Amtali vs
 * Taltali.
 */
const THANA_ALIAS_LINES = `
dhaka           | Bhatara          | Vatara
chandpur        | Faridganj        | Faridgonj
chandpur        | Matlab Uttar     | Matlab North
chandpur        | Matlab Dakshin   | Matlab South
chattogram      | Karnaphuli       | Karnafuli
comilla         | Comilla Adarsha Sadar | Comilla Sadar
comilla         | Comilla Sadar Dakshin | Sadarsouth
coxs_bazar      | Maheshkhali      | Moheshkhali
coxs_bazar      | Ukhia            | Ukhiya
feni            | Daganbhuiyan     | Dagonbhuiyan
khagrachari     | Panchhari        | Panchari
noakhali        | Hatiya           | Hatia
noakhali        | Senbagh          | Senbug
noakhali        | Sonaimuri        | Sonaimori
rangamati       | Baghaichhari     | Baghaichari
rangamati       | Kaukhali         | Kawkhali
moulvibazar     | Barlekha         | Baralekha
moulvibazar     | Kamalganj        | Kamolganj
sunamganj       | Bishwamvarpur    | Bishwambarpur
sunamganj       | Dirai            | Derai
bogura          | Bogura Sadar     | Bogra Sadar
bogura          | Dhunat           | Dhunot
bogura          | Nandigram        | Nondigram
bogura          | Sariakandi       | Shariakandi
bogura          | Sonatola         | Sonatala
chapainawabganj | Gomastapur       | Gomostapur
chapainawabganj | Nachole          | Nachol
naogaon         | Badalgachhi      | Badalgachi
naogaon         | Mahadebpur       | Mohadevpur
pabna           | Atgharia         | Atghoria
pabna           | Ishwardi         | Ishurdi
rajshahi        | Mohanpur         | Mohonpur
sirajganj       | Kamarkhanda      | Kamarkhand
sirajganj       | Raiganj          | Raigonj
jashore         | Jashore Sadar    | Jessore Sadar
jashore         | Chaugachha       | Chougachha
jashore         | Jhikargachha     | Jhikargacha
jhenaidah       | Harinakunda      | Harinakundu
jhenaidah       | Maheshpur        | Moheshpur
barishal        | Barishal Sadar   | Barisal Sadar
khulna          | Phultala         | Fultola
khulna          | Paikgachha       | Paikgasa
khulna          | Batiaghata       | Botiaghata
khulna          | Dacope           | Dakop
khulna          | Dighalia         | Digholia
khulna          | Rupsa            | Rupsha
barguna         | Patharghata      | Pathorghata
bhola           | Borhanuddin      | Borhan Sddin, Burhanuddin
bhola           | Char Fasson      | Charfesson
bhola           | Daulatkhan       | Doulatkhan
bhola           | Manpura          | Monpura
jhalokati       | Jhalokati Sadar  | Jhalakathi Sadar
dinajpur        | Biral            | Birol
dinajpur        | Phulbari         | Fulbari
dinajpur        | Kaharole         | Kaharol
gaibandha       | Phulchhari       | Phulchari
gaibandha       | Saghata          | Sughatta
kurigram        | Rowmari          | Raomari
nilphamari      | Kishoreganj      | Kishorganj
nilphamari      | Saidpur          | Syedpur
rangpur         | Badarganj        | Badargonj
rangpur         | Pirgachha        | Pirgacha
rangpur         | Pirganj          | Pirgonj
rangpur         | Taraganj         | Taragonj
jamalpur        | Bakshiganj       | Bokshiganj
jamalpur        | Dewanganj        | Dewangonj
jamalpur        | Melandaha        | Melandah
mymensingh      | Gaffargaon       | Gafargaon
mymensingh      | Gauripur         | Gouripur
mymensingh      | Ishwarganj       | Iswarganj
mymensingh      | Muktagachha      | Muktagacha
netrokona       | Mohanganj        | Mohongonj
sherpur         | Nakla            | Nokla
sherpur         | Sreebardi        | Sreebordi
`;

/** districtSlug → Map(normalisedVariant → canonicalLabel) */
const THANA_ALIASES = (() => {
  const out = new Map();
  for (const line of THANA_ALIAS_LINES.split('\n')) {
    const row = line.trim();
    if (!row) continue;
    const [dist, canonical, variants] = row.split('|').map((s) => s.trim());
    if (!out.has(dist)) out.set(dist, new Map());
    const m = out.get(dist);
    m.set(norm(canonical), canonical);
    for (const v of (variants || '').split(',')) {
      const name = v.trim();
      if (name) m.set(norm(name), canonical);
    }
  }
  return out;
})();

/** Fold a thana name onto its canonical spelling for this district. */
const canonicalThana = (distSlug, name) =>
  (THANA_ALIASES.get(distSlug) || new Map()).get(norm(name)) || String(name || '').trim();

const divisionById = new Map(rawDivisions.map((d) => [d.id, d]));
const districtById = new Map(rawDistricts.map((d) => [d.id, d]));
const upazilaById = new Map(rawUpazilas.map((u) => [u.id, u]));

// ─── accumulators ────────────────────────────────────────────────────────────
// divisions: slug → { en, bn }
// districts: divisionSlug → Map(districtSlug → { id, en, bn })
// thanas:    districtSlug → Map(normKey → { en, bn })
// areas:     districtSlug → thanaEn → Map(normKey → { en, bn })

const districts = new Map();
const thanas = new Map();
const areas = new Map();

const districtBucket = (divSlug) => {
  if (!districts.has(divSlug)) districts.set(divSlug, new Map());
  return districts.get(divSlug);
};
const thanaBucket = (distSlug) => {
  if (!thanas.has(distSlug)) thanas.set(distSlug, new Map());
  return thanas.get(distSlug);
};
const areaBucket = (distSlug, thanaEn) => {
  if (!areas.has(distSlug)) areas.set(distSlug, new Map());
  const byThana = areas.get(distSlug);
  if (!byThana.has(thanaEn)) byThana.set(thanaEn, new Map());
  return byThana.get(thanaEn);
};

/** Insert unless an equivalent name is already there (first writer wins). */
const put = (bucket, en, bn) => {
  const label = String(en || '').trim();
  if (!label) return;
  const key = norm(label);
  if (!key || bucket.has(key)) return;
  bucket.set(key, { en: label, bn: String(bn || '').trim() || label });
};

const stats = { districts: 0, thanas: 0, areas: 0, unmatchedDivision: [], orphanThanas: [] };

// Districts
for (const d of rawDistricts) {
  const div = divisionById.get(d.division_id);
  const divSlug = DIVISION_SLUG[norm(div?.name)];
  if (!divSlug) {
    stats.unmatchedDivision.push(div?.name);
    continue;
  }
  const slug = districtSlug(d.name);
  const bucket = districtBucket(divSlug);
  if (!bucket.has(slug)) {
    bucket.set(slug, {
      id: slug,
      en: DISTRICT_LABEL_OVERRIDE[slug] || d.name,
      bn: d.bn_name,
    });
  }
}

// Upazilas → thanas
for (const u of rawUpazilas) {
  const dist = districtById.get(u.district_id);
  if (!dist) continue;
  const slug = districtSlug(dist.name);
  put(thanaBucket(slug), canonicalThana(slug, u.name), u.bn_name);
}

// Unions → areas
for (const un of rawUnions) {
  const up = upazilaById.get(un.upazilla_id);
  if (!up) continue;
  const dist = districtById.get(up.district_id);
  if (!dist) continue;
  const slug = districtSlug(dist.name);
  put(areaBucket(slug, canonicalThana(slug, up.name)), un.name, un.bn_name);
}

// ─── 2. curated urban layer ──────────────────────────────────────────────────

const urbanFiles = fs
  .readdirSync(path.join(HERE, 'bd-geo'))
  .filter((f) => f.startsWith('urban-') && f.endsWith('.json'));

/**
 * Register a thana name (folding romanisation variants) and return the label
 * the areas map should be keyed by, so an area list can never end up under a
 * thana that is not selectable.
 */
function resolveThanaKey(distSlug, rawName, bn, { track = false } = {}) {
  const canonical = canonicalThana(distSlug, rawName);
  const tb = thanaBucket(distSlug);
  if (!tb.has(norm(canonical))) {
    put(tb, canonical, bn || canonical);
    if (track) stats.orphanThanas.push(`${distSlug}/${canonical}`);
  }
  return tb.get(norm(canonical)).en;
}

for (const file of urbanFiles) {
  const data = loadUrban(file);
  for (const [distSlug, list] of Object.entries(data.metroThanas || {})) {
    for (const t of list) put(thanaBucket(distSlug), canonicalThana(distSlug, t.en), t.bn);
  }
  for (const [distSlug, byThana] of Object.entries(data.areas || {})) {
    for (const [thanaEn, list] of Object.entries(byThana)) {
      // An areas key matching no thana yet is still a real place (usually a
      // "<District> Sadar" spelled differently), so register it rather than
      // drop its neighbourhoods on the floor.
      const key = resolveThanaKey(distSlug, thanaEn, thanaEn, { track: true });
      for (const a of list) put(areaBucket(distSlug, key), a.en, a.bn);
    }
  }
}

// ─── 3. legacy inline lists from AddProperty.jsx ─────────────────────────────

// Snapshot of what the wizard could already offer, taken before the literals
// were deleted from the component (see scripts/bd-geo/extract-legacy.mjs).
// Merged in so regeneration can never drop an area a live listing already uses.
const legacy = JSON.parse(
  fs.readFileSync(path.join(HERE, 'bd-geo', 'legacy-inline.json'), 'utf8'),
);
const LEGACY_THANAS = legacy.THANAS_BY_DISTRICT || {};
const LEGACY_AREAS_BY_THANA = legacy.AREAS_BY_THANA || {};
const LEGACY_AREAS_BY_DISTRICT = legacy.AREAS_BY_DISTRICT || {};
const LEGACY_THANA_BN = legacy.THANA_BN || {};
const LEGACY_AREA_BN = legacy.AREA_BN || {};
const LEGACY_UNIONS = legacy.UNIONS_BY_THANA || {};

const legacyThanaBn = (dist, th) => (LEGACY_THANA_BN[dist] || {})[th] || '';
const legacyAreaBn = (dist, th, a) => ((LEGACY_AREA_BN[dist] || {})[th] || {})[a] || '';

for (const [dist, list] of Object.entries(LEGACY_THANAS)) {
  for (const th of list) put(thanaBucket(dist), canonicalThana(dist, th), legacyThanaBn(dist, th));
}
for (const [dist, byThana] of Object.entries(LEGACY_AREAS_BY_THANA)) {
  for (const [th, list] of Object.entries(byThana)) {
    const key = resolveThanaKey(dist, th, legacyThanaBn(dist, th));
    for (const a of list) put(areaBucket(dist, key), a, legacyAreaBn(dist, th, a));
  }
}
for (const [dist, byThana] of Object.entries(LEGACY_UNIONS)) {
  for (const [th, list] of Object.entries(byThana)) {
    const key = resolveThanaKey(dist, th, legacyThanaBn(dist, th));
    for (const u of list) put(areaBucket(dist, key), u.en, u.bn);
  }
}
// District-level areas with no thana attribution become that district's
// "popular areas" fallback, shown when a host has not picked a thana yet.
const POPULAR = {};
for (const [dist, list] of Object.entries(LEGACY_AREAS_BY_DISTRICT)) {
  const seen = new Set();
  POPULAR[dist] = list.filter((a) => {
    const k = norm(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── serialise ───────────────────────────────────────────────────────────────

const sortByEn = (a, b) => a.en.localeCompare(b.en, 'en');

/** "Sadar" first, then alphabetical — the district town is the common case. */
const sortThanas = (list) =>
  [...list].sort((a, b) => {
    const as = /sadar|model/i.test(a.en) ? 0 : 1;
    const bs = /sadar|model/i.test(b.en) ? 0 : 1;
    return as !== bs ? as - bs : sortByEn(a, b);
  });

/**
 * Numeric-aware sort so "Mirpur 2" precedes "Mirpur 10", and blocks/sectors
 * read in order instead of 1, 10, 11, 2.
 */
const sortAreas = (list) =>
  [...list].sort((a, b) =>
    a.en.localeCompare(b.en, 'en', { numeric: true, sensitivity: 'base' }),
  );

const j = (v) => JSON.stringify(v);

// bdGeo.js — divisions + districts + thanas. Small enough to ship eagerly.
const divisionOrder = ['dhaka', 'chittagong', 'sylhet', 'rajshahi', 'khulna', 'barishal', 'rangpur', 'mymensingh'];

let geo = `/**
 * bdGeo.js — GENERATED FILE, DO NOT EDIT BY HAND.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerate with:  node scripts/generate-bd-geo.mjs
 * Sources: the official Bangladesh geocode dump (8 divisions / 64 districts /
 * 494 upazilas / 4540 unions, bilingual) merged with a curated urban layer of
 * metropolitan thanas, and the legacy lists that used to live inline in
 * AddProperty.jsx. See scripts/generate-bd-geo.mjs for the merge rules.
 *
 * Division and district are addressed by SLUG (what the API stores); thana and
 * area are addressed by their ENGLISH LABEL, which is also what gets stored, so
 * regenerating never renames an existing listing's location.
 *
 * Areas live in the sibling bdAreas.js, code-split behind src/hooks/useBdAreas
 * so only a screen that opens a location picker downloads them.
 */

/** @typedef {{ id: string, en: string, bn: string }} GeoNode */

export const DIVISIONS = [
`;
for (const slug of divisionOrder) {
  const l = DIVISION_LABEL[slug];
  geo += `  { id: ${j(slug)}, en: ${j(l.en)}, bn: ${j(l.bn)} },\n`;
  stats.districts += (districts.get(slug) || new Map()).size;
}
geo += `];

export const DISTRICTS_BY_DIVISION = {
`;
for (const slug of divisionOrder) {
  const list = [...(districts.get(slug) || new Map()).values()].sort(sortByEn);
  geo += `  ${j(slug)}: [\n`;
  for (const d of list) geo += `    { id: ${j(d.id)}, en: ${j(d.en)}, bn: ${j(d.bn)} },\n`;
  geo += `  ],\n`;
}
geo += `};

/**
 * Thana / upazila by district slug. Metropolitan police thanas (Dhanmondi,
 * Panchlaish, Sonadanga …) sit alongside rural upazilas because a host thinks
 * of them as the same level of "which thana is your place in".
 */
export const THANAS_BY_DISTRICT = {
`;
const allDistrictSlugs = [];
for (const slug of divisionOrder) {
  for (const d of [...(districts.get(slug) || new Map()).values()].sort(sortByEn)) {
    allDistrictSlugs.push(d.id);
  }
}
for (const dist of allDistrictSlugs) {
  const list = sortThanas([...(thanas.get(dist) || new Map()).values()]);
  stats.thanas += list.length;
  geo += `  ${j(dist)}: [\n`;
  for (const t of list) geo += `    { en: ${j(t.en)}, bn: ${j(t.bn)} },\n`;
  geo += `  ],\n`;
}
geo += `};

/**
 * Well-known neighbourhoods of a district that are not pinned to one thana.
 * Used as the area suggestions before a thana is chosen.
 */
export const POPULAR_AREAS_BY_DISTRICT = ${JSON.stringify(POPULAR, null, 2)};

/**
 * Older romanisations folded into the canonical thana name at build time
 * (Faridgonj → Faridganj, Ukhiya → Ukhia, Barisal Sadar → Barishal Sadar).
 *
 * The dropdown only ever shows the canonical spelling, but findThana() consults
 * this so a value that arrived from somewhere else — a listing saved before the
 * merge, or a geocoder that prefers the old spelling — still resolves to the
 * real option and renders with its Bengali label instead of being treated as
 * an unrecognised free-text string.
 *
 * districtSlug → { normalisedVariant: canonicalLabel }
 */
export const THANA_NAME_ALIASES = ${JSON.stringify(
    Object.fromEntries(
      [...THANA_ALIASES.entries()].map(([dist, m]) => [dist, Object.fromEntries(m)]),
    ),
    null,
    2,
  )};

// ─── lookups ─────────────────────────────────────────────────────────────────

const norm = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9\\u0980-\\u09FF]+/g, '');

const DIVISION_BY_ID = new Map(DIVISIONS.map((d) => [d.id, d]));
const DISTRICT_BY_ID = new Map(
  Object.values(DISTRICTS_BY_DIVISION).flat().map((d) => [d.id, d]),
);
const DIVISION_OF_DISTRICT = new Map(
  Object.entries(DISTRICTS_BY_DIVISION).flatMap(([div, list]) =>
    list.map((d) => [d.id, div]),
  ),
);

export const getDivision = (id) => DIVISION_BY_ID.get(String(id || '')) || null;
export const getDistrict = (id) => DISTRICT_BY_ID.get(String(id || '')) || null;
export const getDivisionOfDistrict = (id) => DIVISION_OF_DISTRICT.get(String(id || '')) || '';
export const getDistricts = (divisionId) => DISTRICTS_BY_DIVISION[divisionId] || [];
export const getThanas = (districtId) => THANAS_BY_DISTRICT[districtId] || [];

/** Match a name (English or Bengali, any spacing/case) to a district slug. */
export function findDistrictId(name) {
  const k = norm(name);
  if (!k) return '';
  if (DISTRICT_BY_ID.has(k)) return k;
  for (const d of DISTRICT_BY_ID.values()) {
    if (norm(d.en) === k || norm(d.bn) === k) return d.id;
  }
  return '';
}

/**
 * Match a name (English, Bengali, or a superseded romanisation) to one of a
 * district's thanas.
 * @returns {GeoNode|null}
 */
export function findThana(districtId, name) {
  const k = norm(name);
  if (!k) return null;
  const list = getThanas(districtId);
  const direct = list.find((t) => norm(t.en) === k || norm(t.bn) === k);
  if (direct) return direct;
  const canonical = (THANA_NAME_ALIASES[districtId] || {})[k];
  if (!canonical) return null;
  return list.find((t) => t.en === canonical) || null;
}

/** Bengali label for a thana, falling back to the English one. */
export const thanaBn = (districtId, thanaEn) =>
  findThana(districtId, thanaEn)?.bn || thanaEn || '';
`;

// bdAreas.js — the big one, loaded on demand.
let areasOut = `/**
 * bdAreas.js — GENERATED FILE, DO NOT EDIT BY HAND.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerate with:  node scripts/generate-bd-geo.mjs
 *
 * districtSlug → thanaEnglishLabel → [{ en, bn }]. Union parishads for rural
 * upazilas, paras / mahallas / sectors / blocks / R-As for the cities.
 *
 * Split out of bdGeo.js and reached through loadAreas() so this payload only
 * downloads for someone who actually opens a location picker.
 */

export const AREAS_BY_THANA = {
`;
for (const dist of allDistrictSlugs) {
  const byThana = areas.get(dist);
  if (!byThana || byThana.size === 0) continue;
  areasOut += `  ${j(dist)}: {\n`;
  const thanaList = sortThanas([...(thanas.get(dist) || new Map()).values()]);
  for (const t of thanaList) {
    const bucket = byThana.get(t.en);
    if (!bucket || bucket.size === 0) continue;
    const list = sortAreas([...bucket.values()]);
    stats.areas += list.length;
    areasOut += `    ${j(t.en)}: [\n`;
    for (const a of list) areasOut += `      { en: ${j(a.en)}, bn: ${j(a.bn)} },\n`;
    areasOut += `    ],\n`;
  }
  areasOut += `  },\n`;
}
areasOut += `};

export default AREAS_BY_THANA;
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'bdGeo.js'), geo);
fs.writeFileSync(path.join(OUT, 'bdAreas.js'), areasOut);

const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
console.log(`bdGeo.js    ${kb('bdGeo.js')} KB`);
console.log(`bdAreas.js  ${kb('bdAreas.js')} KB`);
console.log(
  `divisions ${DIVISIONS_COUNT()} · districts ${stats.districts} · thanas ${stats.thanas} · areas ${stats.areas}`,
);
if (stats.unmatchedDivision.length) {
  console.log('UNMATCHED DIVISIONS:', [...new Set(stats.unmatchedDivision)]);
}
if (stats.orphanThanas.length) {
  console.log(
    `registered ${stats.orphanThanas.length} thanas that only the urban/legacy layer knew about:`,
  );
  console.log('  ' + stats.orphanThanas.join(', '));
}

function DIVISIONS_COUNT() {
  return divisionOrder.length;
}
