/**
 * verify-bd-geo.mjs — asserts the location dataset and its search behave.
 * ─────────────────────────────────────────────────────────────────────────────
 * Run with:  node scripts/verify-bd-geo.mjs
 *
 * Exercises the SAME functions the Add Property comboboxes use
 * (searchLocationOptions / isCustomLocation from src/data/locationSearch.js)
 * against the real generated data, so this checks what a host actually
 * experiences rather than a copy of the logic.
 *
 * Covers the failure that prompted the work: picking a district used to leave
 * the thana and area dropdowns either empty or missing the host's own para,
 * with no way to type it in.
 */

import {
  DIVISIONS,
  DISTRICTS_BY_DIVISION,
  THANAS_BY_DISTRICT,
  getThanas,
  findThana,
  thanaBn,
} from '../src/data/bdGeo.js';
import { AREAS_BY_THANA } from '../src/data/bdAreas.js';
import { searchLocationOptions, isCustomLocation } from '../src/data/locationSearch.js';

let pass = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const allDistricts = Object.values(DISTRICTS_BY_DIVISION).flat();
const areasOf = (district, thana) => (AREAS_BY_THANA[district] || {})[thana] || [];

/** Every area of a district, which is what the picker offers before a thana. */
const allAreasOf = (district) => Object.values(AREAS_BY_THANA[district] || {}).flat();

/** Does searching `query` surface `expected`? Mirrors the combobox exactly. */
function finds(options, query, expected) {
  const hits = searchLocationOptions(options, query);
  return hits.some((o) => o.en === expected || o.bn === expected);
}

// ─── 1. structural completeness ──────────────────────────────────────────────

check('8 divisions', DIVISIONS.length === 8, `got ${DIVISIONS.length}`);
check('64 districts', allDistricts.length === 64, `got ${allDistricts.length}`);

for (const d of allDistricts) {
  check(`${d.id}: has thanas`, getThanas(d.id).length > 0, 'thana dropdown would be empty');
  check(`${d.id}: has areas`, allAreasOf(d.id).length > 0, 'area dropdown would be empty');
  check(`${d.id}: bilingual`, Boolean(d.en && d.bn));
}

// Every thana with areas must be a thana the host can actually select,
// otherwise its areas are unreachable.
for (const [district, byThana] of Object.entries(AREAS_BY_THANA)) {
  const selectable = new Set(getThanas(district).map((t) => t.en));
  for (const thana of Object.keys(byThana)) {
    check(
      `${district}/${thana}: area list is reachable`,
      selectable.has(thana),
      'areas keyed to a thana that is not in the dropdown',
    );
  }
}

// Bilingual labels everywhere — Bengali mode must never fall back to blanks.
let missingLabel = 0;
for (const district of Object.keys(THANAS_BY_DISTRICT)) {
  for (const t of getThanas(district)) if (!t.en || !t.bn) missingLabel += 1;
  for (const a of allAreasOf(district)) if (!a.en || !a.bn) missingLabel += 1;
}
check('every thana + area is bilingual', missingLabel === 0, `${missingLabel} missing a label`);

// ─── 2. the reported failures, as scenarios ──────────────────────────────────

// Savar → Dattapara: the neighbourhood from the original bug report.
check(
  'dhaka/Savar exists',
  Boolean(findThana('dhaka', 'Savar')),
  'Savar missing from the Dhaka thana list',
);
check(
  'Savar → Dattapara is findable',
  finds(areasOf('dhaka', 'Savar'), 'dattapara', 'Dattapara'),
);

// Rural union that only the old hand-maintained list knew about.
check(
  'Bhola → Lalmohan → Kalma is findable',
  finds(areasOf('bhola', 'Lalmohan'), 'kalma', 'Kalma'),
);

// Numbered areas, in both digit scripts.
const mirpur = areasOf('dhaka', 'Mirpur');
check('Mirpur → "Mirpur 10" via latin digits', finds(mirpur, 'mirpur 10', 'Mirpur 10'));
check('Mirpur → "Mirpur 10" via Bengali digits', finds(mirpur, 'মিরপুর ১০', 'Mirpur 10'));
check('Mirpur → "10" alone still matches', finds(mirpur, '10', 'Mirpur 10'));

// Multi-token narrowing: "uttara 7" must not return every sector.
const uttaraW = areasOf('dhaka', 'Uttara West');
const sector7 = searchLocationOptions(uttaraW, 'uttara 7');
check('"uttara 7" finds Sector 7', sector7.some((o) => o.en === 'Uttara Sector 7'));
check(
  '"uttara 7" excludes Sector 9',
  !sector7.some((o) => o.en === 'Uttara Sector 9'),
  `returned ${sector7.map((o) => o.en).join(', ')}`,
);

// Bengali query against an English-stored name.
check(
  'Bengali query finds Dhanmondi 27',
  finds(areasOf('dhaka', 'Dhanmondi'), 'ধানমন্ডি ২৭', 'Dhanmondi 27'),
);

// Districts that had NO thana list at all before this change.
for (const district of ['kurigram', 'panchagarh', 'magura', 'meherpur', 'jhalokati', 'natore']) {
  check(`${district}: thanas now listed`, getThanas(district).length >= 3);
  check(`${district}: areas now listed`, allAreasOf(district).length >= 5);
}

// Metropolitan thanas the official upazila dump does not contain.
for (const [district, thana] of [
  ['dhaka', 'Dhanmondi'],
  ['dhaka', 'Gulshan'],
  ['dhaka', 'Motijheel'],
  ['chattogram', 'Panchlaish'],
  ['chattogram', 'Khulshi'],
  ['khulna', 'Sonadanga'],
  ['rajshahi', 'Boalia'],
  ['sylhet', 'Jalalabad'],
  ['rangpur', 'Tajhat'],
  ['barishal', 'Kotwali Model'],
]) {
  check(`${district}/${thana}: metro thana present`, Boolean(findThana(district, thana)));
}

// Romanisation collapse: the old dump spelling must resolve to one canonical
// entry, not sit beside it as a duplicate.
for (const [district, variant, canonical] of [
  ['chandpur', 'Faridgonj', 'Faridganj'],
  ['coxs_bazar', 'Ukhiya', 'Ukhia'],
  ['bhola', 'Borhan Sddin', 'Borhanuddin'],
  ['sherpur', 'Nokla', 'Nakla'],
  ['barishal', 'Barisal Sadar', 'Barishal Sadar'],
]) {
  const hit = findThana(district, variant);
  check(
    `${district}: "${variant}" resolves to "${canonical}"`,
    hit && hit.en === canonical,
    hit ? `resolved to ${hit.en}` : 'no match',
  );
  check(
    `${district}: "${variant}" is not a second dropdown row`,
    !getThanas(district).some((t) => t.en === variant),
  );
}

// ─── 3. free text — the actual fix for "my area isn't in the list" ───────────

const dhanmondi = areasOf('dhaka', 'Dhanmondi');
check(
  'an unlisted name is offered as custom',
  isCustomLocation(dhanmondi, 'Amar Notun Para'),
);
check(
  'a listed name is NOT offered as custom',
  !isCustomLocation(dhanmondi, 'Dhanmondi 27'),
);
check(
  'custom detection ignores case',
  !isCustomLocation(dhanmondi, 'dhanmondi 27'),
);
check(
  'a Bengali listed name is NOT offered as custom',
  !isCustomLocation(dhanmondi, 'ধানমন্ডি ২৭'),
);
check('empty input offers nothing', !isCustomLocation(dhanmondi, '   '));

// Thana free text too — someone in a brand-new thana must not be stuck.
check(
  'unlisted thana is offered as custom',
  isCustomLocation(getThanas('dhaka'), 'Notun Thana'),
);

// ─── 4. Bengali fallbacks ───────────────────────────────────────────────────

check('thanaBn returns Bengali', thanaBn('dhaka', 'Dhanmondi') === 'ধানমন্ডি');
check('thanaBn falls back to input', thanaBn('dhaka', 'Made Up Place') === 'Made Up Place');

// ─── report ─────────────────────────────────────────────────────────────────

const totalThanas = Object.keys(THANAS_BY_DISTRICT).reduce(
  (n, d) => n + getThanas(d).length,
  0,
);
const totalAreas = Object.keys(AREAS_BY_THANA).reduce((n, d) => n + allAreasOf(d).length, 0);

console.log(
  `coverage: ${DIVISIONS.length} divisions · ${allDistricts.length} districts · ` +
    `${totalThanas} thanas · ${totalAreas} areas`,
);
console.log(`${pass} checks passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
