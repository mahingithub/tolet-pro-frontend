/*
 * inquiryUnread.js
 * ──────────────────────────────────────────────────────────────────────────
 * Lightweight, client-side "unread until opened" tracking for inquiry lists.
 *
 * We persist, per inquiry id, a "signature" of the activity the user has
 * already seen. An inquiry is UNREAD when its current signature differs from
 * the stored one, and OPENING (expanding) its card records the current
 * signature — so a new inquiry / new reply stays highlighted until viewed.
 *
 * Signatures are role-aware, because "new activity" means different things:
 *   • host   → a new message FROM THE TENANT. The host's own replies must not
 *              re-flag the card, so the signature is the incoming-message
 *              count (tenant/guest messages only).
 *   • tenant → the landlord ACTED (status change / reply / visit), which bumps
 *              the inquiry's updatedAt. A freshly-sent inquiry (updatedAt ===
 *              createdAt) is NOT unread — the tenant knows they just sent it.
 *
 * Persistence is per role + browser (localStorage), so the highlight survives
 * reloads. It is intentionally not synced to the server: this is a personal
 * "have I looked at this yet" hint, not an authoritative read receipt.
 */

const KEY = (role) => `tlp_inq_seen_${role === 'host' ? 'host' : 'tenant'}_v1`;

// A message counts as "from the host side" when its sender is the landlord/owner.
// Plain-string messages (legacy) and tenant-sent messages count as incoming.
const isHostSender = (m) => {
  const s = (typeof m === 'string' ? '' : (m && m.sender) || '').toLowerCase();
  return s === 'host' || s === 'landlord' || s === 'owner';
};

const inquiryId = (inquiry) => (inquiry && (inquiry.id || inquiry._id)) || '';

/**
 * Current activity signature for an inquiry. Empty string means "nothing to
 * flag" (e.g. a tenant's freshly-sent inquiry with no landlord activity yet).
 */
export const inquirySignature = (inquiry, role) => {
  if (!inquiry) return '';
  if (role === 'host') {
    const msgs = Array.isArray(inquiry.messages) ? inquiry.messages : [];
    const incoming = msgs.filter((m) => !isHostSender(m)).length;
    // Fall back to the base inquiry message when the thread array is empty.
    const count = incoming > 0 ? incoming : (inquiry.msg ? 1 : 0);
    return count > 0 ? `h:${count}` : '';
  }
  // tenant
  const created = inquiry.createdAt || inquiry.created_at || '';
  const updated = inquiry.updatedAt || inquiry.updated_at || '';
  if (!updated || updated === created) return ''; // no landlord activity yet
  return `t:${updated}`;
};

/** Read the persisted { [inquiryId]: signature } map for a role. */
export const loadSeenMap = (role) => {
  try {
    return JSON.parse(localStorage.getItem(KEY(role)) || '{}') || {};
  } catch {
    return {};
  }
};

/** True when the inquiry has activity the user hasn't opened yet. */
export const isInquiryUnread = (inquiry, role, seenMap) => {
  const sig = inquirySignature(inquiry, role);
  if (!sig) return false;
  const id = inquiryId(inquiry);
  return !!id && (seenMap || {})[id] !== sig;
};

/**
 * Record the inquiry's current signature as "seen". Returns the NEW map (or
 * the same reference when nothing changed, so callers can skip a re-render).
 */
export const markInquirySeen = (role, inquiry, seenMap) => {
  const sig = inquirySignature(inquiry, role);
  const id = inquiryId(inquiry);
  const map = seenMap || {};
  if (!id || !sig || map[id] === sig) return map;
  const next = { ...map, [id]: sig };
  try {
    localStorage.setItem(KEY(role), JSON.stringify(next));
  } catch {
    /* storage full / unavailable — highlight just won't persist */
  }
  return next;
};
