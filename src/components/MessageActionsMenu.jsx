// MessageActionsMenu.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The little floating menu that pops up when you long-press a message (mobile)
// or right-click / tap the ⋯ affordance (desktop) — the Messenger/WhatsApp
// pattern. Options: Reply, Forward, and (for your own messages) Delete for
// everyone.
//
// It positions itself at the (x, y) where the gesture happened and clamps to
// stay on screen. A full-screen transparent backdrop closes it on any outside
// tap / scroll / Escape.
//
// Props:
//   open, x, y      – controlled by the parent (viewport coordinates)
//   mine            – show "Delete for everyone" only for the user's own bubbles
//   onReply, onForward, onDelete, onClose

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerUpLeft, Forward, Trash2 } from 'lucide-react';

const MENU_W = 210;

export default function MessageActionsMenu({ open, x = 0, y = 0, mine = false, onReply, onForward, onDelete, onClose }) {
  // Close on Escape / scroll so the menu never gets "stuck" floating.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const onScroll = () => onClose?.();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onClose]);

  // Rough height (Delete adds a row) so we can keep the menu fully on-screen.
  const menuH = mine ? 150 : 104;
  const left = Math.max(8, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 360) - MENU_W - 8));
  const top = Math.max(8, Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 640) - menuH - 8));

  const Item = ({ icon: Icon, label, onClick, danger }) => (
    <button
      onClick={() => { onClick?.(); onClose?.(); }}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      {label}
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Invisible backdrop — tap anywhere to dismiss. */}
          <div className="fixed inset-0 z-[115]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose?.(); }} />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 6 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{ left, top, width: MENU_W }}
            className="fixed z-[116] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-gray-100 p-1.5 origin-top-left"
          >
            <Item icon={CornerUpLeft} label="Reply" onClick={onReply} />
            <Item icon={Forward} label="Forward" onClick={onForward} />
            {mine && <Item icon={Trash2} label="Delete for everyone" onClick={onDelete} danger />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
