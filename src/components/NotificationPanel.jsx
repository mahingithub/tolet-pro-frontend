import React from 'react';
import { Bell, MessageCircle, Inbox, CheckCheck, X, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
// The row is a horizontally draggable motion.div. A red "delete" strip is
// revealed behind it on either side as you pull; releasing past ~96px (or
// flinging fast) removes the notification. Tapping the body still deep-links.
function NotificationRow({ n, onOpen, onRemove }) {
  const { t } = useLanguage();
  return (
    <div className="relative overflow-hidden border-b border-gray-50 last:border-b-0">
      {/* Delete affordance revealed on swipe (both edges). */}
      <div className="absolute inset-0 flex items-center justify-between px-5 bg-red-500 text-white pointer-events-none">
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider"><Trash2 size={14} /> {t.notifRemove || 'Remove'}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">{t.notifRemove || 'Remove'} <Trash2 size={14} /></span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={(_e, info) => {
          if (Math.abs(info.offset.x) > 96 || Math.abs(info.velocity.x) > 600) onRemove(n.id);
        }}
        whileDrag={{ cursor: 'grabbing' }}
        className={`relative flex items-start gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors ${!n.read ? 'bg-red-50/40' : ''}`}
      >
        <div className="mt-0.5 shrink-0 cursor-pointer" onClick={() => onOpen(n)}>
          {n.data?.avatar || n.data?.senderAvatar ? (
            <img src={n.data.avatar || n.data.senderAvatar} alt={n.title} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            typeIcon(n.type)
          )}
        </div>
        <button type="button" className="w-full min-w-0 flex-1 text-left" onClick={() => onOpen(n)}>
          <div className="flex justify-between items-start">
            <p className={`text-[12px] truncate ${!n.read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
              {n.title || 'Notification'}
            </p>
            {!n.read && <span className="w-2 h-2 rounded-full bg-[#ba0036] shrink-0 ml-2" />}
          </div>
          {n.body ? (
            <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5" style={{ maxWidth: '60ch' }}>
              {n.body.length > 60 ? n.body.substring(0, 60) + '...' : n.body}
            </p>
          ) : null}
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mt-1">
            {formatTime(n.createdAt)}
          </p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(n.id); }}
          className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50 self-start"
          title={t.notifRemove || 'Remove notification'}
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

        case 'inquiry':
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

        case 'review':
          navigate(`/property/${targetId}`, { state: { scrollTo: 'reviews' } });
          break;

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

        case 'system':
          // Admin-facing system events (e.g. user reports) carry a path.
          if (n.data && n.data.path) navigate(n.data.path);
          else navigate('/notifications');
          break;

        default:
          navigate('/notifications');
          break;
      }
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-[0_18px_60px_rgba(0,0,0,0.15)] border border-gray-100 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h4 className="text-sm font-black text-gray-900">{t.notifTitle || 'Notifications'}</h4>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[10px] font-black text-[#ba0036] hover:underline uppercase tracking-wide"
            >
              {t.notifMarkAllRead || 'Mark all read'}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAllNotifications}
              className="text-[10px] font-black text-gray-400 hover:text-red-500 hover:underline uppercase tracking-wide"
            >
              {t.notifClearAll || 'Clear all'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
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
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">
            {t.notifSwipeHint || 'Swipe a card left or right to remove'}
          </p>
        </div>
      )}
    </div>
  );
}
