// MessageActionsMenu.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The message ACTIONS menu (Reply · Forward · Copy · Pin · Mute · Remove),
// opened by the per-bubble ⋮ button, a right-click, or the "⋯" on the reaction
// bar. Quick emoji reactions live in ReactionBar (a separate pill) now, so this
// is a clean action list.
//
// Smoothness: portal-rendered, position measured before paint, animates only
// transform + opacity with `will-change: transform` so the drop-shadow is
// rasterized once (not repainted per frame → no mobile "buffering").
//
// Props:
//   open, x, y            viewport coordinates of the trigger
//   mine                  the message is the current user's
//   canCopy               show Copy (text messages only)
//   pinned, muted         toggle the Pin / Mute labels
//   onReply, onForward, onCopy, onPin, onMute, onDelete, onClose
//   labels                { reply, forward, copy, pin, unpin, mute, unmute, remove }

import React, { useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerUpLeft, Forward, Copy, Pin, PinOff, BellOff, Bell, Trash2 } from 'lucide-react';

const MENU_W = 232;

export default function MessageActionsMenu({
  open, x = 0, y = 0, mine = false, canCopy = false, pinned = false, muted = false,
  onReply, onForward, onCopy, onPin, onMute, onDelete, onClose, labels = {},
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, origin: 'top center' });

  // Position near the trigger, clamped so the whole menu stays on-screen.
  useLayoutEffect(() => {
    if (!open) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
    const rows = 2 + (canCopy ? 1 : 0) + (onPin ? 1 : 0) + (onMute ? 1 : 0) + (onDelete ? 1 : 0);
    const menuH = rows * 44 + 16;
    const left = Math.max(8, Math.min(x - MENU_W / 2, vw - MENU_W - 8));
    let top = y + 8;
    let origin = 'top center';
    if (top + menuH > vh - 8) { top = Math.max(8, y - menuH - 8); origin = 'bottom center'; }
    setPos({ top, left, origin });
  }, [open, x, y, canCopy, onPin, onMute, onDelete]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const Item = ({ icon: Icon, label, onClick, danger }) => (
    <button
      onClick={() => { onClick?.(); onClose?.(); }}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl transition-colors active:scale-[0.98] ${
        danger ? 'text-red-600 hover:bg-red-50 active:bg-red-100' : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      {label}
    </button>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[997]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose?.(); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 560, damping: 30, mass: 0.6 }}
            style={{ left: pos.left, top: pos.top, width: MENU_W, transformOrigin: pos.origin, willChange: 'transform, opacity' }}
            className="fixed z-[999] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-100 p-1.5"
          >
            <Item icon={CornerUpLeft} label={labels.reply || 'Reply'} onClick={onReply} />
            <Item icon={Forward} label={labels.forward || 'Forward'} onClick={onForward} />
            {canCopy && onCopy && <Item icon={Copy} label={labels.copy || 'Copy'} onClick={onCopy} />}
            {onPin && <Item icon={pinned ? PinOff : Pin} label={pinned ? (labels.unpin || 'Unpin') : (labels.pin || 'Pin')} onClick={onPin} />}
            {onMute && <Item icon={muted ? Bell : BellOff} label={muted ? (labels.unmute || 'Unmute') : (labels.mute || 'Mute')} onClick={onMute} />}
            {onDelete && <Item icon={Trash2} label={labels.remove || 'Remove'} onClick={onDelete} danger />}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
