// MuteNotificationsModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp-style "Mute notifications" chooser: pick a duration, then OK/Cancel.
//
// Props:
//   open, name
//   onCancel
//   onConfirm(durationKey)   durationKey ∈ '8h' | '1w' | 'always'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellOff } from 'lucide-react';

const OPTIONS = [
  { key: '8h',     label: '8 hours' },
  { key: '1w',     label: '1 week' },
  { key: 'always', label: 'Always' },
];

export default function MuteNotificationsModal({ open, name = 'this chat', onCancel, onConfirm }) {
  const [choice, setChoice] = useState('8h');

  // Reset to the default each time it opens.
  useEffect(() => { if (open) setChoice('8h'); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 20, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-[1.75rem] w-full max-w-sm shadow-[0_30px_80px_rgba(0,0,0,0.25)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <BellOff size={22} />
                </span>
                <div>
                  <h3 className="text-base font-black text-gray-900">Mute notifications</h3>
                  <p className="text-[11px] font-bold text-gray-400">Mute {name} for…</p>
                </div>
              </div>

              <div className="space-y-1">
                {OPTIONS.map((o) => (
                  <label
                    key={o.key}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-colors ${
                      choice === o.key ? 'bg-[#ba0036]/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        choice === o.key ? 'border-[#ba0036]' : 'border-gray-300'
                      }`}
                    >
                      {choice === o.key && <span className="w-2.5 h-2.5 rounded-full bg-[#ba0036]" />}
                    </span>
                    <span className="text-[14px] font-bold text-gray-800">{o.label}</span>
                    {/* Hidden native radio keeps keyboard/a11y behaviour. */}
                    <input
                      type="radio"
                      name="mute-duration"
                      value={o.key}
                      checked={choice === o.key}
                      onChange={() => setChoice(o.key)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex border-t border-gray-100">
              <button
                onClick={onCancel}
                className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <span className="w-px bg-gray-100" />
              <button
                onClick={() => onConfirm?.(choice)}
                className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest text-[#ba0036] hover:bg-red-50 transition-colors"
              >
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
