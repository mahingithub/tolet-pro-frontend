/**
 * livingService — client for the connected "Roommate Wallet" (Household) API.
 * Mirrors the app's other services (native fetch, `auth:token` bearer, throws
 * on non-2xx). Every mutation resolves to `{ household }` — the full,
 * server-authoritative wallet — which the store applies directly.
 */

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const getToken = () => window.localStorage.getItem('auth:token');

const headers = (opId) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  // Idempotency key for the offline write queue. Sent as a HEADER (not in the
  // body) so it works for DELETE too and can never be mistaken for a field of
  // the entity being written. The server applies each id exactly once.
  ...(opId ? { 'X-Op-Id': opId } : {}),
});

async function req(path, { method = 'GET', body, signal, opId } = {}) {
  let res;
  try {
    res = await fetch(`${API}/living${path}`, {
      method,
      headers: headers(opId),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    // fetch only rejects when the request never got an answer — no network, DNS
    // failure, the server unreachable. The queue treats this as "try again
    // later"; a 4xx/5xx below means the server DID answer and is a real refusal.
    const err = new Error('নেটওয়ার্কে পৌঁছানো যায়নি।');
    err.offline = true;
    err.cause = cause;
    throw err;
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty / non-JSON body */
  }
  if (!res.ok) {
    const err = new Error(data.message || 'অনুরোধ ব্যর্থ হয়েছে।');
    err.status = res.status;
    err.code = data.code;
    // 5xx / 429 are the server having a bad moment, not a refusal of the write.
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }
  return data;
}

// Every mutation takes a trailing `opId` — the queue's idempotency key. Calls
// made outside the queue (household create/join/leave) simply pass nothing.
export const livingService = {
  // household
  getHousehold: (signal) => req('/household', { signal }),
  createHousehold: (name) => req('/household', { method: 'POST', body: { name } }),
  joinHousehold: (code) => req('/household/join', { method: 'POST', body: { code } }),
  leaveHousehold: (password) => req('/household/leave', { method: 'POST', body: { password } }),
  regenerateCode: () => req('/household/regenerate-code', { method: 'POST' }),
  updateConfig: (patch, opId) => req('/household', { method: 'PATCH', body: patch, opId }),

  // members
  addMember: (name, color) => req('/members', { method: 'POST', body: { name, color } }),
  removeMember: (id) => req(`/members/${id}`, { method: 'DELETE' }),

  // expenses
  addExpense: (e, opId) => req('/expenses', { method: 'POST', body: e, opId }),
  updateExpense: (id, patch, opId) => req(`/expenses/${id}`, { method: 'PATCH', body: patch, opId }),
  deleteExpense: (id, opId) => req(`/expenses/${id}`, { method: 'DELETE', opId }),

  // bills
  addBill: (b, opId) => req('/bills', { method: 'POST', body: b, opId }),
  updateBill: (id, patch, opId) => req(`/bills/${id}`, { method: 'PATCH', body: patch, opId }),
  deleteBill: (id, opId) => req(`/bills/${id}`, { method: 'DELETE', opId }),

  // meals + groceries
  setMeal: (p, opId) => req('/meals', { method: 'PUT', body: p, opId }),
  addGrocery: (g, opId) => req('/groceries', { method: 'POST', body: g, opId }),
  deleteGrocery: (id, opId) => req(`/groceries/${id}`, { method: 'DELETE', opId }),

  // settlements
  addSettlement: (s, opId) => req('/settlements', { method: 'POST', body: s, opId }),
  deleteSettlement: (id, opId) => req(`/settlements/${id}`, { method: 'DELETE', opId }),

  // mess deposits (জমা)
  addDeposit: (d, opId) => req('/deposits', { method: 'POST', body: d, opId }),
  deleteDeposit: (id, opId) => req(`/deposits/${id}`, { method: 'DELETE', opId }),

  // ── solo খাতা ─────────────────────────────────────────────────────────────
  // The private single-user wallet. Same queue, same idempotency key; the only
  // difference is that every row carries the id THIS phone minted, so an entry
  // written offline never changes identity once it reaches the server.
  // Resolves to `{ ledger }` — or `{ ledger: null }` when the server has never
  // seen this খাতা, which is what triggers the one-time merge upload.
  getSolo: (signal) => req('/solo', { signal }),
  mergeSolo: (ledger, opId) => req('/solo/merge', { method: 'POST', body: ledger, opId }),
  updateSolo: (patch, opId) => req('/solo', { method: 'PATCH', body: patch, opId }),
  resetSolo: (opId) => req('/solo', { method: 'DELETE', opId }),

  addSoloPerson: (p, opId) => req('/solo/people', { method: 'POST', body: p, opId }),
  updateSoloPerson: (id, patch, opId) => req(`/solo/people/${id}`, { method: 'PATCH', body: patch, opId }),
  deleteSoloPerson: (id, opId) => req(`/solo/people/${id}`, { method: 'DELETE', opId }),

  addSoloEntry: (e, opId) => req('/solo/entries', { method: 'POST', body: e, opId }),
  updateSoloEntry: (id, patch, opId) => req(`/solo/entries/${id}`, { method: 'PATCH', body: patch, opId }),
  deleteSoloEntry: (id, opId) => req(`/solo/entries/${id}`, { method: 'DELETE', opId }),
};

export default livingService;
