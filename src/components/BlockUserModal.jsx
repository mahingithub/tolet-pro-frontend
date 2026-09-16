// BlockUserModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Confirmation modal for blocking a user. WhatsApp-style, but we REQUIRE a
// reason before the "Block" button becomes active (useful for moderation and
// makes the action deliberate).
//
// Props:
//   open, name
//   onCancel
//   onConfirm(reason)   reason is a non-empty string ("<reason> — <details>")

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban } from 'lucide-react';
import { useIsBn } from '../context/LanguageContext';

// value → Bangla label. The English value is what moderators receive.
const REASONS = [
  ['Spam or scam', 'স্প্যাম বা প্রতারণা'],
  ['Harassment or bullying', 'হয়রানি বা উত্ত্যক্ত করা'],
  ['Inappropriate content', 'অনুপযুক্ত কনটেন্ট'],
  ['Pretending to be someone', 'অন্যের পরিচয় দেওয়া'],
  ['Other', 'অন্যান্য'],
];

export default function BlockUserModal({ open, name, onCancel, onConfirm }) {
  const isBn = useIsBn();
  const L = (bn, en) => (isBn ? bn : en);
  const who = name || L('এই ব্যবহারকারী', 'this user');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  // Clear the form each time the modal opens.
  useEffect(() => {
    if (open) { setReason(''); setDetails(''); }
  }, [open]);

  const canBlock = reason.trim().length > 0;
  const confirm = () => {
    if (!canBlock) return;
    const full = details.trim() ? `${reason} — ${details.trim()}` : reason;
    onConfirm?.(full);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <Ban size={30} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-black text-gray-900 text-center">{L(`${who}-কে ব্লক করবেন?`, `Block ${who}?`)}</h3>
              <p className="text-[12px] font-bold text-gray-500 mt-2 mb-4 leading-relaxed text-center">
                {L('তিনি আপনাকে আর মেসেজ বা কল করতে পারবেন না। চালিয়ে যেতে একটি কারণ বেছে নিন।', "They won't be able to message or call you. Please pick a reason to continue.")}
              </p>

              {/* Reason (REQUIRED) */}
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                {L('কারণ', 'Reason')} <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-3.5 py-3 text-[13px] font-bold text-gray-800 outline-none focus:border-[#ba0036]/40 transition-colors"
              >
                <option value="">{L('একটি কারণ বেছে নিন…', 'Select a reason…')}</option>
                {REASONS.map(([r, bn]) => <option key={r} value={r}>{L(bn, r)}</option>)}
              </select>

              {/* Optional details */}
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                placeholder={L('বিস্তারিত লিখুন (ঐচ্ছিক)…', 'Add details (optional)…')}
                className="mt-3 w-full bg-white border border-gray-200 rounded-2xl px-3.5 py-3 text-[13px] font-medium text-gray-800 outline-none focus:border-[#ba0036]/40 transition-colors resize-none placeholder:text-gray-400"
              />
            </div>

            <div className="flex border-t border-gray-100">
              <button
                onClick={onCancel}
                className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {L('বাতিল', 'Cancel')}
              </button>
              <span className="w-px bg-gray-100" />
              <button
                onClick={confirm}
                disabled={!canBlock}
                className={`flex-1 py-4 text-[12px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${
                  canBlock ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'
                }`}
              >
                <Ban size={14} /> {L('ব্লক', 'Block')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
