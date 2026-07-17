// src/constants/listingIntents.js
//
// Single source of truth for the three listing intents on the FRONTEND. Keep
// these in lockstep with the backend Property model's canonical INTENTS
// ('rent' / 'sale' / 'commercial') and its pre('validate') normaliser. Every
// mode-aware surface — the Zustand store, the ModeSwitcher tabs, the
// PropertyListing filters, the AddProperty wizard — imports from here so a typo
// in one screen can never silently desync it from the rest.

export const LISTING_INTENTS = ['rent', 'sale', 'commercial'];

export const DEFAULT_INTENT = 'rent';

// ─── FEATURE FLAG: buy / sell ('sale') ───────────────────────────────────────
// Buying & selling is temporarily handled OFF-PLATFORM by the support team /
// agency instead of self-service browsing + listing. While this is `false`, the
// 'sale' intent — shown to visitors as the "Buy" tab, and as "Purchase / Buy"
// in the listing wizard — is hidden from every mode switcher, filter tab, the
// home-page "what are you looking for?" prompts and the AddProperty wizard.
//
// Nothing is deleted: the canonical intent still exists, normaliseIntent + the
// backend still understand 'sale', and any already-published sale listings keep
// resolving. Flip this back to `true` to restore buying/selling everywhere with
// no other change.
export const SALE_INTENT_ENABLED = false;

// The intents that should actually be OFFERED in the UI. Derived from
// LISTING_INTENTS so the canonical list stays the single source of truth — we
// only drop 'sale' while it's disabled. Mode switchers / filter tabs map over
// THIS list instead of LISTING_INTENTS.
export const VISIBLE_LISTING_INTENTS = LISTING_INTENTS.filter(
  (intent) => intent !== 'sale' || SALE_INTENT_ENABLED,
);

// Legacy spellings older builds / the old backend enum used. We collapse them
// to 'sale' exactly like the backend does, so a stale value (persisted in
// localStorage, or arriving in a shared '?intent=sell' URL) still resolves
// instead of dropping the user into an unknown tab.
const LEGACY_ALIASES = { sell: 'sale', buy: 'sale', purchase: 'sale' };

export function isValidIntent(value) {
  return LISTING_INTENTS.includes(value);
}

// Map any incoming value to a canonical intent: legacy → 'sale', a valid value
// passes through, and anything unknown/blank falls back to DEFAULT_INTENT.
export function normaliseIntent(value) {
  const v = String(value || '').toLowerCase().trim();
  const resolved = LEGACY_ALIASES[v] || (isValidIntent(v) ? v : DEFAULT_INTENT);
  // While buying/selling is routed through the support team
  // (SALE_INTENT_ENABLED === false) we never resolve INTO 'sale': a stale
  // persisted activeMode, a shared '?intent=sale' link, or a legacy
  // '?intent=buy' link all fall back to the default so nobody lands on a tab
  // that's currently hidden. This governs UI mode state only — the Property
  // model still stores 'sale', so existing listings are unaffected and
  // re-enabling the flag is seamless.
  if (resolved === 'sale' && !SALE_INTENT_ENABLED) return DEFAULT_INTENT;
  return resolved;
}
