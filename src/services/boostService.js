/**
 * boostService.js
 * ──────────────────────────────────────────────────────────────────────────
 * The Plus plan's "1× Top Search Boost / month".
 *
 * A Plus host spends one monthly credit to pin a listing to the top of the
 * search feed for 24 hours. Pro listings already rank above everything else
 * (that's "Super Boost & Top Position"), so the API reports canBoost:false
 * with reason 'pro_always_top' for them — the UI shows an explanation rather
 * than a button. Free hosts get 'upgrade_required'.
 *
 * Credits reset (they do NOT accumulate) on the 1st of each month.
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

async function call(path, { method = 'GET' } = {}) {
  const res = await fetch(`${API}${path}`, { method, headers: authHeaders() });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.message || 'অনুরোধে সমস্যা হয়েছে।');
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const boostService = {
  /**
   * Credits remaining this month.
   * @returns {Promise<{tier, creditsRemaining, monthlyAllowance, canBoost, reason}>}
   */
  async getStatus() {
    if (!getToken()) {
      return { tier: 'free', creditsRemaining: 0, monthlyAllowance: 0, canBoost: false, reason: 'upgrade_required' };
    }
    try {
      const data = await call('/boost/status');
      return data.boost;
    } catch {
      // The Boost button is an enhancement — a failed status read must never
      // break the dashboard. Fall back to "can't boost".
      return { tier: 'free', creditsRemaining: 0, monthlyAllowance: 0, canBoost: false, reason: 'unavailable' };
    }
  },

  /**
   * Spend one credit on `propertyId`. Throws ApiError-shaped errors with
   * `code` set to boost_upgrade_required | boost_no_credits | not_owner.
   */
  async boost(propertyId) {
    return call(`/boost/${propertyId}`, { method: 'POST' });
  },
};

export default boostService;
