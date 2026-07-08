// MediaLightbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A full-screen, in-app media viewer that opens OVER the chat instead of
// navigating to a new browser tab. Handles images, videos and PDFs.
//
// Rendered through a portal on document.body so it always sits above the chat's
// stacking contexts. Close with the X button, the backdrop, or Escape.
//
// Props:
//   open           boolean
//   media          { type: 'image' | 'video' | 'document', url, name? }
//   onClose()

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText } from 'lucide-react';

export default function MediaLightbox({ open, media, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const type = media?.type;
  const url = media?.url;
  const name = media?.name || (type === 'document' ? 'Document.pdf' : type === 'video' ? 'Video' : 'Photo');

  return createPortal(
    <AnimatePresence>
      {open && media && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-sm flex flex-col"
          onClick={onClose}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between gap-3 px-4 text-white shrink-0"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold truncate flex items-center gap-2 min-w-0">
              {type === 'document' && <FileText size={16} className="shrink-0" />}
              <span className="truncate">{name}</span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={18} />
              </a>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Media body */}
          <div
            className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6"
            onClick={onClose}
          >
            {type === 'image' && (
              <motion.img
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                src={url}
                alt={name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {type === 'video' && (
              <motion.video
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                src={url}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-full rounded-lg shadow-2xl bg-black"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {type === 'document' && (
              <div
                className="w-full h-full max-w-4xl bg-white rounded-lg overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <iframe
                  src={url}
                  title={name}
                  className="w-full h-full"
                  style={{ border: 'none', minHeight: '60vh' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
