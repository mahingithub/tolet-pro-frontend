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
  BellOff, Ban, Flag, CornerUpLeft, Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../services/chatService';
import { getCurrentUser } from '../services/authService';
import { listTenantReceipts, listHostReceipts } from '../services/receiptService';
import callProvider from '../services/callProvider';
import { getCurrentToken } from '../services/authService';
import callService from '../services/callService';
import CallHistory from './CallHistory';
import CallQualityOverlay from './CallQualityOverlay';
import CallDetailModal from './CallDetailModal';
// ── Chat UX upgrade: modular pieces that plug into this existing component ──
import CompactAudioPlayer from './CompactAudioPlayer';
import MessageActionsMenu from './MessageActionsMenu';
import BlockUserModal from './BlockUserModal';
import ChatPinLock from './ChatPinLock';
// ── WhatsApp-style header menu, contact/mute/report modals + reactions ──────
import ChatHeaderMenu from './ChatHeaderMenu';
import ViewContactModal from './ViewContactModal';
import MuteNotificationsModal from './MuteNotificationsModal';
import ReportContactModal from './ReportContactModal';
import ReactionBar from './ReactionBar';
import EmojiPicker from './EmojiPicker';

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
const ChatRow = ({ chat, lastMsg, isActive, onClick, isMobile }) => {
  const initials = (chat.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 sm:p-4 rounded-2xl flex items-center gap-3 border transition-all active:scale-[0.99] ${
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
        {chat.status === 'online' && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
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
            {lastMsg?.iso ? formatTime(lastMsg.iso) : chat.time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[11px] truncate ${chat.unread > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-500'}`}>
            {lastMsg?.preview || chat.lastMsg}
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
};

// ─── Main ChatSystem component ──────────────────────────────────────────────
const ChatSystem = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const peerUserId = location.state?.peerUserId;

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
  const [menuState, setMenuState]   = useState(null);   // { message, x, y } for the long-press menu
  const [replyTo, setReplyTo]       = useState(null);   // message currently being replied to
  const [forwardMsg, setForwardMsg] = useState(null);   // message currently being forwarded
  const [showBlockModal, setShowBlockModal] = useState(false);
  // WhatsApp-style header dropdown + its action modals.
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showMuteModal, setShowMuteModal]       = useState(false);
  const [showReportModal, setShowReportModal]   = useState(false);
  // Emoji reactions persist + sync via the backend (Message.reactions +
  // MESSAGE_REACTION socket). They live on each message object as
  // m.reactions = { userId: emoji }; this state only drives the floating bar.
  const [reactionBar, setReactionBar] = useState(null); // { message, x, y }
  // Per-chat PIN privacy. `chatLocks` persists { chatId: pinHash } to localStorage;
  // `pinUnlocked` is per-session (unlock is forgotten on reload); `pinSetupFor`
  // holds the chatId whose PIN is currently being set.
  const [chatLocks, setChatLocks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_LOCKS_KEY)) || {}; } catch { return {}; }
  });
  const [pinUnlocked, setPinUnlocked] = useState({});
  const [pinSetupFor, setPinSetupFor] = useState(null);
  const longPressRef = useRef(null);   // long-press timer
  const pressPosRef  = useRef(null);   // pointer start position (move tolerance)

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

    socket.on('MESSAGE_DELIVERED', onDelivered);
    socket.on('MESSAGE_SEEN', onSeen);
    socket.on('MESSAGE_DELETED', onMessageDeleted);
    socket.on('MESSAGE_REACTION', onReaction);
    socket.on('USER_TYPING', onTyping);
    socket.on('USER_STOPPED_TYPING', onStopTyping);

    return () => {
      socket.off('MESSAGE_DELIVERED', onDelivered);
      socket.off('MESSAGE_SEEN', onSeen);
      socket.off('MESSAGE_DELETED', onMessageDeleted);
      socket.off('MESSAGE_REACTION', onReaction);
      socket.off('USER_TYPING', onTyping);
      socket.off('USER_STOPPED_TYPING', onStopTyping);
    };
  }, [activeChatId, chats]);

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
    setChats((prev) => {
      // Build a map of existing local UI state (blocked, muted, pinned) keyed by id
      // so polling never wipes out what the user just set in this session.
      const localState = new Map(prev.map((c) => [c.id, {
        blocked: c.blocked,
        muted:   c.muted,
        pinned:  c.pinned,
      }]));

      const next = [...initialChats];
      // Anything in `prev` that's a backend convo (id is not 'ai-bot') will be
      // refreshed from `list`. AI bot + any in-flight dynamic threads stay.
      const aiAndDynamic = prev.filter(
        (c) => c.id === 'ai-bot' || !list.find((b) => b.id === c.id),
      );
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
          status:    'online',
          lastMsg:   b.lastMessageText || 'New conversation',
          time:      b.lastMessageAt ? new Date(b.lastMessageAt).toISOString() : 'Just now',
          unread:    Number(b.unread) || 0,
          // Preserve local UI toggles so polling doesn't revert block/mute/pin.
          pinned:    ls.pinned  ?? false,
          blocked:   ls.blocked ?? (b.blocked   || false),
          muted:     ls.muted   ?? (b.muted     || false),
          peerUserId: b.peerUserId,
          propertyId: b.propertyId,
        });
      }
      return next;
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

  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const handledStateRef = useRef(null);

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
      (async () => {
        try {
          const me = getCurrentUser();
          const myId = String(me?.id || me?._id || '');
          if (String(s.peerUserId) === myId) {
            toast.error('নিজের সাথে চ্যাট বা কল করা যায় না।');
            return;
          }
          const convo = await chatService.openConversation({
            peerUserId: s.peerUserId,
            propertyId: s.propertyId,
          });
          if (!convo?.id) return;
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
        }
      })();
      return;
    }

    // 3. Legacy free-form chatId path — just open call/banner UI without
    //    activating a thread (we have no peer mapping for it).
    if (s.chatId) {
      if (s.mode === 'call') {
                      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

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

  // Paperclip → open file picker.
  const handleAttachClick = () => {
    if (activeChat.isAI) return;        // can't send media to the AI bot
    if (isUploadingMedia) return;
    fileInputRef.current?.click();
  };

  // A file was chosen → validate + upload as an image message.
  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                // reset so the same file can be re-picked
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf   = file.type === 'application/pdf';
    if (!isImage && !isPdf) { alert('শুধু ছবি বা PDF পাঠানো যাবে।'); return; }
    if (file.size > 10 * 1024 * 1024)  { alert('ফাইল অনেক বড় (সর্বোচ্চ ১০ MB)।'); return; }

    setIsUploadingMedia(true);
    try {
      const saved = await chatService.sendMediaMessage(activeChatId, file, {
        kind: isPdf ? 'document' : 'image',
        filename: file.name,
      });
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
    try { await chatService.reportConversation?.(activeChatId, reason); } catch (e) { console.warn('report failed', e); }
    setReportSent(true);
    toast.success('Report submitted. Thank you.');
  };

  // ── Emoji reactions (opened by long-press / hover on a bubble) ─────────────
  const openReactions = (message, x, y) => {
    if (!message || message.isDeleted) return;
    setReactionBar({ message, x, y });
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

  // ── Message long-press / context menu (Reply · Forward · Delete) ───────────
  const openMessageMenu = (message, x, y) => setMenuState({ message, x, y });

  // Cancel a pending long-press (used when a swipe/drag starts or pointer lifts).
  const cancelLongPress = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  };

  // Handlers spread onto each text/media bubble. Long-press (touch) or
  // right-click (desktop) opens the REACTION BAR (which itself has a "more"
  // button → Reply/Forward/Delete). A >10px move cancels it so scrolling and
  // swipe-to-reply never trigger it.
  const bubblePressHandlers = (m) => ({
    onContextMenu: (e) => { e.preventDefault(); openReactions(m, e.clientX, e.clientY); },
    onPointerDown: (e) => {
      pressPosRef.current = { x: e.clientX, y: e.clientY };
      if (longPressRef.current) clearTimeout(longPressRef.current);
      longPressRef.current = setTimeout(() => openReactions(m, pressPosRef.current.x, pressPosRef.current.y), 450);
    },
    onPointerMove: (e) => {
      const p = pressPosRef.current;
      if (p && longPressRef.current && (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10)) {
        clearTimeout(longPressRef.current); longPressRef.current = null;
      }
    },
    onPointerUp:    () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } },
    onPointerLeave: () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } },
  });

  const handleReply = (m) => { setReplyTo(m); setTimeout(() => inputRef.current?.focus(), 30); };
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
      toast.error('Delete করা যায়নি।');
    }
  };
  const forwardTo = (targetChatId) => {
    const m = forwardMsg;
    setForwardMsg(null);
    if (!m || !targetChatId) return;
    // Media has no re-upload path, so forward its link; text forwards as-is.
    const body = (m.type && m.type !== 'text') ? (m.mediaUrl || replyPreviewText(m)) : (parseReplyQuote(m.text)?.body || m.text);
    sendMessageTo(targetChatId, body);
    setActiveChatId(targetChatId);
    if (isMobile) setShowSidebarMobile(false);
    toast.success('Message forwarded');
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
    const base = (messages[activeChatId] || []).map(m => ({ kind: 'text', ...m }));
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
  }, [messages, activeChatId, paymentReceipts, callHistory, activeChat]);

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

  const bubbleRadius = (mine, position) => {
    if (position === 'solo')   return mine ? 'rounded-3xl rounded-tr-md'    : 'rounded-3xl rounded-tl-md';
    if (position === 'first')  return mine ? 'rounded-3xl rounded-tr-md'    : 'rounded-3xl rounded-tl-md';
    if (position === 'middle') return mine ? 'rounded-l-3xl rounded-r-md'   : 'rounded-r-3xl rounded-l-md';
    if (position === 'last')   return mine ? 'rounded-3xl rounded-br-md'    : 'rounded-3xl rounded-bl-md';
    return 'rounded-3xl';
  };

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
                {sidebarTab === 'messages' ? 'Messages' : 'Calls'}
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
                Chats
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
                Calls
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
                      placeholder={sidebarTab === 'messages' ? 'Search chats…' : 'Search calls…'}
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
                  const stream = messages[chat.id] || [];
                  const last = stream[stream.length - 1];
                  const lastMsg = last
                    ? { iso: last.iso, preview: last.sender === 'me' ? `You: ${last.text}` : last.text }
                    : null;
                  return (
                    <ChatRow
                      key={chat.id}
                      chat={chat}
                      lastMsg={lastMsg}
                      isActive={activeChatId === chat.id}
                      isMobile={isMobile}
                      onClick={() => {
                        setActiveChatId(chat.id);
                        if (isMobile) setShowSidebarMobile(false);
                      }}
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
                  onClick={() => { setShowInfoPane(false); setShowSidebarMobile(true); }}
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
                <div className={`w-11 h-11 rounded-2xl overflow-hidden shrink-0 shadow-sm ${!activeChat.isAI && activeChat.peerUserId ? 'group-hover:scale-105 transition-transform' : ''}`}>
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
                <div className="min-w-0">
                  <h3 className={`text-base sm:text-lg font-black text-gray-900 truncate ${!activeChat.isAI && activeChat.peerUserId ? 'group-hover:text-blue-600 transition-colors' : ''}`}>
                    {activeChat.name}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-green-600 truncate">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0"></span>
                    {activeChat.role || 'Online'}{activeChat.tenantPhone ? ` · ${activeChat.tenantPhone}` : ''}
                  </p>
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
              {!isMobile && (
                <button
                  onClick={() => setShowInfoPane(s => !s)}
                  className={`p-2.5 sm:p-3 rounded-2xl transition-all shadow-sm ${
                    showInfoPane ? 'bg-[#ba0036] text-white' : 'bg-white hover:bg-red-50 text-gray-500 hover:text-[#ba0036]'
                  }`}
                  aria-label="Toggle info pane"
                >
                  <Info size={18}/>
                </button>
              )}
              {/* 3-dots → WhatsApp-style dropdown. For the AI bot (no block/report/
                  mute) it just opens the info pane instead. */}
              {activeChat.isAI ? (
                <button
                  onClick={() => setShowInfoPane(s => !s)}
                  className="p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-red-50 text-gray-500 hover:text-[#ba0036] transition-all shadow-sm"
                  aria-label="Contact info"
                >
                  <MoreVertical size={18}/>
                </button>
              ) : (
                <div className="relative">
                  <button
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
                    muted={activeChat.muted}
                    blocked={activeChat.blocked}
                    onClose={() => setHeaderMenuOpen(false)}
                    onViewContact={() => setShowContactModal(true)}
                    onMute={() => (activeChat.muted ? toggleMuteChat() : setShowMuteModal(true))}
                    onReport={() => setShowReportModal(true)}
                    onBlock={() => (activeChat.blocked ? unblockChat() : setShowBlockModal(true))}
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

          {/* Messages stream */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-b from-transparent via-white/10 to-white/40 relative">
            {groupedStream.length === 0 && !isBotTyping && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white flex items-center justify-center shadow-[0_15px_30px_rgba(186,0,54,0.25)] mb-4">
                  {activeChat.isAI ? <Bot size={28}/> : <MessageCircle size={28}/>}
                </div>
                <h4 className="text-lg font-black text-gray-900">
                  {activeChat.isAI ? 'Ask me anything' : `Say hi to ${activeChat.name}`}
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
              const fromBot = m.sender === 'bot';
              const showTail = m.position === 'last' || m.position === 'solo';

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
              return (
                <div key={m.id} className={`group/msg flex items-center ${mine ? 'justify-end' : 'justify-start'} ${m.position === 'middle' ? 'mb-0.5' : 'mb-2'}`}>
                  {/* Swipe-right-to-reply: the bubble is a horizontally draggable
                      motion.div. Drag past ~60px and release → reply. A reply
                      arrow fades in behind it as you pull. dragDirectionLock lets
                      vertical scrolling still work. */}
                  {!m.isDeleted && !mine && (
                    <CornerUpLeft size={16} className="text-[#ba0036] opacity-0 group-active/msg:opacity-60 mr-1 shrink-0 transition-opacity" />
                  )}
                  <motion.div
                    {...bubblePressHandlers(m)}
                    drag={m.isDeleted ? false : 'x'}
                    dragDirectionLock
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0, right: 0.55 }}
                    dragSnapToOrigin
                    onDragStart={cancelLongPress}
                    onDragEnd={(_e, info) => { if (info.offset.x > 60) handleReply(m); }}
                    className={`relative max-w-[78%] sm:max-w-[68%] ${bubbleRadius(mine, m.position)} px-3.5 py-2.5 select-none cursor-default transition-shadow shadow-[0_2px_10px_-3px_rgba(0,0,0,0.12)] ${
                    mine
                      ? 'bg-gradient-to-br from-[#ba0036] to-[#a30030] text-white'
                      : fromBot
                        ? 'bg-gradient-to-br from-gray-900 to-[#1a1a1f] text-white'
                        : 'bg-white text-gray-800 border border-gray-100 ring-1 ring-black/[0.02]'
                  }`}>
                    {fromBot && m.position !== 'middle' && m.position !== 'last' && (
                      <div className="flex items-center gap-1.5 mb-1 text-[9px] font-black text-white/60 uppercase tracking-widest">
                        <Sparkles size={10}/> AI Assistant
                      </div>
                    )}
                    {m.isDeleted ? (
                      <p className={`text-[13px] italic font-medium inline-flex items-center gap-1.5 ${mine || fromBot ? 'text-white/70' : 'text-gray-400'}`}>
                        <Ban size={13} className="shrink-0" /> This message was deleted
                      </p>
                    ) : (
                    <>
                    {m.type === 'image' && m.mediaUrl ? (
                      <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={m.mediaUrl}
                          alt="shared"
                          className="rounded-xl max-w-full max-h-72 object-cover cursor-pointer"
                          loading="lazy"
                        />
                      </a>
                    ) : m.type === 'audio' && m.mediaUrl ? (
                      <CompactAudioPlayer src={m.mediaUrl} mine={mine || fromBot} durationSec={m.mediaMeta?.durationSec} />
                    ) : m.type === 'document' && m.mediaUrl ? (
                      <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-xl border ${mine ? 'bg-white/10 border-white/20 hover:bg-white/20' : fromBot ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} transition-all max-w-[240px] sm:max-w-[280px] group`}>
                        <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${mine || fromBot ? 'bg-white/20 text-white' : 'bg-[#ba0036]/10 text-[#ba0036]'}`}>
                          <FileText size={20} className="group-hover:scale-110 transition-transform"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-bold truncate leading-tight mb-0.5 ${mine || fromBot ? 'text-white' : 'text-gray-800'}`}>
                            {m.mediaMeta?.originalName || 'Document.pdf'}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className={`text-[9px] font-black uppercase tracking-widest ${mine || fromBot ? 'text-white/60' : 'text-gray-400'}`}>
                              {m.mediaMeta?.bytes ? (m.mediaMeta.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'PDF FILE'}
                            </p>
                            <Download size={12} className={`${mine || fromBot ? 'text-white/80' : 'text-gray-400'} group-hover:-translate-y-0.5 transition-transform`} />
                          </div>
                        </div>
                      </a>
                    ) : null}
                    {(m.type === 'text' || !m.type) ? (() => {
                      // Prefer the structured backend replyTo; fall back to the
                      // legacy "> quote" text encoding for messages sent earlier.
                      const legacy = m.replyTo ? null : parseReplyQuote(m.text);
                      const quote = m.replyTo ? replyQuoteLabel(m.replyTo) : (legacy ? legacy.quote : null);
                      const body = legacy ? legacy.body : m.text;
                      return (
                        <>
                          {quote && (
                            <div className={`mb-1.5 rounded-lg px-2.5 py-1.5 border-l-[3px] ${
                              mine ? 'bg-white/15 border-white/60' : fromBot ? 'bg-white/10 border-white/40' : 'bg-gray-50 border-[#ba0036]/50'
                            }`}>
                              <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${mine || fromBot ? 'text-white/70' : 'text-[#ba0036]'}`}>Reply</p>
                              <p className={`text-[11px] font-medium line-clamp-2 ${mine || fromBot ? 'text-white/80' : 'text-gray-500'}`}>{quote}</p>
                            </div>
                          )}
                          {isImageUrl(body) ? (
                            <a href={body} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={body} alt="gif" loading="lazy" className="rounded-xl max-w-full max-h-72 object-cover" />
                            </a>
                          ) : (
                            <p className={isJumboEmoji(body)
                              ? 'text-5xl leading-tight'
                              : 'text-[13px] sm:text-sm font-medium whitespace-pre-line leading-relaxed'}>{body}</p>
                          )}
                        </>
                      );
                    })() : (m.text ? (
                      <p className="text-[13px] sm:text-sm font-medium whitespace-pre-line leading-relaxed mt-1.5">{m.text}</p>
                    ) : null)}
                    </>
                    )}
                    {showTail && (
                      <div className={`flex items-center gap-1.5 mt-1 ${mine ? 'justify-end text-white/70' : fromBot ? 'justify-start text-white/50' : 'justify-start text-gray-400'}`}>
                        <span className="text-[9px] font-bold tabular-nums">{formatTime(m.iso)}</span>
                        {mine && (
                          m.status === 'read'      ? <CheckCheck size={11} className="text-blue-200"/>
                          : m.status === 'delivered' ? <CheckCheck size={11}/>
                          : m.status === 'queued' ? <Hourglass size={11} className="opacity-70"/>
                          : m.status === 'failed' ? <X size={11} className="text-red-300"/>
                          : <Check size={11}/>
                        )}
                      </div>
                    )}
                    {/* Emoji reaction chip — aggregated from all users, at the corner. */}
                    {m.reactions && Object.keys(m.reactions).length > 0 && (() => {
                      const all = Object.values(m.reactions);
                      const unique = [...new Set(all)];
                      return (
                        <span className={`absolute -bottom-2.5 ${mine ? 'right-2' : 'left-2'} bg-white rounded-full shadow-md border border-gray-100 px-1.5 py-0.5 text-[13px] leading-none z-10 flex items-center gap-0.5`}>
                          {unique.slice(0, 3).map((e, i) => <span key={i}>{e}</span>)}
                          {all.length > 1 && <span className="text-[10px] font-black text-gray-500 ml-0.5">{all.length}</span>}
                        </span>
                      );
                    })()}
                  </motion.div>
                  {/* Desktop hover affordance → opens the reaction bar. */}
                  {!m.isDeleted && (
                    <button
                      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openReactions(m, r.left + r.width / 2, r.top); }}
                      className="hidden sm:group-hover/msg:flex w-7 h-7 rounded-full bg-white shadow-sm border border-gray-100 items-center justify-center text-gray-400 hover:text-[#ba0036] shrink-0 mx-1 transition-colors"
                      aria-label="React"
                    >
                      <Smile size={14} />
                    </button>
                  )}
                </div>
              );
            })}

            {isBotTyping && <TypingDots name={activeChat.isAI ? "AI" : activeChat.name?.split(' ')[0]} />}
            <div ref={scrollRef} />
          </div>

          {/* Smart-reply chips */}
          {smartReplies.length > 0 && !isBotTyping && (
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
                <span className="text-[12px] font-bold text-gray-500">You blocked {activeChat.name}</span>
                <button onClick={unblockChat} className="text-[11px] font-black uppercase tracking-widest text-[#ba0036] hover:underline">Unblock</button>
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
                className={`p-2.5 rounded-xl transition-all ${showEmojiPicker ? 'bg-[#ba0036]/10 text-[#ba0036]' : 'text-gray-400 hover:text-[#ba0036] hover:bg-gray-50'}`}
                aria-label="Emoji"
              >
                <Smile size={18}/>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChosen}
              />
              <button
                onClick={handleAttachClick}
                disabled={isUploadingMedia || isRecording}
                className="p-2.5 rounded-xl text-gray-400 hover:text-[#ba0036] hover:bg-gray-50 transition-all disabled:opacity-40"
                aria-label="Attach image or PDF"
                title="ছবি বা PDF পাঠান"
              >
                <Paperclip size={18}/>
              </button>
              {isRecording ? (
                /* Recording in progress — replace the textarea with a live indicator */
                <div className="flex-1 flex items-center gap-2.5 py-2 px-1">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-sm font-black text-gray-700 tabular-nums shrink-0">
                    {String(Math.floor(recordSecs / 60)).padStart(1, '0')}:{String(recordSecs % 60).padStart(2, '0')}
                  </span>
                  {/* Live waveform line while recording */}
                  <div className="flex-1 flex items-center gap-[3px] h-6 overflow-hidden">
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
                  placeholder={activeChat.isAI ? 'Ask the AI assistant anything…' : 'Type a message…'}
                  className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800 resize-none py-2 max-h-[120px] leading-relaxed placeholder:text-gray-400"
                />
              )}
              {isRecording ? (
                /* Cancel + Send buttons while recording */
                <div className="flex items-center gap-1.5">
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
                <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-[#ba0036] rounded-full animate-spin" />
                </div>
              ) : inputText.trim() ? (
                <button
                  onClick={handleSendMessage}
                  className="w-11 h-11 bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white rounded-xl flex items-center justify-center shadow-[0_8px_20px_rgba(186,0,54,0.30)] hover:-translate-y-0.5 transition-all active:scale-95"
                  aria-label="Send"
                >
                  <Send size={18} className="ml-0.5"/>
                </button>
              ) : activeChat.isAI ? (
                /* AI chat: no voice message, keep a disabled-looking mic */
                <button
                  className="w-11 h-11 bg-gray-100 text-gray-300 rounded-xl flex items-center justify-center cursor-not-allowed"
                  aria-label="Voice message unavailable"
                  title="Voice message is for chats with people"
                  disabled
                >
                  <Mic size={18}/>
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="w-11 h-11 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-[#ba0036] rounded-xl flex items-center justify-center transition-all active:scale-95"
                  aria-label="Record voice message"
                  title="ভয়েস মেসেজ"
                >
                  <Mic size={18}/>
                </button>
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

        {/* CONTACT INFO — desktop: inline right rail · mobile/tablet: slide-up sheet */}
        {showInfoPane && (
          <>
            {!isDesktop && (
              <div
                className="fixed inset-0 z-[85] bg-gray-900/40 backdrop-blur-sm"
                onClick={() => setShowInfoPane(false)}
              />
            )}
            <motion.aside
              initial={isDesktop ? false : { y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={
                isDesktop
                  ? 'w-[300px] border-l border-white/60 bg-white/30 backdrop-blur-md p-5 overflow-y-auto shrink-0'
                  : 'fixed inset-x-0 bottom-0 z-[90] max-h-[88vh] overflow-y-auto rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.25)] p-5'
              }
              style={!isDesktop ? { paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' } : undefined}
            >
              {!isDesktop && <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-gray-900">Conversation</h4>
              <button onClick={() => setShowInfoPane(false)} className="p-1.5 hover:bg-white rounded-full text-gray-400">
                <X size={14}/>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 text-center">
              {activeChat.avatar ? (
                <img src={activeChat.avatar} className="w-20 h-20 rounded-full object-cover mx-auto mb-3" alt={activeChat.name}/>
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white flex items-center justify-center mx-auto mb-3">
                  <Bot size={32}/>
                </div>
              )}
              <h5 className="text-base font-black text-gray-900">{activeChat.name}</h5>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">{activeChat.role}</p>
              {activeChat.tenantPhone && (
                <p className="text-[11px] font-bold text-gray-700 mt-2">{activeChat.tenantPhone}</p>
              )}
              {activeChat.propertyTitle && (
                <p className="text-[11px] font-bold text-gray-500 mt-1 line-clamp-2">{activeChat.propertyTitle}</p>
              )}
            </div>

            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Receipts in this chat</h5>
            <div className="space-y-2">
              {paymentReceipts.filter(r => r.landlordChatId === activeChatId).slice(0, 6).map(r => (
                <ReceiptCard key={r.id} receipt={r} mine={false} onView={(rec) => setActiveReceipt(rec)}/>
              ))}
              {paymentReceipts.filter(r => r.landlordChatId === activeChatId).length === 0 && (
                <p className="text-[11px] font-bold text-gray-400 text-center py-6 leading-relaxed">
                  No rent receipts yet.<br/>They'll appear here automatically when the landlord marks a month as paid.
                </p>
              )}
            </div>

            {/* Shared media — photos + voice from this conversation */}
            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1 mt-5">Shared media</h5>
            {(() => {
              const msgs = messages[activeChatId] || [];
              const photos = msgs.filter(m => m.type === 'image' && m.mediaUrl);
              const voices = msgs.filter(m => m.type === 'audio' && m.mediaUrl);
              if (photos.length === 0 && voices.length === 0) {
                return <p className="text-[11px] font-bold text-gray-400 text-center py-5">No photos or voice messages yet.</p>;
              }
              return (
                <div className="space-y-3">
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {photos.slice(-9).reverse().map((m, i) => (
                        <a key={m.id || i} href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-100 hover:ring-2 hover:ring-[#ba0036]/30 transition-all">
                          <img src={m.mediaUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {voices.length > 0 && (
                    <div className="space-y-1.5">
                      {voices.slice(-4).reverse().map((m, i) => (
                        <div key={m.id || i} className="bg-white border border-gray-100 rounded-xl px-2.5 py-2">
                          <CompactAudioPlayer src={m.mediaUrl} variant="list" durationSec={m.mediaMeta?.durationSec} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1 mt-5">Quick actions</h5>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => {   }} className="bg-white hover:bg-red-50 border border-gray-100 hover:border-[#ba0036]/20 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-[#ba0036] transition-all flex items-center justify-center gap-1.5">
                <Phone size={12}/> Call
              </button>
              <button onClick={() => {   }} className="bg-white hover:bg-red-50 border border-gray-100 hover:border-[#ba0036]/20 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-[#ba0036] transition-all flex items-center justify-center gap-1.5">
                <Video size={12}/> Video
              </button>
              <button
                onClick={toggleMuteChat}
                className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border ${
                  activeChat.muted
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-white border-gray-100 hover:border-amber-200 text-gray-700 hover:text-amber-700 hover:bg-amber-50'
                }`}
              >
                <BellOff size={12}/> {activeChat.muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={() => setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, pinned: !c.pinned } : c))}
                className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border ${
                  activeChat.pinned
                    ? 'bg-[#ba0036]/10 border-[#ba0036]/20 text-[#ba0036]'
                    : 'bg-white border-gray-100 hover:border-amber-200 text-gray-700 hover:text-amber-700 hover:bg-amber-50'
                }`}
              >
                <Pin size={12}/> {activeChat.pinned ? 'Unpin' : 'Pin'}
              </button>
            </div>

            {/* PIN privacy — lock this specific conversation behind a PIN. */}
            {!activeChat.isAI && (
              <button
                onClick={() => (chatLocks[activeChatId] ? disablePin() : beginPinSetup())}
                className={`mt-2 w-full rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border ${
                  chatLocks[activeChatId]
                    ? 'bg-[#ba0036]/10 border-[#ba0036]/20 text-[#ba0036]'
                    : 'bg-white border-gray-100 hover:border-[#ba0036]/20 text-gray-700 hover:text-[#ba0036] hover:bg-red-50'
                }`}
              >
                <Lock size={12}/> {chatLocks[activeChatId] ? 'Remove PIN lock' : 'Lock chat with PIN'}
              </button>
            )}

            {/* Danger zone — Report + Block (hidden for the AI assistant) */}
            {!activeChat.isAI && (
              <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
                {reportSent ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-3 py-2.5 text-center">
                    Report পাঠানো হয়েছে। ধন্যবাদ।
                  </div>
                ) : reportOpen ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">Report reason</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Spam', 'Harassment', 'Scam / Fraud', 'Inappropriate'].map(r => (
                        <button key={r} onClick={() => submitReport(r)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 transition-all">
                          {r}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setReportOpen(false)} className="mt-2 text-[10px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setReportOpen(true)} className="w-full bg-white hover:bg-amber-50 border border-gray-100 hover:border-amber-200 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-amber-700 transition-all flex items-center justify-center gap-1.5">
                    <Flag size={12}/> Report
                  </button>
                )}

                {activeChat.blocked ? (
                  <button onClick={unblockChat} className="w-full bg-white hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-800 transition-all flex items-center justify-center gap-1.5">
                    <Ban size={12}/> Unblock {activeChat.name}
                  </button>
                ) : (
                  <button onClick={() => setShowBlockModal(true)} className="w-full bg-white hover:bg-red-50 border border-gray-100 hover:border-red-200 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-all flex items-center justify-center gap-1.5">
                    <Ban size={12}/> Block
                  </button>
                )}
              </div>
            )}
            </motion.aside>
          </>
        )}
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

      {/* Emoji reaction bar (long-press / right-click a bubble) */}
      <ReactionBar
        open={!!reactionBar}
        x={reactionBar?.x || 0}
        y={reactionBar?.y || 0}
        current={reactionBar?.message?.reactions?.[currentUserId] || null}
        onReact={(emoji) => reactionBar && toggleReaction(reactionBar.message, emoji)}
        onMore={() => reactionBar && openMessageMenu(reactionBar.message, reactionBar.x, reactionBar.y)}
        onClose={() => setReactionBar(null)}
      />

      {/* Long-press / right-click message actions: Reply · Forward · Delete */}
      <MessageActionsMenu
        open={!!menuState}
        x={menuState?.x || 0}
        y={menuState?.y || 0}
        mine={menuState?.message?.sender === 'me'}
        onReply={() => menuState && handleReply(menuState.message)}
        onForward={() => menuState && handleForward(menuState.message)}
        onDelete={() => menuState && handleDeleteMessage(menuState.message)}
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
          if (activeChat.role === 'Property Owner' || activeChat.role === 'Landlord') navigate(`/host/${activeChat.peerUserId}`);
          else navigate(`/tenant/${activeChat.peerUserId}`);
        } : undefined}
        onOpenMedia={() => setShowInfoPane(true)}
        onMute={() => (activeChat?.muted ? toggleMuteChat() : setShowMuteModal(true))}
        onBlock={() => (activeChat?.blocked ? unblockChat() : setShowBlockModal(true))}
        onReport={() => setShowReportModal(true)}
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
                <h3 className="text-sm font-black text-gray-900">Forward to…</h3>
                <button onClick={() => setForwardMsg(null)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400"><X size={16}/></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {forwardTargets.length === 0 ? (
                  <p className="text-[12px] font-bold text-gray-400 text-center py-8">No other chats to forward to.</p>
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
