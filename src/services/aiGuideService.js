/**
 * aiGuideService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Public helpers for fetching admin-managed video guides that appear inside
 * page sections ("How it Works", "Help & Support", Subscription, Checkout)
 * and popups (the Free Pro Trial task).
 *
 * Videos are created/edited by admins in the AI Video Guides manager
 * (/admin/support → "AI Video Guides") with a `placement` of "how_it_works",
 * "support", "subscription", "checkout" or "free_trial_mode", and an
 * `audience` of "tenant" | "landlord" | "all".
 */

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

/**
 * Fetch active guides for a public page section.
 *
 * @param {'how_it_works'|'support'|'subscription'|'checkout'|'free_trial_mode'} placement
 * @param {'tenant'|'landlord'} [audience] optional role filter (returns that
 *        role's guides plus "all"-audience guides). Omit to get every active
 *        guide for the placement and split by audience client-side.
 * @returns {Promise<Array>} guides sorted by `order` (empty array on failure).
 */
export const getDeviceCategory = () => {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
};

export const getSectionGuides = async (placement, audience) => {
  try {
    const devCat = getDeviceCategory();
    let qs = `?deviceCategory=${devCat}`;
    if (audience) qs += `&audience=${encodeURIComponent(audience)}`;
    const res = await fetch(`${API}/ai-guides/section/${placement}${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Sections degrade gracefully — if guides can't load the page still renders.
    return [];
  }
};
