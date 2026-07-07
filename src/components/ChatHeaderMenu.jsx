// ChatHeaderMenu.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp-style dropdown that opens from the chat header. BOTH the header
// avatar/name and the ⋮ (3-dots) button open this same menu.
//
// Options: View Contact · Mute / Unmute · Report · Block / Unblock.
//
// Render this INSIDE a `relative` wrapper in the header (it positions itself to
// the top-right). A transparent full-screen backdrop closes it on outside tap.
//
// Props:
//   open, muted, blocked
//   onViewContact, onMute, onReport, onBlock, onClose

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, BellOff, Bell, Flag, Ban } from 'lucide-react';

export default function ChatHeaderMenu({ open, muted, blocked, onViewContact, onMute, onReport, onBlock, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const Item = ({ icon: Icon, label, onClick, danger }) => (
    <button
      onClick={() => { onClose?.(); onClick?.(); }}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-left transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
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
          {/* Backdrop — tap anywhere to close. Sits under the menu. */}
          <div className="fixed inset-0 z-[118]" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+8px)] z-[119] w-56 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-gray-100 py-1.5 origin-top-right overflow-hidden"
          >
            <Item icon={User} label="View contact" onClick={onViewContact} />
            <Item icon={muted ? Bell : BellOff} label={muted ? 'Unmute notifications' : 'Mute notifications'} onClick={onMute} />
            <Item icon={Flag} label="Report" onClick={onReport} />
            <Item icon={Ban} label={blocked ? 'Unblock' : 'Block'} onClick={onBlock} danger />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
