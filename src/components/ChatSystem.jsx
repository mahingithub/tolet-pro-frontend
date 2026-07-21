// ChatSystem.jsx
//
// Full-screen TO-LET PRO message centre. Re-written end-to-end for:
//   • Real responsive behaviour — full-screen master/detail on mobile,
//     two-pane on tablet, three-pane on desktop with a context rail.
//   • Cross-system rent-receipt cards rendered inline in the right thread,
//     fed by the same `tolet_payment_receipts` store HostDashboard writes to.
//   • Smart-reply chips (rule-based locally, swappable for an LLM endpoint).
//   • Message grouping, date dividers, status ticks (sent / delivered / read),
//     proper typing indicator, and full-bleed glassmorphic surfaces.
//
// Backward-compatible with every existing entry-point:
//   navigate('/messages', { state: { chatId, initialMessage, mode: 'call' }})  → still works.
//   navigate('/messages', { state: { chatId: 'ai-bot', initialMessage: '...' }}) → still works.
//   navigate('/messages', { state: { chatId, source: 'host-bookings', tenantName, tenantPhone, propertyTitle }}) → host CTA.
//   navigate('/messages', { state: { chatId, source: 'tenant-receipt', receiptId, propertyTitle, monthKey, prefillMessage }}) → tenant CTA.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Send, Bot, Search, MoreVertical, Paperclip, Sparkles,
  CheckCheck, Check, Phone, Video, ArrowLeft, Smile, X, Mic, PhoneOff,
  UserPlus, Pin, Receipt, FileText, Hourglass, Info, ChevronRight,
  Download, MessageCircle, VolumeX, MessageSquare,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, VideoOff,
  BellOff, Ban, Flag, CornerUpLeft, Lock, Image as ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../services/chatService';
import { useLanguage } from '../context/LanguageContext';
import { getCurrentUser } from '../services/authService';
import { listTenantReceipts, listHostReceipts } from '../services/receiptService';
import callProvider from '../services/callProvider';
import { getCurrentToken } from '../services/authService';
import callService from '../services/callService';
import CallHistory from './CallHistory';
import CallQualityOverlay from './CallQualityOverlay';
import CallDetailModal from './CallDetailModal';
// ── Chat UX upgrade: modular pieces that plug into this existing component ──
import MessageActionsMenu from './MessageActionsMenu';
import BlockUserModal from './BlockUserModal';
import ChatPinLock from './ChatPinLock';
// ── WhatsApp-style header menu, contact/mute/report modals + reactions ──────
import ChatHeaderMenu from './ChatHeaderMenu';
import ViewContactModal from './ViewContactModal';
import ChatMediaViewer from './ChatMediaViewer';
import MuteNotificationsModal from './MuteNotificationsModal';
import ReportContactModal from './ReportContactModal';
import EmojiPicker from './EmojiPicker';
// ── Perf + UX upgrade pieces ────────────────────────────────────────────────
import ChatMessageBubble from './ChatMessageBubble';
import MediaLightbox from './MediaLightbox';
import ChatListItemMenu from './ChatListItemMenu';
import ReactionBar from './ReactionBar';

// Render a text message bigger when it's only emoji ("jumbo"/sticker), and
// detect a lone image/GIF URL so stickers and Tenor GIFs render as media.
const EMOJI_ONLY_RE = (() => { try { return new RegExp('^(?:\\p{Extended_Pictographic}|\\uFE0F|\\u200D|\\s){1,8}$', 'u'); } catch { return null; } })();
const isJumboEmoji = (t) => { const s = (t || '').trim(); return !!s && !!EMOJI_ONLY_RE && EMOJI_ONLY_RE.test(s); };
const isImageUrl = (t) => {
  const s = (t || '').trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return false;
  return /\.(gif|png|jpe?g|webp)(\?|$)/i.test(s) || /(tenor\.com|giphy\.com|media\.tenor|c\.tenor)/i.test(s);
};

// ── Reply-quote helpers (module scope, pure) ────────────────────────────────
// A reply is encoded as a leading markdown blockquote line:
//     "> quoted snippet\n<the actual reply>"
// This works with the plain-text message backend (no schema change), survives
// reload, and reaches the peer. parseReplyQuote() splits it back out so the
// bubble can render the quote as a styled inline block.
const parseReplyQuote = (text) => {
  if (typeof text !== 'string' || !text.startsWith('> ')) return null;
  const nl = text.indexOf('\n');
  if (nl === -1) return null;
  return { quote: text.slice(2, nl).trim(), body: text.slice(nl + 1) };
};
const replyPreviewText = (m) => {
  if (!m) return '';
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'audio') return '🎤 Voice message';
  if (m.type === 'document') return '📄 Document';
  const parsed = parseReplyQuote(m.text);
  return (parsed ? parsed.body : m.text || '').slice(0, 120);
};
// Label for the quoted strip inside a bubble, built from the POPULATED backend
// replyTo object: { text, type, mediaUrl, senderId, isDeleted }.
const replyQuoteLabel = (r) => {
  if (!r) return '';
  if (r.isDeleted) return '🚫 Deleted message';
  if (r.type === 'image') return '📷 Photo';
  if (r.type === 'audio') return '🎤 Voice message';
  if (r.type === 'document') return '📄 Document';
  return (r.text || '').slice(0, 120);
};
// Tiny non-crypto hash for the per-chat PIN. Enough to gate over-the-shoulder /
// shared-device snooping — NOT real security (see ChatPinLock's note).
const hashPin = (pin) => {
  let h = 0;
  const s = `tolet:${pin}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
};
const CHAT_LOCKS_KEY = 'tolet_chat_locks';
const HIDDEN_MSGS_KEY = 'tolet_hidden_msgs';   // messages the user removed "for me"

// ─── Cross-system storage keys (mirrored on HostDashboard / TenantDashboard) ─
const CHAT_HISTORY_KEY        = 'tolet_chat_history';
const CHAT_THREADS_KEY        = 'tolet_chat_threads';        // dynamic threads created from location.state
const PAYMENT_RECEIPTS_KEY    = 'tolet_payment_receipts';
const PAYMENT_RECEIPTS_EVENT  = 'tolet-payment-receipts-updated';
const OFFLINE_MESSAGES_KEY    = 'tolet_offline_messages';

// ─── Seed chats — AI bot only. Real conversations are appended dynamically
//     when the user navigates in with state.chatId (e.g. tapping "Contact
//     host" on a property). No demo Rahman/Sarah/Rahim seed rows. ────────────
const initialChats = [
  {
    id: 'ai-bot',
    name: 'TO-LET AI Bot',
    role: 'Smart Assistant',
    avatar: null,
    isAI: true,
    status: 'online',
    lastMsg: 'How can I help you today?',
    time: 'Just now',
    unread: 0,
    pinned: true,
  },
];

// ─── Local rule-based bot. Kept verbatim from previous version so the floating
//     GlobalAIAssistant hand-off keeps working. Swap with backend later. ─────
const getBotReply = (text) => {
  const lower = (text || '').toLowerCase();
  if (!lower.trim()) {
    return "I'm here whenever you're ready. Ask me about properties, rent, tours, or how to contact a landlord.";
  }
  if (/(hi|hello|hey|salam|assalam|হ্যালো|হাই)/i.test(lower)) {
    return "Hi! 👋 I'm the TO-LET PRO AI Assistant. I can help you find properties, schedule a tour, understand rent, or contact a landlord. What would you like to do?";
  }
  if (/(rent|ভাড়া|payment|পেমেন্ট|due|বকেয়া)/i.test(lower)) {
    return "For rent and payment questions: open your dashboard → 'Payments' (tenant) or 'Rent Collection' (host). Receipts arrive automatically when the landlord marks a month as paid. Need anything specific?";
  }
  if (/(tour|visit|ভিজিট|দেখ|appointment)/i.test(lower)) {
    return "To schedule a tour, open the property page and tap 'Request Tour'. The host gets notified instantly and approved tours appear in your dashboard's 'Upcoming Tours' section.";
  }
  if (/(contact|landlord|host|বাড়িওয়ালা|message)/i.test(lower)) {
    return "Tap 'Contact Host' on any property card or use the Messages tab from your dashboard. You can chat, voice-call, or video-call them from here.";
  }
  if (/(property|properties|flat|apartment|house|home|প্রপার্টি|বাসা|ফ্ল্যাট)/i.test(lower)) {
    return "We've got listings across Dhaka — Gulshan, Banani, Dhanmondi, Uttara, Mirpur and more. Use the Explore page filters (price, BHK, location) to narrow down. Want me to open Explore for you?";
  }
  if (/(price|cost|budget|দাম)/i.test(lower)) {
    return "Prices vary widely: studios from ৳18,000, family flats ৳35,000–৳1,20,000, premium suites ৳2,50,000+. Tell me your budget and area — I'll suggest options.";
  }
  if (/(thanks|thank you|ধন্যবাদ)/i.test(lower)) {
    return "You're welcome! Anything else I can help with? 🙂";
  }
  return "Got it. I'm still learning, but I can help with: 🏠 finding properties · 💸 rent & payments · 📅 tours · 📞 contacting landlords. Try asking about one of those.";
};

// ─── Smart-reply chips. Rule-based for now; the chip array is shaped exactly
//     like an LLM completion would deliver, so swapping in /api/ai/replies
//     later means changing one function. ────────────────────────────────────
const getSmartReplies = (lastIncoming, chat) => {
  if (!lastIncoming) {
    return chat?.isAI
      ? [
          { id: 'sr-find', text: 'Find me a 2-bed in Dhanmondi' },
          { id: 'sr-rent', text: 'Explain how rent receipts work' },
          { id: 'sr-tour', text: 'Schedule a tour this week' },
        ]
      : [
          { id: 'sr-greet', text: 'Hi, is this still available?' },
          { id: 'sr-tour',  text: 'Can I visit this weekend?' },
          { id: 'sr-rent',  text: 'Is the rent negotiable?' },
        ];
  }
  const t = (lastIncoming.text || '').toLowerCase();
  const out = [];
  if (/rent|ভাড়া|price|দাম/i.test(t))   out.push({ id: 'sr-neg',  text: 'Is the rent negotiable a bit?' });
  if (/tour|visit|ভিজিট|দেখ/i.test(t))    out.push({ id: 'sr-when', text: 'I can come Saturday morning' });
  if (/available|আছে/i.test(t))           out.push({ id: 'sr-yes',  text: "Great — I'd like to proceed" });
  if (/document|kyc|nid|ডকুমেন্ট/i.test(t)) out.push({ id: 'sr-doc',  text: "I'll send my NID + photo today" });
  if (/deposit|advance|অগ্রিম/i.test(t)) out.push({ id: 'sr-dep',  text: 'How much advance is required?' });
  if (out.length < 3) {
    out.push({ id: 'sr-call', text: 'Can we hop on a quick call?' });
    out.push({ id: 'sr-info', text: 'Could you share more details?' });
    out.push({ id: 'sr-thx',  text: 'Thanks for the info 🙂' });
  }
  return out.slice(0, 3);
};

  // ─── Escape to close panels & overlays ────────────────────────────────────────────────────────────
const sameDay = (a, b) => {
  if (!a || !b) return false;
  const x = new Date(a), y = new Date(b);
  if (isNaN(x.getTime()) || isNaN(y.getTime())) return false;
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};
const dayLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest))  return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
const formatBDT = (n) => `৳${(Number(n) || 0).toLocaleString('en-IN')}`;
const formatTime = (iso) => {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; // already a label like "Just now"
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// "Last seen" relative label for the offline (red) presence state. Bilingual.
const formatLastSeen = (iso, isBn = false) => {
  if (!iso) return isBn ? 'অফলাইন' : 'Offline';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return isBn ? 'অফলাইন' : 'Offline';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const pre = isBn ? 'সর্বশেষ দেখা' : 'Last seen';
  if (mins < 1)  return isBn ? 'একটু আগে দেখা গিয়েছিল' : 'Last seen just now';
  if (mins < 60) return isBn ? `${pre} ${mins} মিনিট আগে` : `${pre} ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return isBn ? `${pre} ${hrs} ঘণ্টা আগে` : `${pre} ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return isBn ? `${pre} ${days} দিন আগে` : `${pre} ${days}d ago`;
  return isBn ? `${pre} ${d.toLocaleDateString()}` : `${pre} ${d.toLocaleDateString()}`;
};

// ─── Receipt card — rendered inline inside the message stream when a host has
//     marked a month paid. Visually consistent with TenantDashboard's
//     receipt-detail modal (blue = full, amber = partial). ────────────────────
const ReceiptCard = ({ receipt, mine, onView }) => {
  const isFull = receipt.status === 'full' || (Number(receipt.balance) || 0) <= 0;
  const grad = isFull
    ? 'from-blue-500 to-indigo-600'
    : 'from-amber-500 to-orange-600';
  return (
    <button
      onClick={() => onView?.(receipt)}
      className={`group relative text-left w-full max-w-[320px] rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all border ${
        mine ? 'border-white/30' : 'border-gray-100'
      } bg-white`}
    >
      <div className={`relative px-4 py-3 text-white bg-gradient-to-br ${grad} overflow-hidden`}>
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative flex items-center gap-2">
          {isFull ? <CheckCheck size={16} strokeWidth={3}/> : <Hourglass size={16} strokeWidth={2.5}/>}
          <p className="text-[9px] font-black uppercase tracking-[0.18em]">
            {isFull ? 'Rent Receipt · Full Paid' : 'Rent Receipt · Partial'}
          </p>
        </div>
        <p className="text-xl font-black tracking-tight mt-1.5 tabular-nums">
          {formatBDT(receipt.totalPaid)}
        </p>
        <p className="text-[10px] font-bold text-white/80 mt-0.5">
          {receipt.monthLabel || receipt.monthKey}{receipt.method ? ` · ${receipt.method}` : ''}
        </p>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        <p className="text-[11px] font-black text-gray-900 line-clamp-1">{receipt.propertyTitle}</p>
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span>Due {formatBDT(receipt.totalDue)}</span>
          <span className={(Number(receipt.balance) || 0) > 0 ? 'text-amber-600' : 'text-blue-600'}>
            {(Number(receipt.balance) || 0) > 0 ? `Balance ${formatBDT(receipt.balance)}` : 'Cleared'}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[9px] font-black text-gray-300 font-mono truncate max-w-[60%]">{receipt.id}</span>
          <span className="text-[10px] font-black text-[#ba0036] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            View <ChevronRight size={11}/>
          </span>
        </div>
      </div>
    </button>
  );
};

// ─── Inline call card — rendered inside the message stream when a call
//     ends (completed/missed/declined/no-answer). Mirrors how Messenger,
//     WhatsApp and IMO show call events in the chat thread. Tap a card
//     to call the peer back instantly. ────────────────────────────────────
const ChatCallCard = ({ call, mine, onCallBack }) => {
  // Status palette — missed/declined go red, completed goes neutral.
  const missed = call.status === 'missed' || call.status === 'no-answer' || call.status === 'declined';
  let Icon = call.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
  if (missed) Icon = call.status === 'missed' ? PhoneMissed : PhoneOff;
  const TypeIcon = call.type === 'video' ? Video : Phone;

  let label;
  if (call.status === 'missed')     label = call.type === 'video' ? 'Missed video call' : 'Missed voice call';
  else if (call.status === 'no-answer') label = 'No answer';
  else if (call.status === 'declined') label = call.direction === 'outgoing' ? 'Call declined' : 'You declined';
  else if (call.status === 'completed') {
    const dur = callService.formatCallDuration(call.durationSec);
    label = `${call.type === 'video' ? 'Video' : 'Voice'} call · ${dur}`;
  } else {
    label = call.type === 'video' ? 'Video call' : 'Voice call';
  }

  const time = (() => {
    if (!call.iso) return '';
    const d = new Date(call.iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <button
      onClick={() => onCallBack?.(call)}
      className={`group text-left w-full max-w-[280px] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
        missed
          ? 'bg-red-50 border-red-100 hover:border-red-200'
          : mine
            ? 'bg-white/95 border-white/40'
            : 'bg-white border-gray-100 hover:border-[#ba0036]/20'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        missed ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'
      }`}>
        <Icon size={18} strokeWidth={2.5}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-black truncate ${missed ? 'text-red-700' : 'text-gray-900'}`}>
          {label}
        </p>
        <p className="text-[10px] font-bold text-gray-400 mt-0.5 flex items-center gap-1">
          <TypeIcon size={10} className="shrink-0"/>
          {time}
          <span className="text-gray-300">·</span>
          <span className="text-gray-500 group-hover:text-[#ba0036] transition-colors">Tap to call back</span>
        </p>
      </div>
    </button>
  );
};

// ─── Day divider that floats in the message stream ──────────────────────────
const DayDivider = ({ label }) => (
  <div className="flex items-center justify-center my-4">
    <span className="bg-white/80 backdrop-blur-md border border-gray-100 text-[9px] font-black uppercase tracking-[0.18em] text-gray-500 px-3 py-1.5 rounded-full shadow-sm">
      {label}
    </span>
  </div>
);

// ─── Animated typing dots ───────────────────────────────────────────────────
const TypingDots = ({ name = 'AI' }) => (
  <div className="flex justify-start">
    <div className="bg-gradient-to-br from-gray-900 to-[#1a1a1f] text-white px-4 py-3 rounded-3xl rounded-tl-md shadow-sm">
      <div className="flex items-center gap-1.5 text-[9px] font-black text-white/60 uppercase tracking-widest mb-1.5">
        <Sparkles size={10}/> {name} is typing
      </div>
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>
  </div>
);

// ─── Sidebar chat row ───────────────────────────────────────────────────────
// Memoized so a parent re-render (e.g. opening the list context menu, presence
// ticks, the 5s message poll) never re-renders rows whose data didn't change.
// Requires STABLE props from the parent: `onSelect`/`onContextMenu` via
// useCallback, and `lastMessage` (a referentially-stable message object) instead
// of a freshly-built object each render.
const ChatRow = React.memo(function ChatRow({ chat, lastMessage, isActive, onSelect, isMobile, online = false, onContextMenu }) {
  const initials = (chat.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  // Long-press (mobile) / right-click (desktop) → open the row context menu.
  // Timer + touch state are LOCAL refs, so pressing a row never touches the
  // parent's state or re-renders the list.
  const lpRef = useRef(null);
  const posRef = useRef(null);
  const openedRef = useRef(false);   // suppress the click that follows a long-press
  const clearLp = () => { if (lpRef.current) { clearTimeout(lpRef.current); lpRef.current = null; } };
  const ctxHandlers = onContextMenu ? {
    onContextMenu: (e) => { e.preventDefault(); onContextMenu(chat, e.clientX, e.clientY); },
    onPointerDown: (e) => {
      if (e.button === 2) return;
      posRef.current = { x: e.clientX, y: e.clientY };
      clearLp();
      lpRef.current = setTimeout(() => {
        openedRef.current = true;
        onContextMenu(chat, posRef.current.x, posRef.current.y);
        lpRef.current = null;
      }, 350);
    },
    onPointerMove: (e) => {
      const p = posRef.current;
      if (p && lpRef.current && (Math.abs(e.clientX - p.x) > 12 || Math.abs(e.clientY - p.y) > 12)) clearLp();
    },
    onPointerUp: clearLp,
    onPointerLeave: clearLp,
  } : {};

  // Derive preview/time from the stable lastMessage prop (no per-render object).
  const preview = lastMessage
    ? (lastMessage.sender === 'me' ? `You: ${lastMessage.text || ''}` : (lastMessage.text || ''))
    : '';
  const timeLabel = lastMessage?.iso ? formatTime(lastMessage.iso) : chat.time;

  return (
    <button
      {...ctxHandlers}
      onClick={(e) => {
        if (openedRef.current) { openedRef.current = false; e.preventDefault(); return; }
        onSelect?.(chat.id);
      }}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      className={`w-full text-left p-3 sm:p-4 rounded-2xl flex items-center gap-3 border transition-colors touch-pan-y select-none active:bg-gray-100 ${
        isActive
          ? 'bg-white border-[#ba0036]/15 shadow-[0_4px_20px_rgba(186,0,54,0.08)]'
          : 'border-transparent hover:bg-white/70'
      }`}
    >
      <div className="relative shrink-0">
        {chat.isAI ? (
          <div className="w-12 h-12 bg-gradient-to-br from-[#ba0036] to-[#7a0024] rounded-full flex items-center justify-center text-white shadow-md">
            <Bot size={20}/>
          </div>
        ) : chat.avatar ? (
          <img src={chat.avatar} className="w-12 h-12 rounded-full object-cover" alt={chat.name}/>
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-700 font-black text-sm">
            {initials}
          </div>
        )}
        {chat.isAI ? (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
        ) : (
          <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-black text-gray-900 text-[13px] truncate flex items-center gap-1.5">
            {chat.name}
            {chat.pinned && <Pin size={10} className="text-gray-400 shrink-0" />}
            {chat.muted && <BellOff size={10} className="text-gray-400 shrink-0" />}
            {chat.blocked && <Ban size={10} className="text-red-400 shrink-0" />}
          </h4>
          <span className="text-[9px] font-black text-gray-400 shrink-0 tabular-nums">
            {timeLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[11px] truncate ${chat.unread > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-500'}`}>
            {preview || chat.lastMsg}
          </p>
          {chat.unread > 0 && (
            <span className="bg-[#ba0036] text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center shrink-0">
              {chat.unread}
            </span>
          )}
        </div>
      </div>

      {isMobile && <ChevronRight size={14} className="text-gray-300 shrink-0"/>}
    </button>
  );
});

// ─── Main ChatSystem component ──────────────────────────────────────────────
const ChatSystem = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const peerUserId = location.state?.peerUserId;

  // While we resolve/open a real conversation from navigation state, show a
  // dedicated loading layer so tapping "Message" / "Call" on a tenant lands
  // straight in the thread (with a spinner) instead of flashing the chat list
  // or the AI-bot thread first. Seeded synchronously from the incoming state so
  // it paints on the very first frame — no multi-page bounce.
  const [openingPeer, setOpeningPeer] = useState(() => {
    try {
      const st = location.state || {};
      const qp = new URLSearchParams(location.search);
      const pid = st.peerUserId || qp.get('peerUserId');
      if (!pid) return null;
      return { name: st.peerName || '', avatar: st.peerAvatar || '', mode: st.mode || 'message' };
    } catch { return null; }
  });

  // Chat list = AI bot (local-only) + real backend conversations (polled).
  // We hydrate from localStorage for instant perceived load (SWR pattern),
  // then conversations are synced from Mongo.
  const [chats, setChats] = useState(() => {
    if (!getCurrentUser()) return initialChats;
    try {
      const stored = JSON.parse(localStorage.getItem(CHAT_THREADS_KEY));
      if (stored && Array.isArray(stored) && stored.length > 0) {
        // Ensure AI bot is present
        const hasAi = stored.some(c => c.id === 'ai-bot');
        return hasAi ? stored : [initialChats[0], ...stored];
      }
    } catch { /* ignore */ }
    return initialChats;
  });
  // Latest message timestamp per backend conversation — used for delta polling.
  const latestMessageIso = useRef({});

  const [activeChatId, setActiveChatId] = useState('ai-bot');
  const activeChat = chats.find(c => c.id === activeChatId) || initialChats[0];
  // Live presence per peer userId → { online, lastSeenAt }. Seeded from the
  // conversation list poll and kept live via PRESENCE_UPDATE socket events.
  const [presence, setPresence] = useState({});
  // Legacy states kept for basic overlay visibility; managed by callProvider now
  const [muted, setMuted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  const [showInfoPane, setShowInfoPane] = useState(false);
  // Info-pane sub-states + auto-reset whenever the pane closes.
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen]     = useState(false);
  const [reportSent, setReportSent]     = useState(false);
  useEffect(() => {
    if (!showInfoPane) { setConfirmBlock(false); setReportOpen(false); setReportSent(false); }
  }, [showInfoPane]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contextBanner, setContextBanner] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [paymentReceipts, setPaymentReceipts] = useState([]);

  // ── Chat UX upgrade: message actions, reply/forward, block modal, PIN lock ──
  const [menuState, setMenuState]   = useState(null);   // { message, x, y } for the 3-dot actions menu
  const [reactionBar, setReactionBar] = useState(null); // { message, x, y } for the quick-emoji bar
  const [replyTo, setReplyTo]       = useState(null);   // message currently being replied to
  const [forwardMsg, setForwardMsg] = useState(null);   // message currently being forwarded
  const [showBlockModal, setShowBlockModal] = useState(false);
  // WhatsApp-style header dropdown + its action modals.
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showMediaViewer, setShowMediaViewer]   = useState(false); // Media/Links/Docs
  const [showMuteModal, setShowMuteModal]       = useState(false);
  const [showReportModal, setShowReportModal]   = useState(false);
  // ── New UX pieces ───────────────────────────────────────────────────────
  const [lightbox, setLightbox]         = useState(null);  // { type, url, name } for the in-app viewer
  const [showAttachMenu, setShowAttachMenu] = useState(false); // Photo&Video / Document popover
  const [listMenu, setListMenu]         = useState(null);  // { chat, x, y } chat-list context menu
  // Conversations the user just deleted — filtered from the poll merge so they
  // don't flicker back before the backend DELETE lands.
  const deletedConvoIdsRef = useRef(new Set());
  const chatBackGuardRef   = useRef(false);   // mobile hardware-back history guard
  // Emoji reactions persist + sync via the backend (Message.reactions +
  // MESSAGE_REACTION socket). They live on each message object as
  // m.reactions = { userId: emoji }; this state only drives the floating bar.
  // Messages the current user hid "for me" (Removing someone else's message).
  // Persisted so they stay hidden across reloads + polling merges.
  const [hiddenMsgIds, setHiddenMsgIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_MSGS_KEY)) || {}; } catch { return {}; }
  });
  // Per-chat PIN privacy. `chatLocks` persists { chatId: pinHash } to localStorage;
  // `pinUnlocked` is per-session (unlock is forgotten on reload); `pinSetupFor`
  // holds the chatId whose PIN is currently being set.
  const [chatLocks, setChatLocks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_LOCKS_KEY)) || {}; } catch { return {}; }
  });
  const [pinUnlocked, setPinUnlocked] = useState({});
  const [pinSetupFor, setPinSetupFor] = useState(null);
  // (long-press timing now lives inside ChatMessageBubble)

  // ── Chat media (image upload + voice message) ──────────────────────────────
  const [isUploadingMedia, setIsUploadingMedia] = useState(false); // image/audio upload in flight
  const [isRecording, setIsRecording] = useState(false);           // mic actively recording
  const [recordSecs, setRecordSecs] = useState(0);                 // elapsed record time
  const fileInputRef = useRef(null);                               // hidden <input type=file>
  const mediaRecorderRef = useRef(null);                           // MediaRecorder instance
  const recordChunksRef = useRef([]);                              // recorded audio chunks
  const recordTimerRef = useRef(null);                             // setInterval handle
  const recordStreamRef = useRef(null);                            // mic MediaStream (to stop tracks)

  const [sidebarTab, setSidebarTab] = useState('messages');
  // Recent call history (polled). Items are pre-described via callService.describeCall.
  const [callHistory, setCallHistory] = useState([]);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null); // Phase Call-4: detail modal

  // Local message store keyed by chatId. For the AI bot this is the only
  // store. For backend conversations it's a cache populated by the poll.
  // Hydrated from localStorage for instant perceived load.
  const [messages, setMessages] = useState(() => {
    if (!getCurrentUser()) return { 'ai-bot': [] };
    try {
      const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY));
      if (stored && typeof stored === 'object') {
        if (!stored['ai-bot']) stored['ai-bot'] = [];
        return stored;
      }
    } catch { /* ignore */ }
    return { 'ai-bot': [] };
  });

  // Sync to localStorage for instant hydration on next mount
  useEffect(() => {
    if (getCurrentUser()) {
      localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(chats));
    }
  }, [chats]);

  useEffect(() => {
    if (getCurrentUser()) {
      const slim = {};
      for (const key in messages) {
        if (Array.isArray(messages[key])) {
          slim[key] = messages[key].slice(-50); // Keep last 50 per chat
        }
      }
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(slim));
    }
  }, [messages]);

  // ─── Socket.IO Call Connection ──────────────────────────────────────────────
  // The main connection and ringing UI is now fully handled by GlobalCallUI.jsx.
  // We only listen to call ends to optimistically refresh the call history.
  useEffect(() => {
    const offCallStateChange = callProvider.onCallStateChange((status) => {
      if (['ended', 'rejected', 'missed'].includes(status)) {
        // We defer the refresh slightly to let backend complete saving the Call
        setTimeout(() => refreshCallHistory?.(), 1000);
      }
    });
    return () => offCallStateChange?.();
  }, []);

  // ─── Socket Event Handlers for Status & Typing ──────────────────────────────
  useEffect(() => {
    const socket = callProvider.getSocket();
    if (!socket) return;
    
    const onDelivered = ({ messageId }) => {
      setMessages(prev => {
        const next = { ...prev };
        for (const chatId in next) {
          next[chatId] = next[chatId].map(m => m.id === messageId ? { ...m, status: 'delivered' } : m);
        }
        return next;
      });
    };

    const onSeen = ({ messageIds }) => {
      if (!messageIds || !messageIds.length) return;
      setMessages(prev => {
        const next = { ...prev };
        for (const chatId in next) {
          next[chatId] = next[chatId].map(m => messageIds.includes(m.id) ? { ...m, status: 'read' } : m);
        }
        return next;
      });
    };

    // Delete-for-everyone from the other side → swap the bubble to the
    // "This message was deleted" placeholder in real-time.
    const onMessageDeleted = ({ messageId }) => {
      if (!messageId) return;
      setMessages(prev => {
        const next = { ...prev };
        for (const chatId in next) {
          next[chatId] = next[chatId].map(m =>
            String(m.id) === String(messageId)
              ? { ...m, isDeleted: true, text: '', mediaUrl: null }
              : m);
        }
        return next;
      });
    };

    // Reaction added/removed by either side → update the message's reactions
    // live so the other user sees the emoji appear/disappear.
    const onReaction = ({ messageId, reactions: rx }) => {
      if (!messageId) return;
      setMessages(prev => {
        const next = { ...prev };
        for (const chatId in next) {
          next[chatId] = next[chatId].map(m =>
            String(m.id) === String(messageId) ? { ...m, reactions: rx || {} } : m);
        }
        return next;
      });
    };

    const onTyping = ({ senderId }) => {
      if (activeChatId !== 'ai-bot') {
        const chat = chats.find(c => String(c.peerUserId) === String(senderId));
        if (chat && chat.id === activeChatId) {
          setIsBotTyping(true);
        }
      }
    };

    const onStopTyping = ({ senderId }) => {
      if (activeChatId !== 'ai-bot') {
        const chat = chats.find(c => String(c.peerUserId) === String(senderId));
        if (chat && chat.id === activeChatId) {
          setIsBotTyping(false);
        }
      }
    };

    // Presence — flip a peer online/offline in real time.
    const onPresenceUpdate = ({ userId, online, lastSeenAt }) => {
      if (!userId) return;
      setPresence(prev => ({
        ...prev,
        [String(userId)]: {
          online: !!online,
          lastSeenAt: lastSeenAt || prev[String(userId)]?.lastSeenAt || null,
        },
      }));
    };
    const onPresenceSnapshot = ({ online }) => {
      if (!Array.isArray(online)) return;
      setPresence(prev => {
        const next = { ...prev };
        online.forEach(id => {
          next[String(id)] = { online: true, lastSeenAt: next[String(id)]?.lastSeenAt || null };
        });
        return next;
      });
    };

    // Block state changed by the peer → reflect it so the composer updates.
    const onConversationBlocked = ({ conversationId }) => {
      if (!conversationId) return;
      setChats(prev => prev.map(c => c.id === conversationId ? { ...c, blockedByPeer: true } : c));
    };
    const onConversationUnblocked = ({ conversationId }) => {
      if (!conversationId) return;
      setChats(prev => prev.map(c => c.id === conversationId ? { ...c, blockedByPeer: false } : c));
    };
    const onConversationPins = ({ conversationId, pinnedMessageIds }) => {
      if (!conversationId) return;
      setChats(prev => prev.map(c => c.id === conversationId ? { ...c, pinnedMessageIds: pinnedMessageIds || [] } : c));
    };

    // Real-time incoming message (Messenger / WhatsApp feel). The backend emits
    // RECEIVE_MESSAGE to the recipient the instant a message is saved. Without
    // this, a new message + its unread badge only appeared on the next 15s
    // conversation poll. We cache the message (so an open thread updates live
    // and the sidebar re-sorts this thread to the top — visibleChats orders by
    // the latest cached message) and bump the conversation's unread badge unless
    // that chat is already open.
    const onReceiveMessage = (payload) => {
      const m = payload && payload.message;
      const convoId = payload && payload.conversationId;
      if (!m || !convoId) return;
      const myId = String(getCurrentUser()?.id || getCurrentUser()?._id || '');
      const fromMe = String(m.senderId) === myId;
      const isActive = convoId === activeChatId;

      setMessages(prev => {
        const existing = prev[convoId] || [];
        // Dedup against the 5s delta poll, which may also deliver this message.
        if (existing.some(x => String(x.id) === String(m.id || m._id))) return prev;
        const mapped = {
          id: m.id || m._id,
          sender: fromMe ? 'me' : 'them',
          text: m.text,
          type: m.type || 'text',
          mediaUrl: m.mediaUrl || null,
          mediaMeta: m.mediaMeta || null,
          replyTo: m.replyTo || null,
          isDeleted: !!m.isDeleted,
          reactions: m.reactions || {},
          iso: m.createdAt,
          status: 'delivered',
          senderId: m.senderId,
        };
        if (mapped.iso) latestMessageIso.current[convoId] = mapped.iso;
        return { ...prev, [convoId]: [...existing, mapped] };
      });

      setChats(prev => {
        const idx = prev.findIndex(c => c.id === convoId);
        if (idx === -1) {
          // First message of a thread we don't have locally yet → pull the list.
          chatService.listConversations().then(mergeBackendConversations).catch(() => {});
          return prev;
        }
        const row = prev[idx];
        const preview = m.text || (m.type && m.type !== 'text' ? `[${m.type}]` : row.lastMsg);
        const next = [...prev];
        next[idx] = {
          ...row,
          lastMsg: preview,
          time: m.createdAt ? new Date(m.createdAt).toISOString() : row.time,
          // An open chat (or our own echo) is already "read" — never bump it.
          unread: (isActive || fromMe) ? 0 : (Number(row.unread) || 0) + 1,
        };
        return next;
      });
    };

    socket.on('MESSAGE_DELIVERED', onDelivered);
    socket.on('MESSAGE_SEEN', onSeen);
    socket.on('MESSAGE_DELETED', onMessageDeleted);
    socket.on('MESSAGE_REACTION', onReaction);
    socket.on('USER_TYPING', onTyping);
    socket.on('USER_STOPPED_TYPING', onStopTyping);
    socket.on('PRESENCE_UPDATE', onPresenceUpdate);
    socket.on('PRESENCE_SNAPSHOT', onPresenceSnapshot);
    socket.on('CONVERSATION_BLOCKED', onConversationBlocked);
    socket.on('CONVERSATION_UNBLOCKED', onConversationUnblocked);
    socket.on('CONVERSATION_PINS', onConversationPins);
    socket.on('RECEIVE_MESSAGE', onReceiveMessage);

    return () => {
      socket.off('MESSAGE_DELIVERED', onDelivered);
      socket.off('MESSAGE_SEEN', onSeen);
      socket.off('MESSAGE_DELETED', onMessageDeleted);
      socket.off('MESSAGE_REACTION', onReaction);
      socket.off('USER_TYPING', onTyping);
      socket.off('USER_STOPPED_TYPING', onStopTyping);
      socket.off('PRESENCE_UPDATE', onPresenceUpdate);
      socket.off('PRESENCE_SNAPSHOT', onPresenceSnapshot);
      socket.off('CONVERSATION_BLOCKED', onConversationBlocked);
      socket.off('CONVERSATION_UNBLOCKED', onConversationUnblocked);
      socket.off('CONVERSATION_PINS', onConversationPins);
      socket.off('RECEIVE_MESSAGE', onReceiveMessage);
    };
  }, [activeChatId, chats]);

  // Poll authoritative presence for the ACTIVE peer (socket keeps it live; this
  // is a freshness backstop in case a PRESENCE_UPDATE was missed).
  useEffect(() => {
    const chat = chats.find(c => c.id === activeChatId);
    const pid = chat?.peerUserId ? String(chat.peerUserId) : null;
    if (!pid) return undefined;
    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const map = await chatService.getPresence([pid]);
        if (!cancelled && map && map[pid]) setPresence(prev => ({ ...prev, [pid]: map[pid] }));
      } catch { /* silent */ }
    };
    fetchPresence();
    const timer = setInterval(fetchPresence, 20_000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, chats.length]);

  // Emit MARK_SEEN for unseen incoming messages
  useEffect(() => {
    if (!activeChatId || activeChatId === 'ai-bot') return;
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat || !chat.peerUserId) return;

    const msgs = messages[activeChatId] || [];
    const unseenIds = msgs.filter(m => m.sender === 'them' && m.status !== 'read').map(m => m.id);

    if (unseenIds.length > 0) {
      const socket = callProvider.getSocket();
      if (socket) {
        socket.emit('MARK_SEEN', { messageIds: unseenIds, senderId: chat.peerUserId });
      }
      // Optimistically mark local as read
      setMessages(prev => ({
        ...prev,
        [activeChatId]: prev[activeChatId].map(m => unseenIds.includes(m.id) ? { ...m, status: 'read' } : m)
      }));
    }
  }, [messages, activeChatId, chats]);

  // ─── Backend conversation hydration ────────────────────────────────────
  // Load the user's real conversations on mount, then re-poll every 15 s.
  // Each backend conversation becomes a chat row keyed by its Mongo id.
  const mergeBackendConversations = useCallback((list) => {
    // Drop any conversation the user just deleted so the 15s poll can't briefly
    // resurrect it before the backend DELETE is acknowledged.
    list = (Array.isArray(list) ? list : []).filter((b) => !deletedConvoIdsRef.current.has(b.id));
    // Seed presence from the poll (socket PRESENCE_UPDATE keeps it live between).
    setPresence((prev) => {
      const next = { ...prev };
      for (const b of list) {
        if (b.peerUserId) {
          const key = String(b.peerUserId);
          next[key] = {
            online: !!b.peerOnline,
            lastSeenAt: b.peerLastSeenAt || next[key]?.lastSeenAt || null,
          };
        }
      }
      return next;
    });
    setChats((prev) => {
      // Build a map of existing local UI state (blocked, muted, pinned) keyed by id
      // so polling never wipes out what the user just set in this session.
      const localState = new Map(prev.map((c) => [c.id, {
        blocked: c.blocked,
        muted:   c.muted,
        pinned:  c.pinned,
      }]));

      // Peers the backend already returns a (deduped) thread for. Used to drop
      // stale local rows for the SAME peer so one person never shows twice.
      const backendPeerIds = new Set(
        list.map((b) => (b.peerUserId ? String(b.peerUserId) : null)).filter(Boolean),
      );

      const next = [...initialChats];
      // Keep the AI bot + genuinely in-flight threads (a conversation the user
      // just opened that the 15s poll hasn't returned yet). But DROP any prior
      // row whose id was refreshed by the backend OR whose PEER the backend
      // already lists — the latter is the stale duplicate (e.g. an empty
      // "New conversation" left behind when the backend's one-thread-per-peer
      // pick points at a different Conversation doc than the local row).
      const aiAndDynamic = prev.filter((c) => {
        if (c.id === 'ai-bot') return true;
        if (list.find((b) => b.id === c.id)) return false;                          // refreshed below by id
        if (c.peerUserId && backendPeerIds.has(String(c.peerUserId))) return false; // stale same-peer dup
        return true;                                                                // truly in-flight
      });
      for (const c of aiAndDynamic) {
        if (c.id === 'ai-bot') continue;
        if (!next.find((x) => x.id === c.id)) next.push(c);
      }
      for (const b of list) {
        const ls = localState.get(b.id) || {};
        next.push({
          id:        b.id,
          name:      b.peerName || 'User',
          role:      Array.isArray(b.peerRoles) && b.peerRoles.includes('landlord')
                       ? 'Property Owner'
                       : (Array.isArray(b.peerRoles) && b.peerRoles.includes('tenant') ? 'Tenant' : 'User'),
          avatar:    b.peerAvatar || null,
          isAI:      false,
          status:    b.peerOnline ? 'online' : 'offline',
          online:    !!b.peerOnline,
          lastSeenAt: b.peerLastSeenAt || null,
          lastMsg:   b.lastMessageText || 'New conversation',
          time:      b.lastMessageAt ? new Date(b.lastMessageAt).toISOString() : 'Just now',
          unread:    Number(b.unread) || 0,
          // Preserve local UI toggles so polling doesn't revert block/mute/pin.
          pinned:    ls.pinned  ?? false,
          blocked:   ls.blocked ?? (b.blocked   || false),
          blockedByPeer: b.blockedByPeer || false,
          muted:     ls.muted   ?? (b.muted     || false),
          pinnedMessageIds: b.pinnedMessageIds || [],
          peerUserId: b.peerUserId,
          propertyId: b.propertyId,
        });
      }

      // Final safety net: collapse any rows that still share a peer (the AI bot
      // has no peerUserId, so it's never touched), keeping the one with the most
      // recent activity — a real thread beats an empty "New conversation" dup.
      const activityMs = (c) => (c.time && c.time !== 'Just now' ? (Date.parse(c.time) || 0) : 0);
      const peerIndex = new Map();
      const deduped = [];
      for (const c of next) {
        const pid = c.peerUserId ? String(c.peerUserId) : null;
        if (!pid) { deduped.push(c); continue; }
        if (!peerIndex.has(pid)) {
          peerIndex.set(pid, deduped.length);
          deduped.push(c);
        } else {
          const idx = peerIndex.get(pid);
          if (activityMs(c) >= activityMs(deduped[idx])) deduped[idx] = c;
        }
      }
      return deduped;
    });
  }, []);

  const syncOfflineMessages = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const offlineQueue = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      if (offlineQueue.length === 0) return;

      const remainingQueue = [];
      for (const msg of offlineQueue) {
        try {
          const saved = await chatService.sendMessage(msg.chatId, msg.text);
          setMessages(prev => ({
            ...prev,
            [msg.chatId]: (prev[msg.chatId] || []).map(m =>
              m.id === msg.id
                ? { id: saved.id, sender: 'me', text: saved.text, iso: saved.createdAt, status: 'delivered' }
                : m,
            ),
          }));
          latestMessageIso.current[msg.chatId] = saved.createdAt;
        } catch (err) {
          remainingQueue.push(msg);
        }
      }
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(remainingQueue));
    } catch (e) {
      console.warn('[Offline Sync] Failed to parse offline messages', e);
    }
  }, []);

  useEffect(() => {
    syncOfflineMessages();
    window.addEventListener('online', syncOfflineMessages);
    return () => window.removeEventListener('online', syncOfflineMessages);
  }, [syncOfflineMessages]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const load = async () => {
      try {
        const list = await chatService.listConversations();
        if (cancelled) return;
        mergeBackendConversations(list);
      } catch (err) {
        // Probably unauthenticated — silent skip.
      }
    };
    load();
    timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [mergeBackendConversations]);

  // Receipts feed — pulled from localStorage and merged with backend.
  useEffect(() => {
    const loadLocal = () => {
      try {
        const arr = JSON.parse(localStorage.getItem(PAYMENT_RECEIPTS_KEY) || '[]');
        setPaymentReceipts((prev) => {
          const map = new Map(prev.map(r => [r.id, r]));
          arr.forEach(r => map.set(r.id, r));
          return Array.from(map.values()).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
        });
      } catch { /* ignore */ }
    };
    loadLocal();

    let cancelled = false;
    const loadBackend = async () => {
      const user = getCurrentUser();
      if (!user) return;
      try {
        // Fetch both if role is mixed, or just one based on user logic. Here we fetch both and merge to be safe
        // (ChatSystem is shared between host and tenant).
        const [tRes, hRes] = await Promise.allSettled([
          listTenantReceipts(),
          listHostReceipts()
        ]);
        if (cancelled) return;
        
        let all = [];
        if (tRes.status === 'fulfilled') all.push(...tRes.value);
        if (hRes.status === 'fulfilled') all.push(...hRes.value);

        setPaymentReceipts((prev) => {
          const map = new Map(prev.map(r => [r.id, r]));
          all.forEach(r => map.set(r.id, r));
          return Array.from(map.values()).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
        });
      } catch (err) {
        console.warn('[chat] receipt fetch failed:', err);
      }
    };
    loadBackend();
    
    const interval = setInterval(loadBackend, 30_000);
    const onUpdate = () => loadLocal();
    const onStorage = (e) => { if (!e.key || e.key === PAYMENT_RECEIPTS_KEY) loadLocal(); };
    window.addEventListener(PAYMENT_RECEIPTS_EVENT, onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener(PAYMENT_RECEIPTS_EVENT, onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Track viewport so we can switch master/detail vs three-pane behaviour.
  const [viewport, setViewport] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobile  = viewport < 768;
  const isDesktop = viewport >= 1280;
  // True only when a real conversation is open on a phone. Drives the
  // full-screen "clean chat" layer that covers the app's top navbar +
  // bottom tab bar so the thread feels like a native messenger.
  const mobileChatOpen = isMobile && !showSidebarMobile;

  // The full-screen mobile chat is sized to the VISUAL viewport (not 100dvh) so
  // that when the keyboard opens, the container shrinks and the composer stays
  // visible ABOVE the keyboard instead of being covered by it.
  const [kbViewport, setKbViewport] = useState({ height: null, offsetTop: 0 });
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!mobileChatOpen || !vv) { setKbViewport({ height: null, offsetTop: 0 }); return undefined; }
    const apply = () => setKbViewport({ height: vv.height, offsetTop: vv.offsetTop || 0 });
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply); };
  }, [mobileChatOpen]);

  // ── Mobile hardware / browser BACK button → return to the chat LIST, not the
  // Home page. While a conversation is open on a phone we push a history
  // "guard" entry; pressing Back pops it and we simply close the thread (show
  // the list) instead of navigating away from /messages.
  useEffect(() => {
    if (!(isMobile && mobileChatOpen)) return undefined;
    window.history.pushState({ toletChatOpen: true }, '');
    chatBackGuardRef.current = true;
    const onPop = () => {
      chatBackGuardRef.current = false;
      setShowInfoPane(false);
      setShowSidebarMobile(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isMobile, mobileChatOpen]);

  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const handledStateRef = useRef(null);
  const headerMenuBtnRef = useRef(null);   // anchor for the ⋮ dropdown (portal)

  // ─── Call media refs ──────────────────────────────────────────────────────
  // remoteVideoRef → <video> element that displays the peer's stream
  // remoteAudioRef → <audio> element for voice calls


  // ─── Call history fetching + light polling ──────────────────────────────
  // We refetch when the sidebar tab is flipped to 'calls', when a call
  // overlay closes (so new entries appear immediately), and every 30 s
  // as a safety net for events the socket layer might miss.
  const refreshCallHistory = useCallback(async () => {
    const me = getCurrentUser();
    if (!me) return;
    try {
      const raw = await callService.listCallHistory({ limit: 80 });
      const myId = me.id || me._id;
      const described = raw
        .map((c) => callService.describeCall(c, myId))
        .filter(Boolean);
      setCallHistory(described);
    } catch {
      // silent — auth/network blip
    }
  }, []);

  useEffect(() => {
    setCallHistoryLoading(true);
    refreshCallHistory().finally(() => setCallHistoryLoading(false));
    const t = setInterval(refreshCallHistory, 30_000);
    return () => clearInterval(t);
  }, [refreshCallHistory]);



  // Phase Call-4: when the Calls tab opens, mark missed calls as seen so the
  // red badge clears. Optimistically flip local `seen`, then tell the backend.
  useEffect(() => {
    if (sidebarTab !== 'calls') return;
    const hasUnseen = callHistory.some(c => c.status === 'missed' && !c.seen);
    if (!hasUnseen) return;
    setCallHistory((list) => list.map(c => (c.status === 'missed' ? { ...c, seen: true } : c)));
    callService.markSeen().catch(() => { /* non-fatal; a later refresh corrects */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarTab]);

  // ─── Call-end toast bridge ──────────────────────────────────────────────
  // NOTE: toast handling now lives inside the PRIMARY onCallStateChange handler
  // above. callProvider keeps only one state callback, so registering a second
  // one here used to overwrite the primary handler — which broke ring-stop and
  // video. Intentionally left empty/removed.

  // ─── Centralised call-placement helper ─────────────────────────────────
  // Used by the chat header voice/video buttons, the Calls-tab "call back"
  // arrow, and the in-chat call cards. Keeps the overlay/UI in sync with
  // callProvider.initiateCall regardless of where the call was triggered.
  const placeCall = useCallback(async ({ peerUserId, peerName, peerAvatar, type }) => {
    if (!peerUserId) {
      toast.error('Call করা সম্ভব হচ্ছে না, একটু পরে চেষ্টা করুন।');
      return;
    }
    const me = getCurrentUser();
                        try {
      await callProvider.initiateCall({
        receiverId: peerUserId,
        type,
        callerName: me?.name || 'User',
        callerAvatar: me?.profilePicture || me?.avatar || null,
        receiverName: peerName || 'Unknown',
        receiverAvatar: peerAvatar || null,
      });
    } catch (e) {
             console.error('[CALL FAIL] WebRTC initiateCall failed:', e);
      toast.error('Call করা সম্ভব হচ্ছে না, একটু পরে চেষ্টা করুন।');
    }
  }, []);

  // Triggered when the user taps a call-back arrow / in-chat call card.
  // Re-uses the same call type the past call had, switches to the matching
  // chat thread (if known) and places the call.
  const handleCallBack = useCallback((call) => {
    if (!call?.peer?.id) return;
    // Try to find the existing chat row for this peer.
    const matchingChat = chats.find(c => String(c.peerUserId || '') === String(call.peer.id));
    if (matchingChat) {
      setSidebarTab('messages');
      setActiveChatId(matchingChat.id);
      if (typeof setShowSidebarMobile === 'function') setShowSidebarMobile(false);
    }
    placeCall({
      peerUserId: call.peer.id,
      peerName: call.peer.name,
      peerAvatar: call.peer.profilePicture,
      type: call.type === 'video' ? 'video' : 'voice',
    });
  }, [chats, placeCall]);

  // ─── Phase Call-4: call-detail modal actions ─────────────────────────────
  // Call the peer from the modal with an explicit type (voice/video).
  const callPeerFromDetail = useCallback((peer, type) => {
    if (!peer?.id) return;
    setSelectedCall(null);
    const matchingChat = chats.find(c => String(c.peerUserId || '') === String(peer.id));
    if (matchingChat) {
      setSidebarTab('messages');
      setActiveChatId(matchingChat.id);
      if (isMobile) setShowSidebarMobile(false);
    }
    placeCall({
      peerUserId: peer.id,
      peerName: peer.name,
      peerAvatar: peer.profilePicture,
      type: type === 'video' ? 'video' : 'voice',
    });
  }, [chats, placeCall, isMobile]);

  // Open (or find) the chat thread with this peer from the modal.
  const messagePeer = useCallback(async (peer) => {
    if (!peer?.id) return;
    setSelectedCall(null);
    setSidebarTab('messages');
    const matchingChat = chats.find(c => String(c.peerUserId || '') === String(peer.id));
    if (matchingChat) {
      setActiveChatId(matchingChat.id);
      if (isMobile) setShowSidebarMobile(false);
      return;
    }
    // No existing thread — open a backend conversation, then activate it.
    try {
      const convo = await chatService.openConversation({ peerUserId: peer.id });
      if (convo?.id) {
        try { mergeBackendConversations(await chatService.listConversations()); } catch { /* ignore */ }
        setActiveChatId(convo.id);
        if (isMobile) setShowSidebarMobile(false);
      }
    } catch (err) {
      console.warn('[chat] messagePeer failed:', err?.message);
    }
  }, [chats, isMobile]);

  // View the peer's profile. Route by role; param is the peer's user id.
  // NOTE: verify these two route paths match your router (see PHASE4 guide).
  const viewPeerProfile = useCallback((peer) => {
    if (!peer?.id) return;
    setSelectedCall(null);
    const base = peer.role === 'tenant' ? '/tenant' : '/landlord';
    navigate(`${base}/${peer.id}`);
  }, [navigate]);

  // Soft-delete a call from history (optimistic — also hits the backend).
  const handleDeleteCall = useCallback(async (call) => {
    if (!call?.id) return;
    setSelectedCall((cur) => (cur && cur.id === call.id ? null : cur));
    setCallHistory((list) => list.filter((c) => c.id !== call.id)); // optimistic
    try {
      await callService.deleteCall(call.id);
    } catch (err) {
      console.warn('[calls] delete failed, refreshing:', err?.message);
      refreshCallHistory(); // restore truth on failure
    }
  }, [refreshCallHistory]);

  // Send message — AI bot stays local, real chats POST to /api/conversations/:id/messages.
  const sendMessageTo = useCallback(async (chatId, text, opts = {}) => {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    const chat = chats.find(c => c.id === chatId);

    // AI bot — client-side only.
    if (chat?.isAI) {
      const userMsg = {
        id: Date.now(),
        sender: 'me',
        text: trimmed,
        iso: new Date().toISOString(),
        status: 'sent',
      };
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), userMsg] }));
      setIsBotTyping(true);
      const reply = getBotReply(trimmed);
      setTimeout(() => {
        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: reply,
          iso: new Date().toISOString(),
        };
        setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), botMsg] }));
        setIsBotTyping(false);
        setMessages(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map(m => m.id === userMsg.id ? { ...m, status: 'read' } : m),
        }));
      }, 700 + Math.min(trimmed.length * 18, 1400));
      return;
    }

    // Real conversation — optimistic insert, then POST.
    const replyMsg = opts.replyTo || null;
    const tempId  = `temp-${Date.now()}`;
    const tempIso = new Date().toISOString();
    const optimistic = {
      id: tempId,
      sender: 'me',
      text: trimmed,
      type: 'text',
      iso: tempIso,
      status: 'sent',
      isDeleted: false,
      // Show the quote instantly (optimistic) with a slim copy of the target.
      replyTo: replyMsg ? {
        id: replyMsg.id, text: replyMsg.text, type: replyMsg.type,
        mediaUrl: replyMsg.mediaUrl, senderId: replyMsg.senderId, isDeleted: !!replyMsg.isDeleted,
      } : null,
    };
    setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), optimistic] }));
    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }
      const saved = await chatService.sendMessage(chatId, trimmed, { replyTo: replyMsg?.id });
      setMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map(m =>
          m.id === tempId
            ? {
                id: saved.id, sender: 'me', text: saved.text,
                type: saved.type || 'text', mediaUrl: saved.mediaUrl || null, mediaMeta: saved.mediaMeta || null,
                replyTo: saved.replyTo || null, isDeleted: !!saved.isDeleted, reactions: saved.reactions || {},
                iso: saved.createdAt, status: 'delivered', senderId: saved.senderId,
              }
            : m,
        ),
      }));
      latestMessageIso.current[chatId] = saved.createdAt;
    } catch (err) {
      // Offline Message Queuing
      const queuedMsg = { ...optimistic, status: 'queued', chatId };
      const offlineQueue = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      offlineQueue.push(queuedMsg);
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(offlineQueue));

      setMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map(m =>
          m.id === tempId ? { ...m, status: 'queued', error: err?.message || 'Queued for sync' } : m,
        ),
      }));
    }
  }, [chats]);

  // Create a chat row on the fly when a new chatId arrives via state.
  const ensureChat = useCallback((s) => {
    setChats(prev => {
      if (prev.find(c => c.id === s.chatId)) return prev;
      const isAI = s.chatId === 'ai-bot';
      const fresh = {
        id: s.chatId,
        name: s.tenantName || s.landlordName || (isAI ? 'TO-LET AI Bot' : 'Conversation'),
        role: s.source === 'tenant-receipt'
          ? 'Property Owner'
          : (s.source === 'host-bookings' ? 'Tenant' : (isAI ? 'Smart Assistant' : 'Conversation')),
        avatar: s.avatar || (s.tenantName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(s.tenantName)}&background=fce4ec&color=ba0036` : null),
        isAI,
        status: 'online',
        lastMsg: s.propertyTitle ? `Re: ${s.propertyTitle}` : 'New conversation',
        time: 'Just now',
        unread: 0,
        pinned: false,
        propertyTitle: s.propertyTitle,
        tenantPhone: s.tenantPhone,
      };
      return [...prev, fresh];
    });
  }, []);

  // Hydrate from location.state.
  // New shape:  { peerUserId, propertyId?, propertyTitle?, prefillMessage?, mode? }
  //   → opens (or finds) a real backend conversation and activates it.
  // Legacy shape: { chatId: 'ai-bot', ... }
  //   → activates the AI bot chat (still local).
  // Legacy shape: { chatId: <arbitrary>, ... }
  //   → we no longer know who that maps to without peerUserId, so we just
  //     surface the context banner without activating a thread.
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hasQueryParams = searchParams.has('peerUserId') || searchParams.has('chatId');
    
    if (!location.state && !hasQueryParams) return;
    
    // Use search as key if state is empty, to prevent double-firing
    const stateKey = location.key || location.search;
    if (handledStateRef.current === stateKey) return;
    handledStateRef.current = stateKey;

    const s = {
      ...(location.state || {}),
      peerUserId: location.state?.peerUserId || searchParams.get('peerUserId'),
      chatId: location.state?.chatId || searchParams.get('chatId'),
      source: location.state?.source || searchParams.get('source'),
      autoOpen: location.state?.autoOpen || searchParams.get('autoOpen') === 'true',
      prefillMessage: location.state?.prefillMessage || searchParams.get('prefillMessage')
    };

    if (s.source === 'host-bookings' || s.source === 'tenant-receipt') {
      setContextBanner({
        source: s.source,
        propertyTitle: s.propertyTitle,
        monthKey: s.monthKey,
        receiptId: s.receiptId,
      });
    }

    // 1. AI bot path — unchanged.
    if (s.chatId === 'ai-bot') {
      setActiveChatId('ai-bot');
      if (isMobile) setShowSidebarMobile(false);
      if (s.initialMessage) {
        setTimeout(() => sendMessageTo('ai-bot', s.initialMessage), 50);
      } else if (s.prefillMessage) {
        setInputText(s.prefillMessage);
        setTimeout(() => inputRef.current?.focus(), 80);
      }
      return;
    }

    // 2. New backend path — open or find a real conversation.
    if (s.peerUserId) {
      // Show the loading layer straight away (covers re-navigation while already
      // on /messages — the useState seed only catches the first mount).
      setOpeningPeer({ name: s.peerName || '', avatar: s.peerAvatar || '', mode: s.mode || 'message' });
      // Go straight to the thread pane on mobile so we never flash the list.
      if (isMobile) setShowSidebarMobile(false);
      (async () => {
        try {
          const me = getCurrentUser();
          const myId = String(me?.id || me?._id || '');
          if (String(s.peerUserId) === myId) {
            setOpeningPeer(null);
            toast.error('নিজের সাথে চ্যাট বা কল করা যায় না।');
            return;
          }
          const convo = await chatService.openConversation({
            peerUserId: s.peerUserId,
            propertyId: s.propertyId,
          });
          if (!convo?.id) { setOpeningPeer(null); return; }
          // Make sure the new convo is in the sidebar immediately.
          try {
            const list = await chatService.listConversations();
            mergeBackendConversations(list);
          } catch { /* ignore */ }
          setActiveChatId(convo.id);
          if (isMobile) setShowSidebarMobile(false);
          if (s.mode === 'call') {
            // Phase Call-4 fix: actually start the call (this used to only open
            // the empty call UI without ringing). Peer details come from the
            // navigation state (profile pages pass them); placeCall fills gaps.
            placeCall({
              peerUserId: s.peerUserId,
              peerName: s.peerName,
              peerAvatar: s.peerAvatar,
              type: s.callType === 'video' ? 'video' : 'voice',
            });
          }
          if (s.prefillMessage) {
            setInputText(s.prefillMessage);
            setTimeout(() => inputRef.current?.focus(), 80);
          } else if (s.initialMessage) {
            setTimeout(() => sendMessageTo(convo.id, s.initialMessage), 50);
          }
        } catch (err) {
          console.warn('[chat] failed to open conversation:', err?.message);
          toast.error(language === 'বাংলা' ? 'কথোপকথন খুলতে সমস্যা হয়েছে।' : 'Could not open the conversation.');
        } finally {
          // Clear the loading layer once the thread is active (or on failure).
          setOpeningPeer(null);
        }
      })();
      return;
    }

    // 3. Legacy free-form chatId path — we have no peer mapping for it, so we
    //    can't open a real backend thread. The context banner (set above for
    //    host-bookings / tenant-receipt) is enough; we leave the user on the
    //    conversation list rather than a dead-end. No thread to activate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Safety net: never let the "opening conversation" layer get stuck if the
  // async open silently stalls (offline, slow backend). Clears after 12s.
  useEffect(() => {
    if (!openingPeer) return undefined;
    const timer = setTimeout(() => setOpeningPeer(null), 12000);
    return () => clearTimeout(timer);
  }, [openingPeer]);

  // Auto-scroll to the latest message. Opening a chat (or a bulk load) JUMPS
  // instantly to the bottom — no visible top→bottom scroll-through. Only a
  // single newly-arrived message animates smoothly.
  const prevChatRef  = useRef(null);
  const prevCountRef = useRef(0);
  useEffect(() => {
    const count = (messages[activeChatId] || []).length;
    const chatChanged = prevChatRef.current !== activeChatId;
    const bulk = count - prevCountRef.current > 1;
    scrollRef.current?.scrollIntoView({
      behavior: (chatChanged || bulk) ? 'auto' : 'smooth',
      block: 'end',
    });
    prevChatRef.current  = activeChatId;
    prevCountRef.current = count;
  }, [messages, activeChatId, isBotTyping, paymentReceipts]);

  // Esc to close call/overlay.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (activeReceipt) setActiveReceipt(null);
        else if (showEmojiPicker) setShowEmojiPicker(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeReceipt, showEmojiPicker]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const text = inputText;
    const replying = replyTo; // capture before clearing so we can pass its id
    setInputText('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    sendMessageTo(activeChatId, text, { replyTo: replying });

    // ── Crucial mobile UX fix ──────────────────────────────────────────────
    // Refocus the input right after sending so the on-screen keyboard STAYS
    // open for continuous typing (otherwise the input blurs and the keyboard
    // slides away between every message).
    inputRef.current?.focus();

    // Stop typing immediately when sent
    const chat = chats.find(c => c.id === activeChatId);
    if (chat && chat.peerUserId) {
      const socket = callProvider.getSocket();
      if (socket) socket.emit('TYPING_STOP', { receiverId: chat.peerUserId });
    }
  };

  const insertEmoji = (e) => {
    // Append without refocusing the input, so the emoji panel stays open and
    // the keyboard doesn't pop up over it (WhatsApp behaviour).
    setInputText((t) => t + e);
  };

  const typingTimeoutRef = useRef(null);

  function handleTyping(text) {
    setInputText(text);
    if (activeChatId === 'ai-bot') return;
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat || !chat.peerUserId) return;

    const socket = callProvider.getSocket();
    if (!socket) return;

    socket.emit('TYPING_START', { receiverId: chat.peerUserId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('TYPING_STOP', { receiverId: chat.peerUserId });
    }, 2000);
  };

  // ── Chat media handlers ────────────────────────────────────────────────────

  // Push a freshly-sent media message straight into the local stream so the
  // sender sees it immediately (polling would also pick it up, but instant
  // feedback feels better). De-duped by id on the next poll merge.
  const appendLocalMessage = (saved) => {
    const myId = String(getCurrentUser()?.id || getCurrentUser()?._id || '');
    setMessages((prev) => {
      const existing = prev[activeChatId] || [];
      if (existing.some((m) => String(m.id) === String(saved.id))) return prev;
      const mapped = {
        id:        saved.id,
        sender:    String(saved.senderId) === myId ? 'me' : 'them',
        text:      saved.text || '',
        type:      saved.type || 'text',
        mediaUrl:  saved.mediaUrl || null,
        mediaMeta: saved.mediaMeta || null,
        replyTo:   saved.replyTo || null,
        isDeleted: !!saved.isDeleted,
        reactions: saved.reactions || {},
        iso:       saved.createdAt,
        status:    'delivered',
        senderId:  saved.senderId,
      };
      latestMessageIso.current[activeChatId] = saved.createdAt;
      return { ...prev, [activeChatId]: [...existing, mapped] };
    });
  };

  // Paperclip → open the attachment menu (Photo & Video / Document).
  const handleAttachClick = () => {
    if (activeChat.isAI) return;        // can't send media to the AI bot
    if (isUploadingMedia) return;
    setShowAttachMenu((s) => !s);
  };

  // Open the OS file picker filtered to a given accept string. One hidden input
  // serves both attachment-menu options (we set `accept` imperatively).
  const openPicker = (accept) => {
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  // A file was chosen → validate + upload as an image / VIDEO / document.
  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                // reset so the same file can be re-picked
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isPdf   = file.type === 'application/pdf';
    if (!isImage && !isVideo && !isPdf) { alert('শুধু ছবি, ভিডিও বা PDF পাঠানো যাবে।'); return; }
    const maxMb = isVideo ? 20 : 10;
    if (file.size > maxMb * 1024 * 1024) { alert(`ফাইল অনেক বড় (সর্বোচ্চ ${maxMb} MB)।`); return; }

    const kind = isPdf ? 'document' : isVideo ? 'video' : 'image';
    setIsUploadingMedia(true);
    try {
      const saved = await chatService.sendMediaMessage(activeChatId, file, { kind, filename: file.name });
      appendLocalMessage(saved);
    } catch (err) {
      alert('ফাইল পাঠানো যায়নি: ' + (err?.message || 'unknown'));
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Mic → start recording (tap to start / tap to stop).
  const startRecording = async () => {
    if (activeChat.isAI) return;
    if (isRecording || isUploadingMedia) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('আপনার ব্রাউজার ভয়েস রেকর্ডিং সাপোর্ট করে না।');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('মাইক্রোফোন অনুমতি দেওয়া হয়নি।');
      return;
    }
    recordStreamRef.current = stream;
    recordChunksRef.current = [];

    // Pick a mime type the browser actually supports.
    let mime = '';
    if (MediaRecorder.isTypeSupported?.('audio/webm')) mime = 'audio/webm';
    else if (MediaRecorder.isTypeSupported?.('audio/mp4')) mime = 'audio/mp4';
    else if (MediaRecorder.isTypeSupported?.('audio/ogg')) mime = 'audio/ogg';

    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    mediaRecorderRef.current = rec;

    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) recordChunksRef.current.push(ev.data); };
    rec.start();

    setIsRecording(true);
    setRecordSecs(0);
    recordTimerRef.current = setInterval(() => {
      setRecordSecs((s) => {
        // Safety: auto-stop at 2 minutes so we never record forever.
        if (s >= 120) { stopRecording(true); return s; }
        return s + 1;
      });
    }, 1000);
  };

  // Stop recording. If `send` is true, upload the clip; otherwise discard.
  async function stopRecording(send = true) {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    const finalSecs = recordSecs;

    const cleanup = () => {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
      recordStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      recordStreamRef.current = null;
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordSecs(0);
    };

    rec.onstop = async () => {
      const chunks = recordChunksRef.current;
      recordChunksRef.current = [];
      cleanup();
      if (!send) return;
      if (!chunks.length) return;
      const type = rec.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type });
      if (blob.size < 1000) { alert('রেকর্ডিং খুব ছোট।'); return; }
      if (blob.size > 5 * 1024 * 1024) { alert('ভয়েস মেসেজ অনেক বড়।'); return; }

      const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
      setIsUploadingMedia(true);
      try {
        const saved = await chatService.sendMediaMessage(activeChatId, blob, {
          kind: 'audio',
          durationSec: finalSecs,
          filename: `voice.${ext}`,
        });
        appendLocalMessage(saved);
      } catch (err) {
        alert('ভয়েস মেসেজ পাঠানো যায়নি: ' + (err?.message || 'unknown'));
      } finally {
        setIsUploadingMedia(false);
      }
    };
    try { rec.stop(); } catch { /* already stopped */ }
  };

  // Filter & sort the sidebar chat list.
  const visibleChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? chats.filter(c => c.name.toLowerCase().includes(q) || (c.role || '').toLowerCase().includes(q))
      : chats;
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const ax = (messages[a.id] || []).slice(-1)[0]?.iso || '';
      const bx = (messages[b.id] || []).slice(-1)[0]?.iso || '';
      return bx.localeCompare(ax);
    });
  }, [chats, searchQuery, messages]);


  // ── Info-pane actions. The optional-chained chatService calls auto-persist
  //    to the backend once those methods exist; until then they're safe
  //    no-ops and the UI updates optimistically. ───────────────────────────
  const toggleMuteChat = () => {
    const next = !activeChat.muted;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, muted: next } : c));
    try { chatService.muteConversation?.(activeChatId, next); } catch (e) { console.warn('mute failed', e); }
  };
  // Mute for a chosen duration (from the Mute modal). Duration is recorded on
  // the chat row; unmute clears it via toggleMuteChat.
  const muteChatFor = (duration) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, muted: true, muteDuration: duration } : c));
    try { chatService.muteConversation?.(activeChatId, true, duration); } catch (e) { console.warn('mute failed', e); }
    setShowMuteModal(false);
    toast.success(duration === 'always' ? 'Notifications muted' : `Muted for ${duration === '8h' ? '8 hours' : '1 week'}`);
  };
  const blockChat = async (reason) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, blocked: true, blockReason: reason } : c));
    setConfirmBlock(false);
    setShowBlockModal(false);
    try { await chatService.blockConversation?.(activeChatId, reason); } catch (e) { console.warn('block failed', e); }
    toast.success(`${activeChat.name || 'Contact'} blocked`);
  };
  const unblockChat = async () => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, blocked: false } : c));
    try { await chatService.unblockConversation?.(activeChatId); } catch (e) { console.warn('unblock failed', e); }
  };
  const submitReport = async (reason) => {
    setShowReportModal(false);
    try {
      await chatService.reportConversation?.(activeChatId, reason);
      toast.success(language === 'বাংলা' ? 'রিপোর্ট পাঠানো হয়েছে। ধন্যবাদ।' : 'Report submitted. Thank you.');
    } catch (e) {
      console.warn('report failed', e);
      toast.error(language === 'বাংলা' ? 'রিপোর্ট পাঠানো যায়নি।' : 'Could not submit the report.');
    }
    setReportSent(true);
  };

  const currentUserId = String(getCurrentUser()?.id || getCurrentUser()?._id || '');
  const toggleReaction = (message, emoji) => {
    if (!message?.id) return;
    const uid = currentUserId;
    // Optimistically flip this user's reaction on the message (one per user).
    setMessages(prev => {
      const next = { ...prev };
      for (const chatId in next) {
        next[chatId] = next[chatId].map(m => {
          if (String(m.id) !== String(message.id)) return m;
          const r = { ...(m.reactions || {}) };
          if (r[uid] === emoji) delete r[uid]; else r[uid] = emoji;
          return { ...m, reactions: r };
        });
      }
      return next;
    });
    // Persist + fan out to the other user (AI bot + unsent temp messages stay local).
    if (!activeChat?.isAI && !String(message.id).startsWith('temp-')) {
      chatService.reactToMessage(activeChatId, message.id, emoji).catch(() => {});
    }
  };

  // ── Message long-press / context menu (unified action sheet) ──────────────
  // Opens the single popup that carries reactions + Reply/Forward/Copy/Pin/
  // Mute/Remove. Deleted bubbles get no menu. useCallback → stable identity so
  // the memoized ChatMessageBubble doesn't re-render when other state changes.
  const openMessageMenu = useCallback((message, x, y) => {
    if (!message || message.isDeleted) return;
    setMenuState({ message, x, y });
  }, []);

  // Open the quick-emoji reaction bar (long-press or the reaction button).
  const openReactions = useCallback((message, x, y) => {
    if (!message || message.isDeleted) return;
    setReactionBar({ message, x, y });
  }, []);

  // Open the in-app media lightbox (image / video / PDF) instead of a new tab.
  const openLightbox = useCallback((item) => {
    if (item?.url) setLightbox(item);
  }, []);

  // NOTE: the long-press timer + swipe gesture now live INSIDE the memoized
  // ChatMessageBubble (their own local refs), which is what stops the list
  // re-rendering on long-press. ChatSystem only supplies stable callbacks.

  const handleReply = useCallback((m) => { setReplyTo(m); setTimeout(() => inputRef.current?.focus(), 30); }, []);
  const handleForward = (m) => setForwardMsg(m);
  const handleDeleteMessage = async (m) => {
    if (!m?.id) return;
    // AI bot messages are local-only — just drop them.
    if (activeChat?.isAI) {
      setMessages(prev => ({
        ...prev,
        [activeChatId]: (prev[activeChatId] || []).filter(x => String(x.id) !== String(m.id)),
      }));
      return;
    }
    // Can't delete a message that hasn't been persisted yet.
    if (String(m.id).startsWith('temp-')) return;

    // Optimistically flip to the "deleted" placeholder, then confirm with the
    // backend. The backend also emits MESSAGE_DELETED so the OTHER user updates.
    const setDeleted = (deleted) => setMessages(prev => ({
      ...prev,
      [activeChatId]: (prev[activeChatId] || []).map(x =>
        String(x.id) === String(m.id)
          ? { ...x, isDeleted: deleted, ...(deleted ? { text: '', mediaUrl: null } : {}) }
          : x),
    }));
    setDeleted(true);
    try {
      await chatService.deleteMessage(activeChatId, m.id);
    } catch (err) {
      setDeleted(false); // revert if the server rejected it (e.g. not the sender)
      toast.error(t.chatDeleteFailed || 'Could not delete the message.');
    }
  };

  // "Remove" from the action sheet. Your OWN message → delete for everyone
  // (server, reliable). Someone else's message → hide it just for you
  // (persisted locally so it doesn't reappear on the next poll).
  const handleRemoveMessage = (m) => {
    if (!m?.id) return;
    if (m.sender === 'me') {
      handleDeleteMessage(m);
      return;
    }
    setHiddenMsgIds((prev) => {
      const next = { ...prev, [String(m.id)]: true };
      try { localStorage.setItem(HIDDEN_MSGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast.success(t.chatRemovedForYou || 'Removed for you');
  };

  // Copy a text message's body to the clipboard.
  const handleCopyMessage = async (m) => {
    if (!m) return;
    const body = (m.type === 'text' || !m.type) ? (parseReplyQuote(m.text)?.body || m.text || '') : (m.mediaUrl || '');
    try { await navigator.clipboard?.writeText(body); toast.success(t.chatCopied || 'Copied'); }
    catch { /* clipboard blocked */ }
  };

  // Pin / unpin a message (shared banner for both participants).
  const handlePinMessage = async (m) => {
    if (!m?.id || activeChat?.isAI || String(m.id).startsWith('temp-')) return;
    const cur = (activeChat.pinnedMessageIds || []).map(String);
    const already = cur.includes(String(m.id));
    const nextPinned = !already;
    // Optimistic.
    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      const list = (c.pinnedMessageIds || []).map(String);
      const updated = nextPinned
        ? [...new Set([...list, String(m.id)])].slice(-3)
        : list.filter(x => x !== String(m.id));
      return { ...c, pinnedMessageIds: updated };
    }));
    try {
      const res = await chatService.pinMessage(activeChatId, m.id, nextPinned);
      if (res?.pinnedMessageIds) {
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, pinnedMessageIds: res.pinnedMessageIds } : c));
      }
      toast.success(nextPinned ? (t.chatPinned || 'Message pinned') : (t.chatUnpinned || 'Message unpinned'));
    } catch {
      toast.error(t.chatActionFailed || 'Action failed. Please try again.');
    }
  };

  // ── Chat-list row actions (long-press/right-click menu + header delete) ────
  // Stable so the memoized ChatRow keeps its identity and never re-renders the
  // list on unrelated parent updates.
  const handleSelectChat = useCallback((id) => {
    setActiveChatId(id);
    if (isMobile) setShowSidebarMobile(false);
  }, [isMobile]);

  const openListMenu = useCallback((chat, x, y) => {
    if (!chat || chat.isAI) return;   // AI bot can't be pinned/muted/removed
    setListMenu({ chat, x, y });
  }, []);

  // Pin/unpin a thread in the list (client-side; visibleChats sorts pinned first).
  const pinChatRow = (chat) => {
    if (!chat) return;
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, pinned: !c.pinned } : c));
  };

  // Mute/unmute a specific thread from the list menu.
  const muteChatRow = (chat) => {
    if (!chat) return;
    const next = !chat.muted;
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, muted: next } : c));
    if (!chat.isAI) { try { chatService.muteConversation?.(chat.id, next); } catch { /* ignore */ } }
    toast.success(next
      ? (language === 'বাংলা' ? 'নোটিফিকেশন বন্ধ করা হয়েছে' : 'Notifications muted')
      : (language === 'বাংলা' ? 'নোটিফিকেশন চালু করা হয়েছে' : 'Notifications unmuted'));
  };

  // Actually delete the conversation (optimistic remove + backend soft-delete).
  const doDeleteConversation = async (chat) => {
    const target = chat || activeChat;
    if (!target || target.isAI) return;
    const id = target.id;
    deletedConvoIdsRef.current.add(id);
    setChats(prev => prev.filter(c => c.id !== id));
    setMessages(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (activeChatId === id) {
      setActiveChatId('ai-bot');
      if (isMobile) setShowSidebarMobile(true);
    }
    try {
      await chatService.deleteConversation(id);
      toast.success(t.chatConversationDeleted || 'Conversation deleted');
    } catch {
      // Roll back the "pending delete" guard so a later poll can restore it.
      deletedConvoIdsRef.current.delete(id);
      toast.error(t.chatActionFailed || 'Action failed. Please try again.');
    }
  };

  // Ask for confirmation (via an actionable toast) before deleting.
  const handleDeleteConversation = (chat) => {
    const target = chat || activeChat;
    if (!target || target.isAI) return;
    toast(t.chatDeleteConfirm || 'Delete this conversation?', {
      action: { label: t.chatDelete || 'Delete', onClick: () => doDeleteConversation(target) },
      duration: 6000,
    });
  };

  const forwardTo = async (targetChatId) => {
    const m = forwardMsg;
    const sourceChatId = activeChatId;
    const sourceIsAI = activeChat?.isAI;
    setForwardMsg(null);
    if (!m || !targetChatId) return;

    const targetChat = chats.find(c => c.id === targetChatId);
    const isMedia = m.type && m.type !== 'text';
    // A real backend forward works when BOTH threads are real conversations and
    // the message is a persisted one (not a temp/optimistic id, receipt or call
    // card). This is what keeps voice notes / photos / documents as real media
    // instead of forwarding the raw Cloudinary URL as text.
    const canBackendForward =
      !!m.id && !String(m.id).startsWith('temp-') &&
      m.kind !== 'receipt' && m.kind !== 'call' &&
      targetChat && !targetChat.isAI && !sourceIsAI;

    // Switch to the target thread first for instant feedback.
    setActiveChatId(targetChatId);
    if (isMobile) setShowSidebarMobile(false);

    if (canBackendForward) {
      try {
        const saved = await chatService.forwardMessage(targetChatId, m.id, sourceChatId);
        const myId = String(getCurrentUser()?.id || getCurrentUser()?._id || '');
        setMessages(prev => {
          const existing = prev[targetChatId] || [];
          if (existing.some(x => String(x.id) === String(saved.id))) return prev;
          return {
            ...prev,
            [targetChatId]: [...existing, {
              id: saved.id,
              sender: String(saved.senderId) === myId ? 'me' : 'them',
              text: saved.text || '',
              type: saved.type || 'text',
              mediaUrl: saved.mediaUrl || null,
              mediaMeta: saved.mediaMeta || null,
              isDeleted: false,
              reactions: saved.reactions || {},
              iso: saved.createdAt,
              status: 'delivered',
              senderId: saved.senderId,
            }],
          };
        });
        latestMessageIso.current[targetChatId] = saved.createdAt;
        toast.success(t.chatForwarded || 'Message forwarded');
      } catch (err) {
        toast.error(t.chatForwardFailed || 'Forward failed. Please try again.');
      }
      return;
    }

    // Fallback: text-only forward (AI bot target/source, or an unsent message).
    // For media with no backend path we still share its link so it's not lost.
    const body = isMedia ? (m.mediaUrl || replyPreviewText(m)) : (parseReplyQuote(m.text)?.body || m.text);
    sendMessageTo(targetChatId, body);
    toast.success(t.chatForwarded || 'Message forwarded');
  };

  // ── Per-chat PIN lock ──────────────────────────────────────────────────────
  const verifyPin   = (chatId, pin) => !!chatLocks[chatId] && chatLocks[chatId] === hashPin(pin);
  const beginPinSetup = () => { setShowInfoPane(false); setPinSetupFor(activeChatId); };
  const savePin = (pin) => {
    setChatLocks(prev => ({ ...prev, [activeChatId]: hashPin(pin) }));
    setPinUnlocked(prev => ({ ...prev, [activeChatId]: true })); // stays open this session
    setPinSetupFor(null);
    toast.success('এই চ্যাট PIN দিয়ে লক করা হলো।');
  };
  const disablePin = () => {
    setChatLocks(prev => { const n = { ...prev }; delete n[activeChatId]; return n; });
    toast.success('PIN লক সরানো হলো।');
  };
  // Persist locks so they survive reload (unlock state does NOT — by design).
  useEffect(() => {
    try { localStorage.setItem(CHAT_LOCKS_KEY, JSON.stringify(chatLocks)); } catch { /* ignore */ }
  }, [chatLocks]);

  // Build the rendered message stream for the active chat — merge text/bot
  // messages with inline ReceiptCards from `paymentReceipts` AND inline
  // ChatCallCards for any call exchanged with this chat's peer. Sorted by ISO.
  const renderedStream = useMemo(() => {
    const base = (messages[activeChatId] || [])
      .filter(m => !hiddenMsgIds[String(m.id)])   // hide messages the user Removed "for me"
      .map(m => ({ kind: 'text', ...m }));
    const receiptItems = paymentReceipts
      .filter(r => r.landlordChatId === activeChatId)
      .map(r => ({
        kind: 'receipt',
        sender: 'them',
        id: `r-${r.id}`,
        iso: r.issuedAt,
        receipt: r,
      }));

    // Inline call cards: pick every call whose peer matches this chat's
    // peerUserId. AI bot chats have no peerUserId, so they get no calls.
    const peerId = activeChat?.peerUserId ? String(activeChat.peerUserId) : null;
    const callItems = peerId
      ? callHistory
          .filter(c => c.peer?.id === peerId && c.status !== 'in-progress')
          .map(c => ({
            kind: 'call',
            sender: c.direction === 'outgoing' ? 'me' : 'them',
            id: `c-${c.id}`,
            iso: c.iso,
            call: c,
          }))
      : [];

    return [...base, ...receiptItems, ...callItems]
      .sort((a, b) => (a.iso || '').localeCompare(b.iso || ''));
  }, [messages, activeChatId, paymentReceipts, callHistory, activeChat, hiddenMsgIds]);

  // Pinned messages (resolved from ids on the active chat row) for the banner.
  const pinnedMessages = useMemo(() => {
    const ids = (activeChat?.pinnedMessageIds || []).map(String);
    if (!ids.length) return [];
    const stream = messages[activeChatId] || [];
    return ids.map(id => stream.find(m => String(m.id) === id)).filter(Boolean);
  }, [activeChat, messages, activeChatId]);

  const lastIncoming = useMemo(() => {
    const stream = messages[activeChatId] || [];
    for (let i = stream.length - 1; i >= 0; i--) {
      if (stream[i].sender !== 'me') return stream[i];
    }
    return null;
  }, [messages, activeChatId]);
  const smartReplies = useMemo(() => getSmartReplies(lastIncoming, activeChat), [lastIncoming, activeChat]);

  // Group consecutive same-sender messages so we can collapse the avatar
  // and tighten the bubble shoulder — feels closer to iMessage / WhatsApp.
  const groupedStream = useMemo(() => {
    const out = [];
    let lastDay = null;
    renderedStream.forEach((m, i) => {
      const dl = dayLabel(m.iso);
      if (dl && dl !== lastDay) {
        out.push({ kind: 'divider', id: `d-${i}`, label: dl });
        lastDay = dl;
      }
      const prev = renderedStream[i - 1];
      const next = renderedStream[i + 1];
      const prevSame = prev && prev.sender === m.sender && sameDay(prev.iso, m.iso);
      const nextSame = next && next.sender === m.sender && sameDay(next.iso, m.iso);
      out.push({
        ...m,
        position: !prevSame && !nextSame ? 'solo' : !prevSame ? 'first' : !nextSame ? 'last' : 'middle',
      });
    });
    return out;
  }, [renderedStream]);

  // (bubbleRadius now lives inside ChatMessageBubble.)

  // Mark thread "read" when opened. For backend conversations we hit the
  // /read endpoint so the unread counter resets server-side too.
  useEffect(() => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, unread: 0 } : c));
    const chat = chats.find((c) => c.id === activeChatId);
    if (chat && !chat.isAI && activeChatId !== 'ai-bot') {
      chatService.markRead(activeChatId).catch(() => { /* silent */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  // ─── Active-conversation message polling (5 s) ──────────────────────────────
  // Whenever the active chat changes (to a backend conversation), do an
  // initial full fetch of its messages, then start a delta poll using
  // ?since=<latest iso>. We don't poll the AI bot.
  useEffect(() => {
    if (!activeChatId || activeChatId === 'ai-bot') return;
    let cancelled = false;
    let timer = null;

    const myId = String(getCurrentUser()?.id || getCurrentUser()?._id || '');

    const mergeMessages = (incoming) => {
      if (!incoming || incoming.length === 0) return;
      setMessages((prev) => {
        const existing = prev[activeChatId] || [];
        const seen = new Set(existing.map((m) => String(m.id)));
        const fresh = incoming
          .filter((m) => !seen.has(String(m.id)))
          .map((m) => ({
            id:     m.id,
            sender: String(m.senderId) === myId ? 'me' : 'them',
            text:   m.text,
            type:   m.type || 'text',
            mediaUrl: m.mediaUrl || null,
            mediaMeta: m.mediaMeta || null,
            replyTo: m.replyTo || null,
            isDeleted: !!m.isDeleted,
            reactions: m.reactions || {},
            iso:    m.createdAt,
            status: 'delivered',
            senderId: m.senderId,
          }));
        if (fresh.length === 0) return prev;
        const merged = [...existing, ...fresh];
        const last = merged[merged.length - 1];
        if (last?.iso) latestMessageIso.current[activeChatId] = last.iso;
        return { ...prev, [activeChatId]: merged };
      });
    };

    const initialLoad = async () => {
      try {
        const msgs = await chatService.listMessages(activeChatId);
        if (cancelled) return;
        // For initial load we replace, not merge, so the order is canonical.
        setMessages((prev) => ({
          ...prev,
          [activeChatId]: msgs.map((m) => ({
            id:     m.id,
            sender: String(m.senderId) === myId ? 'me' : 'them',
            text:   m.text,
            type:   m.type || 'text',
            mediaUrl: m.mediaUrl || null,
            mediaMeta: m.mediaMeta || null,
            replyTo: m.replyTo || null,
            isDeleted: !!m.isDeleted,
            reactions: m.reactions || {},
            iso:    m.createdAt,
            status: 'delivered',
            senderId: m.senderId,
          })),
        }));
        if (msgs.length) {
          latestMessageIso.current[activeChatId] = msgs[msgs.length - 1].createdAt;
        }
        // Mark read after a successful initial load.
        chatService.markRead(activeChatId).catch(() => { /* silent */ });
      } catch (err) {
        // Auth or network error — silent.
      }
    };

    const pollDelta = async () => {
      const cursorIso = latestMessageIso.current[activeChatId];
      // Overlap the cursor by 1ms so a message sharing the exact same
      // millisecond as the last one we already hold is never skipped by a
      // strict `createdAt > since` query on the backend. Any message that gets
      // re-fetched by this overlap is dropped by the id-dedupe in
      // mergeMessages, so the overlap can never create a visible duplicate
      // (audit 6.3 — same-millisecond delta polling).
      const since = cursorIso
        ? new Date(new Date(cursorIso).getTime() - 1).toISOString()
        : cursorIso;
      try {
        const msgs = await chatService.listMessages(activeChatId, { since });
        if (cancelled) return;
        mergeMessages(msgs);
        if (msgs.length) {
          // Mark as read while the user is actively viewing.
          chatService.markRead(activeChatId).catch(() => { /* silent */ });
        }
      } catch { /* silent */ }
    };

    initialLoad();
    timer = setInterval(pollDelta, 5_000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [activeChatId]);

  // Presence for the active peer (live socket state → falls back to poll data).
  const isBn = language === 'বাংলা';
  const activePeerId = activeChat?.peerUserId ? String(activeChat.peerUserId) : null;
  const activeOnline = activePeerId ? (presence[activePeerId]?.online ?? activeChat.online ?? false) : false;
  const activeLastSeen = activePeerId ? (presence[activePeerId]?.lastSeenAt ?? activeChat.lastSeenAt ?? null) : null;

  // This chat is PIN-locked and hasn't been unlocked yet this session.
  const activeLocked = !activeChat?.isAI && !!chatLocks[activeChatId] && !pinUnlocked[activeChatId];
  // Chats available as forward targets (real people, not this chat, not blocked).
  const forwardTargets = chats.filter(c => c.id !== 'ai-bot' && c.id !== activeChatId && !c.blocked);

  return (
    <div className={`relative w-full ${isMobile ? 'h-[100dvh] overflow-hidden' : ''}`}>
      {/* Backdrop accents */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-32 w-[480px] h-[480px] bg-[#ba0036]/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-32 w-[480px] h-[480px] bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* ── "Opening conversation" loading layer ──────────────────────────────
          Shown the instant the user taps Message/Call on a tenant (seeded from
          navigation state) and cleared once the real thread is active. Replaces
          the old behaviour where the chat list / AI-bot thread flashed first. */}
      <AnimatePresence>
        {openingPeer && (
          <motion.div
            key="opening-peer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-white/80 backdrop-blur-xl"
          >
            <div className="flex flex-col items-center gap-5 px-8 text-center">
              <div className="relative">
                {openingPeer.avatar ? (
                  <img
                    src={openingPeer.avatar}
                    alt={openingPeer.name || 'Tenant'}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-xl"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ba0036] to-[#ff004c] flex items-center justify-center text-white text-2xl font-black shadow-xl">
                    {(openingPeer.name || 'T').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -inset-1.5 rounded-full border-[3px] border-[#ba0036]/25 border-t-[#ba0036] animate-spin" />
              </div>
              <div>
                <p className="text-base font-black text-gray-900">
                  {openingPeer.mode === 'call'
                    ? (language === 'বাংলা' ? 'কল সংযোগ হচ্ছে…' : 'Connecting call…')
                    : (language === 'বাংলা' ? 'কথোপকথন খোলা হচ্ছে…' : 'Opening conversation…')}
                </p>
                {openingPeer.name && (
                  <p className="text-sm font-bold text-gray-500 mt-0.5">{openingPeer.name}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`flex flex-col md:flex-row overflow-hidden ${
          mobileChatOpen
            ? 'fixed inset-x-0 top-0 z-[80] bg-white'
            : isMobile
              ? 'relative h-[100dvh] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_30px_80px_rgba(0,0,0,0.08)]'
              : 'relative h-[calc(100dvh-2rem)] my-4 max-w-[1400px] mx-auto rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_30px_80px_rgba(0,0,0,0.08)]'
        }`}
        style={mobileChatOpen ? { height: kbViewport.height ?? '100dvh', top: kbViewport.offsetTop } : undefined}
      >



        {/* SIDEBAR */}
        <aside
          className={`${
            isMobile
              ? (showSidebarMobile ? 'flex' : 'hidden') + ' w-full'
              : 'flex w-[320px] lg:w-[360px] shrink-0 border-r border-white/60'
          } flex-col bg-white/40`}
        >
          <div className="p-5 sm:p-6 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-gray-900">
                {sidebarTab === 'messages' ? (t.chatMessages || 'Messages') : (t.chatCalls || 'Calls')}
              </h2>
              <button
                onClick={() => setIsSearching(s => !s)}
                className="p-2 hover:bg-white rounded-xl text-gray-500 hover:text-[#ba0036] transition-all"
                aria-label="Toggle search"
              >
                <Search size={18}/>
              </button>
            </div>

            {/* ─── Tab switcher (Messages / Calls) ─── */}
            <div className="flex gap-1 p-1 bg-white/60 backdrop-blur-sm rounded-2xl mb-3 border border-white/70 shadow-sm">
              <button
                onClick={() => setSidebarTab('messages')}
                className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'messages'
                    ? 'bg-[#ba0036] text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MessageSquare size={13}/>
                {t.chatChatsTab || 'Chats'}
                <span className={`text-[9px] font-black rounded-full min-w-[18px] h-[16px] px-1.5 inline-flex items-center justify-center ${
                  sidebarTab === 'messages' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-600'
                }`}>{chats.length}</span>
              </button>
              <button
                onClick={() => setSidebarTab('calls')}
                className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'calls'
                    ? 'bg-[#ba0036] text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Phone size={13}/>
                {t.chatCallsTab || 'Calls'}
                {(() => {
                  const missedCount = callHistory.filter(c => c.status === 'missed' && !c.seen).length;
                  if (missedCount === 0) return null;
                  return (
                    <span className={`text-[9px] font-black rounded-full min-w-[18px] h-[16px] px-1.5 inline-flex items-center justify-center ${
                      sidebarTab === 'calls' ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'
                    }`}>{missedCount}</span>
                  );
                })()}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isSearching && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text" autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={sidebarTab === 'messages' ? (t.chatSearchChats || 'Search chats…') : (t.chatSearchCalls || 'Search calls…')}
                      className="w-full bg-white border border-white rounded-2xl py-2.5 pl-11 pr-10 outline-none text-sm font-bold text-gray-800 focus:border-[#ba0036]/30 transition-all shadow-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                      >
                        <X size={14} className="text-gray-400"/>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
            {sidebarTab === 'messages' ? (
              visibleChats.length === 0 ? (
                <div className="text-center text-xs font-bold text-gray-400 py-10 px-4">
                  No chats match "{searchQuery}". Try a different query.
                </div>
              ) : (
                visibleChats.map(chat => {
                  const stream = messages[chat.id];
                  // Pass the raw last-message OBJECT (referentially stable) — not a
                  // freshly-built { iso, preview } each render — so React.memo works.
                  const last = stream && stream.length ? stream[stream.length - 1] : undefined;
                  return (
                    <ChatRow
                      key={chat.id}
                      chat={chat}
                      lastMessage={last}
                      isActive={activeChatId === chat.id}
                      isMobile={isMobile}
                      online={chat.peerUserId ? (presence[String(chat.peerUserId)]?.online ?? chat.online ?? false) : false}
                      onSelect={handleSelectChat}
                      onContextMenu={chat.isAI ? undefined : openListMenu}
                    />
                  );
                })
              )
            ) : (
              <CallHistory
                calls={callHistory}
                isLoading={callHistoryLoading}
                searchQuery={searchQuery}
                onCallBack={handleCallBack}
                onSelectCall={setSelectedCall}
                onDelete={handleDeleteCall}
              />
            )}
          </div>

          {!isMobile && (
            <div className="p-4 border-t border-white/60 text-[10px] font-bold text-gray-400 leading-relaxed">
              {sidebarTab === 'messages'
                ? 'Tip: open a chat from any property card or the host/tenant dashboard to start a new thread.'
                : 'Tip: tap the phone icon on any call to call that person back.'}
            </div>
          )}
        </aside>

        {/* MAIN CHAT PANE */}
            <main className={`${isMobile && showSidebarMobile ? 'hidden' : 'flex'} relative flex-1 flex-col min-w-0 min-h-0 bg-white/30`}>          <header
            className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/60 bg-white/40 backdrop-blur-md flex justify-between items-center gap-3"
            style={mobileChatOpen ? { paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' } : undefined}
          >
            <div className="flex items-center gap-3 min-w-0">
              {isMobile && (
                <button
                  onClick={() => {
                    setShowInfoPane(false);
                    // Route through history so the pushed guard entry is consumed
                    // and hardware-back stays in sync; popstate shows the list.
                    if (chatBackGuardRef.current) window.history.back();
                    else setShowSidebarMobile(true);
                  }}
                  className="p-2 -ml-1 rounded-xl hover:bg-white/70 transition-all"
                  aria-label="Back to chats"
                >
                  <ArrowLeft size={20} className="text-gray-700"/>
                </button>
              )}
              <div 
                className={`flex items-center gap-3 ${!activeChat.isAI ? 'cursor-pointer group' : ''}`}
                onClick={() => {
                  // WhatsApp behaviour: tapping the header avatar/name opens the
                  // full Contact info screen. (The ⋮ button opens the dropdown.)
                  if (activeChat.isAI) return;
                  setShowContactModal(true);
                }}
              >
                <div className="relative shrink-0">
                  <div className={`w-11 h-11 rounded-2xl overflow-hidden shadow-sm ${!activeChat.isAI && activeChat.peerUserId ? 'group-hover:scale-105 transition-transform' : ''}`}>
                    {activeChat.isAI ? (
                      <div className="w-full h-full bg-gradient-to-br from-[#ba0036] to-[#7a0024] flex items-center justify-center text-white">
                        <Bot size={22}/>
                      </div>
                    ) : activeChat.avatar ? (
                      <img src={activeChat.avatar} className="w-full h-full object-cover" alt={activeChat.name}/>
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-700 font-black text-sm">
                        {(activeChat.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                  </div>
                  {!activeChat.isAI && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${activeOnline ? 'bg-green-500' : 'bg-red-500'}`}
                      title={activeOnline ? (t.chatActiveNow || 'Active now') : formatLastSeen(activeLastSeen, isBn)}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className={`text-base sm:text-lg font-black text-gray-900 truncate ${!activeChat.isAI && activeChat.peerUserId ? 'group-hover:text-blue-600 transition-colors' : ''}`}>
                    {activeChat.name}
                  </h3>
                  {activeChat.isAI ? (
                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-green-600 truncate">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0"></span>
                      {activeChat.role || 'Online'}
                    </p>
                  ) : activeOnline ? (
                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-green-600 truncate">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0"></span>
                      {t.chatActiveNow || 'Active now'}
                    </p>
                  ) : (
                    <p className="text-[10px] font-bold flex items-center gap-1.5 text-gray-400 truncate normal-case">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0"></span>
                      {formatLastSeen(activeLastSeen, isBn)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => {
                  if (activeChat.isAI) return;
                  placeCall({
                    peerUserId: activeChat.peerUserId,
                    peerName: activeChat.name,
                    peerAvatar: activeChat.avatar,
                    type: 'voice',
                  });
                }}
                className="p-2.5 sm:p-3 bg-white hover:bg-red-50 rounded-2xl text-gray-500 hover:text-[#ba0036] transition-all shadow-sm"
                aria-label="Voice call"
              >
                <Phone size={18}/>
              </button>
              <button
                onClick={() => {
                  if (activeChat.isAI) return;
                  placeCall({
                    peerUserId: activeChat.peerUserId,
                    peerName: activeChat.name,
                    peerAvatar: activeChat.avatar,
                    type: 'video',
                  });
                }}
                className="p-2.5 sm:p-3 bg-white hover:bg-red-50 rounded-2xl text-gray-500 hover:text-[#ba0036] transition-all shadow-sm"
                aria-label="Video call"
              >
                <Video size={18}/>
              </button>
              {/* Desktop (i) info button removed — Shared media + Lock chat with
                  PIN now live in the Contact tab (tap the header / "View
                  contact"). The AI bot has no block/report/mute, so no ⋮ menu. */}
              {!activeChat.isAI && (
                <div className="relative">
                  <button
                    ref={headerMenuBtnRef}
                    onClick={() => setHeaderMenuOpen(o => !o)}
                    className={`p-2.5 sm:p-3 rounded-2xl transition-all shadow-sm ${
                      headerMenuOpen ? 'bg-[#ba0036] text-white' : 'bg-white hover:bg-red-50 text-gray-500 hover:text-[#ba0036]'
                    }`}
                    aria-label="Chat options"
                  >
                    <MoreVertical size={18}/>
                  </button>
                  <ChatHeaderMenu
                    open={headerMenuOpen}
                    anchorRef={headerMenuBtnRef}
                    muted={activeChat.muted}
                    blocked={activeChat.blocked}
                    onClose={() => setHeaderMenuOpen(false)}
                    onViewContact={() => setShowContactModal(true)}
                    onMute={() => (activeChat.muted ? toggleMuteChat() : setShowMuteModal(true))}
                    onReport={() => setShowReportModal(true)}
                    onBlock={() => (activeChat.blocked ? unblockChat() : setShowBlockModal(true))}
                    onDelete={() => handleDeleteConversation(activeChat)}
                  />
                </div>
              )}
            </div>
          </header>

          {/* Context banner — appears when arriving from HostDashboard / TenantDashboard */}
          {contextBanner && (
            <div className="px-4 sm:px-6 pt-3">
              <div className="bg-gradient-to-r from-[#ba0036]/10 to-transparent border border-[#ba0036]/15 rounded-2xl px-4 py-2.5 flex items-center gap-3 text-[11px] font-bold text-gray-700">
                <span className="w-7 h-7 rounded-full bg-[#ba0036]/15 text-[#ba0036] flex items-center justify-center shrink-0">
                  {contextBanner.source === 'tenant-receipt' ? <Receipt size={13}/> : <FileText size={13}/>}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {contextBanner.source === 'tenant-receipt'
                    ? <>Replying about <b>{contextBanner.propertyTitle}</b>{contextBanner.monthKey ? ` (${contextBanner.monthKey})` : ''}{contextBanner.receiptId ? ` · receipt ${contextBanner.receiptId}` : ''}</>
                    : <>Conversation about <b>{contextBanner.propertyTitle || 'this booking'}</b></>}
                </span>
                <button onClick={() => setContextBanner(null)} className="p-1 hover:bg-white rounded-full" aria-label="Dismiss">
                  <X size={12} className="text-gray-400"/>
                </button>
              </div>
            </div>
          )}

          {/* Pinned messages banner */}
          {pinnedMessages.length > 0 && (
            <div className="px-4 sm:px-6 pt-2">
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <Pin size={14} className="text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">
                    {t.chatPinnedLabel || 'Pinned'}{pinnedMessages.length > 1 ? ` · ${pinnedMessages.length}` : ''}
                  </p>
                  <p className="text-[11px] font-bold text-gray-600 truncate">
                    {replyPreviewText(pinnedMessages[pinnedMessages.length - 1])}
                  </p>
                </div>
                <button
                  onClick={() => handlePinMessage(pinnedMessages[pinnedMessages.length - 1])}
                  className="text-[9px] font-black uppercase tracking-widest text-amber-700 hover:underline shrink-0"
                >
                  {t.chatUnpin || 'Unpin'}
                </button>
              </div>
            </div>
          )}

          {/* Messages stream */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-b from-transparent via-white/10 to-white/40 relative">
            {groupedStream.length === 0 && !isBotTyping && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white flex items-center justify-center shadow-[0_15px_30px_rgba(186,0,54,0.25)] mb-4">
                  {activeChat.isAI ? <Bot size={28}/> : <MessageCircle size={28}/>}
                </div>
                <h4 className="text-lg font-black text-gray-900">
                  {activeChat.isAI ? (t.chatAskAnything || 'Ask me anything') : `${t.chatSayHiTo || 'Say hi to'} ${activeChat.name}`}
                </h4>
                <p className="text-[11px] font-bold text-gray-500 mt-1.5 max-w-[280px] leading-relaxed">
                  {activeChat.isAI
                    ? 'Try a smart-reply chip below — properties, rent, tours or contacting a landlord.'
                    : 'Send your first message — your phone number stays private until you choose to share it.'}
                </p>
              </div>
            )}

            {groupedStream.map((m) => {
              if (m.kind === 'divider') {
                return <DayDivider key={m.id} label={m.label}/>;
              }
              const mine = m.sender === 'me';

              if (m.kind === 'receipt') {
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}>
                    <ReceiptCard
                      receipt={m.receipt}
                      mine={mine}
                      onView={(r) => setActiveReceipt(r)}
                    />
                  </div>
                );
              }
              if (m.kind === 'call') {
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}>
                    <ChatCallCard
                      call={m.call}
                      mine={mine}
                      onCallBack={(c) => handleCallBack(c)}
                    />
                  </div>
                );
              }
              // Text / bot bubble → memoized component. Extracting it means the
              // whole list no longer re-renders when the long-press action sheet
              // opens (menuState is not one of its props), which kills the
              // long-press stutter. All its callbacks are useCallback-stable.
              return (
                <ChatMessageBubble
                  key={m.id}
                  m={m}
                  currentUserId={currentUserId}
                  onOpenMenu={openMessageMenu}
                  onOpenReactions={openReactions}
                  onReply={handleReply}
                  onMediaClick={openLightbox}
                />
              );
            })}

            {isBotTyping && <TypingDots name={activeChat.isAI ? "AI" : activeChat.name?.split(' ')[0]} />}
            <div ref={scrollRef} />
          </div>

          {/* Smart-reply chips */}
          {smartReplies.length > 0 && !isBotTyping && !activeChat.blocked && !activeChat.blockedByPeer && (
            <div className="px-4 sm:px-6 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
              {smartReplies.map(sr => (
                <button
                  key={sr.id}
                  onClick={() => sendMessageTo(activeChatId, sr.text)}
                  className="shrink-0 px-3.5 py-1.5 bg-white border border-gray-100 hover:border-[#ba0036]/30 hover:bg-[#ba0036]/5 text-gray-700 hover:text-[#ba0036] rounded-full text-[11px] font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <Sparkles size={10} className="text-amber-500"/>
                  {sr.text}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div
            className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 relative"
            style={mobileChatOpen ? { paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' } : undefined}
          >
            {activeChat.blocked ? (
              <div className="flex items-center justify-center gap-3 bg-gray-50 border border-gray-200 rounded-[1.6rem] px-4 py-3.5">
                <Ban size={16} className="text-gray-400 shrink-0" />
                <span className="text-[12px] font-bold text-gray-500">{(t.chatYouBlocked || 'You blocked')} {activeChat.name}</span>
                <button onClick={unblockChat} className="text-[11px] font-black uppercase tracking-widest text-[#ba0036] hover:underline">{t.chatUnblockShort || 'Unblock'}</button>
              </div>
            ) : activeChat.blockedByPeer ? (
              <div className="flex items-center justify-center gap-3 bg-gray-50 border border-gray-200 rounded-[1.6rem] px-4 py-3.5">
                <Ban size={16} className="text-gray-400 shrink-0" />
                <span className="text-[12px] font-bold text-gray-500 text-center">{t.chatCantReply || "You can't send messages to this contact."}</span>
              </div>
            ) : (
              <>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 mb-2 px-3 py-2 bg-white/95 border border-gray-100 rounded-2xl shadow-sm"
              >
                <CornerUpLeft size={15} className="text-[#ba0036] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#ba0036]">
                    Replying to {replyTo.sender === 'me' ? 'yourself' : activeChat.name}
                  </p>
                  <p className="text-[11px] font-bold text-gray-500 truncate">{replyPreviewText(replyTo)}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-100 rounded-full shrink-0" aria-label="Cancel reply">
                  <X size={13} className="text-gray-400" />
                </button>
              </motion.div>
            )}
            <div className="flex items-end gap-2 bg-white border border-white p-2 rounded-[1.6rem] shadow-[0_10px_25px_rgba(0,0,0,0.06)]">
              <button
                onClick={() => {
                  // Toggle the emoji panel. When opening, blur the input so the
                  // on-screen keyboard drops and the panel takes its place.
                  setShowEmojiPicker((s) => {
                    const next = !s;
                    if (next) inputRef.current?.blur();
                    return next;
                  });
                }}
                className={`shrink-0 p-2.5 rounded-xl transition-all ${showEmojiPicker ? 'bg-[#ba0036]/10 text-[#ba0036]' : 'text-gray-400 hover:text-[#ba0036] hover:bg-gray-50'}`}
                aria-label="Emoji"
              >
                <Smile size={18}/>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={handleFileChosen}
              />
              <div className="relative shrink-0">
                <button
                  onClick={handleAttachClick}
                  disabled={isUploadingMedia || isRecording}
                  className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${showAttachMenu ? 'bg-[#ba0036]/10 text-[#ba0036]' : 'text-gray-400 hover:text-[#ba0036] hover:bg-gray-50'}`}
                  aria-label="Attach"
                  title={t.attachTitle || 'Attach photo, video or PDF'}
                >
                  <Paperclip size={18}/>
                </button>
                {showAttachMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowAttachMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      className="absolute bottom-full left-0 mb-2 z-[61] w-48 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 p-1.5 origin-bottom-left"
                    >
                      <button
                        onClick={() => openPicker('image/*,video/*')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors text-[13px] font-bold text-gray-700"
                      >
                        <span className="w-8 h-8 rounded-lg bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0"><ImageIcon size={16}/></span>
                        {t.attachPhotoVideo || 'Photo & Video'}
                      </button>
                      <button
                        onClick={() => openPicker('application/pdf')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors text-[13px] font-bold text-gray-700"
                      >
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0"><FileText size={16}/></span>
                        {t.attachDocument || 'Document'}
                      </button>
                    </motion.div>
                  </>
                )}
              </div>
              {isRecording ? (
                /* Recording in progress — replace the textarea with a live indicator.
                   min-w-0 lets this middle area shrink so the Cancel/Send buttons
                   on the right always stay on-screen (they were being pushed off). */
                <div className="flex-1 min-w-0 flex items-center gap-2.5 py-2 px-1">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-sm font-black text-gray-700 tabular-nums shrink-0">
                    {String(Math.floor(recordSecs / 60)).padStart(1, '0')}:{String(recordSecs % 60).padStart(2, '0')}
                  </span>
                  {/* Live waveform line while recording (min-w-0 → clips instead of overflowing) */}
                  <div className="flex-1 min-w-0 flex items-center gap-[3px] h-6 overflow-hidden">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <span
                        key={i}
                        className="flex-1 min-w-[2px] bg-[#ba0036]/60 rounded-full animate-pulse"
                        style={{ height: `${25 + ((i * 37) % 75)}%`, animationDelay: `${(i % 6) * 90}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <textarea
                  ref={inputRef}
                  rows="1"
                  value={inputText}
                  onChange={(e) => {
                    handleTyping(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                  }}
                  onBlur={() => {
                    const chat = chats.find(c => c.id === activeChatId);
                    if (chat && chat.peerUserId) {
                      const socket = callProvider.getSocket();
                      if (socket) socket.emit('TYPING_STOP', { receiverId: chat.peerUserId });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder={activeChat.isAI ? (t.chatAskAI || 'Ask the AI assistant anything…') : (t.chatTypeMessage || 'Type a message…')}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-gray-800 resize-none py-2 max-h-[120px] leading-relaxed placeholder:text-gray-400"
                />
              )}
              {isRecording ? (
                /* Cancel + Send buttons while recording */
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => stopRecording(false)}
                    className="w-11 h-11 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl flex items-center justify-center transition-all active:scale-95"
                    aria-label="Cancel recording"
                    title="বাতিল"
                  >
                    <X size={18}/>
                  </button>
                  <button
                    onClick={() => stopRecording(true)}
                    className="w-11 h-11 bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white rounded-xl flex items-center justify-center shadow-[0_8px_20px_rgba(186,0,54,0.30)] transition-all active:scale-95"
                    aria-label="Send voice message"
                    title="পাঠান"
                  >
                    <Send size={18} className="ml-0.5"/>
                  </button>
                </div>
              ) : isUploadingMedia ? (
                /* Upload spinner */
                <div className="w-11 h-11 shrink-0 bg-gray-100 rounded-xl flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-[#ba0036] rounded-full animate-spin" />
                </div>
              ) : (
                /* ── Fixed-width action slot ──────────────────────────────────
                   Send + Mic are BOTH absolutely positioned inside one w-11 h-11
                   box and cross-fade in place. Toggling between them (typing /
                   clearing text) therefore never changes the slot's width, so the
                   textarea never shifts. */
                <div className="relative w-11 h-11 shrink-0">
                  {/* Send — visible only when there's text */}
                  <button
                    onClick={handleSendMessage}
                    tabIndex={inputText.trim() ? 0 : -1}
                    className={`absolute inset-0 w-11 h-11 bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white rounded-xl flex items-center justify-center shadow-[0_8px_20px_rgba(186,0,54,0.30)] transition-all duration-150 active:scale-95 ${
                      inputText.trim() ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                    }`}
                    aria-label="Send"
                  >
                    <Send size={18} className="ml-0.5"/>
                  </button>
                  {/* Mic — visible only when empty (disabled for the AI bot) */}
                  <button
                    onClick={activeChat.isAI ? undefined : startRecording}
                    disabled={activeChat.isAI}
                    tabIndex={inputText.trim() ? -1 : 0}
                    className={`absolute inset-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 ${
                      inputText.trim() ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                    } ${activeChat.isAI ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-[#ba0036]'}`}
                    aria-label={activeChat.isAI ? 'Voice message unavailable' : 'Record voice message'}
                    title={activeChat.isAI ? 'Voice message is for chats with people' : 'ভয়েস মেসেজ'}
                  >
                    <Mic size={18}/>
                  </button>
                </div>
              )}
            </div>

            {/* Emoji / Sticker / GIF panel — full-width, sits where the keyboard
                would be (WhatsApp style). Stickers + GIFs send immediately. */}
            {showEmojiPicker && (
              <div className="-mx-4 sm:-mx-6 mt-2 rounded-t-2xl overflow-hidden shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
                <EmojiPicker
                  open={showEmojiPicker}
                  onClose={() => setShowEmojiPicker(false)}
                  onPickEmoji={insertEmoji}
                  onSendSticker={(e) => sendMessageTo(activeChatId, e)}
                  onSendGif={(url) => sendMessageTo(activeChatId, url)}
                />
              </div>
            )}

            {!inputText && !isMobile && !showEmojiPicker && (
              <p className="text-center text-[9px] font-black text-gray-300 uppercase tracking-[0.18em] mt-2.5">
                Enter to send · Shift + Enter for new line · Esc to close call
              </p>
            )}
              </>
            )}
          </div>

          {/* PIN lock overlay — hides the thread until the correct PIN is
              entered (unlock is remembered for this session only). */}
          {activeLocked && (
            <ChatPinLock
              chatName={activeChat.name}
              mode="unlock"
              verify={(pin) => verifyPin(activeChatId, pin)}
              onUnlocked={() => setPinUnlocked(prev => ({ ...prev, [activeChatId]: true }))}
              onCancel={() => { if (isMobile) setShowSidebarMobile(true); else setActiveChatId('ai-bot'); }}
            />
          )}
          {/* PIN setup overlay — shown while turning ON privacy for this chat. */}
          {pinSetupFor === activeChatId && (
            <ChatPinLock
              chatName={activeChat.name}
              mode="set"
              onDone={savePin}
              onCancel={() => setPinSetupFor(null)}
            />
          )}
        </main>

        {/* The old desktop (i) info pane was removed. Its contents now live in
            the Contact tab: Shared media → ChatMediaViewer (Media/Links/Docs),
            Lock chat with PIN → ViewContactModal, Report/Block → header menu +
            ViewContactModal. Receipts still render inline in the thread. */}
      </div>

      {/* RECEIPT DETAIL MODAL */}
      <AnimatePresence>
        {activeReceipt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-gray-900/40 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setActiveReceipt(null)}
          >
            <motion.div
              initial={{ y: 20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.96 }}
              className="bg-white rounded-[2rem] w-full max-w-md shadow-[0_30px_80px_rgba(0,0,0,0.2)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className={`p-6 text-white relative overflow-hidden ${
                (activeReceipt.status === 'full' || (Number(activeReceipt.balance) || 0) <= 0)
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gradient-to-br from-amber-500 to-orange-600'
              }`}>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="absolute top-4 right-4 p-2 bg-white/15 hover:bg-white/25 rounded-full transition-all"
                >
                  <X size={16}/>
                </button>
                <div className="relative">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30 shadow-lg">
                    {(activeReceipt.status === 'full' || (Number(activeReceipt.balance) || 0) <= 0)
                      ? <CheckCheck size={26} strokeWidth={3}/>
                      : <Hourglass size={26} strokeWidth={2.5}/>}
                  </div>
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Digital Rent Receipt</p>
                  <h3 className="text-2xl font-black tracking-tight">{formatBDT(activeReceipt.totalPaid)}</h3>
                  <p className="text-[11px] font-bold text-white/80 mt-1">
                    {(activeReceipt.status === 'full' || (Number(activeReceipt.balance) || 0) <= 0)
                      ? 'Full payment confirmed'
                      : 'Partial payment recorded'}
                  </p>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {[
                  ['Property', activeReceipt.propertyTitle],
                  ['Month', activeReceipt.monthLabel || activeReceipt.monthKey],
                  ['Total Due', formatBDT(activeReceipt.totalDue)],
                  ['Total Paid', formatBDT(activeReceipt.totalPaid)],
                  ['Balance', (Number(activeReceipt.balance) || 0) > 0 ? formatBDT(activeReceipt.balance) : 'Cleared'],
                  ['Method', activeReceipt.method ? `${activeReceipt.method}${activeReceipt.txnId ? ' · ' + activeReceipt.txnId : ''}` : '—'],
                  ['Date', activeReceipt.date],
                  ['Receipt ID', activeReceipt.id],
                ].map(([k, v], i, a) => (
                  <div key={k} className={`flex justify-between items-center py-2 ${i < a.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{k}</span>
                    <span className={`text-sm font-black text-right max-w-[220px] ${k === 'Balance' && (Number(activeReceipt.balance) || 0) > 0 ? 'text-[#ba0036]' : k === 'Balance' ? 'text-green-600' : 'text-gray-900'} ${k === 'Receipt ID' ? 'font-mono text-[11px]' : ''}`}>
                      {v}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const text = [
                      'TO-LET PRO Rent Receipt',
                      `Property: ${activeReceipt.propertyTitle}`,
                      `Month: ${activeReceipt.monthLabel || activeReceipt.monthKey}`,
                      `Total Due: ${formatBDT(activeReceipt.totalDue)}`,
                      `Total Paid: ${formatBDT(activeReceipt.totalPaid)}`,
                      `Balance: ${(Number(activeReceipt.balance) || 0) > 0 ? formatBDT(activeReceipt.balance) : 'Cleared'}`,
                      `Method: ${activeReceipt.method || '—'}${activeReceipt.txnId ? ' · Txn ' + activeReceipt.txnId : ''}`,
                      `Date: ${activeReceipt.date}`,
                      `Receipt ID: ${activeReceipt.id}`,
                    ].join('\n');
                    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `receipt-${activeReceipt.id}.txt`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full mt-2 py-3 bg-gray-900 hover:bg-[#ba0036] text-white rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14}/> Download receipt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Phase Call-4: call detail modal (tap a row in the Calls tab) */}
      {selectedCall && (
        <CallDetailModal
          call={selectedCall}
          calls={callHistory}
          onClose={() => setSelectedCall(null)}
          onCall={(type) => callPeerFromDetail(selectedCall.peer, type)}
          onMessage={() => messagePeer(selectedCall.peer)}
          onViewProfile={selectedCall.peer?.id ? () => viewPeerProfile(selectedCall.peer) : undefined}
        />
      )}

      {/* Quick-emoji reaction bar (long-press or the reaction button). Its "⋯"
          hands off to the actions menu below. */}
      <ReactionBar
        open={!!reactionBar}
        x={reactionBar?.x || 0}
        y={reactionBar?.y || 0}
        current={reactionBar?.message?.reactions?.[currentUserId] || null}
        onReact={(emoji) => reactionBar && toggleReaction(reactionBar.message, emoji)}
        onMore={() => reactionBar && openMessageMenu(reactionBar.message, reactionBar.x, reactionBar.y)}
        onClose={() => setReactionBar(null)}
      />

      {/* Actions menu (3-dot button / right-click / reaction-bar "⋯"):
          Reply · Copy · Forward · Pin · Mute · Remove. */}
      <MessageActionsMenu
        open={!!menuState}
        x={menuState?.x || 0}
        y={menuState?.y || 0}
        mine={menuState?.message?.sender === 'me'}
        canCopy={!menuState?.message?.type || menuState?.message?.type === 'text'}
        pinned={menuState?.message ? (activeChat.pinnedMessageIds || []).map(String).includes(String(menuState.message.id)) : false}
        muted={!!activeChat.muted}
        labels={{
          reply: t.msgReply || 'Reply',
          forward: t.msgForward || 'Forward',
          copy: t.msgCopy || 'Copy',
          pin: t.msgPin || 'Pin',
          unpin: t.msgUnpin || 'Unpin',
          mute: t.msgMute || 'Mute',
          unmute: t.msgUnmute || 'Unmute',
          remove: t.msgRemove || 'Remove',
        }}
        onReply={() => menuState && handleReply(menuState.message)}
        onForward={() => menuState && handleForward(menuState.message)}
        onCopy={() => menuState && handleCopyMessage(menuState.message)}
        onPin={activeChat.isAI ? undefined : () => menuState && handlePinMessage(menuState.message)}
        onMute={activeChat.isAI ? undefined : () => (activeChat.muted ? toggleMuteChat() : setShowMuteModal(true))}
        onDelete={() => menuState && handleRemoveMessage(menuState.message)}
        onClose={() => setMenuState(null)}
      />

      {/* Block confirmation modal (requires a reason) */}
      <BlockUserModal
        open={showBlockModal}
        name={activeChat?.name}
        onCancel={() => setShowBlockModal(false)}
        onConfirm={(reason) => blockChat(reason)}
      />

      {/* WhatsApp-style "Contact info" (opened by tapping the header avatar/name) */}
      <ViewContactModal
        open={showContactModal}
        contact={{
          name: activeChat?.name,
          avatar: activeChat?.avatar,
          role: activeChat?.role,
          phone: activeChat?.tenantPhone,
          propertyTitle: activeChat?.propertyTitle,
          peerUserId: activeChat?.peerUserId,
        }}
        muted={activeChat?.muted}
        blocked={activeChat?.blocked}
        mediaCount={(messages[activeChatId] || []).filter(m => m.mediaUrl).length}
        onClose={() => setShowContactModal(false)}
        onVoiceCall={activeChat?.peerUserId ? () => placeCall({ peerUserId: activeChat.peerUserId, peerName: activeChat.name, peerAvatar: activeChat.avatar, type: 'voice' }) : undefined}
        onVideoCall={activeChat?.peerUserId ? () => placeCall({ peerUserId: activeChat.peerUserId, peerName: activeChat.name, peerAvatar: activeChat.avatar, type: 'video' }) : undefined}
        onViewProfile={activeChat?.peerUserId ? () => {
          // Route paths are /landlord/:id and /tenant/:id (there is no /host/:id).
          if (activeChat.role === 'Property Owner' || activeChat.role === 'Landlord') navigate(`/landlord/${activeChat.peerUserId}`);
          else navigate(`/tenant/${activeChat.peerUserId}`);
        } : undefined}
        onOpenMedia={() => { setShowContactModal(false); setShowMediaViewer(true); }}
        onMute={() => (activeChat?.muted ? toggleMuteChat() : setShowMuteModal(true))}
        onBlock={() => (activeChat?.blocked ? unblockChat() : setShowBlockModal(true))}
        onReport={() => setShowReportModal(true)}
        locked={!!chatLocks[activeChatId]}
        onToggleLock={activeChat?.isAI ? undefined : () => (chatLocks[activeChatId] ? disablePin() : beginPinSetup())}
      />

      {/* Media / Links / Docs viewer (opened from the Contact tab) */}
      <ChatMediaViewer
        open={showMediaViewer}
        onClose={() => setShowMediaViewer(false)}
        messages={messages[activeChatId] || []}
        contactName={activeChat?.name}
      />

      {/* In-app media lightbox — opens photos / videos / PDFs OVER the chat
          instead of a new browser tab. */}
      <MediaLightbox open={!!lightbox} media={lightbox} onClose={() => setLightbox(null)} />

      {/* Chat-list row context menu (long-press mobile / right-click desktop) */}
      <ChatListItemMenu
        open={!!listMenu}
        x={listMenu?.x || 0}
        y={listMenu?.y || 0}
        pinned={!!listMenu?.chat?.pinned}
        muted={!!listMenu?.chat?.muted}
        labels={{
          pin: t.msgPin || 'Pin',
          unpin: t.msgUnpin || 'Unpin',
          mute: t.msgMute || 'Mute',
          unmute: t.msgUnmute || 'Unmute',
          remove: t.msgRemove || 'Remove',
        }}
        onPin={() => listMenu && pinChatRow(listMenu.chat)}
        onMute={() => listMenu && muteChatRow(listMenu.chat)}
        onRemove={() => listMenu && handleDeleteConversation(listMenu.chat)}
        onClose={() => setListMenu(null)}
      />

      {/* Mute notifications (8 hours / 1 week / Always) */}
      <MuteNotificationsModal
        open={showMuteModal}
        name={activeChat?.name}
        onCancel={() => setShowMuteModal(false)}
        onConfirm={(duration) => muteChatFor(duration)}
      />

      {/* Report confirmation */}
      <ReportContactModal
        open={showReportModal}
        name={activeChat?.name}
        onCancel={() => setShowReportModal(false)}
        onConfirm={(reason) => submitReport(reason || 'Reported from chat')}
      />

      {/* Forward picker */}
      <AnimatePresence>
        {forwardMsg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setForwardMsg(null)}
          >
            <motion.div
              initial={{ y: 20, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, scale: 0.96, opacity: 0 }}
              className="bg-white rounded-[1.75rem] w-full max-w-sm shadow-[0_30px_80px_rgba(0,0,0,0.25)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-black text-gray-900">{t.chatForwardTo || 'Forward to…'}</h3>
                <button onClick={() => setForwardMsg(null)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400"><X size={16}/></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {forwardTargets.length === 0 ? (
                  <p className="text-[12px] font-bold text-gray-400 text-center py-8">{t.chatNoForwardTargets || 'No other chats to forward to.'}</p>
                ) : forwardTargets.map(c => (
                  <button
                    key={c.id}
                    onClick={() => forwardTo(c.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-gray-50 transition-colors text-left"
                  >
                    {c.avatar ? (
                      <img src={c.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-700 font-black text-xs">
                        {(c.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-gray-900 truncate">{c.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 truncate">{c.role || 'Conversation'}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatSystem;
