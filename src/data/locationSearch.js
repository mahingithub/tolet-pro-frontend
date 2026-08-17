/**
 * locationSearch — ranking for the location comboboxes.
 * ─────────────────────────────────────────────────────────────────────────────
 * Kept out of the component so the behaviour hosts actually depend on ("I typed
 * my para, did it come up?") is plain functions that can be exercised directly:
 * see scripts/verify-bd-geo.mjs.
 *
 * Matching rules, in order of intent:
 *   • every whitespace/comma-separated token must hit, so "uttara 7" narrows to
 *     Sector 7 instead of returning all eighteen sectors;
 *   • a token matches in EITHER language and EITHER digit script, via
 *     expandLocationToken — "১০" finds "Mirpur 10", "ধানমন্ডি" finds "Dhanmondi";
 *   • exact beats prefix beats word-start beats substring, and shorter names win
 *     ties, so "Mirpur 1" is never buried under "Mirpur 11 Block D".
 */

// Explicit extension so plain `node` can import this module too — the dataset
// verification script (scripts/verify-bd-geo.mjs) runs outside Vite's resolver.
import { expandLocationToken } from './locationAliases.js';

/** Cap on rendered rows. Past this, narrowing the query beats scrolling. */
export const MAX_LOCATION_ROWS = 60;

const norm = (s) => String(s || '').toLowerCase().trim();

/** Split a query the way a person types a place: on spaces and commas. */
export const tokenizeLocationQuery = (q) => norm(q).split(/[\s,;]+/).filter(Boolean);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Relevance of one option to a query. 0 means "no match at all".
 * @param {{en:string,bn:string}} option
 * @param {string[]} tokens   pre-tokenised query
 * @param {string} rawQuery   normalised full query
 */
export function scoreLocationOption(option, tokens, rawQuery) {
  const en = norm(option.en);
  const bn = norm(option.bn);
  const hay = `${en} ${bn}`;

  for (const token of tokens) {
    const variants = expandLocationToken(token);
    if (!variants.some((v) => hay.includes(v))) return 0;
  }

  if (en === rawQuery || bn === rawQuery) return 1000;
  if (en.startsWith(rawQuery) || bn.startsWith(rawQuery)) return 700;
  // A word-boundary hit reads as more relevant than a mid-word one: searching
  // "bazar" should surface "Bazar Ghata" above "Shahebbazar".
  if (new RegExp(`\\b${escapeRe(rawQuery)}`).test(hay)) return 500;
  if (hay.includes(rawQuery)) return 300;
  return 100; // matched only through an alias / digit / multi-token expansion
}

/**
 * Rank options against a query. An empty query returns the head of the list
 * unchanged, so opening the picker shows the natural (Sadar-first) order.
 *
 * @param {{en:string,bn:string}[]} options
 * @param {string} query
 * @param {{limit?:number}} [opts]
 * @returns {{en:string,bn:string}[]}
 */
export function searchLocationOptions(options, query, { limit = MAX_LOCATION_ROWS } = {}) {
  const raw = norm(query);
  if (!raw) return options.slice(0, limit);
  const tokens = tokenizeLocationQuery(raw);
  const scored = [];
  for (const o of options) {
    const s = scoreLocationOption(o, tokens, raw);
    if (s > 0) scored.push({ o, s });
  }
  scored.sort((a, b) => b.s - a.s || a.o.en.length - b.o.en.length);
  return scored.slice(0, limit).map((x) => x.o);
}

/**
 * True when `query` is not already one of the options, i.e. we should offer to
 * keep it verbatim. This is the escape hatch that makes every unlisted para in
 * the country reachable.
 */
export function isCustomLocation(options, query) {
  const q = norm(query);
  if (!q) return false;
  return !options.some((o) => norm(o.en) === q || norm(o.bn) === q);
}
