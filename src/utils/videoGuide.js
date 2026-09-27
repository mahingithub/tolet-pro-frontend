/**
 * videoGuide.js — small helpers for admin-managed video guides.
 * Shared by shared/VideoGuides.jsx (grids of guides) and shared/Explainer.jsx
 * (the one explainer video per feature).
 */

// Pull a YouTube video id out of the common URL shapes so we can show a
// thumbnail. Non-YouTube URLs (e.g. direct MP4) simply fall back to a branded
// gradient tile.
const youTubeId = (url = '') => {
  try {
    if (url.includes('youtube.com/watch')) return new URL(url).searchParams.get('v') || '';
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?&]/)[0];
    if (url.includes('youtube.com/embed/')) return url.split('embed/')[1].split(/[?&]/)[0];
    if (url.includes('youtube.com/shorts/')) return url.split('shorts/')[1].split(/[?&]/)[0];
  } catch {
    /* ignore malformed URLs */
  }
  return '';
};

/** A poster image for the guide's video, or '' when there is none to get. */
export const thumbFor = (url) => {
  const id = youTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/**
 * 75 → "1:15" / "১:১৫". Empty when the admin left the length blank — a video
 * with no length shown is fine; a wrong one is not.
 */
export function formatDuration(sec, bn) {
  const n = Math.round(Number(sec));
  if (!Number.isFinite(n) || n <= 0) return '';
  const text = `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  return bn ? text.replace(/\d/g, (d) => BN_DIGITS[d]) : text;
}
