/*
 * OverdueDrawer.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * "Who owes me money", as a floating edge widget — the mirror of the theme
 * switcher on the right.
 *
 * Deliberately built to the SAME pattern as shared/ThemeWidget.jsx: a small
 * tab resting against the edge, which slides a panel out when tapped. Copying
 * that component's geometry (the w-10 h-12 tab, the rounded edge, the
 * translate-x slide, the shadow) is the point — two floating widgets on
 * opposite edges of the same screen should look like siblings, not like two
 * different ideas that happen to be nearby.
 *
 * THE ONLY PLACE overdue tenants are listed. The rail used to carry a box with
 * the same list, which put it on screen twice.
 *
 * Scoped to ONE building: the tab appears after the landlord has entered a
 * building, and shows that building's arrears. On the all-buildings overview
 * there is no single set of tenants to chase, so it is not rendered at all.
 */

import React, { useEffect, useRef } from 'react';
import { BellRing, X, ChevronRight } from 'lucide-react';

export default function OverdueDrawer({
  open,
  onOpen,
  onClose,
  tenants = [],        // the overdue rent units, as the month summary reports them
  language,
  formatBDT,
  onRemind,            // (unit) => void
  onOpenTenant,        // (unit) => void
}) {
  const isBn = language === 'বাংলা';
  const count = tenants.length;
  const ref = useRef(null);

  // Tapping anywhere else closes it — same behaviour as the theme widget, and
  // what anyone expects from something that slid out of an edge.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="fixed left-0 top-1/2 -translate-y-1/2 z-[100] flex items-center">
      <div
        className={`
          flex items-center bg-white dark:bg-gray-800 border border-l-0 border-gray-200 dark:border-gray-700
          shadow-[0_8px_30px_-15px_rgba(0,0,0,0.3)]
          transition-all duration-300 ease-in-out
          ${open ? 'rounded-r-2xl p-2 translate-x-0' : 'rounded-r-xl p-0 -translate-x-full'}
        `}
      >
        {open && (
          <div className="ml-1 w-[76vw] max-w-[300px] max-h-[70vh] flex flex-col">
            <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
              <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <BellRing size={13} className="text-rose-500" />
                {isBn ? 'বকেয়া ভাড়াটিয়া' : 'Overdue Tenants'}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-black tabular-nums">
                {count}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-0.5">
              {count === 0 ? (
                <p className="px-2 py-6 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
                  {isBn ? 'কারও ভাড়া বকেয়া নেই।' : 'Nobody is overdue.'}
                </p>
              ) : tenants.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenTenant?.(u)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0">
                      {(u.tenantInit || (u.tenant || '?').trim().charAt(0)).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-gray-900 dark:text-white truncate">
                        {u.tenant || (isBn ? 'নামহীন' : 'Unnamed')}
                      </p>
                      <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 truncate tabular-nums">
                        {formatBDT ? formatBDT((Number(u.monthlyRent) || 0) + (Number(u.serviceCharge) || 0)) : u.monthlyRent}
                        {u.roomNumber ? ` · ${isBn ? 'রুম' : 'Room'} ${u.roomNumber}` : (u.property ? ` · ${u.property}` : '')}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemind?.(u)}
                    className="shrink-0 p-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 active:scale-95 transition-all"
                    title={isBn ? 'রিমাইন্ডার পাঠান' : 'Send reminder'}
                  >
                    <BellRing size={14} />
                  </button>
                  <ChevronRight size={13} className="text-gray-300 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The resting tab. Same 40×48 footprint as the theme widget's, mirrored:
          rounded on the right, border open on the left. */}
      {!open && (
        <button
          type="button"
          onClick={onOpen}
          className={`
            absolute left-0 flex flex-col items-center justify-center w-10 h-12
            bg-white dark:bg-gray-800 border border-l-0 border-gray-200 dark:border-gray-700 shadow-md
            rounded-r-xl transition-colors
            ${count > 0
              ? 'text-rose-600 hover:text-rose-700'
              : 'text-gray-700 dark:text-gray-200 hover:text-[#ba0036]'}
          `}
          aria-label={isBn ? 'বকেয়া ভাড়াটিয়া' : 'Overdue tenants'}
        >
          <BellRing size={18} />
          {count > 0 && (
            <span className="text-[10px] font-black tabular-nums leading-none mt-0.5">{count}</span>
          )}
        </button>
      )}
    </div>
  );
}
