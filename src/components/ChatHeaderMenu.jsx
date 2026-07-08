// ChatHeaderMenu.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp-style dropdown that opens from the chat header ⋮ (3-dots) button.
//
// Options: View Contact · Mute / Unmute · Report · Block / Unblock.
//
// ── Why a portal (this is the "3-dots not clickable" fix) ────────────────────
// The chat header uses `backdrop-blur-md` (backdrop-filter) and sits inside an
// `overflow-hidden` flex container. An absolutely-positioned dropdown rendered
// inside that header is (a) clipped by the overflow-hidden ancestor and (b)
// trapped in the header's stacking context, so the scrolling message stream
// painted ON TOP of it and swallowed the taps. Rendering into `document.body`
// via a portal with `position: fixed` escapes both traps, so the menu always
// floats above everything and every option is tappable.
//
// Props:
//   open, muted, blocked
//   anchorRef                — ref to the ⋮ button (menu positions under it)
//   onViewContact, onMute, onReport, onBlock, onClose

import React, { useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, BellOff, Bell, Flag, Ban } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MENU_W = 232;

export default function ChatHeaderMenu({ open, muted, blocked, anchorRef, onViewContact, onMute, onReport, onBlock, onClose }) {
  const { t } = useLanguage();
  const [pos, setPos] = useState({ top: 64, left: 0 });

  // Anchor the menu under the ⋮ button, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = anchorRef?.current;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
      if (el && el.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        const left = Math.max(8, Math.min(r.right - MENU_W, vw - MENU_W - 8));
        setPos({ top: r.bottom + 8, left });
      } else {
        setPos({ top: 64, left: Math.max(8, vw - MENU_W - 8) });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const Item = ({ icon: Icon, label, onClick, danger }) => (
    <button
      onClick={() => { onClose?.(); onClick?.(); }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-left transition-colors active:scale-[0.98] ${
        danger ? 'text-red-600 hover:bg-red-50 active:bg-red-100' : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
      }`}
    >
      <Icon size={17} className="shrink-0" />
      {label}
    </button>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Full-screen backdrop — tap anywhere to close. */}
          <div className="fixed inset-0 z-[998]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose?.(); }} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ top: pos.top, left: pos.left, width: MENU_W }}
            className="fixed z-[999] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-gray-100 py-1.5 origin-top-right overflow-hidden"
          >
            <Item icon={User} label={t.chatViewContact || 'View contact'} onClick={onViewContact} />
            <Item icon={muted ? Bell : BellOff} label={muted ? (t.chatUnmute || 'Unmute notifications') : (t.chatMute || 'Mute notifications')} onClick={onMute} />
            <Item icon={Flag} label={t.chatReport || 'Report'} onClick={onReport} />
            <Item icon={Ban} label={blocked ? (t.chatUnblock || 'Unblock') : (t.chatBlock || 'Block')} onClick={onBlock} danger />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
