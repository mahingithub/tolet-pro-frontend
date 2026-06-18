/**
 * insightsService.js — HTTP client for /api/host/insights.
 * ──────────────────────────────────────────────────────────────────────────
 * Follows the same fetch + Bearer auth pattern used by bookingService.js,
 * inquiryService.js, etc.
 */

import { getCurrentToken } from './authService';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

async function request(path) {
  const token = getCurrentToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Fetch AI Insights for the logged-in host. */
export async function fetchHostInsights() {
  const { data } = await request('/api/host/insights');
  return data;
}
