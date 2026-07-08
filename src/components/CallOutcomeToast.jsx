// CallOutcomeToast.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium notification card shown when a call finishes: Call ended, Missed
// call, Declined, Cancelled, or Failed. Rendered via sonner's `toast.custom`
// so it owns its look (no default toast chrome). Matches the app's design
// language (brand #ba0036, rounded-2xl, soft shadow, glass surface).
//
// Props:
//   variant   'ended' | 'missed' | 'declined' | 'cancelled' | 'failed'
//   title     main line (bilingual, passed in)
//   subtitle  peer name (+ duration for ended calls)
//   isVideo   swaps the little corner glyph phone↔video
//   onCallBack()   optional → shows a "Call back" pill
//   callBackLabel  bilingual label for the pill
//   onClose()

import React from 'react';
import { Phone, Video, PhoneOff, PhoneMissed, X } from 'lucide-react';

const VARIANTS = {
  ended:     { ring: 'from-emerald-500 to-green-600', Icon: PhoneOff,    glow: 'bg-emerald-500' },
  missed:    { ring: 'from-rose-500 to-[#ba0036]',    Icon: PhoneMissed, glow: 'bg-[#ba0036]' },
  declined:  { ring: 'from-gray-500 to-gray-700',     Icon: PhoneOff,    glow: 'bg-gray-500' },
  cancelled: { ring: 'from-gray-400 to-gray-600',     Icon: PhoneOff,    glow: 'bg-gray-400' },
  failed:    { ring: 'from-rose-500 to-[#ba0036]',    Icon: PhoneOff,    glow: 'bg-[#ba0036]' },
};

export default function CallOutcomeToast({
  variant = 'ended', title, subtitle, isVideo = false,
  onCallBack, callBackLabel = 'Call back', onClose,
}) {
  const v = VARIANTS[variant] || VARIANTS.ended;
  const Icon = v.Icon;
  const TypeIcon = isVideo ? Video : Phone;

  return (
    <div className="relative w-[340px] max-w-[90vw] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-black/5 overflow-hidden">
      {/* Accent strip */}
      <div className={`h-1 bg-gradient-to-r ${v.ring}`} />

      <div className="flex items-center gap-3 p-3.5">
        {/* Icon badge */}
        <div className="relative shrink-0">
          <div className={`absolute -inset-1 rounded-2xl blur-lg opacity-25 ${v.glow}`} aria-hidden />
          <div className={`relative w-11 h-11 rounded-2xl bg-gradient-to-br ${v.ring} text-white flex items-center justify-center shadow-md`}>
            <Icon size={20} strokeWidth={2.5} />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
              <TypeIcon size={11} className="text-gray-600" />
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-black text-gray-900 truncate">{title}</h4>
          {subtitle && <p className="text-[12px] font-medium text-gray-500 truncate mt-0.5">{subtitle}</p>}
        </div>

        {/* Call back pill (optional) */}
        {onCallBack && (
          <button
            onClick={onCallBack}
            className="shrink-0 flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white text-[12px] font-black shadow-md active:scale-95 transition-transform"
          >
            <Phone size={13} /> {callBackLabel}
          </button>
        )}

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 -mr-1 rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
