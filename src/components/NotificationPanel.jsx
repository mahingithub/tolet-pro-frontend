import React from 'react';
import { Bell, MessageCircle, Inbox, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const typeIcon = (t) => {
  if (t === 'message_new')     return <MessageCircle size={14} className="text-blue-500" />;
  if (t === 'inquiry_new')     return <Inbox         size={14} className="text-[#ba0036]" />;
  if (t === 'inquiry_status')  return <CheckCheck    size={14} className="text-emerald-500" />;
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

export default function NotificationPanel({ onClose }) {
  const navigate = useNavigate();
  const { items, unreadCount, loading, markAsRead, markAllRead } = useNotificationContext();
  const { user } = useAuth();
  const isLandlord = user?.role === 'landlord' || user?.role === 'host';

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
        case 'message_new':
          navigate('/messages', {
            state: {
              peerUserId: peerId,
              peerName: peerName,
              peerAvatar: peerAvatar,
              conversationId: targetId || (n.data && n.data.conversationId),
              autoOpen: true
            }
          });
          break;

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
            navigate(n.data.path);
          } else {
            navigate('/admin');
          }
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
        <h4 className="text-sm font-black text-gray-900">Notifications</h4>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[10px] font-black text-[#ba0036] hover:underline uppercase tracking-wide"
            >
              Mark all read
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
          <div className="py-8 text-center text-xs font-bold text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center px-6">
            <Bell size={20} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-bold text-gray-400">You're all caught up.</p>
          </div>
        ) : (
          items.map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => handleRowClick(n)}
              className={`w-full text-left flex gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-red-50/30' : ''}`}
            >
              <div className="mt-0.5 shrink-0">
                {n.data?.avatar || n.data?.senderAvatar ? (
                  <img src={n.data.avatar || n.data.senderAvatar} alt={n.title} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  typeIcon(n.type)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] truncate ${!n.read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                  {n.title || 'Notification'}
                </p>
                {n.body ? (
                  <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5" style={{ maxWidth: '60ch' }}>
                    {n.body.length > 60 ? n.body.substring(0, 60) + '...' : n.body}
                  </p>
                ) : null}
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mt-1">
                  {formatTime(n.createdAt)}
                </p>
              </div>
              {!n.read && (
                <span className="w-2 h-2 mt-1.5 rounded-full bg-[#ba0036] shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
