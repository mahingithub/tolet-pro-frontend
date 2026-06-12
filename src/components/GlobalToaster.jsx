import React, { useEffect, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import callProvider from '../services/callProvider';
import useAudioChime from '../hooks/useAudioChime';
import { useNotificationSettings } from '../context/NotificationContext';

export default function GlobalToaster() {
  const location = useLocation();
  const navigate = useNavigate();
  const playChime = useAudioChime();
  const { shouldPlayChimeOrToast, soundEnabled } = useNotificationSettings();
  
  const activeToastsRef = useRef([]);

  useEffect(() => {
    const socket = callProvider.getSocket();
    if (!socket) return;

    const handleReceiveMessage = (data) => {
      if (!shouldPlayChimeOrToast()) return;

      const { conversationId, message, senderName, senderAvatar } = data;

      const isViewingChat = location.pathname.includes(`/messages/${conversationId}`);
      if (isViewingChat) {
        return;
      }

      if (soundEnabled) {
        playChime();
      }

      const toastId = Date.now().toString();

      activeToastsRef.current.push(toastId);
      if (activeToastsRef.current.length > 3) {
        const oldestId = activeToastsRef.current.shift();
        toast.dismiss(oldestId);
      }

      toast(
        <div className="flex items-center gap-3 w-full">
          {senderAvatar ? (
            <img src={senderAvatar} alt={senderName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{senderName}</h4>
            <p className="text-xs text-gray-500 line-clamp-1">{message?.text || (message?.type === 'image' ? '📷 Photo' : '🎤 Voice message')}</p>
          </div>
          <button 
            onClick={() => {
              navigate(`/messages/${conversationId}`);
              toast.dismiss(toastId);
            }}
            className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md shrink-0 hover:bg-blue-100 transition-colors"
          >
            Reply
          </button>
        </div>,
        {
          id: toastId,
          duration: 4000,
          position: 'top-center',
          onDismiss: () => {
            activeToastsRef.current = activeToastsRef.current.filter((id) => id !== toastId);
          },
          onAutoClose: () => {
            activeToastsRef.current = activeToastsRef.current.filter((id) => id !== toastId);
          }
        }
      );
    };

    socket.on('RECEIVE_MESSAGE', handleReceiveMessage);

    return () => {
      socket.off('RECEIVE_MESSAGE', handleReceiveMessage);
    };
  }, [location.pathname, navigate, playChime, shouldPlayChimeOrToast, soundEnabled]);

  return (
    <Toaster 
      position="top-center" 
      richColors 
      expand={true}
      toastOptions={{
        style: { borderRadius: '12px', padding: '12px' },
      }}
    />
  );
}
