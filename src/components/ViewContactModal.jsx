// ViewContactModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp-style "Contact info" popup: an enlarged avatar, the name, role and
// any basic info we have, plus quick actions (message / call / view full
// profile). Slides up as a sheet on mobile, centred card on larger screens.
//
// Props:
//   open, contact { name, avatar, role, phone, propertyTitle, peerUserId }
//   onClose, onViewProfile?, onVoiceCall?, onVideoCall?

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Video, UserCircle, Home, Shield } from 'lucide-react';

export default function ViewContactModal({ open, contact = {}, onClose, onViewProfile, onVoiceCall, onVideoCall }) {
  const initials = (contact.name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-gray-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_30px_80px_rgba(0,0,0,0.25)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with the big avatar over a brand gradient */}
            <div className="relative bg-gradient-to-br from-[#ba0036] to-[#7a0024] pt-7 pb-6 px-6 text-center text-white">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-2 bg-white/15 hover:bg-white/25 rounded-full transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <div className="w-28 h-28 mx-auto rounded-full border-4 border-white/30 shadow-xl overflow-hidden bg-white/10">
                {contact.avatar ? (
                  <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-black">{initials}</div>
                )}
              </div>
              <h3 className="text-xl font-black mt-4">{contact.name || 'Contact'}</h3>
              {contact.role && (
                <span className="inline-block mt-1.5 text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                  {contact.role}
                </span>
              )}
            </div>

            {/* Quick actions */}
            {(onVoiceCall || onVideoCall || onViewProfile) && (
              <div className="flex items-center justify-center gap-3 py-4 border-b border-gray-100">
                {onVoiceCall && (
                  <button onClick={() => { onClose?.(); onVoiceCall(); }} className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ba0036] transition-colors">
                    <span className="w-11 h-11 rounded-full bg-gray-50 hover:bg-red-50 flex items-center justify-center"><Phone size={18} /></span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Call</span>
                  </button>
                )}
                {onVideoCall && (
                  <button onClick={() => { onClose?.(); onVideoCall(); }} className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ba0036] transition-colors">
                    <span className="w-11 h-11 rounded-full bg-gray-50 hover:bg-red-50 flex items-center justify-center"><Video size={18} /></span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Video</span>
                  </button>
                )}
                {onViewProfile && (
                  <button onClick={() => { onClose?.(); onViewProfile(); }} className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ba0036] transition-colors">
                    <span className="w-11 h-11 rounded-full bg-gray-50 hover:bg-red-50 flex items-center justify-center"><UserCircle size={18} /></span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
                  </button>
                )}
              </div>
            )}

            {/* Info rows */}
            <div className="p-5 space-y-3">
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center shrink-0"><Phone size={15} /></span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Phone</p>
                    <p className="text-[13px] font-bold text-gray-800 truncate">{contact.phone}</p>
                  </div>
                </div>
              )}
              {contact.propertyTitle && (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center shrink-0"><Home size={15} /></span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Property</p>
                    <p className="text-[13px] font-bold text-gray-800 line-clamp-2">{contact.propertyTitle}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Shield size={15} /></span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Privacy</p>
                  <p className="text-[13px] font-bold text-gray-800">Your phone number stays private until you share it.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
