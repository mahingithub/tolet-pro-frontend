// ChatPinLock.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A lock-screen overlay for a single conversation. Two modes:
//   • mode="set"    → user is turning ON privacy for this chat: enter a new
//                     4-digit PIN, then confirm it.
//   • mode="unlock" → the chat is locked and being opened: enter the PIN to reveal.
//
// It fills its positioned parent (the chat pane must be `relative`) and blurs
// everything behind it, so the messages stay hidden until unlocked.
//
// SECURITY NOTE (important): this is a *client-side privacy gate*, not real
// security. The PIN is only checked in the browser, so it stops over-the-
// shoulder / shared-device snooping — it does NOT protect messages from someone
// with technical access to the device. For true protection the PIN check must
// live on the server.
//
// Props:
//   chatName          – shown in the header
//   mode              – 'set' | 'unlock'
//   verify(pin)       – (unlock mode) return true if the PIN is correct
//   onDone(pin)       – (set mode) called with the confirmed PIN
//   onUnlocked()      – (unlock mode) called after a correct PIN
//   onCancel()        – back out (returns to the chat list)

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, Delete, ArrowLeft } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

export default function ChatPinLock({ chatName = 'this chat', mode = 'unlock', verify, onDone, onUnlocked, onCancel }) {
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState(null); // set-mode: the first entry to confirm against
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  const settingConfirm = mode === 'set' && firstPin !== null;

  const title = mode === 'set'
    ? (settingConfirm ? 'Confirm your PIN' : 'Set a 4-digit PIN')
    : 'Locked chat';
  const subtitle = mode === 'set'
    ? (settingConfirm ? 'Re-enter the PIN to confirm.' : `This chat will ask for a PIN each time you open it.`)
    : `Enter your PIN to open your chat with ${chatName}.`;

  const fail = useCallback((msg) => {
    setError(msg);
    setShake((s) => s + 1);
    setEntry('');
  }, []);

  // Called once a full 4-digit PIN is entered.
  const submit = useCallback((pin) => {
    if (mode === 'unlock') {
      if (verify?.(pin)) onUnlocked?.();
      else fail('Wrong PIN. Try again.');
      return;
    }
    // set mode
    if (!settingConfirm) {
      setFirstPin(pin);
      setEntry('');
      setError('');
    } else if (pin === firstPin) {
      onDone?.(pin);
    } else {
      setFirstPin(null);
      fail("PINs didn't match. Start again.");
    }
  }, [mode, verify, onUnlocked, fail, settingConfirm, firstPin, onDone]);

  const press = useCallback((k) => {
    setError('');
    if (k === 'back') { setEntry((e) => e.slice(0, -1)); return; }
    if (!/^[0-9]$/.test(k)) return;
    setEntry((e) => {
      if (e.length >= 4) return e;
      const next = e + k;
      if (next.length === 4) setTimeout(() => submit(next), 120);
      return next;
    });
  }, [submit]);

  // Allow the physical keyboard too (desktop).
  useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, onCancel]);

  return (
    <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl p-6">
      <button
        onClick={onCancel}
        className="absolute top-4 left-4 p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        aria-label="Back"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#ba0036] to-[#7a0024] text-white flex items-center justify-center shadow-[0_15px_30px_rgba(186,0,54,0.25)] mb-5">
        <Lock size={28} />
      </div>

      <h3 className="text-lg font-black text-gray-900">{title}</h3>
      <p className="text-[12px] font-bold text-gray-500 mt-1.5 text-center max-w-[260px] leading-relaxed">{subtitle}</p>

      {/* 4-dot indicator (shakes on error). */}
      <motion.div
        key={shake}
        animate={shake ? { x: [0, -9, 9, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4 my-7"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all ${
              i < entry.length ? 'bg-[#ba0036] scale-110' : 'bg-gray-300'
            }`}
          />
        ))}
      </motion.div>

      <div className="h-4 mb-2">
        {error && <p className="text-[11px] font-black text-red-500">{error}</p>}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-[240px]">
        {KEYS.map((k, i) => {
          if (k === '') return <span key={i} />;
          const isBack = k === 'back';
          return (
            <button
              key={i}
              onClick={() => press(k)}
              className={`h-14 rounded-2xl text-xl font-black flex items-center justify-center transition-all active:scale-90 ${
                isBack
                  ? 'text-gray-500 hover:bg-gray-100'
                  : 'bg-white border border-gray-100 text-gray-900 shadow-sm hover:border-[#ba0036]/30 hover:text-[#ba0036]'
              }`}
              aria-label={isBack ? 'Delete' : k}
            >
              {isBack ? <Delete size={20} /> : k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
