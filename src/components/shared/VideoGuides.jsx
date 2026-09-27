import React, { useState } from 'react';
import { Play } from 'lucide-react';
import VideoModal from './VideoModal';
import { thumbFor, formatDuration } from '../../utils/videoGuide';

/**
 * A responsive grid of clickable video-guide cards. Clicking a card opens the
 * shared VideoModal (which handles YouTube embeds and direct MP4 files).
 *
 * Renders nothing when there are no guides, so callers can drop it in without
 * guarding for empty admin data.
 *
 * Each tile shows the video's length when the admin entered one — a short,
 * known length is what gets a stranger to press play.
 *
 * @param {{ guides?: Array, columns?: 2|3, bn?: boolean }} props
 */
export default function VideoGuides({ guides = [], columns = 3, bn = false }) {
  const [active, setActive] = useState(null); // the guide whose video is open

  if (!guides.length) return null;

  const colClass = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <>
      <div className={`grid grid-cols-1 ${colClass} gap-3`}>
        {guides.map((g) => {
          const thumb = thumbFor(g.videoUrl);
          const length = formatDuration(g.durationSec, bn);
          return (
            <button
              key={g._id || g.videoUrl}
              onClick={() => setActive(g)}
              className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 overflow-hidden active:scale-[0.99] transition-all"
            >
              <div className="relative aspect-video bg-gradient-to-br from-[#ba0036] to-[#e60045] overflow-hidden">
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-14 h-14 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Play size={24} className="text-[#ba0036] ml-1" fill="currentColor" />
                  </span>
                </div>
                {length && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                    {length}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h4 className="text-sm font-black text-gray-900 leading-tight">{g.title}</h4>
                {g.suggestionText && (
                  <p className="text-xs font-medium text-gray-500 mt-1 leading-relaxed line-clamp-2">{g.suggestionText}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <VideoModal
        isOpen={!!active}
        onClose={() => setActive(null)}
        videoUrl={active?.videoUrl}
        title={active?.title}
      />
    </>
  );
}
