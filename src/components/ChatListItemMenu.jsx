// ChatListItemMenu.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Context menu for a chat thread in the Messenger list. Opens on long-press
// (mobile) or right-click (desktop) of a chat row. Options: Pin/Unpin,
// Mute/Unmute, Remove (delete conversation).
//
// Rendered via a portal with fixed positioning at the press coordinates,
// clamped to the viewport — same robust pattern as the message action sheet.
//
// Props:
//   open, x, y
//   pinned, muted     current row state (labels toggle)
//   onPin, onMute, onRemove, onClose
//   labels            { pin, unpin, mute, unmute, remove }

import React, { useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, PinOff, BellOff, Bell, Trash2 } from 'lucide-react';

const MENU_W = 210;

export default function ChatListItemMenu({
  open, x = 0, y = 0, pinned = false, muted = false,
  onPin, onMute, onRemove, onClose, labels = {},
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, origin: 'top left' });

  useLayoutEffect(() => {
    if (!open) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
    const menuH = 3 * 46 + 14;
    const left = Math.max(8, Math.min(x, vw - MENU_W - 8));
    let top = y + 6;
    let origin = 'top left';
    if (top + menuH > vh - 8) { top = Math.max(8, y - menuH - 6); origin = 'bottom left'; }
    setPos({ top, left, origin });
  }, [open, x, y]);

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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }}
            style={{ left: pos.left, top: pos.top, width: MENU_W, transformOrigin: pos.origin }}
            className="fixed z-[999] bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.24)] border border-gray-100 p-1.5"
          >
            <Item icon={pinned ? PinOff : Pin} label={pinned ? (labels.unpin || 'Unpin') : (labels.pin || 'Pin')} onClick={onPin} />
            <Item icon={muted ? Bell : BellOff} label={muted ? (labels.unmute || 'Unmute') : (labels.mute || 'Mute')} onClick={onMute} />
            <Item icon={Trash2} label={labels.remove || 'Remove'} onClick={onRemove} danger />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
