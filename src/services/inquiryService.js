/**
 * inquiryService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Frontend client for the inquiry endpoints.
 *
 *   POST   /api/inquiries                createInquiry (auth) — repeat inquiry
 *                                         on the same property APPENDS to thread
 *   GET    /api/inquiries/mine           listMyInquiries (auth, tenant)
 *   POST   /api/inquiries/:id/reply      reply / follow-up message (auth)
 *   POST   /api/inquiries/:id/visit      propose a visit (auth)
 *   PATCH  /api/inquiries/:id/visit      accept/reject a visit (auth)
 *   PATCH  /api/inquiries/:id/status     updateInquiryStatus (auth, host)
 *   GET    /api/host/inquiries           listHostInquiries (auth, host)
 *   DELETE /api/inquiries/:id            deleteInquiry (auth)
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
    const err = new Error(data.message || 'অনুরোধে সমস্যা হয়েছে।');
    err.code = data.code;
    err.details = data.details;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── Tenant side ────────────────────────────────────────────────────────────

/**
 * Send an inquiry to the host of a property. A second inquiry on the same
 * property appends to the existing thread server-side (no duplicate card).
 */
export const createInquiry = async ({ propertyId, message, leaseStart, leaseEnd }) => {
  const data = await call('/inquiries', {
    method: 'POST',
    body: {
      propertyId,
      message,
      ...(leaseStart ? { leaseStart } : {}),
      ...(leaseEnd   ? { leaseEnd   } : {}),
    },
  });
  return data.inquiry;
};

/** Tenant's own outgoing inquiries. */
export const listMyInquiries = async () => {
  const data = await call('/inquiries/mine');
  return Array.isArray(data.inquiries) ? data.inquiries : [];
};

// ─── Shared (landlord + tenant) — thread + visit ────────────────────────────

/**
 * Append a message to an inquiry thread. Landlord "Reply" or tenant follow-up.
 * Server decides sender ('landlord' | 'tenant') from the auth token.
 * @returns {{ inquiry, message }}
 */
export const replyToInquiry = async (id, text) => {
  const data = await call(`/inquiries/${id}/reply`, {
    method: 'POST',
    body: { text },
  });
  return data; // { inquiry, message }
};

/**
 * Propose a visit slot (either party).
 * @param {object} slot { date: 'YYYY-MM-DD', time: 'HH:mm', location?: string }
 */
export const proposeVisit = async (id, { date, time, location }) => {
  const data = await call(`/inquiries/${id}/visit`, {
    method: 'POST',
    body: { date, time, location },
  });
  return data.inquiry;
};

/**
 * Accept or reject a pending visit (must be the party who did NOT propose).
 * @param {'accept'|'reject'} action
 */
export const respondVisit = async (id, action) => {
  const data = await call(`/inquiries/${id}/visit`, {
    method: 'PATCH',
    body: { action },
  });
  return data.inquiry;
};

// ─── Host side ──────────────────────────────────────────────────────────────

/** Host's incoming inquiries (every property they own). */
export const listHostInquiries = async ({ status } = {}) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await call(`/host/inquiries${qs}`);
  return Array.isArray(data.inquiries) ? data.inquiries : [];
};

/** Move an inquiry through its lifecycle. Status enum must match the model:
 *  'sent' | 'delivered' | 'viewed' | 'accepted' | 'rejected'
 *  | 'visit_scheduled' | 'final_booking'. */
export const updateInquiryStatus = async (id, status) => {
  const data = await call(`/inquiries/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
  return data.inquiry;
};

/** Delete/withdraw an inquiry (either party). */
export const deleteInquiry = async (id) => {
  const data = await call(`/inquiries/${id}`, {
    method: 'DELETE',
  });
  return data;
};

export default {
  createInquiry,
  listMyInquiries,
  replyToInquiry,
  proposeVisit,
  respondVisit,
  listHostInquiries,
  updateInquiryStatus,
  deleteInquiry,
};