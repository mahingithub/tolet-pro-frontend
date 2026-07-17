/**
 * reviewService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Person-to-person reviews (landlord <-> tenant reputation that lives on the
 * profile pages, not on a property listing).
 *
 * ALL endpoints require auth:
 *   • Reviews are visible to logged-in users only.
 *   • Any logged-in user may leave ONE review for any OTHER user (no booking
 *     relationship required). Re-submitting edits the existing review.
 *
 * Mirrors the API base + token conventions used by Propertyservice.js.
 */

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const getToken = () => window.localStorage.getItem('auth:token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

async function parse(res) {
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.code || 'REVIEW_REQUEST_FAILED');
    err.code = data.code;
    err.status = res.status;
    // Backend ApiError carries a user-facing (Bangla) `message`.
    err.serverMessage = data.message;
    throw err;
  }
  return data;
}

export const reviewService = {
  // List a profile's reviews for a role. → { reviews[], summary:{avg,count}, myReview }
  async getReviews(revieweeId, role) {
    const url = `${API}/reviews?revieweeId=${encodeURIComponent(revieweeId)}&role=${encodeURIComponent(role)}`;
    const res = await fetch(url, { headers: authHeaders() });
    return parse(res);
  },

  // Create or update the current user's review. → { review, summary }
  async submitReview({ revieweeId, revieweeRole, rating, comment }) {
    const res = await fetch(`${API}/reviews`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ revieweeId, revieweeRole, rating, comment }),
    });
    return parse(res);
  },

  // Delete your own review by id. → { ok, summary }
  async deleteReview(id) {
    const res = await fetch(`${API}/reviews/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return parse(res);
  },
};

export default reviewService;
