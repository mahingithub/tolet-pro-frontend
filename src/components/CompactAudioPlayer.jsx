// CompactAudioPlayer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A small, self-contained voice-note player that REPLACES the bulky native
// <audio controls> element. It renders just:
//     [ ▶ / ⏸ ]   ▁▂▅▇▂▁▃▅  (seekable waveform)   0:07
//
// Why: native <audio controls> is tall, inconsistent across browsers, and when
// several stack in "Shared media" they eat huge vertical space. This is fixed
// height, on-brand, and looks the same everywhere.
//
// Props:
//   • src         (string)  the audio URL (required)
//   • mine        (bool)     true when it sits inside the user's own brand-colour
//                            bubble → renders light controls; otherwise dark/brand.
//   • variant     ('bubble' | 'list')  'list' is the slimmer full-width style used
//                            in the Shared-media panel.
//   • durationSec (number)   optional known length (from mediaMeta) shown until
//                            the real metadata loads.
//
// No external deps beyond React + two lucide icons.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

// Turn seconds into "M:SS" (guards NaN/Infinity from streamed blobs).
function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Build a stable set of "waveform" bar heights from the URL so a given clip
// always looks the same (no real FFT needed — this is a lightweight visual).
function useWaveform(src, bars = 32) {
  return useMemo(() => {
    const out = [];
    let seed = 0;
    const key = String(src || 'seed');
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 100000;
    for (let i = 0; i < bars; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      // Height between 28% and 100% — keeps a lively but even-looking bar row.
      out.push(28 + (seed % 72));
    }
    return out;
  }, [src, bars]);
}

export default function CompactAudioPlayer({ src, mine = false, variant = 'bubble', durationSec = null }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(Number(durationSec) || 0);

  const bars = useWaveform(src, variant === 'list' ? 40 : 30);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  // Wire up the hidden <audio> element's events.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const onLoaded = () => {
      // MediaRecorder .webm blobs often report Infinity for duration until you
      // seek to the end once — this is the well-known fix to get a real number.
      if (el.duration === Infinity) {
        el.currentTime = 1e9;
        el.ontimeupdate = () => {
          el.ontimeupdate = null;
          el.currentTime = 0;
          setDuration(Number.isFinite(el.duration) ? el.duration : (Number(durationSec) || 0));
        };
      } else {
        setDuration(Number.isFinite(el.duration) ? el.duration : (Number(durationSec) || 0));
      }
    };
    const onTime = () => setCurrent(el.currentTime || 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [src, durationSec]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      // Pause any other players first so two notes never play at once.
      document.querySelectorAll('audio').forEach((a) => { if (a !== el) a.pause(); });
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  // Click/drag anywhere on the waveform to seek.
  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  };

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const btn = mine
    ? 'bg-white/20 text-white hover:bg-white/30'
    : 'bg-[#ba0036] text-white hover:bg-[#a30030]';
  const activeBar = mine ? 'bg-white' : 'bg-[#ba0036]';
  const idleBar = mine ? 'bg-white/35' : 'bg-gray-300';
  const timeText = mine ? 'text-white/80' : 'text-gray-500';

  const isList = variant === 'list';

  return (
    <div className={`flex items-center gap-2.5 ${isList ? 'w-full min-w-0' : 'min-w-[200px] sm:min-w-[236px]'}`}>
      {/* Hidden real audio element — all the actual playback happens here. */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-90 ${btn}`}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      {/* Waveform / progress — click to seek. */}
      <div
        onClick={seek}
        className="flex-1 min-w-0 flex items-center gap-[2px] h-8 cursor-pointer select-none"
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(progress * 100)}
      >
        {bars.map((h, i) => {
          const filled = i / bars.length <= progress;
          return (
            <span
              key={i}
              className={`flex-1 rounded-full transition-colors duration-150 ${filled ? activeBar : idleBar}`}
              style={{ height: `${h}%`, minWidth: 2 }}
            />
          );
        })}
      </div>

      <span className={`shrink-0 text-[10px] font-black tabular-nums ${timeText}`}>
        {fmt(playing || current > 0 ? current : duration)}
      </span>
    </div>
  );
}
