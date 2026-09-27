/**
 * Explainer.jsx — the video-first building blocks every explaining screen uses.
 * ─────────────────────────────────────────────────────────────────────────────
 * People watch; they don't read. So a screen that explains a feature leads with
 * ONE line of text and a video, and keeps its long copy folded away for anyone
 * who would rather read. These are the pieces, shared so the homepage, the
 * feature landing pages, /to-let and /how-it-works look and behave alike:
 *
 *   useExplainerVideo(s)   the admin-managed video for a placement, fetched
 *                          once per page load (AI Video Guides → feature_*).
 *   ExplainerVideo         the poster + play button; opens the player itself.
 *   ReadMoreFold           the "prefer reading?" <details>. Closed content is
 *                          still in the DOM, so it is still indexed.
 *   Eyebrow                the small label pill, never letter-spaced in Bangla.
 *
 * The persuasion is deliberately honest — it helps people see the benefit, it
 * never pressures them:
 *   • a short, KNOWN length on every video ("১:১৫") — people press play when
 *     they know what it costs them; the admin enters it (durationSec);
 *   • watching comes before committing — the video is the first action, the
 *     sign-up is the second;
 *   • reading is offered, not imposed — autonomy keeps people on the page.
 * No invented numbers, countdowns, fake scarcity or guilt-trip buttons.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Play } from 'lucide-react';

import { getSectionGuides } from '../../services/aiGuideService';
import { thumbFor, formatDuration } from '../../utils/videoGuide';
import VideoModal from './VideoModal';

/* ── Fetching ─────────────────────────────────────────────────────────────── */

// One request per placement per page load. The homepage mounts its mobile and
// desktop trees together (CSS-hidden, not unmounted), and a video can appear on
// several screens, so without this the same guide was fetched repeatedly.
const cache = new Map();
const loadExplainerVideo = (placement) => {
  if (!placement) return Promise.resolve(null);
  if (!cache.has(placement)) {
    cache.set(placement, getSectionGuides(placement).then((guides) => guides[0] || null));
  }
  return cache.get(placement);
};

/**
 * Guides for several placements, in order. Each entry is `undefined` while
 * loading and `null` once we know there is no video — a hero can then hold a
 * neutral placeholder instead of flashing the wrong content.
 */
export function useExplainerVideos(placements) {
  const key = placements.join('|');
  const [guides, setGuides] = useState(() => placements.map(() => undefined));
  useEffect(() => {
    let alive = true;
    Promise.all(key.split('|').map((p) => loadExplainerVideo(p || null)))
      .then((g) => { if (alive) setGuides(g); });
    return () => { alive = false; };
  }, [key]);
  return guides;
}

/** The guide for one placement: undefined (loading), null (none — normal), or the guide. */
export function useExplainerVideo(placement) {
  return useExplainerVideos([placement || ''])[0];
}

export { formatDuration };

/* ── The video ────────────────────────────────────────────────────────────── */

/**
 * @param {object}  props
 * @param {object}  props.guide     an AI guide ({ videoUrl, title, durationSec })
 * @param {'hero'|'card'|'row'} [props.variant]
 *        hero  the big player beside a page's headline;
 *        card  full-width preview on top of a feature card;
 *        row   a small thumbnail at the start of a list row.
 * @param {string}  props.label     accessible name — say WHICH video it is.
 * @param {string}  [props.chip]    visible call to action ("ভিডিওতে দেখুন").
 * @param {boolean} props.bn
 */
export function ExplainerVideo({ guide, variant = 'card', label, chip, bn, className = '' }) {
  const [open, setOpen] = useState(false);
  if (!guide) return null;

  const thumb = thumbFor(guide.videoUrl);
  const length = formatDuration(guide.durationSec, bn);
  const hero = variant === 'hero';
  const row = variant === 'row';

  const frame = {
    hero: 'block w-full aspect-video rounded-[28px] ring-1 ring-white/25 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]',
    card: 'block w-full aspect-video',
    row: 'w-[92px] aspect-video rounded-xl',
  }[variant] || '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={length ? `${label} (${length})` : label}
        className={`group/video relative z-10 shrink-0 overflow-hidden bg-gradient-to-br from-[#ba0036] to-[#e60045] ${frame} ${className}`}
      >
        {thumb && (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/video:scale-[1.04]"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <span className={`absolute inset-0 bg-gradient-to-t ${hero ? 'from-black/65 via-black/15' : 'from-black/50 via-black/10'} to-transparent`} />

        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={`flex items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform duration-300 group-hover/video:scale-110 ${
              hero ? 'w-14 h-14 ring-[6px] md:w-20 md:h-20 md:ring-[10px] ring-white/20' : row ? 'w-8 h-8' : 'w-14 h-14'
            }`}
          >
            <Play size={hero ? 26 : row ? 13 : 22} className="ml-1 text-[#ba0036] md:scale-110" fill="currentColor" />
          </span>
        </span>

        {row ? (
          length && (
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-bold leading-4 text-white tabular-nums">
              {length}
            </span>
          )
        ) : (
          // safe-area-ok — the caption strip along the bottom of the video
          // poster, positioned inside the button, never at the screen edge.
          <span className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 text-left ${hero ? 'p-4 md:p-5' : 'p-3'}`}>
            <span className="min-w-0">
              {hero && guide.title && (
                <span className="block truncate text-[15px] font-black text-white">{guide.title}</span>
              )}
              {chip && (
                <span className={`inline-flex items-center gap-1.5 font-bold text-white ${hero ? 'mt-0.5 text-[12px] text-white/80' : 'rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[11px]'}`}>
                  <Play size={10} fill="currentColor" /> {chip}
                </span>
              )}
            </span>
            {length && (
              <span className="shrink-0 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-white tabular-nums">
                {length}
              </span>
            )}
          </span>
        )}
      </button>

      {/* Portalled: callers sit inside stacking contexts (the homepage wraps
          its sections in `relative z-10`) where even the modal's z-[100001]
          renders under the sticky navbar. */}
      {open && createPortal(
        <VideoModal isOpen onClose={() => setOpen(false)} videoUrl={guide.videoUrl} title={guide.title} />,
        document.body,
      )}
    </>
  );
}

/* ── The fold ─────────────────────────────────────────────────────────────── */

/** The long copy, opened by choice. Closed <details> content is still indexed. */
export function ReadMoreFold({ bn, title, children, className = '' }) {
  return (
    <details className={`group/story rounded-[28px] border border-gray-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 lg:p-7 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-[#ba0036]">
            {bn ? 'পড়তে ভালোবাসেন?' : 'Prefer reading?'}
          </span>
          <span className={`mt-1 block text-lg md:text-xl font-black text-gray-900 ${bn ? 'leading-snug' : 'tracking-tight leading-snug'}`}>
            {title}
          </span>
        </span>
        <span className="w-10 h-10 shrink-0 rounded-full bg-[#ba0036]/[0.07] text-[#ba0036] flex items-center justify-center transition-transform duration-300 group-open/story:rotate-180">
          <ChevronDown size={18} strokeWidth={2.4} />
        </span>
      </summary>
      <div className="border-t border-gray-100 px-6 lg:px-7 py-8">{children}</div>
    </details>
  );
}

/* ── The label ────────────────────────────────────────────────────────────── */

/**
 * The small pill above a heading. `tracking-*` pulls the parts of a Bangla word
 * apart (টু-লেট rendered as "টু - লে ট"), so spacing and caps are English-only.
 *
 * @param {'brand'|'light'} [tone] light = on the red hero gradients.
 */
export function Eyebrow({ bn, tone = 'brand', size = 'md', className = '', children }) {
  const tones = {
    brand: 'border-[#ba0036]/15 bg-[#ba0036]/[0.06] text-[#ba0036]',
    light: 'border-white/20 bg-white/10 text-white',
  };
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border font-bold ${tones[tone]} ${
        bn ? '' : 'uppercase tracking-[0.14em]'
      } ${size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'} ${className}`}
    >
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${tone === 'light' ? 'bg-white' : 'bg-[#ba0036]'}`} />
      {children}
    </p>
  );
}
