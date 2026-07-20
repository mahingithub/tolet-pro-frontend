import React from 'react';

/**
 * FullScreenLoader — the branded "home rent" loading animation.
 *
 * This is the React twin of the instant boot splash in index.html: a little
 * house whose windows light up while data arrives, the TO-LET PRO wordmark,
 * and an indeterminate progress bar. Use it wherever the app is waiting on the
 * server (initial page data, a slow refetch, a route that needs to hydrate).
 *
 * All motion lives in .tp-home-* classes (see index.css) which the app's
 * "Reduce motion" setting neutralises automatically, and every colour maps
 * cleanly through the global dark-theme rules.
 *
 * @param {object}  props
 * @param {string}  [props.message]      Big status line (uppercase, tracked).
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

const HouseGlyph = () => (
  <svg viewBox="0 0 64 64" className="w-[54%] h-[54%] block" aria-hidden="true">
    {/* roof */}
    <path
      d="M6 31.5 L32 9 L58 31.5"
      fill="none"
      stroke="#ffffff"
      strokeWidth="4.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* body */}
    <path d="M12 29 L12 53 Q12 55 14 55 L50 55 Q52 55 52 53 L52 29 Z" fill="#ffffff" />
    {/* windows — light up in sequence */}
    <rect className="tp-home-win" x="18.5" y="34" width="9" height="9" rx="2" fill="rgba(255,255,255,.92)" />
    <rect className="tp-home-win tp-home-win--2" x="36.5" y="34" width="9" height="9" rx="2" fill="rgba(255,255,255,.92)" />
    {/* door */}
    <rect x="27" y="45" width="10" height="10" rx="1.6" fill="#ba0036" />
  </svg>
);

export const HomeLoaderMark = ({ message, subMessage, compact = false }) => {
  const box = compact ? 60 : 78;
  const badge = compact ? 84 : 104;
  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="relative flex items-center justify-center" style={{ width: badge, height: badge }}>
        {/* radar rings — "searching for homes" */}
        <span
          className="tp-home-ring absolute top-1/2 left-1/2 rounded-[24px] border-2 border-[#ba0036]/40"
          style={{ width: box, height: box, opacity: 0, transform: 'translate(-50%, -50%)' }}
        />
        <span
          className="tp-home-ring tp-home-ring--2 absolute top-1/2 left-1/2 rounded-[24px] border-2 border-[#ba0036]/40"
          style={{ width: box, height: box, opacity: 0, transform: 'translate(-50%, -50%)' }}
        />
        {/* brand tile + house */}
        <span
          className="tp-home-bob relative z-[2] flex items-center justify-center rounded-[22px] bg-gradient-to-br from-[#ba0036] to-[#e60045] shadow-[0_18px_40px_-12px_rgba(186,0,54,0.55),0_6px_16px_rgba(186,0,54,0.28)]"
          style={{ width: box, height: box }}
        >
          <HouseGlyph />
        </span>
      </div>

      <div className="font-black tracking-tighter text-xl leading-none">
        <span className="text-gray-900">TO-LET</span> <span className="text-[#ba0036]">PRO</span>
      </div>

      <div className="relative h-[5px] w-[172px] max-w-[70vw] overflow-hidden rounded-full bg-[#ba0036]/15">
        <span
          className="tp-home-bar-fill absolute top-0 h-full w-[42%] rounded-full bg-gradient-to-r from-[#ba0036] to-[#e60045]"
          style={{ left: '-45%' }}
        />
      </div>

      {message && (
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 text-center max-w-[16rem]">
          {message}
        </p>
      )}
      {subMessage && (
        <p className="-mt-2 text-xs font-medium text-gray-400 text-center max-w-[18rem]">{subMessage}</p>
      )}
    </div>
  );
};

const FullScreenLoader = ({
  message = 'Finding your next home…',
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
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 ${
        overlay ? 'bg-white/70 backdrop-blur-md' : 'bg-white/95 backdrop-blur-sm'
      } ${className}`}
    >
      <HomeLoaderMark message={message} subMessage={subMessage} compact={compact} />
    </div>
  );
};

export default FullScreenLoader;
