/**
 * livingService — client for the connected "Roommate Wallet" (Household) API.
 * Mirrors the app's other services (native fetch, `auth:token` bearer, throws
 * on non-2xx). Every mutation resolves to `{ household }` — the full,
 * server-authoritative wallet — which the store applies directly.
 */

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const getToken = () => window.localStorage.getItem('auth:token');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

async function req(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${API}/living${path}`, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
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
    throw err;
  }
  return data;
}

export const livingService = {
  // household
  getHousehold: (signal) => req('/household', { signal }),
  createHousehold: (name) => req('/household', { method: 'POST', body: { name } }),
  joinHousehold: (code) => req('/household/join', { method: 'POST', body: { code } }),
  leaveHousehold: () => req('/household/leave', { method: 'POST' }),
  regenerateCode: () => req('/household/regenerate-code', { method: 'POST' }),
  updateConfig: (patch) => req('/household', { method: 'PATCH', body: patch }),

  // members
  addMember: (name, color) => req('/members', { method: 'POST', body: { name, color } }),
  removeMember: (id) => req(`/members/${id}`, { method: 'DELETE' }),

  // expenses
  addExpense: (e) => req('/expenses', { method: 'POST', body: e }),
  updateExpense: (id, patch) => req(`/expenses/${id}`, { method: 'PATCH', body: patch }),
  deleteExpense: (id) => req(`/expenses/${id}`, { method: 'DELETE' }),

  // bills
  addBill: (b) => req('/bills', { method: 'POST', body: b }),
  updateBill: (id, patch) => req(`/bills/${id}`, { method: 'PATCH', body: patch }),
  deleteBill: (id) => req(`/bills/${id}`, { method: 'DELETE' }),

  // meals + groceries
  setMeal: (p) => req('/meals', { method: 'PUT', body: p }),
  addGrocery: (g) => req('/groceries', { method: 'POST', body: g }),
  deleteGrocery: (id) => req(`/groceries/${id}`, { method: 'DELETE' }),

  // settlements
  addSettlement: (s) => req('/settlements', { method: 'POST', body: s }),
};

export default livingService;
