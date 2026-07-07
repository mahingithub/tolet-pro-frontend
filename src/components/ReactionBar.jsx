// ReactionBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The floating emoji reaction bar that pops above a message when you long-press
// (mobile) or hover/right-click (desktop) a bubble — the WhatsApp pattern.
// Tapping an emoji toggles your reaction; the "⋯" opens the full actions menu
// (Reply / Forward / Delete).
//
// Props:
//   open, x, y      viewport coordinates of the pressed bubble
//   current         the emoji you've already reacted with (highlighted), or null
//   onReact(emoji)  toggle a reaction
//   onMore()        open the Reply/Forward/Delete menu
//   onClose()

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const BAR_W = 268;

export default function ReactionBar({ open, x = 0, y = 0, current = null, onReact, onMore, onClose }) {
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

  const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
  const left = Math.max(8, Math.min(x - BAR_W / 2, vw - BAR_W - 8));
  // Sit ABOVE the press point; clamp so it never goes off the top.
  const top = Math.max(8, y - 64);

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[115]"
            onClick={onClose}
            onContextMenu={(e) => { e.preventDefault(); onClose?.(); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ left, top, width: BAR_W }}
            className="fixed z-[116] flex items-center gap-1 bg-white rounded-full shadow-[0_18px_45px_rgba(0,0,0,0.22)] border border-gray-100 px-2 py-1.5"
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { onReact?.(e); onClose?.(); }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-transform hover:scale-125 active:scale-95 ${
                  current === e ? 'bg-[#ba0036]/10 scale-110' : ''
                }`}
                aria-label={`React ${e}`}
              >
                {e}
              </button>
            ))}
            <span className="w-px h-6 bg-gray-100 mx-0.5" />
            <button
              onClick={() => { onClose?.(); onMore?.(); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="More actions"
            >
              <MoreHorizontal size={18} />
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
