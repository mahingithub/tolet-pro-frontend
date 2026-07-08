// ViewContactModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp-style "Contact info" screen, opened by tapping the header avatar/name.
//   • Big circular avatar, name, "~role/username"
//   • Action buttons: Call · Video · Profile
//   • Phone number card
//   • Media, links & docs row
//   • Mute row (shows current state)
//   • Block / Report (red) at the bottom
// Full-screen on mobile, right-side panel on desktop — matches the reference.
//
// Props:
//   open, contact { name, avatar, role, phone, propertyTitle, peerUserId }
//   muted, blocked, mediaCount
//   onClose, onViewProfile?, onVoiceCall?, onVideoCall?, onOpenMedia?, onMute, onBlock, onReport

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Video, UserCircle, Image as ImageIcon, Bell, BellOff, Ban, Flag, ChevronRight, MessageCircle, Lock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ViewContactModal({
  open, contact = {}, muted = false, blocked = false, mediaCount = 0, locked = false,
  onClose, onViewProfile, onVoiceCall, onVideoCall, onOpenMedia, onMute, onBlock, onReport, onToggleLock,
}) {
  const { t } = useLanguage();
  const initials = (contact.name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  const Action = ({ icon: Icon, label, onClick }) => (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-gray-50 hover:bg-red-50 text-[#ba0036] transition-colors"
    >
      <Icon size={20} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-gray-900/50 sm:backdrop-blur-sm flex justify-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white w-full sm:max-w-md h-full shadow-[0_0_80px_rgba(0,0,0,0.25)] overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100">
              <button onClick={onClose} className="p-2 -ml-1 rounded-xl hover:bg-gray-100 text-gray-600" aria-label="Close">
                <X size={20} />
              </button>
              <h3 className="text-sm font-black text-gray-900">{t.contactInfo || 'Contact info'}</h3>
            </div>

            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center px-6 pt-6 pb-5">
              <div className="w-32 h-32 rounded-full overflow-hidden shadow-lg bg-gradient-to-br from-[#ba0036] to-[#7a0024] flex items-center justify-center text-white">
                {contact.avatar
                  ? <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                  : <span className="text-5xl font-black">{initials}</span>}
              </div>
              <h2 className="text-2xl font-black text-gray-900 mt-4">{contact.name || 'Contact'}</h2>
              {contact.role && <p className="text-[13px] font-bold text-gray-400 mt-0.5">~{contact.role}</p>}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 px-5">
              {onVoiceCall && <Action icon={Phone} label={t.contactCall || 'Call'} onClick={() => { onClose?.(); onVoiceCall(); }} />}
              {onVideoCall && <Action icon={Video} label={t.contactVideo || 'Video'} onClick={() => { onClose?.(); onVideoCall(); }} />}
              {onViewProfile && <Action icon={UserCircle} label={t.contactProfile || 'Profile'} onClick={() => { onClose?.(); onViewProfile(); }} />}
            </div>

            {/* Phone card */}
            {contact.phone && (
              <div className="mx-5 mt-5 bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-gray-900 truncate">{contact.name}</p>
                  <p className="text-[12px] font-bold text-gray-500">{contact.phone}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={onClose} className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[#ba0036]" aria-label="Message"><MessageCircle size={16} /></button>
                  {onVoiceCall && <button onClick={() => { onClose?.(); onVoiceCall(); }} className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[#ba0036]" aria-label="Call"><Phone size={16} /></button>}
                </div>
              </div>
            )}

            {/* Media, links & docs — opens the tabbed Media/Links/Docs viewer */}
            <button
              onClick={() => { onOpenMedia?.(); }}
              className="mx-5 mt-3 bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-3 text-gray-700">
                <ImageIcon size={18} className="text-gray-400" />
                <span className="text-[13px] font-bold">{t.contactSharedMedia || 'Media, links and docs'}</span>
              </span>
              <span className="flex items-center gap-1 text-gray-400 text-[12px] font-bold">
                {mediaCount > 0 ? mediaCount : ''} <ChevronRight size={16} />
              </span>
            </button>

            {/* Lock chat with PIN — moved here from the old (i) info pane */}
            {onToggleLock && (
              <button
                onClick={() => { onClose?.(); onToggleLock(); }}
                className="mx-5 mt-3 bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-3 text-gray-700">
                  <Lock size={18} className={locked ? 'text-[#ba0036]' : 'text-gray-400'} />
                  <span className="text-[13px] font-bold">{locked ? (t.contactRemovePin || 'Remove PIN lock') : (t.contactLockPin || 'Lock chat with PIN')}</span>
                </span>
                <span className="flex items-center gap-1 text-gray-400 text-[12px] font-bold">
                  {locked ? (t.contactOn || 'On') : (t.contactOff || 'Off')} <ChevronRight size={16} />
                </span>
              </button>
            )}

            {/* Mute row */}
            <button
              onClick={onMute}
              className="mx-5 mt-3 bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-3 text-gray-700">
                {muted ? <BellOff size={18} className="text-amber-500" /> : <Bell size={18} className="text-gray-400" />}
                <span className="text-[13px] font-bold">{t.chatMute || 'Mute notifications'}</span>
              </span>
              <span className="flex items-center gap-1 text-gray-400 text-[12px] font-bold">
                {muted ? (t.contactOn || 'On') : (t.contactOff || 'Off')} <ChevronRight size={16} />
              </span>
            </button>

            {/* Danger zone */}
            <div className="mx-5 mt-4 mb-8 bg-gray-50 rounded-2xl overflow-hidden">
              <button
                onClick={() => { onClose?.(); onBlock?.(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-red-600 hover:bg-red-50 transition-colors border-b border-gray-100"
              >
                <Ban size={18} /> <span className="text-[13px] font-bold">{blocked ? `${t.chatUnblockShort || 'Unblock'} ${contact.name || ''}` : `${t.contactBlockName || 'Block'} ${contact.name || ''}`}</span>
              </button>
              <button
                onClick={() => { onClose?.(); onReport?.(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-red-600 hover:bg-red-50 transition-colors"
              >
                <Flag size={18} /> <span className="text-[13px] font-bold">{t.contactReportName || 'Report'} {contact.name || ''}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
