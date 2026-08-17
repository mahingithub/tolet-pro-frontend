/**
 * LocationCombobox — searchable location picker that also accepts free text.
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the plain <select> the Add Property wizard used for thana and area.
 * A <select> had two problems that made listings impossible to place correctly:
 *
 *   1. With 600+ thanas and 6700+ areas in the dataset, scrolling a native
 *      select is unusable — you need to type to filter.
 *   2. A select cannot accept a value that is not in the list, so a host whose
 *      para was missing had nowhere to put it. Bangladesh has more
 *      neighbourhood names than any list will ever hold, so "type your own" is
 *      not a fallback here, it is a requirement.
 *
 * Matching is bilingual and digit-aware via expandLocationToken(), so "১০"
 * finds "Mirpur 10", "dhanmondi" finds "ধানমন্ডি ২৭", and every token in a
 * multi-word query has to hit (typing "uttara 7" narrows to Sector 7).
 *
 * Accessibility: implements the ARIA 1.2 combobox pattern — aria-expanded,
 * aria-controls, aria-activedescendant on the input, role="listbox"/"option"
 * on the popup, full arrow-key/Enter/Escape/Home/End keyboard support, and
 * aria-live feedback on the result count for screen readers.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, MapPin, Search, X, Loader2, PencilLine } from 'lucide-react';
import {
  MAX_LOCATION_ROWS,
  searchLocationOptions,
  isCustomLocation,
} from '../../data/locationSearch';

const norm = (s) => String(s || '').toLowerCase().trim();

export default function LocationCombobox({
  value = '',
  onChange,
  options = [],
  isBn = false,
  placeholder = '',
  disabled = false,
  loading = false,
  invalid = false,
  allowCustom = true,
  /** Shown under the input when the list is empty for this parent. */
  emptyHint = '',
  className = '',
  inputClassName = '',
  'data-tour': dataTour,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const uid = useId();
  const listId = `loc-list-${uid}`;

  const byLabel = useMemo(() => {
    const m = new Map();
    for (const o of options) m.set(norm(o.en), o);
    return m;
  }, [options]);

  /** The label to show when not actively typing. */
  const selectedOption = value ? byLabel.get(norm(value)) : null;
  const displayValue = selectedOption ? (isBn ? selectedOption.bn : selectedOption.en) : value;

  const results = useMemo(() => searchLocationOptions(options, query), [query, options]);

  /**
   * True when the typed text is not (case-insensitively) one of the options, so
   * we offer to keep it verbatim. This is the escape hatch that makes every
   * unlisted para in the country reachable.
   */
  const trimmedQuery = query.trim();
  const showCustom = allowCustom && isCustomLocation(options, trimmedQuery);

  // Row 0 is the custom row when present, so options shift down by one.
  const rows = showCustom ? [{ custom: true }, ...results.map((o) => ({ o }))] : results.map((o) => ({ o }));

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  // Clicking away keeps whatever was typed rather than throwing it out. Someone
  // entering an unlisted area is the case this whole control exists for, and
  // silently discarding their typing on an outside click is the fastest way to
  // make it feel broken again.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (rootRef.current && rootRef.current.contains(e.target)) return;
      if (showCustom) commit(trimmedQuery);
      else close();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [open, showCustom, trimmedQuery]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function commit(next, option = null) {
    onChange?.(next, option);
    setOpen(false);
    setQuery('');
  }

  function pick(idx) {
    const row = rows[idx];
    if (!row) {
      // Enter on an empty result set still keeps what was typed.
      if (showCustom) commit(trimmedQuery);
      return;
    }
    if (row.custom) commit(trimmedQuery);
    else commit(row.o.en, row.o);
  }

  function onKeyDown(e) {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((i) => Math.min(rows.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActive(rows.length - 1);
        }
        break;
      case 'Enter':
        if (open) {
          e.preventDefault();
          pick(active);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case 'Tab':
        // Leaving the field keeps what was typed rather than silently dropping
        // it — the most common way a host enters an unlisted area.
        if (open && showCustom) commit(trimmedQuery);
        else close();
        break;
      default:
        break;
    }
  }

  const hasOptions = options.length > 0;
  const t = (en, bn) => (isBn ? bn : en);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
          {open ? <Search size={16} /> : <MapPin size={16} />}
        </span>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows.length ? `${listId}-${active}` : undefined}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          data-tour={dataTour}
          className={`${inputClassName} pl-10 pr-16 ${invalid ? 'border-red-200 bg-red-50' : ''} ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          placeholder={placeholder}
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={onKeyDown}
        />

        {/* Clear — only when something is chosen and we're not mid-search. */}
        {!open && value && !disabled && (
          <button
            type="button"
            onClick={() => {
              commit('');
              inputRef.current?.focus();
            }}
            aria-label={t('Clear selection', 'নির্বাচন মুছুন')}
            className="absolute right-9 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full text-gray-300 hover:text-[#ba0036] hover:bg-red-50 transition-colors"
          >
            <X size={13} strokeWidth={3} />
          </button>
        )}

        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={16} />}
        </span>
      </div>

      {/* Screen-reader-only running commentary on the result count. */}
      <span className="sr-only" aria-live="polite">
        {open
          ? t(`${results.length} matches`, `${results.length} টি ফলাফল`)
          : ''}
      </span>

      {!open && !hasOptions && !loading && emptyHint && (
        <p className="text-[10px] font-bold text-gray-400 mt-1.5 flex items-center gap-1">
          <PencilLine size={11} />
          {emptyHint}
        </p>
      )}

      {open && (
        <div
          className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-100 shadow-[0_12px_36px_rgba(0,0,0,0.12)] overflow-hidden"
          // z-30 keeps this under the app-download banner's fixed-overlay band
          // (z-50+) while still clearing the wizard's in-flow content.
        >
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-64 overflow-y-auto overscroll-contain py-1"
          >
            {showCustom && (
              <li
                id={`${listId}-0`}
                data-idx={0}
                role="option"
                aria-selected={active === 0}
                onMouseEnter={() => setActive(0)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(0)}
                className={`px-4 py-2.5 cursor-pointer flex items-center gap-2.5 border-b border-gray-50 ${
                  active === 0 ? 'bg-red-50' : 'hover:bg-gray-50'
                }`}
              >
                <PencilLine size={14} className="text-[#ba0036] shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-black text-gray-900 truncate">
                    {trimmedQuery}
                  </span>
                  <span className="block text-[10px] font-bold text-[#ba0036]">
                    {t('Use this name', 'এই নামটি ব্যবহার করুন')}
                  </span>
                </span>
              </li>
            )}

            {results.map((o, i) => {
              const idx = showCustom ? i + 1 : i;
              const primary = isBn ? o.bn : o.en;
              const secondary = isBn ? o.en : o.bn;
              const isSelected = norm(value) === norm(o.en);
              return (
                <li
                  key={o.en}
                  id={`${listId}-${idx}`}
                  data-idx={idx}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(idx)}
                  className={`px-4 py-2.5 cursor-pointer flex items-center justify-between gap-3 ${
                    active === idx ? 'bg-red-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black text-gray-900 truncate">
                      {primary}
                    </span>
                    {secondary && secondary !== primary && (
                      <span className="block text-[10px] font-bold text-gray-400 truncate">
                        {secondary}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check size={14} className="text-[#ba0036] shrink-0" strokeWidth={3} />}
                </li>
              );
            })}

            {loading && (
              <li className="px-4 py-3 flex items-center gap-2 text-[11px] font-bold text-gray-400">
                <Loader2 size={13} className="animate-spin" />
                {t('Loading areas…', 'এলাকা লোড হচ্ছে…')}
              </li>
            )}

            {!loading && results.length === 0 && !showCustom && (
              <li className="px-4 py-3 text-[11px] font-bold text-gray-400">
                {hasOptions
                  ? t('No match — type your own name', 'কোনো মিল নেই — নিজের নাম লিখুন')
                  : t('Type your area name', 'আপনার এলাকার নাম লিখুন')}
              </li>
            )}
          </ul>

          {results.length >= MAX_LOCATION_ROWS && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] font-bold text-gray-400">
              {t('Keep typing to narrow down', 'আরও লিখে খুঁজুন')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
