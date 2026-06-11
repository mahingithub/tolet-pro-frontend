import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Play } from 'lucide-react';

const WelcomeRobotOverlay = () => {
  const { showWelcomeAnimation, setShowWelcomeAnimation } = useAuth();
  const [started, setStarted] = useState(false);
  const [shrinking, setShrinking] = useState(false);

  // Fallback cleanup if component unmounts unexpectedly
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!showWelcomeAnimation) return null;

  const handleStart = () => {
    setStarted(true);

    const text = "স্বাগতম টু-লেট প্রো তে! আমি আপনার গ্লোবাল এআই অ্যাসিস্ট্যান্ট।";
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Use Bengali if available, otherwise fallback to default
    utterance.lang = "bn-BD";
    utterance.pitch = 1.2;
    utterance.rate = 0.95;
    
    let isFinished = false;
    
    const finishAnimation = () => {
      if (isFinished) return;
      isFinished = true;
      setShrinking(true);
      // Wait for shrink animation to finish before removing overlay
      setTimeout(() => {
        setShowWelcomeAnimation(false);
        setStarted(false);
        setShrinking(false);
      }, 1000); 
    };

    utterance.onend = finishAnimation;
    utterance.onerror = finishAnimation;

    window.speechSynthesis.speak(utterance);
    
    // Safety fallback: if speech takes too long or fails silently, shrink anyway after 6 seconds
    setTimeout(() => {
        finishAnimation();
    }, 6000);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none">
      
      {/* 1. Tap to Start Overlay */}
      <AnimatePresence>
        {!started && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto flex flex-col items-center justify-center"
          >
            <motion.div
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="mb-8 text-center text-white"
            >
               <h2 className="text-3xl font-bold mb-2">Welcome!</h2>
               <p className="text-white/80">Turn on your sound to hear my voice.</p>
            </motion.div>

            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 px-10 py-4 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 hover:shadow-primary/60 transition-all font-semibold text-lg border border-white/20"
            >
              <Play className="w-5 h-5 fill-current" />
              Tap to Start
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Robot Animation */}
      <AnimatePresence>
        {started && (
          <motion.div
            initial={{ scale: 0, y: 100, opacity: 0 }}
            animate={
              shrinking
                ? { scale: 0, x: '45vw', y: '45vh', opacity: 0 } // Move toward bottom-right
                : { scale: 1, x: 0, y: 0, opacity: 1 }
            }
            transition={{ type: 'spring', damping: 20, stiffness: 100, duration: shrinking ? 1 : 1.5 }}
            className="relative pointer-events-auto flex flex-col items-center text-primary"
          >
            {/* Robot Visuals */}
            <div className="relative flex flex-col items-center">
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="relative"
              >
                {/* Glow effect behind robot */}
                <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full scale-150" />
                
                {/* Sleek SVG Robot */}
                <svg width="240" height="320" viewBox="0 0 240 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 drop-shadow-2xl">
                  {/* Antenna */}
                  <line x1="120" y1="40" x2="120" y2="15" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                  <motion.circle 
                    animate={{ fill: ['#currentColor', '#ffffff', 'currentColor'] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    cx="120" cy="15" r="8" fill="currentColor" 
                  />

                  {/* Head */}
                  <rect x="70" y="40" width="100" height="80" rx="25" fill="#ffffff" />
                  <rect x="70" y="40" width="100" height="80" rx="25" fill="url(#glassGrad)" />
                  <path d="M85 95 H155" stroke="#f1f5f9" strokeWidth="3" strokeLinecap="round"/>
                  
                  {/* Eyes */}
                  <motion.circle animate={{ scaleY: [1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 4, times: [0, 0.05, 0.1] }} cx="100" cy="70" r="10" fill="currentColor" />
                  <motion.circle animate={{ scaleY: [1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 4, times: [0, 0.05, 0.1] }} cx="140" cy="70" r="10" fill="currentColor" />
                  
                  {/* Body */}
                  <rect x="50" y="140" width="140" height="120" rx="35" fill="#ffffff" />
                  <rect x="50" y="140" width="140" height="120" rx="35" fill="url(#glassGrad)" />
                  
                  {/* Screen on Body */}
                  <rect x="70" y="160" width="100" height="60" rx="15" fill="#f8fafc" />
                  <motion.path 
                    animate={{ pathLength: [0, 1, 0], opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    d="M85 190 Q 120 160 155 190" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none"
                  />

                  {/* Arms */}
                  <rect x="25" y="160" width="20" height="70" rx="10" fill="#ffffff" />
                  <rect x="195" y="160" width="20" height="70" rx="10" fill="#ffffff" />

                  <defs>
                    <linearGradient id="glassGrad" x1="0" y1="0" x2="240" y2="320" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="rgba(0,0,0,0.02)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
                    </linearGradient>
                  </defs>
                </svg>

              </motion.div>
              
              {/* Speech Bubble */}
              {!shrinking && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="absolute -top-12 bg-white text-gray-800 px-8 py-4 rounded-3xl rounded-br-sm shadow-2xl font-bold text-xl text-center whitespace-nowrap border border-gray-100"
                >
                  স্বাগতম টু-লেট প্রো তে!
                  {/* Small animated sound waves */}
                  <div className="flex gap-1 justify-center mt-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [4, 12, 4] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                        className="w-1 bg-primary rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WelcomeRobotOverlay;
