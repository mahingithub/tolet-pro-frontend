/**
 * chatService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Frontend client for the polling-based chat backend at
 *   routes/chat.routes.js
 *
 *   GET    /api/conversations                       listConversations
 *   POST   /api/conversations/open                  openConversation (peerUserId, propertyId?)
 *   GET    /api/conversations/:id/messages?since    listMessages (delta poll)
 *   POST   /api/conversations/:id/messages          sendMessage
 *   POST   /api/conversations/:id/read              markRead
 *
 * Token comes from the shared `'auth:token'` key written by authService.
 */

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const getToken = () => window.localStorage.getItem('auth:token');

function authHeaders() {
  const t = getToken();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.code || 'REQUEST_FAILED');
    err.code = data.code;
    err.details = data.details;
    err.status = res.status;
    throw err;
  }
  return data;
}

/** List all conversations for the logged-in user (sidebar). */
export const listConversations = async () => {
  const data = await call('/conversations');
  return Array.isArray(data.conversations) ? data.conversations : [];
};

/**
 * Open (or find) a 1:1 conversation with another user.
 * @param {object} args
 * @param {string} args.peerUserId
 * @param {string=} args.propertyId   Scopes the thread to a specific property.
 * @param {string=} args.inquiryId    Optional inquiry link.
 */
export const openConversation = async ({ peerUserId, propertyId, inquiryId }) => {
  const data = await call('/conversations/open', {
    method: 'POST',
    body: {
      peerUserId,
      ...(propertyId ? { propertyId } : {}),
      ...(inquiryId  ? { inquiryId  } : {}),
    },
  });
  return data.conversation;
};

/**
 * Fetch messages for a conversation. Pass `since` (ISO timestamp) for
 * delta polling so we don't refetch the whole thread every 5s.
 */
export const listMessages = async (conversationId, { since } = {}) => {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const data = await call(`/conversations/${conversationId}/messages${qs}`);
  return Array.isArray(data.messages) ? data.messages : [];
};

/**
 * Send a message to a conversation.
 * @param {string} conversationId
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.replyTo]  id of the message being replied to (quote).
 */
export const sendMessage = async (conversationId, text, { replyTo } = {}) => {
  const data = await call(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { text, ...(replyTo ? { replyTo } : {}) },
  });
  return data.message;
};

/**
 * Delete-for-everyone (soft delete). Only works on messages you sent; the
 * backend clears the content and notifies the other user in real-time.
 */
export const deleteMessage = async (conversationId, messageId) => {
  return call(`/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' });
};

/**
 * Send an image or voice message (multipart upload).
 * @param {string} conversationId
 * @param {Blob|File} file       the image / audio blob
 * @param {object} opts
 * @param {'image'|'audio'} opts.kind
 * @param {string=} opts.caption
 * @param {number=} opts.durationSec   voice length (audio only)
 * @param {string=} opts.filename
 */
export const sendMediaMessage = async (conversationId, file, { kind, caption = '', durationSec, filename } = {}) => {
  const fd = new FormData();
  fd.append('file', file, filename || (kind === 'audio' ? 'voice.webm' : 'photo.jpg'));
  fd.append('kind', kind);
  if (caption) fd.append('caption', caption);
  if (durationSec != null) fd.append('durationSec', String(durationSec));

  const t = getToken();
  const res = await fetch(`${API}/conversations/${conversationId}/media`, {
    method: 'POST',
    // NOTE: do NOT set Content-Type — the browser sets the multipart boundary.
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: fd,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.code || 'UPLOAD_FAILED');
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data.message;
};

/** Mark all messages in this conversation as read by the current user. */
export const markRead = async (conversationId) => {
  return call(`/conversations/${conversationId}/read`, { method: 'POST' });
};

export const getMissedMessagesCount = async (since) => {
  if (!since) return 0;
  const qs = `?since=${encodeURIComponent(since)}`;
  const data = await call(`/conversations/messages/missed${qs}`);
  return data.count || 0;
};

export default {
  listConversations,
  openConversation,
  listMessages,
  sendMessage,
  sendMediaMessage,
  markRead,
  deleteMessage,
  getMissedMessagesCount,
};
