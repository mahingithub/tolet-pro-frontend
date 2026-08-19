import React, { useEffect, useRef, useState } from 'react';

/**
 * YouTubeBackground — a decorative YouTube loop with none of YouTube's own UI.
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared by the desktop hero (HeroSection.jsx) and the mobile home banner
 * (mobile/MobileHome.jsx), which both mount on every homepage load — HomePage
 * hides one with CSS — so the two must not each hand-roll this.
 *
 * `controls=0` is not enough on YouTube's current embed player: it keeps a
 * centre play/pause button and a buffering spinner, and paints them for ~4.3s
 * after *any* restart. Measured identically for a native `loop=1&playlist=`
 * embed, for an API `seekTo(0)`, and for a mid-clip seek — so with a 15s clip
 * that is a control sitting in the middle of the frame every 15 seconds.
 *
 * Since the chrome cannot be turned off it is never left uncovered: the clip's
 * own still frame is raised over the video for each restart and lowered only
 * once that window has passed. The dissolve also hides the hard cut the loop
 * would otherwise make, and it doubles as the fallback whenever the video can't
 * run — autoplay refused, API blocked, reduced-motion — where the surface
 * simply stays a still image.
 *
 * Usage: drop into a `relative overflow-hidden` box of any aspect ratio; the
 * player is sized to cover it. The poster sits at z-5, so anything layered on
 * top (gradients, headlines) needs z-10 or higher.
 */

// The reveal is counted in *played seconds*, not wall clock: if a restart stalls
// on a slow connection the chrome stays up for as long as the stall, so a timer
// would uncover it mid-spinner.
const CHROME_S    = 4.6;  // played seconds before the video is revealed
// getDuration() reports the nominal length (16s for a clip whose media actually
// ends at ~15.06s), so the rewind has to start well clear of it — trimming the
// tail of a background loop costs nothing, overrunning it means the player
// reaches ENDED and paints its replay UI.
const LOOP_LEAD_S = 2.5;
const SEEK_DELAY  = 300;  // let the poster reach full opacity, then rewind

let ytApiPromise = null;
const loadYouTubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prevReady?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src   = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
  return ytApiPromise;
};

// The player is sized to a true 16:9 cover box so the video fills the frame with
// no letterbox bars, and so the iframe's edges (where the player puts its title
// and branding row) fall outside the parent's crop. The poster drifts slowly so
// the covered stretch reads as a deliberate photo, not a frozen video.
const CSS = `
.ytbg-shell { container-type: size; }
.ytbg-shell iframe {
  position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%);
  border:0; pointer-events:none;
  width:100%; height:100%;                     /* fallback: no container units */
  width: max(100cqw, calc(100cqh * 16 / 9));
  height:max(100cqh, calc(100cqw * 9 / 16));
}
@keyframes ytbg-drift { from { transform:scale(1); } to { transform:scale(1.06); } }
.ytbg-poster { animation:ytbg-drift 18s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) { .ytbg-poster { animation:none; } }
`;

let cssInjected = false;
const injectCss = () => {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.dataset.ytbg = '';
  style.textContent = CSS;
  document.head.appendChild(style);
};

// `cc_load_policy=0` does not turn captions off — it only means "don't force
// them on", so an auto-captioned clip still burns subtitles across the bottom of
// the frame. That is invisible in a wide crop (they sit outside it) but plainly
// visible in a near-16:9 one like the mobile banner, so drop the module outright.
const dropCaptions = (player) => {
  for (const mod of ['captions', 'cc']) {
    try { player.unloadModule(mod); } catch { /* module not loaded yet */ }
  }
};

const YouTubeBackground = ({ videoId, title = 'Background video' }) => {
  const mountRef   = useRef(null);
  const coveredRef = useRef(true);
  const playerRef  = useRef(null);
  // `snap` skips the fade: used when the player stalls unexpectedly, where a
  // fade would let the spinner show through for its duration.
  const [cover, setCoverState] = useState({ on: true, snap: true });
  // Both homepage variants stay mounted, so the hidden one must not stream.
  const [inView, setInView] = useState(false);

  injectCss();

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    if (typeof IntersectionObserver !== 'function') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!videoId || !inView || !mountRef.current) return;
    // Respect reduced-motion: keep the still poster, never start the loop.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let tick = null, seekTimer = null;
    // 'warmup'    → covered, waiting for the playhead to reach revealAt
    // 'showing'   → video visible
    // 'restarting'→ covered, rewind pending
    let phase = 'warmup';
    let revealAt = CHROME_S;
    const setCover = (next, snap = false) => {
      if (coveredRef.current === next) return;
      coveredRef.current = next;
      setCoverState({ on: next, snap });
    };
    // Cover now and hold until `from` + the chrome window has actually played.
    const coverFrom = (from) => {
      phase = 'warmup';
      revealAt = from + CHROME_S;
      setCover(true, true);
    };

    // The API swaps this node out for its iframe, so it must be a throwaway
    // child rather than the React-owned wrapper (StrictMode mounts twice).
    const host = document.createElement('div');
    mountRef.current.appendChild(host);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(host, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0,
          rel: 0, modestbranding: 1, playsinline: 1,
          iv_load_policy: 3, cc_load_policy: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            if (cancelled) { e.target.destroy?.(); return; }
            e.target.getIframe()?.setAttribute('title', title);
            e.target.mute();          // required, or autoplay is refused
            dropCaptions(e.target);
            e.target.playVideo();

            tick = setInterval(() => {
              const p = playerRef.current;
              if (!p?.getPlayerState) return;
              const state = p.getPlayerState();
              const now   = p.getCurrentTime() || 0;

              // Stopped or paused: the player draws a centre button. Cover it
              // and nudge playback back to life.
              if (state === YT.PlayerState.PAUSED || state === -1) {
                coverFrom(now);
                p.playVideo();
                return;
              }
              // Mid-clip stall: the spinner is centre frame too.
              if (state === YT.PlayerState.BUFFERING) {
                if (phase === 'showing') coverFrom(now);
                return;
              }
              if (state !== YT.PlayerState.PLAYING) return;

              if (phase === 'restarting') return;        // waiting on the rewind
              if (phase === 'warmup') {
                if (now >= revealAt) { phase = 'showing'; setCover(false); }
                return;
              }
              const duration = p.getDuration() || 0;
              if (duration && duration - now < LOOP_LEAD_S) {
                phase = 'restarting';
                setCover(true);
                seekTimer = setTimeout(() => {
                  p.seekTo(0, true);
                  p.playVideo();
                  dropCaptions(p);      // the module can reload on a restart
                  // Never reveal before the clip has a stretch left to show.
                  revealAt = Math.min(CHROME_S, Math.max(0, duration - LOOP_LEAD_S - 1));
                  phase = 'warmup';
                }, SEEK_DELAY);
              }
            }, 200);
          },
          onStateChange: (e) => {
            // The tick owns the reveal; these only need to cover fast, since
            // chrome shows up ~100ms after the state changes.
            if (e.data === YT.PlayerState.PLAYING) dropCaptions(e.target);
            if (e.data === YT.PlayerState.ENDED) {
              // Safety net if the rewind above was missed (throttled timers).
              coverFrom(0);
              e.target.seekTo(0, true);
              e.target.playVideo();
            } else if (e.data === YT.PlayerState.PAUSED || e.data === -1
                       || (e.data === YT.PlayerState.BUFFERING && phase === 'showing')) {
              coverFrom(e.target.getCurrentTime?.() || 0);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearTimeout(seekTimer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
      host.remove();
    };
  }, [videoId, inView, title]);

  return (
    <>
      <div ref={mountRef} className="ytbg-shell absolute inset-0 overflow-hidden" aria-hidden="true" />
      {/* Poster = the clip's own still, so the dissolve stays on-brand. */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
        alt=""
        aria-hidden="true"
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`; }}
        className={`ytbg-poster absolute inset-0 w-full h-full object-cover z-[5] pointer-events-none transition-opacity ${
          cover.on ? `opacity-100 ${cover.snap ? 'duration-0' : 'duration-200'}` : 'opacity-0 duration-700'}`}
      />
    </>
  );
};

export default YouTubeBackground;
