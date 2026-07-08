// ChatMediaViewer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The "Media, links and docs" screen opened from the Contact tab. Three tabs:
//   • Media  → Photos and Videos shared in the thread
//   • Links  → Hyperlinks and Voice messages
//   • Docs   → Documents and PDFs
//
// Full-screen slide-over on mobile, centred panel on desktop. Bilingual via
// useLanguage() with English fallbacks.
//
// Props:
//   open, onClose
//   messages    — the active conversation's message array
//   contactName — shown in the header subtitle

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, LinkIcon, FileText, Download, ExternalLink, Mic } from 'lucide-react';
import CompactAudioPlayer from './CompactAudioPlayer';
import { useLanguage } from '../context/LanguageContext';

const URL_RE = /(https?:\/\/[^\s]+)/gi;
const isVideoUrl = (u = '') => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export default function ChatMediaViewer({ open, onClose, messages = [], contactName = '' }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState('media');

  const { photos, links, voices, docs } = useMemo(() => {
    const photos = [];
    const links = [];
    const voices = [];
    const docs = [];
    for (const m of messages) {
      if (m.isDeleted) continue;
      if (m.type === 'image' && m.mediaUrl) {
        photos.push(m);
      } else if (m.type === 'audio' && m.mediaUrl) {
        voices.push(m);
      } else if (m.type === 'document' && m.mediaUrl) {
        docs.push(m);
      } else if (m.text) {
        // A lone media URL sent as text (e.g. Tenor GIF) counts as a photo/video.
        const trimmed = m.text.trim();
        if (/^https?:\/\/\S+$/i.test(trimmed) && /\.(gif|png|jpe?g|webp)(\?|$)|tenor\.com|giphy\.com/i.test(trimmed)) {
          photos.push({ ...m, mediaUrl: trimmed, type: 'image' });
        } else {
          const found = trimmed.match(URL_RE);
          if (found) found.forEach((url) => links.push({ id: `${m.id}-${url}`, url, iso: m.iso }));
        }
      }
    }
    return { photos: photos.reverse(), links: links.reverse(), voices: voices.reverse(), docs: docs.reverse() };
  }, [messages]);

  const tabs = [
    { key: 'media', label: t.mediaTabMedia || 'Media', icon: ImageIcon, count: photos.length },
    { key: 'links', label: t.mediaTabLinks || 'Links', icon: LinkIcon, count: links.length + voices.length },
    { key: 'docs',  label: t.mediaTabDocs  || 'Docs',  icon: FileText, count: docs.length },
  ];

  const EmptyState = ({ text }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300 mb-3">
        <ImageIcon size={26} />
      </div>
      <p className="text-[12px] font-bold text-gray-400">{text}</p>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[160] bg-gray-900/50 sm:backdrop-blur-sm flex justify-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white w-full sm:max-w-md h-full shadow-[0_0_80px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
              <button onClick={onClose} className="p-2 -ml-1 rounded-xl hover:bg-gray-100 text-gray-600" aria-label="Close">
                <X size={20} />
              </button>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-gray-900">{t.mediaTitle || 'Media, links and docs'}</h3>
                {contactName && <p className="text-[11px] font-bold text-gray-400 truncate">{contactName}</p>}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-2 border-b border-gray-100 shrink-0">
              {tabs.map((tb) => (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${
                    tab === tb.key ? 'bg-[#ba0036] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <tb.icon size={13} />
                  {tb.label}
                  <span className={`text-[9px] rounded-full min-w-[16px] h-[15px] px-1 inline-flex items-center justify-center ${
                    tab === tb.key ? 'bg-white/25' : 'bg-gray-200 text-gray-600'
                  }`}>{tb.count}</span>
                </button>
              ))}
            </div>

            {/* Panels */}
            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'media' && (
                photos.length === 0 ? (
                  <EmptyState text={t.mediaNoPhotos || 'No photos or videos yet.'} />
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {photos.map((m, i) => (
                      <a key={m.id || i} href={m.mediaUrl} target="_blank" rel="noopener noreferrer"
                         className="block aspect-square rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-100 hover:ring-2 hover:ring-[#ba0036]/40 transition-all relative">
                        {isVideoUrl(m.mediaUrl) ? (
                          <video src={m.mediaUrl} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={m.mediaUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                )
              )}

              {tab === 'links' && (
                (links.length === 0 && voices.length === 0) ? (
                  <EmptyState text={t.mediaNoLinks || 'No links or voice messages yet.'} />
                ) : (
                  <div className="space-y-4">
                    {voices.length > 0 && (
                      <div>
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Mic size={12} /> {t.mediaVoiceMessages || 'Voice messages'}
                        </h5>
                        <div className="space-y-1.5">
                          {voices.map((m, i) => (
                            <div key={m.id || i} className="bg-white border border-gray-100 rounded-xl px-2.5 py-2 shadow-sm">
                              <CompactAudioPlayer src={m.mediaUrl} variant="list" durationSec={m.mediaMeta?.durationSec} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {links.length > 0 && (
                      <div>
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <LinkIcon size={12} /> {t.mediaLinks || 'Links'}
                        </h5>
                        <div className="space-y-1.5">
                          {links.map((l) => (
                            <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                               className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3 py-2.5 hover:border-[#ba0036]/30 hover:bg-red-50/30 transition-all group">
                              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                <LinkIcon size={14} />
                              </span>
                              <span className="flex-1 min-w-0 text-[12px] font-bold text-blue-600 truncate">{l.url}</span>
                              <ExternalLink size={13} className="text-gray-300 group-hover:text-[#ba0036] shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {tab === 'docs' && (
                docs.length === 0 ? (
                  <EmptyState text={t.mediaNoDocs || 'No documents or PDFs yet.'} />
                ) : (
                  <div className="space-y-1.5">
                    {docs.map((m, i) => (
                      <a key={m.id || i} href={m.mediaUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-3 hover:border-[#ba0036]/30 hover:bg-red-50/30 transition-all group">
                        <span className="w-10 h-10 rounded-lg bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0">
                          <FileText size={20} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-gray-800 truncate">{m.mediaMeta?.originalName || 'Document.pdf'}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {m.mediaMeta?.bytes ? (m.mediaMeta.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'PDF FILE'}
                          </p>
                        </div>
                        <Download size={14} className="text-gray-300 group-hover:text-[#ba0036] shrink-0" />
                      </a>
                    ))}
                  </div>
                )
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
