import React, { useMemo, useState } from 'react';
import { MapPin, Crosshair, ChevronDown, Check, Search, X } from 'lucide-react';

import { DISTRICTS_BY_DIVISION, THANAS_BY_DISTRICT } from '../../data/bdGeo';

/**
 * LocationBar — "কোথা থেকে খুঁজছেন", answered once and shown on every screen.
 * ──────────────────────────────────────────────────────────────────────────
 * A hyperlocal directory measured from the wrong place shows the wrong shops,
 * confidently — so this is not a setting tucked into a menu. It sits at the top
 * of every marketplace screen, says which of the two answers it is using, and
 * is one tap from being changed.
 *
 * ─── IT ALWAYS SAYS WHICH ANSWER IT HAS ──────────────────────────────────────
 * A GPS fix and a thana name produce very different result quality, and the
 * tenant is the only one who can tell us the first is wrong. Showing "ধানমন্ডি"
 * when we actually have coordinates — or the reverse — hides the one thing they
 * could fix.
 */

// Dhaka first, then the other metros. A thana picker that opens on Bagerhat for
// a Dhaka tenant is a picker they scroll past rather than use.
const PRIORITY_DISTRICTS = ['dhaka', 'chattogram', 'chittagong', 'gazipur', 'narayanganj', 'sylhet', 'khulna', 'rajshahi'];

function useAllThanas() {
  return useMemo(() => {
    const districts = Object.values(DISTRICTS_BY_DIVISION).flat();
    const rank = (id) => {
      const i = PRIORITY_DISTRICTS.indexOf(id);
      return i === -1 ? PRIORITY_DISTRICTS.length : i;
    };
    const sorted = [...districts].sort((a, b) => rank(a.id) - rank(b.id));

    const out = [];
    const seen = new Set();
    for (const d of sorted) {
      for (const t of (THANAS_BY_DISTRICT[d.id] || [])) {
        // Thana names repeat across districts (there is a Kotwali almost
        // everywhere). The provider records store a bare thana STRING, so two
        // districts' Kotwali are the same key as far as the server is
        // concerned — de-duping here at least stops the list showing it twice.
        const key = t.en.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...t, districtId: d.id, districtBn: d.bn, districtEn: d.en });
      }
    }
    return out;
  }, []);
}

export default function LocationBar({ location, precise, asking, onUseGps, onPickThana, bn }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const thanas = useAllThanas();

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return thanas.slice(0, 40);
    return thanas
      .filter((t) => t.en.toLowerCase().includes(needle) || t.bn.includes(q.trim()))
      .slice(0, 40);
  }, [q, thanas]);

  const label = (() => {
    if (!location) return bn ? 'অবস্থান দিন' : 'Set your location';
    if (precise) return bn ? 'আপনার বর্তমান অবস্থান' : 'Your current location';
    return location.thana || (bn ? 'অবস্থান দিন' : 'Set your location');
  })();

  const sub = (() => {
    if (!location) {
      return bn ? 'কাছের দোকান দেখতে এলাকা বেছে নিন' : 'Pick an area to see nearby shops';
    }
    if (precise) {
      return location.thana
        ? `${location.thana} · GPS`
        : (bn ? 'দূরত্ব অনুযায়ী সাজানো' : 'Sorted by distance');
    }
    // Said plainly. Without coordinates the ordering is not by distance, and
    // pretending otherwise is the lie this whole component exists to avoid.
    return bn ? 'এলাকা অনুযায়ী — দূরত্ব মাপা যায়নি' : 'By area — distance not measured';
  })();

  return (
    <>
      <div className="flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-sm border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] px-3.5 py-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          precise ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
        }`}
        >
          <MapPin size={17} strokeWidth={2.4} />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-[13px] font-black text-gray-900 truncate flex items-center gap-1">
            {label}
            <ChevronDown size={13} className="text-gray-400 shrink-0" />
          </p>
          <p className="text-[10px] font-bold text-gray-400 truncate">{sub}</p>
        </button>

        {/* A deliberate tap, never a prompt on mount: a permission dialog thrown
            at somebody the moment a page opens is how people press Block, and a
            blocked origin cannot be un-blocked from inside the app. */}
        <button
          type="button"
          onClick={onUseGps}
          disabled={asking}
          title={bn ? 'আমার অবস্থান ব্যবহার করুন' : 'Use my location'}
          className="shrink-0 w-9 h-9 rounded-xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center active:scale-95 transition disabled:opacity-50"
        >
          <Crosshair size={16} strokeWidth={2.5} className={asking ? 'animate-spin' : ''} />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={bn ? 'বন্ধ' : 'Close'}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] max-h-[80vh] flex flex-col shadow-2xl pb-safe sm:pb-0">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 ring-1 ring-transparent focus-within:ring-2 focus-within:ring-[#ba0036]/25 transition-all">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={bn ? 'থানা খুঁজুন' : 'Search thana'}
                  className="flex-1 bg-transparent outline-none focus:outline-none focus-visible:outline-none text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-medium"
                />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-2">
              {matches.map((t) => {
                const active = location?.thana === t.bn || location?.thana === t.en;
                return (
                  <button
                    key={`${t.districtId}-${t.en}`}
                    type="button"
                    onClick={() => { onPickThana(bn ? t.bn : t.en); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 text-left"
                  >
                    <MapPin size={15} className="text-gray-300 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-gray-900 truncate">
                        {bn ? t.bn : t.en}
                      </span>
                      <span className="block text-[11px] font-bold text-gray-400 truncate">
                        {bn ? t.districtBn : t.districtEn}
                      </span>
                    </span>
                    {active ? <Check size={16} className="text-[#ba0036] shrink-0" /> : null}
                  </button>
                );
              })}
              {!matches.length ? (
                <p className="text-center text-sm font-bold text-gray-400 py-10">
                  {bn ? 'কিছু পাওয়া যায়নি' : 'No match'}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
