// MessageActionsMenu.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The WhatsApp-style action sheet that pops up when you long-press a message
// (mobile), right-click, or tap the ⋯ affordance (desktop). It combines the
// emoji REACTION row and the ACTION list in ONE smooth popup:
//
//     [ 👍  ❤️  😂  😮  😢 ]        ← quick reactions (tap to toggle)
//     ─────────────────────
//      ↩ Reply
//      ⤴ Forward
//      ⧉ Copy            (text only)
//      📌 Pin / Unpin
//      🔕 Mute / Unmute  (conversation)
//      🗑 Remove
//
// Why this replaces the old two-step ReactionBar → "more" → menu flow:
//   The old reaction bar was opened via a long-press that fought with the
//   bubble's drag-to-reply gesture, so it often didn't appear and felt janky.
//   One portal-rendered sheet, opened on a reliable long-press, is smooth and
//   always on top (it renders into document.body, escaping the chat's
//   overflow-hidden + backdrop-filter stacking traps).
//
// Props:
//   open, x, y            viewport coordinates of the press
//   mine                  the message is the current user's (enables delete-for-everyone)
//   canCopy               show the Copy row (text messages only)
//   pinned, muted         current pin/mute state (label toggles)
//   currentReaction       the emoji you've already reacted with (highlighted)
//   onReact(emoji), onReply, onForward, onCopy, onPin, onMute, onDelete, onClose
//   labels                { reply, forward, copy, pin, unpin, mute, unmute, remove }

import React, { useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerUpLeft, Forward, Copy, Pin, PinOff, BellOff, Bell, Trash2 } from 'lucide-react';

const MENU_W = 236;
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageActionsMenu({
  open, x = 0, y = 0, mine = false, canCopy = false, pinned = false, muted = false, currentReaction = null,
  onReact, onReply, onForward, onCopy, onPin, onMute, onDelete, onClose, labels = {},
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, origin: 'top left' });

  // Position near the press point, clamped so the whole sheet stays on-screen.
  useLayoutEffect(() => {
    if (!open) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
    // Rows: reactions (~52) + up to 6 action rows (~44 each) + padding.
    const rows = 3 + (canCopy ? 1 : 0) + 1 /*pin*/ + 1 /*mute*/ + (mine ? 1 : 1) /*remove*/;
    const menuH = 60 + rows * 44 + 16;
    const left = Math.max(8, Math.min(x - MENU_W / 2, vw - MENU_W - 8));
    let top = y + 8;
    let origin = 'top center';
    if (top + menuH > vh - 8) { top = Math.max(8, y - menuH - 8); origin = 'bottom center'; }
    setPos({ top, left, origin });
  }, [open, x, y, canCopy, mine]);

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
          {/* Invisible backdrop — tap anywhere to dismiss. */}
          <div className="fixed inset-0 z-[997]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose?.(); }} />

          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }}
            style={{ left: pos.left, top: pos.top, width: MENU_W, transformOrigin: pos.origin }}
            className="fixed z-[999] bg-white rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.24)] border border-gray-100 overflow-hidden"
          >
            {/* Quick-reaction row */}
            {onReact && (
              <div className="flex items-center justify-between gap-0.5 px-2.5 py-2 border-b border-gray-100">
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(e); onClose?.(); }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-transform hover:scale-125 active:scale-90 ${
                      currentReaction === e ? 'bg-[#ba0036]/10 scale-110' : ''
                    }`}
                    aria-label={`React ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {/* Action list */}
            <div className="p-1.5">
              <Item icon={CornerUpLeft} label={labels.reply || 'Reply'} onClick={onReply} />
              <Item icon={Forward} label={labels.forward || 'Forward'} onClick={onForward} />
              {canCopy && onCopy && <Item icon={Copy} label={labels.copy || 'Copy'} onClick={onCopy} />}
              {onPin && <Item icon={pinned ? PinOff : Pin} label={pinned ? (labels.unpin || 'Unpin') : (labels.pin || 'Pin')} onClick={onPin} />}
              {onMute && <Item icon={muted ? Bell : BellOff} label={muted ? (labels.unmute || 'Unmute') : (labels.mute || 'Mute')} onClick={onMute} />}
              {onDelete && <Item icon={Trash2} label={labels.remove || 'Remove'} onClick={onDelete} danger />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
