/**
 * LocationSearchModal.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * A reusable location search surface shared by the desktop hero
 * (HeroSection.jsx) and the mobile home (mobile/MobileHome.jsx). It replaces
 * the old inline dropdown that used to sit under the location input.
 *
 *   ▸ Desktop  → centered popup dialog (Airbnb-style) over a dimmed backdrop
 *   ▸ Mobile   → full-screen sheet
 *
 * Behaviour
 *   • Auto-focuses the search input the moment it opens.
 *   • Debounced (300ms) live search against `/properties/suggestions`, merged
 *     with the static ALL_SUGGESTIONS index — identical logic to the desktop
 *     hero's previous `filteredSuggestions`.
 *   • Keyboard navigation: ArrowUp / ArrowDown / Enter to pick, Escape closes.
 *   • Picking a location calls `onSelect(location)` then closes.
 *   • No recent-searches — suggestions only appear once the user starts typing.
 *
 * All display copy comes from the shared `t` translation table (via
 * useLanguage) so it stays in sync with the rest of the app; each label falls
 * back to English if a key is ever missing.
 *
 * Props
 *   isOpen        boolean   — controls visibility
 *   onClose       ()        — called on backdrop click / close button / Escape
 *   onSelect      (loc)     — called with the chosen location string
 *   initialValue  string    — seed value for the search input when opened
 *   language      string    — retained for API compatibility (label text now
 *                             comes from the shared `t` translation table)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, TrendingUp, Building2, ArrowLeft } from 'lucide-react';
import { ALL_SUGGESTIONS } from '../../data/searchData';
import { useLanguage } from '../../context/LanguageContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Category-tinted row icon — mirrors the vocabulary used across the search UI.
const SuggestionIcon = ({ category }) => {
  if (category === 'search') return <TrendingUp size={16} className="text-crimson-500" />;
  if (category === 'city')   return <Building2  size={16} className="text-blue-500" />;
  return                            <MapPin     size={16} className="text-emerald-500" />;
};

const LocationSearchModal = ({
  isOpen,
  onClose,
  onSelect,
  initialValue = '',
  // eslint-disable-next-line no-unused-vars
  language = 'English',
}) => {
  const { t } = useLanguage() || {};

  const [query, setQuery]                     = useState(initialValue || '');
  const [liveSuggestions, setLiveSuggestions] = useState([]);
  const [activeIndex, setActiveIndex]         = useState(-1);

  const inputRef = useRef(null);
  const listRef  = useRef(null);

  // Labels pulled from the shared `t` translation table. Reuses existing keys
  // (suggestions / mobSearchAnywhere / searchLocation) plus a dedicated
  // `locSearch*` group; each falls back to English if a key is ever missing.
  const L = {
    title:          t?.locSearchTitle          || 'Search location',
    placeholder:    t?.locSearchPlaceholder    || 'Search city, area, or property…',
    suggestions:    t?.suggestions             || 'Suggestions',
    startTyping:    t?.locSearchStartTyping     || 'Start typing an area or city',
    startTypingSub: t?.locSearchStartTypingSub  || 'Matching locations appear as you type',
    noResults:      t?.locSearchNoResults       || 'No results found',
    searchAnywhere: t?.mobSearchAnywhere        || 'Search Anywhere',
    location:       t?.searchLocation           || 'Location',
    close:          t?.locSearchClose           || 'Close',
    clear:          t?.locSearchClear           || 'Clear',
  };

  // ── Sync input with initialValue + auto-focus whenever the modal opens ──
  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialValue || '');
    setActiveIndex(-1);
    setLiveSuggestions([]);
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [isOpen, initialValue]);

  // ── Lock background scroll while open ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ── Escape closes without changing the location (document-level so it
  //    works regardless of which element inside the modal has focus) ──────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // ── Debounced live API search (same contract as the old HeroSection) ────
  useEffect(() => {
    if (!isOpen) return;
    const raw = query.trim();
    if (raw.length < 2) { setLiveSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/properties/suggestions?q=${encodeURIComponent(raw)}`);
        if (res.ok) {
          const data = await res.json();
          setLiveSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        }
      } catch (err) {
        console.error('Autocomplete fetch error:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // ── Merge static + live suggestions — identical to the desktop hero's
  //    previous `filteredSuggestions`, minus the empty-query fallback (we
  //    intentionally show nothing until the user types). ──────────────────
  const buildSuggestions = useCallback((properties = []) => {
    const raw = query.trim();
    if (!raw) return []; // No recent searches — only show suggestions after typing.

    const q = raw.toLowerCase();
    const staticMatches = ALL_SUGGESTIONS.filter(s => s.title.toLowerCase().includes(q));

    const propMatches = properties.flatMap(p => {
      const entries = [];
      if (p?.location && p.location.toLowerCase().includes(q))
        entries.push({ id: `ploc-${p.id}`,   title: p.location, type: 'Property Area', category: 'area' });
      if (p?.area && p.area.toLowerCase().includes(q))
        entries.push({ id: `parea-${p.id}`,  title: p.area,     type: 'Area',          category: 'area' });
      if (p?.title && p.title.toLowerCase().includes(q))
        entries.push({ id: `ptitle-${p.id}`, title: p.title,    type: 'Property',      category: 'search' });
      return entries;
    });

    const merged = [...staticMatches, ...propMatches].filter(
      (s, i, arr) => arr.findIndex(x => x.title.toLowerCase() === s.title.toLowerCase()) === i
    );

    if (merged.length === 0) {
      return [
        { id: `dynamic-${q}`,    title: raw,                  type: L.searchAnywhere, category: 'search' },
        { id: `dynamic-bd-${q}`, title: `${raw}, Bangladesh`, type: L.location,       category: 'city'   },
      ];
    }
    return merged.slice(0, 9);
  }, [query, L.searchAnywhere, L.location]);

  const suggestions = buildSuggestions(liveSuggestions);

  // ── Selection ──────────────────────────────────────────────────────────
  const handleSelect = useCallback((title) => {
    const value = (title || '').trim();
    if (!value) return;
    onSelect?.(value);
    onClose?.();
  }, [onSelect, onClose]);

  // ── Keyboard navigation on the input ───────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) handleSelect(suggestions[activeIndex].title);
      else if (query.trim()) handleSelect(query.trim());
    }
  };

  // Keep the highlighted row scrolled into view during keyboard nav.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100000] font-sans flex md:items-center md:justify-center md:p-4">
      {/* Backdrop — full-screen white on mobile (panel covers it), dimmed on desktop */}
      <div
        className="absolute inset-0 bg-white md:bg-slate-900/50 md:backdrop-blur-sm tlp-lsm-fade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={L.title}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex flex-col bg-white w-full h-full md:h-auto md:w-full md:max-w-[600px] md:max-h-[72vh] md:rounded-[1.75rem] md:shadow-[0_30px_80px_rgba(15,23,42,0.35)] overflow-hidden tlp-lsm-panel"
      >
        {/* ── Header / search bar ── */}
        <div className="shrink-0 border-b border-slate-100 px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:pt-4 pb-3">
          <div className="flex items-center gap-2">
            {/* Back arrow (mobile) */}
            <button
              type="button"
              onClick={onClose}
              aria-label={L.close}
              className="md:hidden shrink-0 w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex-1 flex items-center gap-2.5 bg-slate-100 md:bg-slate-50 border border-transparent md:border-slate-200 rounded-2xl px-3 py-2.5 focus-within:border-crimson-300 focus-within:ring-2 focus-within:ring-crimson-100 transition-all">
              <Search size={18} className="text-crimson-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
                onKeyDown={handleKeyDown}
                placeholder={L.placeholder}
                className="flex-1 min-w-0 bg-transparent border-none outline-none focus:ring-0 text-[15px] md:text-sm font-bold text-slate-900 placeholder-slate-400"
                autoComplete="off"
                spellCheck={false}
                inputMode="search"
              />
              {hasQuery && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setActiveIndex(-1); inputRef.current?.focus(); }}
                  aria-label={L.clear}
                  className="shrink-0 p-1 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={15} className="text-slate-400" />
                </button>
              )}
            </div>

            {/* Close button (desktop) */}
            <button
              type="button"
              onClick={onClose}
              aria-label={L.close}
              className="hidden md:flex shrink-0 w-10 h-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-95 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Suggestions / empty states ── */}
        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain">
          {!hasQuery ? (
            <div className="flex flex-col items-center justify-center text-center px-8 py-16 md:py-14">
              <div className="w-14 h-14 rounded-2xl bg-crimson-50 text-crimson-500 flex items-center justify-center mb-4">
                <MapPin size={26} />
              </div>
              <p className="text-sm font-black text-slate-800">{L.startTyping}</p>
              <p className="text-xs font-medium text-slate-400 mt-1 max-w-[240px]">{L.startTypingSub}</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-8 py-16">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <Search size={26} />
              </div>
              <p className="text-sm font-black text-slate-800">{L.noResults}</p>
            </div>
          ) : (
            <>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                {L.suggestions}
              </p>
              <div className="pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
                {suggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(s.title)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${activeIndex === idx ? 'bg-crimson-50' : 'hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <SuggestionIcon category={s.category} />
                      </span>
                      <span className="font-bold text-sm text-slate-800 truncate">{s.title}</span>
                    </span>
                    <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider shrink-0">{s.type}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Inline keyframes — the project's Tailwind config has no animate plugin. */}
        <style>{`
          @keyframes tlpLsmFade  { from { opacity: 0 } to { opacity: 1 } }
          @keyframes tlpLsmPanel { from { opacity: 0; transform: translateY(12px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
          .tlp-lsm-fade  { animation: tlpLsmFade .18s ease-out }
          .tlp-lsm-panel { animation: tlpLsmPanel .22s cubic-bezier(.4,0,.2,1) }
          @media (max-width: 767px) {
            @keyframes tlpLsmPanelMobile { from { opacity: 0; transform: translateY(100%) } to { opacity: 1; transform: translateY(0) } }
            .tlp-lsm-panel { animation: tlpLsmPanelMobile .26s cubic-bezier(.4,0,.2,1) }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LocationSearchModal;
