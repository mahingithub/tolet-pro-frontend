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
  if (LEGACY_ALIASES[v]) return LEGACY_ALIASES[v];
  return isValidIntent(v) ? v : DEFAULT_INTENT;
}