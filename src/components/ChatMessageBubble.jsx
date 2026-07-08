// ChatMessageBubble.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A single chat bubble, extracted from ChatSystem and wrapped in React.memo so
// the message list DOESN'T re-render when unrelated parent state changes (e.g.
// opening the long-press action sheet, presence ticks, the composer). This is
// the fix for the long-press stutter: only the bubbles whose data actually
// changed re-render.
//
// Everything the bubble needs is passed as STABLE props:
//   • m               the grouped message object (stable identity between renders
//                     unless its own content changes)
//   • currentUserId   string (value-stable)
//   • onOpenMenu(m,x,y)   open the reaction/actions sheet (useCallback in parent)
//   • onReply(m)          swipe-to-reply (useCallback in parent)
//   • onMediaClick({type,url,name})  open the in-app lightbox (useCallback in parent)
//
// The long-press timer + swipe gesture live LOCALLY here (their own refs), so
// the parent never has to hand down fresh handler closures per render.

import React, { useRef, memo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCheck, Check, Hourglass, X, Ban, FileText, Download, Play, Sparkles, CornerUpLeft, Smile, MoreVertical,
} from 'lucide-react';
import CompactAudioPlayer from './CompactAudioPlayer';

// ── Pure helpers (kept local so this file has no coupling to ChatSystem) ─────
const EMOJI_ONLY_RE = (() => { try { return new RegExp('^(?:\\p{Extended_Pictographic}|\\uFE0F|\\u200D|\\s){1,8}$', 'u'); } catch { return null; } })();
const isJumboEmoji = (t) => { const s = (t || '').trim(); return !!s && !!EMOJI_ONLY_RE && EMOJI_ONLY_RE.test(s); };
const isImageUrl = (t) => {
  const s = (t || '').trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return false;
  return /\.(gif|png|jpe?g|webp)(\?|$)/i.test(s) || /(tenor\.com|giphy\.com|media\.tenor|c\.tenor)/i.test(s);
};
const parseReplyQuote = (text) => {
  if (typeof text !== 'string' || !text.startsWith('> ')) return null;
  const nl = text.indexOf('\n');
  if (nl === -1) return null;
  return { quote: text.slice(2, nl).trim(), body: text.slice(nl + 1) };
};
const replyQuoteLabel = (r) => {
  if (!r) return '';
  if (r.isDeleted) return '🚫 Deleted message';
  if (r.type === 'image') return '📷 Photo';
  if (r.type === 'video') return '🎥 Video';
  if (r.type === 'audio') return '🎤 Voice message';
  if (r.type === 'document') return '📄 Document';
  return (r.text || '').slice(0, 120);
};
const formatTime = (iso) => {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const bubbleRadius = (mine, position) => {
  if (position === 'middle') return mine ? 'rounded-l-3xl rounded-r-md' : 'rounded-r-3xl rounded-l-md';
  if (position === 'last')   return mine ? 'rounded-3xl rounded-br-md'  : 'rounded-3xl rounded-bl-md';
  return mine ? 'rounded-3xl rounded-tr-md' : 'rounded-3xl rounded-tl-md'; // solo / first
};

const LONG_PRESS_MS = 350;   // requirement: exactly 350ms

function ChatMessageBubble({ m, currentUserId, onOpenMenu, onOpenReactions, onReply, onMediaClick }) {
  const timerRef = useRef(null);
  const posRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  // Long-press (touch) → quick REACTION bar (WhatsApp/Messenger behaviour).
  // Right-click (desktop) → the ACTIONS menu.
  const pressHandlers = {
    onContextMenu: (e) => { e.preventDefault(); onOpenMenu?.(m, e.clientX, e.clientY); },
    onPointerDown: (e) => {
      if (e.button === 2) return; // right-click handled by onContextMenu
      posRef.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        onOpenReactions?.(m, posRef.current.x, posRef.current.y);
        timerRef.current = null;
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      const p = posRef.current;
      if (p && timerRef.current && (Math.abs(e.clientX - p.x) > 14 || Math.abs(e.clientY - p.y) > 14)) {
        clearTimer();
      }
    },
    onPointerUp: clearTimer,
    onPointerLeave: clearTimer,
  };

  const mine = m.sender === 'me';
  const fromBot = m.sender === 'bot';
  const showTail = m.position === 'last' || m.position === 'solo';
  const name = m.mediaMeta?.originalName;

  // Reaction + 3-dot buttons that sit on the INNER side of the bubble. Always
  // visible on mobile (there's no hover), fade in on hover on desktop. The
  // reaction button opens the emoji bar; the 3-dot opens the actions menu.
  const actionCluster = m.isDeleted ? null : (
    <div className="flex items-center gap-1 shrink-0 mx-1 transition-opacity duration-150 opacity-100 sm:opacity-0 sm:pointer-events-none sm:group-hover/msg:opacity-100 sm:group-hover/msg:pointer-events-auto">
      <button
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onOpenReactions?.(m, r.left + r.width / 2, r.bottom); }}
        className="w-7 h-7 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#ba0036] active:scale-90 transition-transform"
        aria-label="React"
      >
        <Smile size={15} />
      </button>
      <button
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onOpenMenu?.(m, r.left + r.width / 2, r.bottom); }}
        className="w-7 h-7 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#ba0036] active:scale-90 transition-transform"
        aria-label="More actions"
      >
        <MoreVertical size={15} />
      </button>
    </div>
  );

  return (
    <div className={`group/msg flex items-center ${mine ? 'justify-end' : 'justify-start'} ${m.position === 'middle' ? 'mb-0.5' : 'mb-2'}`}>
      {/* Mine → cluster on the LEFT (inner side). */}
      {mine && actionCluster}
      {!m.isDeleted && !mine && (
        <CornerUpLeft size={16} className="text-[#ba0036] opacity-0 group-active/msg:opacity-60 mr-1 shrink-0 transition-opacity" />
      )}

      <motion.div
        {...pressHandlers}
        drag={m.isDeleted ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.55 }}
        dragSnapToOrigin
        onDragStart={clearTimer}
        onDragEnd={(_e, info) => { if (info.offset.x > 60) onReply?.(m); }}
        // touch-pan-y + WebkitTouchCallout:none stop the mobile browser's native
        // long-press callout / text-selection from fighting our JS long-press
        // (a big source of the "buffering" feel). active:brightness-95 gives
        // instant press feedback (a filter, so it doesn't fight framer's drag
        // transform).
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        className={`relative max-w-[78%] sm:max-w-[68%] ${bubbleRadius(mine, m.position)} px-3.5 py-2.5 select-none touch-pan-y cursor-default transition-[filter,box-shadow] active:brightness-95 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.12)] ${
          mine
            ? 'bg-gradient-to-br from-[#ba0036] to-[#a30030] text-white'
            : fromBot
              ? 'bg-gradient-to-br from-gray-900 to-[#1a1a1f] text-white'
              : 'bg-white text-gray-800 border border-gray-100 ring-1 ring-black/[0.02]'
        }`}
      >
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
            {/* ── Media ─────────────────────────────────────────────────── */}
            {m.type === 'image' && m.mediaUrl ? (
              <button type="button" onClick={() => onMediaClick?.({ type: 'image', url: m.mediaUrl, name })} className="block">
                <img src={m.mediaUrl} alt="shared" className="rounded-xl max-w-full max-h-72 object-cover cursor-pointer" loading="lazy" />
              </button>
            ) : m.type === 'video' && m.mediaUrl ? (
              <button
                type="button"
                onClick={() => onMediaClick?.({ type: 'video', url: m.mediaUrl, name })}
                className="relative block rounded-xl overflow-hidden max-w-full"
              >
                <video src={m.mediaUrl} preload="metadata" muted className="rounded-xl max-w-full max-h-72 object-cover pointer-events-none" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
                    <Play size={22} className="ml-0.5" fill="currentColor" />
                  </span>
                </span>
              </button>
            ) : m.type === 'audio' && m.mediaUrl ? (
              <CompactAudioPlayer src={m.mediaUrl} mine={mine || fromBot} durationSec={m.mediaMeta?.durationSec} />
            ) : m.type === 'document' && m.mediaUrl ? (
              <button
                type="button"
                onClick={() => onMediaClick?.({ type: 'document', url: m.mediaUrl, name })}
                className={`flex items-center gap-3 p-3 rounded-xl border w-full text-left ${mine ? 'bg-white/10 border-white/20 hover:bg-white/20' : fromBot ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} transition-all max-w-[240px] sm:max-w-[280px] group`}
              >
                <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${mine || fromBot ? 'bg-white/20 text-white' : 'bg-[#ba0036]/10 text-[#ba0036]'}`}>
                  <FileText size={20} className="group-hover:scale-110 transition-transform"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-bold truncate leading-tight mb-0.5 ${mine || fromBot ? 'text-white' : 'text-gray-800'}`}>
                    {name || 'Document.pdf'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${mine || fromBot ? 'text-white/60' : 'text-gray-400'}`}>
                      {m.mediaMeta?.bytes ? (m.mediaMeta.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'PDF FILE'}
                    </p>
                    <Download size={12} className={`${mine || fromBot ? 'text-white/80' : 'text-gray-400'} group-hover:-translate-y-0.5 transition-transform`} />
                  </div>
                </div>
              </button>
            ) : null}

            {/* ── Text (+ reply quote / jumbo emoji / lone media URL) ─────── */}
            {(m.type === 'text' || !m.type) ? (() => {
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
                    <button type="button" onClick={() => onMediaClick?.({ type: 'image', url: body.trim() })} className="block">
                      <img src={body} alt="gif" loading="lazy" className="rounded-xl max-w-full max-h-72 object-cover" />
                    </button>
                  ) : (
                    <p className={isJumboEmoji(body) ? 'text-5xl leading-tight' : 'text-[13px] sm:text-sm font-medium whitespace-pre-line leading-relaxed'}>{body}</p>
                  )}
                </>
              );
            })() : (m.text ? (
              <p className="text-[13px] sm:text-sm font-medium whitespace-pre-line leading-relaxed mt-1.5">{m.text}</p>
            ) : null)}
          </>
        )}

        {/* Timestamp + status ticks */}
        {showTail && (
          <div className={`flex items-center gap-1.5 mt-1 ${mine ? 'justify-end text-white/70' : fromBot ? 'justify-start text-white/50' : 'justify-start text-gray-400'}`}>
            <span className="text-[9px] font-bold tabular-nums">{formatTime(m.iso)}</span>
            {mine && (
              m.status === 'read' ? <CheckCheck size={11} className="text-blue-200"/>
              : m.status === 'delivered' ? <CheckCheck size={11}/>
              : m.status === 'queued' ? <Hourglass size={11} className="opacity-70"/>
              : m.status === 'failed' ? <X size={11} className="text-red-300"/>
              : <Check size={11}/>
            )}
          </div>
        )}

        {/* Aggregated reaction chip */}
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

      {/* Them → cluster on the RIGHT (inner side). */}
      {!mine && actionCluster}
    </div>
  );
}

// Only re-render a bubble when its OWN data changes. menuState/reactionBar/
// composer/presence changes in the parent won't touch these props, so the list
// stays still.
export default memo(ChatMessageBubble, (prev, next) => (
  prev.m === next.m &&
  prev.currentUserId === next.currentUserId &&
  prev.onOpenMenu === next.onOpenMenu &&
  prev.onOpenReactions === next.onOpenReactions &&
  prev.onReply === next.onReply &&
  prev.onMediaClick === next.onMediaClick
));
