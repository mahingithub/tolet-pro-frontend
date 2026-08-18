import React, { useState } from 'react';
import { Bell, MessageCircle, Inbox, CheckCheck, X, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useNotificationContext } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const typeIcon = (t) => {
  if (t === 'message_new' || t === 'message') return <MessageCircle size={14} className="text-blue-500" />;
  if (t === 'inquiry_new' || t === 'inquiry') return <Inbox         size={14} className="text-[#ba0036]" />;
  if (t === 'inquiry_status')                 return <CheckCheck    size={14} className="text-emerald-500" />;
  return <Bell size={14} className="text-amber-500" />;
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'now';
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
};

// ─── One notification row — swipe LEFT or RIGHT to dismiss ───────────────────
// The row is a horizontally draggable motion.div. A red "delete" strip fades in
// behind it as you pull; releasing past ~96px (or flinging fast) removes the
// notification. The strip's opacity is driven off the drag position and sits at
// 0 at rest — previously it was painted opaque at all times and only hidden by
// the row's own background, so unread rows (bg-red-50, which index.css remaps to
// a 16%-alpha fill in dark mode) ghosted both trash icons through the card.
function NotificationRow({ n, onOpen, onRemove }) {
  const { t } = useLanguage();
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-96, -20, 0, 20, 96], [1, 0.6, 0, 0.6, 1]);

  return (
    <div className="relative overflow-hidden border-b border-gray-50 last:border-b-0">
      {/* Delete affordance — transparent at rest, fades in with the drag. */}
      <motion.div
        style={{ opacity }}
        className="absolute inset-0 flex items-center justify-between px-5 bg-red-500 text-white pointer-events-none"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
          <Trash2 size={14} /> {t.notifRemove || 'Remove'}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
          {t.notifRemove || 'Remove'} <Trash2 size={14} />
        </span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        style={{ x }}
        onDragEnd={(_e, info) => {
          if (Math.abs(info.offset.x) > 96 || Math.abs(info.velocity.x) > 600) onRemove(n.id);
        }}
        whileDrag={{ cursor: 'grabbing' }}
        className={`relative flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-red-50' : 'bg-white'}`}
      >
        <div className="mt-0.5 shrink-0 cursor-pointer" onClick={() => onOpen(n)}>
          {n.data?.avatar || n.data?.senderAvatar ? (
            <img src={n.data.avatar || n.data.senderAvatar} alt={n.title} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            typeIcon(n.type)
          )}
        </div>
        <button type="button" className="w-full min-w-0 flex-1 text-left" onClick={() => onOpen(n)}>
          <div className="flex justify-between items-start gap-2">
            <p className={`text-[12px] flex-1 min-w-0 truncate ${!n.read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
              {n.title || 'Notification'}
            </p>
            {!n.read && <span className="w-2 h-2 rounded-full bg-[#ba0036] shrink-0 mt-1" />}
          </div>
          {n.body ? (
            <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
              {n.body}
            </p>
          ) : null}
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mt-1">
            {formatTime(n.createdAt)}
          </p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(n.id); }}
          className="shrink-0 self-start -mr-1 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title={t.notifRemove || 'Remove notification'}
          aria-label={t.notifRemove || 'Remove notification'}
        >
          <Trash2 size={14} />
        </button>
      </motion.div>
    </div>
  );
}

export default function NotificationPanel({ onClose }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { items, unreadCount, loading, markAsRead, markAllRead, removeNotification, clearAllNotifications } = useNotificationContext();
  const { user } = useAuth();
  // "Clear all" wipes every notification with no undo, so it asks first.
  const [confirmClear, setConfirmClear] = useState(false);
  const isLandlord = user?.roles?.includes('landlord') || user?.roles?.includes('host') || user?.role === 'landlord';

  const handleRowClick = async (n) => {
    try {
      if (!n.read) {
        await markAsRead(n.id);
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    } finally {
      onClose();

      // Deep-link by type. We support both old and new types.
      const { targetId, peerId, peerName, peerAvatar } = n.data || {};

      switch (n.type) {
        case 'message':
        case 'message_new': {
          const state = {
            peerUserId: peerId,
            peerName: peerName,
            peerAvatar: peerAvatar,
            conversationId: targetId || (n.data && n.data.conversationId),
            autoOpen: true
          };
          if (window.location.pathname.startsWith('/admin')) {
            const queryParams = new URLSearchParams({
              peerUserId: state.peerUserId || '',
              conversationId: state.conversationId || '',
              autoOpen: 'true'
            }).toString();
            window.open(`/messages?${queryParams}`, '_blank');
          } else {
            navigate('/messages', { state });
          }
          break;
        }

        case 'inquiry_new':
          navigate('/host-dashboard?tab=inquiries', {
            state: { highlightId: targetId || n?.data?.inquiryId, autoOpen: true, scrollTo: true }
          });
          break;

        case 'inquiry_status':
          navigate('/tenant-dashboard?tab=applications', {
            state: { highlightId: targetId || n?.data?.inquiryId, autoOpen: true, scrollTo: true }
          });
          break;

        // Legacy untyped inquiry notifications (created before the
        // inquiry_new / inquiry_status split) don't record which surface they
        // belong to. Route by the viewer's role so a tenant lands on their
        // applications and a landlord on the host inbox.
        case 'inquiry':
          navigate(
            isLandlord ? '/host-dashboard?tab=inquiries' : '/tenant-dashboard?tab=applications',
            { state: { highlightId: targetId || n?.data?.inquiryId, autoOpen: true, scrollTo: true } }
          );
          break;

        case 'booking':
          navigate(isLandlord ? '/host-dashboard?tab=bookings' : '/tenant-dashboard?tab=payments', {
            state: { highlightId: targetId, autoOpen: true, scrollTo: true }
          });
          break;

        case 'payment':
        case 'receipt':
        case 'rent_receipt':
        case 'rent_invoice':
        case 'rent_overdue':
          navigate(isLandlord ? '/host-dashboard?tab=rent' : '/tenant-dashboard?tab=payments', {
            state: { highlightId: targetId, autoOpen: true, scrollTo: true }
          });
          break;

        case 'property':
          navigate(`/property/${targetId}`, { state: { autoOpen: true, scrollTo: true } });
          break;

        case 'review': {
          // Property reviews were removed — reputation reviews now live on the
          // user's PROFILE. A review notification means the recipient was
          // reviewed, so deep-link to their own (role-appropriate) profile
          // where the review appears.
          const myId = user?.id || user?._id;
          if (myId) navigate(isLandlord ? `/landlord/${myId}` : `/tenant/${myId}`);
          else navigate('/');
          break;
        }

        case 'maintenance':
          navigate('/host-dashboard?tab=maintenance', {
            state: { highlightId: targetId, autoOpen: true, scrollTo: true }
          });
          break;

        case 'kyc_tenant':
        case 'kyc_landlord':
        case 'support_ticket':
        case 'support_message':
          if (n.data && n.data.path) {
            navigate(n.data.path, { state: { ticketId: n.data.ticketId || targetId } });
          } else {
            navigate('/admin');
          }
          break;

        case 'rent_updated':
          navigate(isLandlord ? '/host-dashboard?tab=rent' : '/tenant-dashboard?tab=bookings', {
            state: {
              highlightId: targetId || (n.data && n.data.bookingId),
              autoOpen: true,
              scrollTo: true,
            },
          });
          break;

        case 'marketing':
          // Admin offers carry their own destination (the plan page by default).
          navigate((n.data && (n.data.path || n.data.url)) || '/subscription');
          break;

        case 'system':
          // Admin-facing system events (e.g. user reports) carry a path.
          if (n.data && n.data.path) navigate(n.data.path);
          else navigate('/');
          break;

        default:
          // NOTE: '/notifications' is NOT a registered route — App.jsx ends with
          // a catch-all that silently redirects unknown paths to '/'. Falling
          // back to it made a tapped notification look like it did nothing, so
          // prefer a destination supplied by the notification itself.
          navigate((n.data && (n.data.path || n.data.url)) || '/');
          break;
      }
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] sm:w-96 bg-white rounded-2xl shadow-[0_18px_60px_rgba(0,0,0,0.15)] border border-gray-100 z-50 overflow-hidden">
      {/* Header. The Bengali action labels are long ("সব পড়া হিসেবে চিহ্নিত করুন"),
          so the title truncates and the actions sit on their own row underneath
          rather than being squeezed into the title line. */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 min-w-0 text-sm font-black text-gray-900">
            <span className="truncate">{t.notifTitle || 'Notifications'}</span>
            {unreadCount > 0 && (
              <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ba0036] text-white text-[10px] font-black flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 -mr-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label={t.close || 'Close'}
          >
            <X size={14} />
          </button>
        </div>

        {(unreadCount > 0 || items.length > 0) && (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-bold text-[#ba0036] hover:underline"
              >
                {t.notifMarkAllRead || 'Mark all read'}
              </button>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-[11px] font-bold text-gray-400 hover:text-red-500 hover:underline"
              >
                {t.notifClearAll || 'Clear all'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-gray-400">{t.loading || 'Loading…'}</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center px-6">
            <Bell size={20} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-bold text-gray-400">{t.notifEmpty || "You're all caught up."}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((n) => (
              <motion.div
                key={n.id}
                layout
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                <NotificationRow n={n} onOpen={handleRowClick} onRemove={removeNotification} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {items.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-50 text-center">
          <p className="text-[10px] font-bold text-gray-400">
            {t.notifSwipeHint || 'Swipe a card left or right to remove'}
          </p>
        </div>
      )}

      {/* Clear-all confirmation — an in-panel sheet rather than a window.confirm
          so it inherits the app's theme and stays inside the dropdown. */}
      {confirmClear && (
        <div className="absolute inset-0 z-10 flex items-end bg-gray-900/40 backdrop-blur-[2px]">
          <div className="w-full bg-white border-t border-gray-100 rounded-b-2xl p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
            <p className="text-[13px] font-black text-gray-900 mb-1">
              {t.notifClearAll || 'Clear all'}
            </p>
            <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
              {t.notifClearAllConfirm || 'This removes every notification. It cannot be undone.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-black transition-colors"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => { clearAllNotifications(); setConfirmClear(false); }}
                className="flex-1 py-2.5 rounded-xl bg-[#ba0036] hover:bg-[#9a002d] text-white text-[12px] font-black transition-colors"
              >
                {t.notifClearAllYes || 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
