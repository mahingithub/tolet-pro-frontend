/**
 * HomeSurfacePicker — "which screen should the app open on?", as one popup.
 * ──────────────────────────────────────────────────────────────────────────
 * Opened from the "ডিফল্ট" button in ThemeWidget, alongside light / dark /
 * system. That pairing is deliberate: both are small, personal "how I like the
 * app" settings, and the theme flyout is already the one control that follows
 * the user onto every screen. Anywhere else meant either a fifth icon in a
 * phone header that had no room for it, or burying the setting two taps deep
 * inside a dashboard drawer where nobody would find it.
 *
 * ONE tap does ONE thing: the surface you tap becomes the screen the app opens
 * on. No secondary "go there now" action sharing the row — a picker that both
 * navigates and saves makes people hesitate over which they just did.
 *
 * Deliberately NOT a role switcher. Changing role has a verification gate in
 * front of it (Navbar's handleSwitchRole) and this must not become a second,
 * ungated copy — so it only ever lists surfaces the account already owns.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, Wallet, Building2, User, X } from 'lucide-react';

import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useLanguage } from '../../context/LanguageContext';
import { availableSurfaces } from '../../utils/homeSurface';

const META = {
  living: {
    icon: Wallet,
    en: 'Living', bn: 'লিভিং',
    subEn: 'Meals, bills and your own ledger',
    subBn: 'মিল, বিল আর নিজের হিসাবের খাতা',
  },
  tenant: {
    icon: User,
    en: 'My tenancy', bn: 'আমার ভাড়া',
    subEn: 'Rent, payments and your landlord',
    subBn: 'ভাড়া, পেমেন্ট আর বাড়িওয়ালা',
  },
  host: {
    icon: Building2,
    en: 'My properties', bn: 'আমার বাড়ি',
    subEn: 'Tenants, rent and listings',
    subBn: 'ভাড়াটিয়া, ভাড়া আদায় আর বিজ্ঞাপন',
  },
  explore: {
    icon: Search,
    en: 'Browse homes', bn: 'বাসা খুঁজুন',
    subEn: 'Search to-let listings',
    subBn: 'ভাড়ার বিজ্ঞাপন খুঁজুন',
  },
};

export default function HomeSurfacePicker({ open, onClose }) {
  const { roles } = useAuth();
  const { settings, update } = useSettings();
  const lang = useLanguage();
  const isBn = lang?.language === 'বাংলা' || lang?.language === 'bn';

  if (!open) return null;

  const options = availableSurfaces(roles);
  const defaultHome = settings?.app?.defaultHome || 'auto';

  const choose = (surface) => {
    // Fire-and-forget: the choice is a preference, not a transaction, and the
    // settings cache reflects it immediately either way.
    update({ app: { defaultHome: surface } }).catch(() => {});
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-[2rem] sm:rounded-[2rem] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isBn ? 'অ্যাপ খুললে যা দেখব' : 'Open the app on'}
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-[18px] font-black text-gray-900 dark:text-gray-50 tracking-tight">
            {isBn ? 'অ্যাপ খুললে কোনটা আসবে?' : 'Open the app on'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mt-1 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition shrink-0"
            aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          {isBn
            ? 'একটায় চাপ দিন — পরেরবার অ্যাপ খুললে সেটাই আসবে। যখন খুশি বদলাতে পারবেন।'
            : 'Tap one — that is where the app opens next time. Change it whenever you like.'}
        </p>

        <div className="space-y-2">
          {options.map((surface) => {
            const meta = META[surface];
            const Icon = meta.icon;
            const active = defaultHome === surface;
            return (
              <button
                key={surface}
                type="button"
                onClick={() => choose(surface)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition active:scale-[0.99] ${
                  active
                    ? 'border-[#ba0036] bg-[#ba0036]/[0.06]'
                    : 'border-gray-100 dark:border-gray-800 hover:border-[#ba0036]/40'
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    active ? 'bg-[#ba0036] text-white' : 'bg-[#ba0036]/10 text-[#ba0036]'
                  }`}
                >
                  <Icon size={19} strokeWidth={2.3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-black text-gray-900 dark:text-gray-50 truncate">
                    {isBn ? meta.bn : meta.en}
                  </span>
                  <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                    {isBn ? meta.subBn : meta.subEn}
                  </span>
                </span>
                {active && (
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 'auto' is what the app has always done, and stays reachable so a
            choice made here is never a one-way door. */}
        <button
          type="button"
          onClick={() => choose('auto')}
          className={`w-full mt-3 py-3 rounded-2xl text-[12px] font-bold transition ${
            defaultHome === 'auto'
              ? 'text-[#ba0036] bg-[#ba0036]/[0.06]'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          {defaultHome === 'auto'
            ? isBn ? '✓ স্বয়ংক্রিয় (এখন চালু)' : '✓ Automatic (on now)'
            : isBn ? 'স্বয়ংক্রিয় করে দিন' : 'Let the app decide'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
