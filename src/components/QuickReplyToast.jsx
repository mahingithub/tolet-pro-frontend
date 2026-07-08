// QuickReplyToast.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium incoming-message toast with an INLINE quick-reply box, so the user
// can reply straight from the notification without opening the messenger.
//
// Rendered via sonner's `toast.custom(...)` so it has no default toast chrome —
// this component fully owns its look. It manages its own input + send state.
//
// Props (all passed from GlobalToaster, which lives inside the app providers):
//   conversationId, senderName, senderAvatar, preview
//   labels { newMessage, placeholder, sent, failed }
//   onOpen()   open the full chat
//   onClose()  dismiss the toast

import React, { useState, useRef } from 'react';
import { Send, X, MessageCircle, Check } from 'lucide-react';
import chatService from '../services/chatService';

export default function QuickReplyToast({
  conversationId, senderName = 'New message', senderAvatar, preview,
  labels = {}, onOpen, onClose,
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef(null);

  const initials = (senderName || '?').charAt(0).toUpperCase();

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !conversationId) return;
    setSending(true);
    try {
      await chatService.sendMessage(conversationId, body);
      setSent(true);
      setText('');
      setTimeout(() => onClose?.(), 1000);
    } catch {
      setSending(false);
    }
  };

  return (
    <div className="w-[360px] max-w-[90vw] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-black/5 overflow-hidden">
      {/* Accent strip */}
      <div className="h-1 bg-gradient-to-r from-[#ba0036] to-[#ff4d78]" />

      {/* Header — tap to open the full chat */}
      <div className="flex items-start gap-3 px-3.5 pt-3">
        <button onClick={onOpen} className="shrink-0 relative" aria-label="Open chat">
          {senderAvatar ? (
            <img src={senderAvatar} alt={senderName} className="w-11 h-11 rounded-full object-cover ring-2 ring-[#ba0036]/15" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white flex items-center justify-center font-black text-lg">
              {initials}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#ba0036] border-2 border-white flex items-center justify-center">
            <MessageCircle size={9} className="text-white" />
          </span>
        </button>

        <button onClick={onOpen} className="flex-1 min-w-0 text-left pt-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-[14px] font-black text-gray-900 truncate">{senderName}</h4>
            <span className="text-[8px] font-black uppercase tracking-widest text-[#ba0036] bg-[#ba0036]/10 px-1.5 py-0.5 rounded-full shrink-0">
              {labels.newMessage || 'New message'}
            </span>
          </div>
          <p className="text-[12px] font-medium text-gray-500 line-clamp-2 mt-0.5 leading-snug">{preview}</p>
        </button>

        <button onClick={onClose} className="p-1.5 -mr-1 rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0" aria-label="Dismiss">
          <X size={15} />
        </button>
      </div>

      {/* Inline quick reply */}
      <div className="px-3.5 pb-3 pt-2.5">
        {sent ? (
          <div className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-black text-emerald-600">
            <Check size={15} strokeWidth={3} /> {labels.sent || 'Reply sent'}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1 pl-4 focus-within:ring-2 focus-within:ring-[#ba0036]/25 transition-all">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
              placeholder={labels.placeholder || 'Reply…'}
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-medium text-gray-800 placeholder:text-gray-400"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white flex items-center justify-center shadow-md shrink-0 transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send reply"
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={16} className="ml-0.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
