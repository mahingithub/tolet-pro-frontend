import { useEffect, useRef, useCallback } from 'react';

// Create a shared audio context instance lazily, but only one across the app.
let sharedAudioCtx = null;

const getAudioContext = () => {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedAudioCtx;
};

export default function useAudioChime() {
  const isReady = useRef(false);

  useEffect(() => {
    const handleInteraction = () => {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          isReady.current = true;
        }).catch(err => console.warn('Failed to resume AudioContext:', err));
      } else if (ctx.state === 'running') {
        isReady.current = true;
      }
    };

    // Attach listeners for first interaction
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const playChime = useCallback(() => {
    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state !== 'running') {
        console.warn('AudioContext not running, skipping chime.');
        return;
      }

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (err) {
      console.warn('Audio play failed', err);
    }
  }, []);

  return playChime;
}
