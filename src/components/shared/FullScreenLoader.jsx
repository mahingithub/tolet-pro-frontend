import React from 'react';

/**
 * FullScreenLoader — the branded, futuristic "home rent" loading animation.
 *
 * The React twin of the instant boot splash in index.html: a rotating conic
 * "scanner" orbit with a glowing node circles a neon-glowing glass house whose
 * windows light up while a light beam sweeps over it. A holographic progress
 * bar, spark particles, and a glowing TO-LET PRO wordmark complete the look.
 *
 * Use it wherever the app waits on the server (initial page data, a slow
 * refetch, a route that needs to hydrate). All motion lives in .tp-home-*
 * classes (see index.css) which the app's "Reduce motion" setting neutralises
 * automatically, and every colour maps cleanly through the global dark theme.
 *
 * @param {object}  props
 * @param {string}  [props.message]      Status line (uppercase, tracked). An
 *                                       animated "…" is appended automatically.
 * @param {string}  [props.subMessage]   Optional smaller line underneath.
 * @param {boolean} [props.inline=false] Render as an in-flow block (fills its
 *                                       parent) instead of a fixed overlay.
 * @param {boolean} [props.overlay=false] When fixed, keep the backdrop
 *                                       translucent so the page shows through
 *                                       (good for a refetch over existing UI).
 * @param {boolean} [props.compact=false] Smaller mark — handy inside cards.
 * @param {string}  [props.minHeight]    Min height for inline mode (default 60vh).
 * @param {string}  [props.className]    Extra classes on the wrapper.
 */

// The TO-LET PRO building mark, recreated as inline SVG so it stays crisp at
// any size and can animate (windows glow) — matching the brand logo.
const BuildingGlyph = () => (
  <svg viewBox="0 0 64 64" className="relative z-[2] w-[56%] h-[56%] block" aria-hidden="true">
    {/* base */}
    <rect x="9" y="48.5" width="46" height="5.5" rx="2.75" fill="#ffffff" />
    {/* side wings */}
    <rect x="12.5" y="28" width="12" height="21" rx="3" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinejoin="round" />
    <rect x="39.5" y="28" width="12" height="21" rx="3" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinejoin="round" />
    {/* central tower */}
    <rect x="24.5" y="13" width="15" height="36" rx="4.5" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinejoin="round" />
    {/* tower nameplate slot */}
    <rect x="29" y="19.5" width="6" height="2.8" rx="1.4" fill="#ffffff" />
    {/* arched door */}
    <path d="M28.5 49 V44.5 a3.5 3.5 0 0 1 7 0 V49" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    {/* wing windows — glow in sequence */}
    <rect className="tp-home-win" x="15" y="32" width="7" height="8" rx="1.4" fill="rgba(255,211,122,0)" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
    <rect className="tp-home-win tp-home-win-2" x="42" y="32" width="7" height="8" rx="1.4" fill="rgba(255,211,122,0)" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);

// Twinkling spark particles scattered around the orbital stage.
const SPARKS = [
  { top: '8%', left: '18%', animationDelay: '0s' },
  { top: '20%', right: '12%', animationDelay: '.6s' },
  { bottom: '16%', left: '12%', animationDelay: '1.1s' },
  { bottom: '10%', right: '18%', animationDelay: '1.6s' },
];

export const HomeLoaderMark = ({ message, subMessage, compact = false }) => {
  const stage = compact ? 108 : 134;
  const tile = compact ? 66 : 82;
  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* orbital stage: rotating scanner rings + orbiting node + glass house */}
      <div className="tp-home-stage" style={{ width: stage, height: stage }}>
        <span className="tp-home-orbit" />
        <span className="tp-home-orbit-2" />
        <span className="tp-home-node" />
        {SPARKS.map((s, i) => (
          <span key={i} className="tp-home-spark" style={s} />
        ))}
        <span className="tp-home-tile" style={{ width: tile, height: tile }}>
          <span className="tp-home-scan" />
          <BuildingGlyph />
        </span>
      </div>

      {/* glowing wordmark */}
      <div className="font-black tracking-tighter text-xl leading-none [text-shadow:0_0_20px_rgba(186,0,54,0.14)]">
        <span className="text-gray-900">TO-LET</span>{' '}
        <span className="text-[#ba0036] [text-shadow:0_0_16px_rgba(186,0,54,0.45)]">PRO</span>
      </div>

      {/* holographic progress bar */}
      <div className="relative h-[6px] w-[190px] max-w-[72vw] overflow-hidden rounded-full bg-[#ba0036]/10 [box-shadow:inset_0_0_0_1px_rgba(186,0,54,0.14)]">
        <span className="tp-home-bar-fill" />
      </div>

      {message && (
        <p className="flex items-center text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400 text-center max-w-[16rem]">
          {message}
          <span className="ml-px inline-flex">
            <span className="tp-home-dot">.</span>
            <span className="tp-home-dot tp-home-dot-2">.</span>
            <span className="tp-home-dot tp-home-dot-3">.</span>
          </span>
        </p>
      )}
      {subMessage && (
        <p className="-mt-3 text-xs font-medium text-gray-400 text-center max-w-[18rem]">{subMessage}</p>
      )}
    </div>
  );
};

// Fades the tech grid out toward the edges so it reads as ambient, not busy.
const GRID_MASK = 'radial-gradient(circle at 50% 45%, #000, transparent 70%)';

const FullScreenLoader = ({
  message = 'Finding your next home',
  subMessage,
  inline = false,
  overlay = false,
  compact = false,
  minHeight = '60vh',
  className = '',
}) => {
  if (inline) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={message}
        className={`flex w-full items-center justify-center px-4 ${className}`}
        style={{ minHeight }}
      >
        <HomeLoaderMark message={message} subMessage={subMessage} compact={compact} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-4 ${
        overlay ? 'bg-white/70 backdrop-blur-md' : 'bg-white/95 backdrop-blur-sm'
      } ${className}`}
    >
      {/* ambient tech-grid backdrop */}
      <div
        className="tp-grid pointer-events-none absolute inset-0 opacity-60"
        style={{ WebkitMaskImage: GRID_MASK, maskImage: GRID_MASK }}
      />
      <div className="relative">
        <HomeLoaderMark message={message} subMessage={subMessage} compact={compact} />
      </div>
    </div>
  );
};

export default FullScreenLoader;
