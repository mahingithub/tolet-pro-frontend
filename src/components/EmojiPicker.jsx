// EmojiPicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp-style bottom picker with three tabs: Emoji · Stickers · GIF.
//   • Emoji  — Recent (persisted) + full category sections (Smileys & People,
//              Animals, Food, Activity, Travel, Objects, Symbols, Flags).
//              Tapping inserts into the message input (keyboard stays down).
//   • Sticker— a set of jumbo emoji; tapping SENDS it immediately.
//   • GIF    — Tenor search when VITE_TENOR_KEY is set; otherwise a hint.
//
// Category tabs use emoji glyphs (not icon-font components) so it never depends
// on which icons a given lucide version happens to export.
//
// Props:
//   open, onClose
//   onPickEmoji(emoji)   insert into the input
//   onSendSticker(emoji) send a jumbo emoji as its own message
//   onSendGif(url)       send a GIF (by URL)

import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

const RECENT_KEY = 'tolet_recent_emoji';

// Compact-but-broad emoji set per category ("All everything").
const CATEGORIES = [
  { id: 'recent',   icon: '🕘', label: 'Recent', emojis: [] },
  { id: 'smileys',  icon: '😀', label: 'Smileys & People', emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😞 😓 😩 😫 😤 😡 😠 🤬 👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 🤞 👌 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💯'.split(' ') },
  { id: 'animals',  icon: '🐻', label: 'Animals & Nature', emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦉 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🐙 🦀 🐠 🐟 🐬 🐳 🐋 🦈 🌵 🌲 🌳 🌴 🌱 🌿 🍀 🎍 🌾 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀️ ⛅ ☁️ 🌧️ ❄️ 💧 🌊'.split(' ') },
  { id: 'food',     icon: '🍔', label: 'Food & Drink', emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🌽 🥕 🥔 🍠 🥐 🍞 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥙 🍜 🍝 🍣 🍱 🍛 🍚 🍙 🍦 🍰 🎂 🍫 🍬 🍭 🍩 🍪 ☕ 🍵 🧃 🥤 🍺 🍻 🍷 🥂'.split(' ') },
  { id: 'activity', icon: '⚽', label: 'Activity', emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🏏 ⛳ 🎯 🎣 🥊 🥋 ⛸️ 🎿 🛷 🥌 🎽 🏆 🥇 🥈 🥉 🎖️ 🏅 🎗️ 🎫 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 🎮 🕹️ 🎰 🎳'.split(' ') },
  { id: 'travel',   icon: '🚗', label: 'Travel & Places', emojis: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚨 🚔 🚍 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 ✈️ 🛫 🛬 🚀 🛸 🚁 ⛵ 🚤 🛥️ 🚢 ⚓ 🏕️ 🏖️ 🏜️ 🏝️ 🗻 🏔️ ⛰️ 🌋 🏙️ 🌆 🌇 🌃 🌉 🗽 🗼 🏰 🏯 🎡 🎢 🎠'.split(' ') },
  { id: 'objects',  icon: '💡', label: 'Objects', emojis: '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🔋 🔌 💡 🔦 📚 📖 📝 ✏️ 🖊️ 🖌️ 📌 📎 🔒 🔑 🔨 🛠️ ⚙️ 🧲 💉 💊 🚪 🛏️ 🛒 🎁 🎈 🎉 🎊 🎀 🕯️ 💰 💳 💎 ⏰ ⏳ 📅 📆'.split(' ') },
  { id: 'symbols',  icon: '❤️', label: 'Symbols', emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✅ ❌ ❓ ❗ ‼️ ⭕ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🔺 🔻 🔶 🔷 ▶️ ⏸️ ⏹️ 🔀 🔁 ➕ ➖ ➗ ✖️ ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ✔️ ☑️ 🔔 🔕'.split(' ') },
  { id: 'flags',    icon: '🏳️', label: 'Flags', emojis: '🏳️ 🏴 🏁 🚩 🏳️‍🌈 🇧🇩 🇮🇳 🇵🇰 🇺🇸 🇬🇧 🇨🇦 🇦🇺 🇸🇦 🇦🇪 🇶🇦 🇸🇬 🇲🇾 🇯🇵 🇨🇳 🇰🇷 🇩🇪 🇫🇷 🇮🇹 🇪🇸 🇧🇷 🇷🇺 🇹🇷 🇮🇩 🇹🇭 🇳🇵'.split(' ') },
];

const STICKERS = '😀 😂 🥰 😎 😭 😡 👍 🙏 🎉 🔥 💯 ❤️ 🥳 🤩 😴 🤔 🙌 👏 💪 🤝 🌹 🎂 🍕 ⚽ 🏆 🚀 🌈 ⭐ 💰 🏠'.split(' ');

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}

export default function EmojiPicker({ open, onClose, onPickEmoji, onSendSticker, onSendGif }) {
  const [tab, setTab] = useState('emoji');       // 'emoji' | 'sticker' | 'gif'
  const [cat, setCat] = useState('smileys');
  const [recent, setRecent] = useState(loadRecent);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const scrollRef = useRef(null);

  const TENOR_KEY = import.meta.env.VITE_TENOR_KEY;

  useEffect(() => { if (open) setRecent(loadRecent()); }, [open]);

  const pushRecent = (e) => {
    setRecent((prev) => {
      const next = [e, ...prev.filter((x) => x !== e)].slice(0, 24);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleEmoji = (e) => { onPickEmoji?.(e); pushRecent(e); };

  // Tenor GIF search (only if a key is configured).
  useEffect(() => {
    if (tab !== 'gif' || !TENOR_KEY) return undefined;
    const q = gifQuery.trim();
    let cancelled = false;
    setGifLoading(true);
    const t = setTimeout(async () => {
      try {
        const url = q
          ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24&media_filter=tinygif,gif`
          : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=24&media_filter=tinygif,gif`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        setGifs((data.results || []).map((r) => ({
          preview: r.media_formats?.tinygif?.url,
          full: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url,
        })).filter((g) => g.preview));
      } catch { if (!cancelled) setGifs([]); }
      finally { if (!cancelled) setGifLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tab, gifQuery, TENOR_KEY]);

  if (!open) return null;

  const activeCat = CATEGORIES.find((c) => c.id === cat) || CATEGORIES[1];
  const catEmojis = cat === 'recent' ? recent : activeCat.emojis;

  return (
    <div className="border-t border-gray-100 bg-white h-[42vh] max-h-[340px] flex flex-col">
      {/* Main tabs */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {['emoji', 'gif', 'sticker'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors ${
              tab === t ? 'bg-[#ba0036] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {t === 'emoji' ? 'Emoji' : t === 'gif' ? 'GIF' : 'Sticker'}
          </button>
        ))}
        <button onClick={onClose} className="ml-auto p-1.5 rounded-full hover:bg-gray-100 text-gray-400" aria-label="Close emoji picker">
          <X size={16} />
        </button>
      </div>

      {/* EMOJI TAB */}
      {tab === 'emoji' && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
            {cat === 'recent' && recent.length === 0 ? (
              <p className="text-center text-[12px] font-bold text-gray-400 py-10">No recent emojis yet.</p>
            ) : (
              <>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{activeCat.label}</p>
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-0.5">
                  {catEmojis.map((e, i) => (
                    <button
                      key={`${e}-${i}`}
                      onClick={() => handleEmoji(e)}
                      className="aspect-square rounded-lg text-2xl leading-none flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-90"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Category bar (emoji glyphs) */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); scrollRef.current?.scrollTo(0, 0); }}
                className={`w-8 h-8 rounded-lg text-lg leading-none flex items-center justify-center transition-all ${
                  cat === c.id ? 'bg-[#ba0036]/10 scale-110' : 'opacity-50 hover:opacity-100'
                }`}
                aria-label={c.label}
              >
                {c.icon}
              </button>
            ))}
          </div>
        </>
      )}

      {/* STICKER TAB */}
      {tab === 'sticker' && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Tap to send</p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {STICKERS.map((e, i) => (
              <button
                key={`${e}-${i}`}
                onClick={() => { onSendSticker?.(e); onClose?.(); }}
                className="aspect-square rounded-2xl bg-gray-50 hover:bg-gray-100 text-4xl flex items-center justify-center transition-all active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GIF TAB */}
      {tab === 'gif' && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {!TENOR_KEY ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
              <p className="text-[12px] font-bold text-gray-500">GIF search needs a free Tenor API key.</p>
              <p className="text-[11px] font-medium text-gray-400 mt-1">Add <code className="bg-gray-100 px-1 rounded">VITE_TENOR_KEY</code> to your .env to enable GIFs.</p>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={gifQuery}
                  onChange={(e) => setGifQuery(e.target.value)}
                  placeholder="Search GIFs…"
                  className="w-full bg-gray-50 rounded-full py-2 pl-9 pr-3 text-[13px] font-bold text-gray-800 outline-none focus:bg-gray-100"
                />
              </div>
              {gifLoading ? (
                <p className="text-center text-[12px] font-bold text-gray-400 py-8">Loading…</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {gifs.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => { onSendGif?.(g.full); onClose?.(); }}
                      className="rounded-xl overflow-hidden bg-gray-100 aspect-video"
                    >
                      <img src={g.preview} alt="gif" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
