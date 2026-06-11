import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Play, Bot, X, Video } from 'lucide-react';
import VideoModal from './shared/VideoModal';

const WelcomeRobotOverlay = () => {
  const { activeRole } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [started, setStarted] = useState(false);
  const [activeVideo, setActiveVideo] = useState({ isOpen: false, url: '', title: '' });
  const [showOptions, setShowOptions] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const utteranceRef = useRef(null);
  const timeoutRef = useRef(null);

  // Listen for the login trigger and handle unmount cleanup
  useEffect(() => {
    const handleTrigger = () => {
      console.log('[DEBUG] triggerWelcomeRobot event received!');
      window.speechSynthesis.cancel();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setShowWelcome(true);
      setStarted(false);
      setShowOptions(false);
      setIsClosing(false);
    };
    window.addEventListener('triggerWelcomeRobot', handleTrigger);
    console.log('[DEBUG] triggerWelcomeRobot listener attached');

    return () => {
      console.log('[DEBUG] triggerWelcomeRobot listener removed');
      window.removeEventListener('triggerWelcomeRobot', handleTrigger);
      window.speechSynthesis.cancel();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleStart = () => {
    setStarted(true);
    const text = "স্বাগতম!";
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    
    const startSpeech = () => {
      const voices = window.speechSynthesis.getVoices();
      const bnVoices = voices.filter(v => v.lang.includes('bn') || v.lang.includes('bn-BD') || v.lang.includes('bn-IN'));
      const bestVoice = bnVoices.find(v => v.name.includes('Google')) || bnVoices[0];
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
      utterance.lang = "bn-BD";
      window.speechSynthesis.speak(utterance);
    };
    
    if (window.speechSynthesis.getVoices().length > 0) {
      startSpeech();
    } else {
      let fired = false;
      const onVoicesChanged = () => {
        if (fired) return;
        fired = true;
        startSpeech();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged, { once: true });
      setTimeout(onVoicesChanged, 1000);
    }
    
    utterance.onend = () => setShowOptions(true);
    utterance.onerror = () => setShowOptions(true);
    
    // Fallback just in case speech fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowOptions(true), 3000);
  };

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.speechSynthesis.cancel();

    const text = "সি ইউ এগেইন!";
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    const startSpeech = () => {
      const voices = window.speechSynthesis.getVoices();
      const bnVoices = voices.filter(v => v.lang.includes('bn') || v.lang.includes('bn-BD') || v.lang.includes('bn-IN'));
      const bestVoice = bnVoices.find(v => v.name.includes('Google')) || bnVoices[0];
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
      utterance.lang = "bn-BD";
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      startSpeech();
    } else {
      let fired = false;
      const onVoicesChanged = () => {
        if (fired) return;
        fired = true;
        startSpeech();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged, { once: true });
      setTimeout(onVoicesChanged, 1000);
    }

    const finishClose = () => {
      setShowWelcome(false);
      setIsClosing(false);
      window.dispatchEvent(new Event('welcomeRobotFinished'));
    };

    utterance.onend = finishClose;
    utterance.onerror = finishClose;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(finishClose, 3000);
  };

  const isTenant = activeRole !== 'landlord';

  // Standard placeholder YouTube URLs for demonstration - admin can configure these later
  const tenantVideoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ"; 
  const landlordVideoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ";

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none">
            {/* 1. Heavy Glassmorphic Background Overlay */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: isClosing ? 0 : 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-xl pointer-events-auto"
            />

            {/* 2. Top-right Cancel Button */}
            <motion.button
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: isClosing ? 0 : 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto z-[100000] border border-white/20 shadow-lg"
            >
              <X size={24} />
            </motion.button>

            {/* 3. Tap to Start Overlay */}
            <AnimatePresence mode="wait">
              {!started ? (
                <motion.div 
                  key="start-btn"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center z-[99999]"
                >
                  <motion.button
                    onClick={handleStart}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-3 px-10 py-4 bg-[#ba0036] text-white rounded-full shadow-[0_15px_40px_rgba(186,0,54,0.4)] hover:shadow-[0_20px_50px_rgba(186,0,54,0.6)] transition-all font-bold text-lg border border-white/20"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Tap to Start
                  </motion.button>
                </motion.div>
              ) : (
                /* 4. Futuristic Robot Modal */
                <motion.div
                  key="robot-modal"
                  initial={{ scale: 0.8, opacity: 0, y: 50 }}
                  animate={isClosing 
                    ? { scale: 0.15, x: '42vw', y: '40vh', opacity: 0 } 
                    : { scale: 1, x: 0, y: 0, opacity: 1 }
                  }
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  className="relative pointer-events-auto flex flex-col items-center w-full max-w-[340px] mx-4"
                >
                  {/* Robot Head Icon */}
                  <div className="relative z-20">
                    <div className="absolute inset-0 bg-[#ba0036] blur-[40px] opacity-40 rounded-full scale-150 animate-pulse" />
                    <div className="relative w-28 h-28 bg-gradient-to-br from-[#ba0036] to-[#8a0028] rounded-[2rem] flex items-center justify-center shadow-2xl border-4 border-white/20">
                      <Bot size={56} className="text-white" />
                    </div>
                  </div>

                  {/* Content Card */}
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="w-full bg-white/95 backdrop-blur-xl rounded-[2rem] p-8 pt-16 -mt-10 shadow-[0_30px_60px_rgba(0,0,0,0.15)] border border-white/50 text-center"
                  >
                    <h3 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">স্বাগতম!</h3>
                    
                    {showOptions && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 space-y-5"
                      >
                        <p className="text-[13px] font-bold text-gray-600 leading-relaxed px-2">
                          {isTenant 
                            ? 'কীভাবে সহজে বাসা খুঁজে পাবেন এবং ভাড়া নেবেন?'
                            : 'কীভাবে খুব সহজেই বাসা ভাড়া দেবেন এবং ম্যানেজ করবেন?'}
                        </p>
                        
                        <button
                          onClick={() => setActiveVideo({ 
                            isOpen: true, 
                            url: isTenant ? tenantVideoUrl : landlordVideoUrl, 
                            title: isTenant ? 'কীভাবে বাসা খুঁজবেন?' : 'হোস্ট ড্যাশবোর্ড গাইড' 
                          })}
                          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-4 rounded-[1.2rem] font-bold shadow-[0_10px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 transition-all text-[13px]"
                        >
                          <Video size={16} />
                          {isTenant ? 'নির্দেশিকা ভিডিও দেখুন' : 'হোস্ট গাইড ভিডিও দেখুন'}
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>

      {/* Reusing the shared VideoModal */}
      <VideoModal
        isOpen={activeVideo.isOpen}
        onClose={() => setActiveVideo({ ...activeVideo, isOpen: false })}
        videoUrl={activeVideo.url}
        title={activeVideo.title}
      />
    </>
  );
};

export default WelcomeRobotOverlay;

