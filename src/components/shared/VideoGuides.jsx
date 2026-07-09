import React, { useState } from 'react';
import { Play } from 'lucide-react';
import VideoModal from './VideoModal';

// Pull a YouTube video id out of the common URL shapes so we can show a
// thumbnail. Non-YouTube URLs (e.g. direct MP4) simply fall back to a branded
// gradient tile.
const youTubeId = (url = '') => {
  try {
    if (url.includes('youtube.com/watch')) return new URL(url).searchParams.get('v') || '';
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?&]/)[0];
    if (url.includes('youtube.com/embed/')) return url.split('embed/')[1].split(/[?&]/)[0];
  } catch {
    /* ignore malformed URLs */
  }
  return '';
};

const thumbFor = (url) => {
  const id = youTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
};

/**
 * A responsive grid of clickable video-guide cards. Clicking a card opens the
 * shared VideoModal (which handles YouTube embeds and direct MP4 files).
 *
 * Renders nothing when there are no guides, so callers can drop it in without
 * guarding for empty admin data.
 *
 * @param {{ guides?: Array, columns?: 2|3 }} props
 */
export default function VideoGuides({ guides = [], columns = 3 }) {
  const [active, setActive] = useState(null); // the guide whose video is open

  if (!guides.length) return null;

  const colClass = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <>
      <div className={`grid grid-cols-1 ${colClass} gap-3`}>
        {guides.map((g) => {
          const thumb = thumbFor(g.videoUrl);
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
