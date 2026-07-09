/**
 * aiGuideService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Public helpers for fetching admin-managed video guides that appear inside
 * page sections (the "How it Works" and "Help & Support" pages).
 *
 * Videos are created/edited by admins in the AI Video Guides manager
 * (/admin/support → "AI Video Guides") with a `placement` of "how_it_works"
 * or "support" and an `audience` of "tenant" | "landlord" | "all".
 */

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

/**
 * Fetch active guides for a public page section.
 *
 * @param {'how_it_works'|'support'} placement
 * @param {'tenant'|'landlord'} [audience] optional role filter (returns that
 *        role's guides plus "all"-audience guides). Omit to get every active
 *        guide for the placement and split by audience client-side.
 * @returns {Promise<Array>} guides sorted by `order` (empty array on failure).
 */
export const getSectionGuides = async (placement, audience) => {
  try {
    const qs = audience ? `?audience=${encodeURIComponent(audience)}` : '';
    const res = await fetch(`${API}/ai-guides/section/${placement}${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Sections degrade gracefully — if guides can't load the page still renders.
    return [];
  }
};
