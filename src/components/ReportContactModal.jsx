// ReportContactModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Simple confirmation modal: "Are you sure you want to report this contact?".
// An optional reason chip-set is included so the report is actually useful,
// but confirming without one is still allowed.
//
// Props:
//   open, name
//   onCancel
//   onConfirm(reason)   reason is a string (may be empty)

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag } from 'lucide-react';

const REASONS = ['Spam', 'Harassment', 'Scam / Fraud', 'Inappropriate'];

export default function ReportContactModal({ open, name = 'this contact', onCancel, onConfirm }) {
  const [reason, setReason] = useState('');

  useEffect(() => { if (open) setReason(''); }, [open]);

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
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <Flag size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-black text-gray-900">Report {name}?</h3>
              <p className="text-[12px] font-bold text-gray-500 mt-2 leading-relaxed">
                The last few messages from this contact will be forwarded to our team for review.
                You can optionally tell us why.
              </p>

              <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason((cur) => (cur === r ? '' : r))}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                      reason === r
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300'
                    }`}
                  >
                    {r}
                  </button>
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
                onClick={() => onConfirm?.(reason)}
                className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Flag size={14} /> Report
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
