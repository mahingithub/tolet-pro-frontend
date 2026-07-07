// BlockUserModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A centred confirmation modal for blocking a user. Replaces the small inline
// "Block X?" strip with a clearer, more deliberate action (blocking is
// destructive to the relationship, so it deserves a real confirm step).
//
// Props: open, name, onCancel, onConfirm

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban, X } from 'lucide-react';

export default function BlockUserModal({ open, name = 'this user', onCancel, onConfirm }) {
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
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <Ban size={30} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-black text-gray-900">Block {name}?</h3>
              <p className="text-[12px] font-bold text-gray-500 mt-2 leading-relaxed">
                They won't be able to message or call you, and they won't be told they were blocked.
                You can unblock them anytime from this menu.
              </p>
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
                onClick={onConfirm}
                className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Ban size={14} /> Block
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
