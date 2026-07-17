import React from 'react';
import usePropertyStore from '../store/usePropertyStore';
import { VISIBLE_LISTING_INTENTS } from '../constants/listingIntents';
import { useLanguage } from '../context/LanguageContext';

// Display copy for each canonical intent. The VALUES live in the shared
// constant (listingIntents) — only the human-facing labels live here. Note
// 'sale' reads as "Buy" on the browse tabs (the visitor is a buyer); the
// underlying intent value stays 'sale' everywhere in state / URL / API.
const LABELS = {
  rent:       { en: 'Rent',       bn: 'ভাড়া' },
  sale:       { en: 'Buy',        bn: 'কিনুন' },
  commercial: { en: 'Commercial', bn: 'কমার্শিয়াল' },
};

/**
 * Shared listing-mode switcher (Rent / Buy / Commercial).
 * Drop it into the Navbar, HomePage hero, and MobileHome — one source of truth,
 * one look. State is global (usePropertyStore.activeMode) so every instance
 * stays in sync and the choice persists across reloads.
 *
 * Props:
 *   className  extra classes for the track (e.g. "hidden md:flex" in the navbar)
 *   fullWidth  stretch tabs to fill the row (use on mobile / hero bars)
 */
export default function ModeSwitcher({ className = '', fullWidth = false }) {
  const activeMode    = usePropertyStore((s) => s.activeMode);
  const setActiveMode = usePropertyStore((s) => s.setActiveMode);

  // useLanguage is called unconditionally (Rules of Hooks); we read the field
  // defensively so a missing provider just falls back to English labels.
  const lang = useLanguage();
  const isBn = lang?.language === 'বাংলা' || lang?.language === 'bn';

  return (
    <div
      role="tablist"
      aria-label="Listing mode"
      className={`inline-flex items-center gap-1 p-1 rounded-full bg-gray-100/80 border border-gray-200/60 backdrop-blur-sm ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {VISIBLE_LISTING_INTENTS.map((intent) => {
        const active = activeMode === intent;
        return (
          <button
            key={intent}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setActiveMode(intent)}
            className={`${fullWidth ? 'flex-1' : ''} px-4 py-1.5 rounded-full text-sm font-black tracking-tight whitespace-nowrap transition-all active:scale-95 ${
              active
                ? 'bg-white text-[#ba0036] border border-gray-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {isBn ? LABELS[intent].bn : LABELS[intent].en}
          </button>
        );
      })}
    </div>
  );
}
