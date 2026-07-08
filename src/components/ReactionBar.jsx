// ReactionBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The floating quick-reaction pill (WhatsApp / Messenger style) that pops above
// a message when you tap its reaction button or long-press it. A trailing "⋯"
// button opens the full actions menu.
//
// Smoothness notes (this was the janky part before):
//   • Rendered in a portal → escapes the chat's overflow-hidden / backdrop
//     stacking traps, so it's never clipped and never re-layouts the thread.
//   • Position is measured in useLayoutEffect (before paint) → no first-frame
//     jump.
//   • Animates ONLY transform + opacity, with `will-change: transform` so the
//     soft drop-shadow is rasterized once onto its own layer instead of being
//     repainted every frame (the box-shadow repaint was the main cause of the
//     "buffering" feel on mobile). Emojis stagger in for a lively-but-cheap feel.
//
// Props:
//   open, x, y            viewport coords to anchor to
//   current               the emoji the user already reacted with (highlighted)
//   onReact(emoji), onMore(), onClose()

import React, { useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const BAR_W = 296;

export default function ReactionBar({ open, x = 0, y = 0, current = null, onReact, onMore, onClose }) {
  const [pos, setPos] = useState({ top: 0, left: 0, origin: 'top center' });

  useLayoutEffect(() => {
    if (!open) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
    const left = Math.max(8, Math.min(x - BAR_W / 2, vw - BAR_W - 8));
    let top = y + 10;
    let origin = 'top center';
    if (top + 68 > vh - 8) { top = Math.max(8, y - 68); origin = 'bottom center'; }
    setPos({ top, left, origin });
  }, [open, x, y]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[997]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose?.(); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 560, damping: 30, mass: 0.55 }}
            style={{ left: pos.left, top: pos.top, transformOrigin: pos.origin, willChange: 'transform, opacity' }}
            className="fixed z-[999] flex items-center gap-0.5 bg-white rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.20)] border border-gray-100 px-2 py-1.5"
          >
            {REACTION_EMOJIS.map((e, i) => (
              <motion.button
                key={e}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 + i * 0.025, type: 'spring', stiffness: 600, damping: 26 }}
                onClick={() => { onReact?.(e); onClose?.(); }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-2xl leading-none transition-transform hover:scale-125 active:scale-90 ${
                  current === e ? 'bg-[#ba0036]/10 scale-110' : ''
                }`}
                aria-label={`React ${e}`}
              >
                {e}
              </motion.button>
            ))}
            {onMore && (
              <button
                onClick={() => { onClose?.(); onMore?.(); }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-90 flex items-center justify-center text-gray-500 ml-0.5 transition-transform"
                aria-label="More actions"
              >
                <MoreHorizontal size={16} />
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
