import React, { useEffect, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import callProvider from '../services/callProvider';
import useAudioChime from '../hooks/useAudioChime';
import { useNotificationSettings } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import QuickReplyToast from './QuickReplyToast';

export default function GlobalToaster() {
  const location = useLocation();
  const navigate = useNavigate();
  const playChime = useAudioChime();
  const { shouldPlayChimeOrToast, soundEnabled } = useNotificationSettings();
  const { t } = useLanguage();
  // `t` is a fresh Proxy each render — keep it in a ref so the socket handler
  // reads the latest labels without re-subscribing on every render.
  const tRef = useRef(t);
  tRef.current = t;

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

      const preview = message?.text
        || (message?.type === 'image' ? '📷 Photo'
          : message?.type === 'video' ? '🎥 Video'
          : message?.type === 'document' ? '📄 Document'
          : message?.type === 'audio' ? '🎤 Voice message' : 'New message');

      const cleanup = () => {
        activeToastsRef.current = activeToastsRef.current.filter((id) => id !== toastId);
      };

      // Premium custom toast with an inline quick-reply box (no default chrome).
      toast.custom(
        () => (
          <QuickReplyToast
            conversationId={conversationId}
            senderName={senderName}
            senderAvatar={senderAvatar}
            preview={preview}
            labels={{
              newMessage: tRef.current.notifNewMessage || 'New message',
              placeholder: tRef.current.quickReplyPlaceholder || 'Reply…',
              sent: tRef.current.quickReplySent || 'Reply sent',
            }}
            onOpen={() => {
              navigate('/messages', { state: { peerUserId: message?.senderId, conversationId, autoOpen: true } });
              toast.dismiss(toastId);
            }}
            onClose={() => toast.dismiss(toastId)}
          />
        ),
        {
          id: toastId,
          duration: 6500,
          position: 'top-center',
          onDismiss: cleanup,
          onAutoClose: cleanup,
        }
      );
    };

    // NOTE: We intentionally do NOT toast 'new_notification' here.
    // For chat messages the backend fires BOTH 'RECEIVE_MESSAGE' (handled above,
    // with the rich sender card + Reply) AND 'new_notification'. Toasting both
    // is exactly what made a single message pop up twice. 'new_notification' is
    // owned by NotificationContext (bell + non-message toasts) instead.
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
