import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Draggable from 'react-draggable';
import {
  Bot, Send, Sparkles, Minimize2, ExternalLink,
  Headphones, Inbox, ArrowLeft, ShieldCheck, CheckCircle2, Clock, Play,
  Building2, MapPin, BedDouble, Bath, Mic
} from 'lucide-react';
import VideoModal from './shared/VideoModal';
import { propertyPath } from '../utils/propertyPath';
import useBackGuard, { useOverlayNavigate } from '../hooks/useBackGuard';

import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage, useIsBn } from '../context/LanguageContext';
import {
  openTicket as svcOpenTicket,
  listMyTickets,
  getTicket,
  sendMessage as svcSendMessage,
  onTicketsChanged,
} from '../services/supportService.js';
import { getDeviceCategory } from '../services/aiGuideService.js';

/**
 * Global AI assistant + support widget.
 *
 * Three internal views:
 *   - 'ai'      : the original AI chat (default).
 *   - 'tickets' : list of the signed-in user's support tickets.
 *   - 'ticket'  : a single ticket's conversation with a human admin.
 *
 * Hand-off rule: if the AI fails to satisfy the user (2+ open-ended replies
 * in a row) or the user types "human" / "agent" / "support" / "complaint",
 * we surface a "Talk to a human" CTA. Pressing it opens a real ticket
 * with the AI transcript attached, and switches the widget to the 'ticket'
 * view so the user can keep typing without losing context.
 */

const HUMAN_KEYWORDS = ['human', 'agent', 'support', 'complaint', 'real person', 'staff'];

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

// /ai-chat/* answers guests too (routes/aiChatRoutes.js); the token is sent when
// there is one so a signed-in user is still identified. Same token the rest of
// the app uses (see supportService.js).
const authHeader = () => {
  const t = window.localStorage.getItem('auth:token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// Phones get the assistant as a full screen, not a floating card. The 600px card
// was pinned above the bottom rail, so once the keyboard opened the rail rode up
// on top of it and the chat shrank to a sliver between the two.
const PHONE_QUERY = '(max-width: 767px)';
const matchesPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_QUERY).matches;

const GlobalAIAssistant = () => {
  // Every link inside the chat also closes it. On a phone the open chat holds a
  // Back entry; this replaces that entry with the destination instead of
  // stranding it, so Back from there lands on the page the chat was opened on.
  const navigate = useOverlayNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  // Current UI language mode — sent with every AI question so the bot names
  // the buttons the user actually sees ('যোগাযোগ করুন' vs 'Inquire').
  const { language } = useLanguage() || {};
  const uiLang = language === 'বাংলা' ? 'bn' : 'en';
  const pick = (bnText, enText) => (uiLang === 'bn' ? bnText : enText);

  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null);
  const floatingBtnRef = useRef(null);
  const inputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isPhone, setIsPhone] = useState(matchesPhone);
  const [isIconVisible, setIsIconVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [view, setView] = useState(/** @type {'ai'|'tickets'|'ticket'} */('ai'));
  const [activeTicketId, setActiveTicketId] = useState(/** @type {string|null} */(null));
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isTyping, setIsTyping] = useState(false);

  const [aiGuides, setAiGuides] = useState([]);
  const [activeVideoModal, setActiveVideoModal] = useState({ isOpen: false, url: '', title: '' });

  // Hide icon after 10s on non-visual pages
  useEffect(() => {
    const isVisualPage = location.pathname === '/' || 
                         location.pathname.startsWith('/property/') || 
                         location.pathname.startsWith('/properties/');

    if (isVisualPage || isOpen) {
      setIsIconVisible(true);
      return;
    }

    let timer;
    const startHideTimer = () => {
      setIsIconVisible(true);
      timer = setTimeout(() => {
        setIsIconVisible(false);
      }, 10000);
    };

    startHideTimer();

    const handleRobotFinish = () => {
      clearTimeout(timer);
      startHideTimer();
    };

    window.addEventListener('welcomeRobotFinished', handleRobotFinish);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('welcomeRobotFinished', handleRobotFinish);
    };
  }, [location.pathname, isOpen]);

  // Hide the floating button when the mobile menu drawer is open so it
  // doesn't overlap. The Navbar dispatches these custom events.
  useEffect(() => {
    const onOpen  = () => setIsMobileMenuOpen(true);
    const onClose = () => setIsMobileMenuOpen(false);
    window.addEventListener('open-mobile-menu', onOpen);
    window.addEventListener('close-mobile-menu', onClose);
    return () => {
      window.removeEventListener('open-mobile-menu', onOpen);
      window.removeEventListener('close-mobile-menu', onClose);
    };
  }, []);

  useEffect(() => {
    const devCat = getDeviceCategory();
    fetch(`${API}/ai-guides?deviceCategory=${devCat}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch AI guides");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setAiGuides(data);
      })
      .catch(console.error);
  }, []);

  // We'll declare handleGuideClick lower down after aiMessages is defined.

  // AI chat history — SESSION-only persistence (sessionStorage): it survives
  // refreshes and in-app navigation, but clears when the app/tab is closed so
  // a returning user always starts a fresh conversation. (It used to live in
  // localStorage, which resurfaced ten-day-old chats after re-login.)
  const [aiMessages, setAiMessages] = useState(() => {
    try {
      // One-time cleanup of the old forever-persisted history.
      localStorage.removeItem('ai_chat_history');
      const saved = sessionStorage.getItem('ai_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        // id 1 was the canned welcome bubble. A chat saved earlier in this
        // session would otherwise bring it straight back.
        if (Array.isArray(parsed)) return parsed.filter((m) => m.id !== 1);
      }
    } catch {
      // fall through
    }
    // No canned welcome bubble: it sat at the top of every conversation. The
    // suggestion chips above the input are the empty state.
    return [];
  });

  // How many AI replies in a row have been unhelpful (no `action`)? Used to
  // decide when to nudge the user toward the human handoff CTA.
  const [unhelpfulStreak, setUnhelpfulStreak] = useState(0);
  const [showHandoffCta, setShowHandoffCta] = useState(false);

  const handleGuideClick = (guide) => {
    const userMsg = { id: crypto.randomUUID(), sender: 'user', text: guide.suggestionText };
    const aiMsg = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: pick(`এই বিষয়ের ভিডিও গাইড: ${guide.title}`, `Here is a video guide for: ${guide.title}`),
        videoAction: { label: pick('ভিডিও দেখুন', 'Play Video'), url: guide.videoUrl, title: guide.title }
    };
    setAiMessages(prev => [...prev, userMsg, aiMsg]);
    setTimeout(() => {
      setActiveVideoModal({ isOpen: true, url: guide.videoUrl, title: guide.title });
    }, 500);
  };

  // Tickets list + currently-open ticket detail.
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(/** @type {any} */(null));

  // ── persistence ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      sessionStorage.setItem('ai_chat_history', JSON.stringify(aiMessages));
    } catch (e) {
      console.warn("Could not save chat history to sessionStorage", e);
    }
  }, [aiMessages]);

  // ── keep the newest message in view ────────────────────────────────────
  // Scrolls the message list itself. scrollIntoView() scrolled EVERY scrollable
  // ancestor to reach the end marker — the page behind the chat included — so
  // with the keyboard up each new message shoved the whole screen around.
  const scrollToLatest = useCallback(() => {
    const list = messagesEndRef.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToLatest();
  }, [aiMessages, activeTicket, isTyping, isOpen, view, scrollToLatest]);

  // ── phone: a full screen that behaves like one ─────────────────────────
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE_QUERY);
    if (!mq) return undefined;
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Back closes the chat instead of leaving the page underneath it.
  useBackGuard(isOpen && isPhone, () => setIsOpen(false));

  useEffect(() => {
    if (!isOpen || !isPhone) return undefined;
    // The page behind must not scroll while the chat covers it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // The keyboard shrinks the chat from below. Re-pin to the newest message,
    // or the one being replied to slides out of view as the keyboard opens.
    const vv = window.visualViewport;
    vv?.addEventListener('resize', scrollToLatest);
    return () => {
      document.body.style.overflow = prev;
      vv?.removeEventListener('resize', scrollToLatest);
    };
  }, [isOpen, isPhone, scrollToLatest]);

  // ── load tickets when user opens the Tickets view, and react to admin
  //    replies in real time via the supportService broadcast. ─────────────
  const refreshTickets = useCallback(async () => {
    if (!isAuthenticated) {
      setTickets([]);
      return;
    }
    try {
      const list = await listMyTickets();
      setTickets(list);
    } catch (e) {
      console.error(e);
    }
  }, [isAuthenticated]);

  const refreshActiveTicket = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const data = await getTicket(activeTicketId);
      setActiveTicket(data);
    } catch (e) {
      console.error(e);
    }
  }, [activeTicketId]);

  useEffect(() => {
    refreshTickets();
    return onTicketsChanged(() => {
      refreshTickets();
      refreshActiveTicket();
    });
  }, [refreshTickets, refreshActiveTicket]);

  useEffect(() => {
    refreshActiveTicket();
  }, [activeTicketId, refreshActiveTicket]);

  useEffect(() => {
    setInputText('');
  }, [view]);

  // ── AI chat send handler ───────────────────────────────────────────────
  const handleAiSend = async (e, overrideText) => {
    e?.preventDefault();
    const text = (typeof overrideText === 'string' ? overrideText : inputText).trim();
    if (!text || isTyping) return;

    const userMsg = { id: crypto.randomUUID(), sender: 'user', text };
    setAiMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Keyword-triggered immediate handoff suggestion.
    const lower = text.toLowerCase();
    if (HUMAN_KEYWORDS.some((kw) => lower.includes(kw))) {
      setShowHandoffCta(true);
    }

    try {
      const historyPayload = aiMessages
        .filter(m => m.text && m.text !== "Sorry, I am having trouble connecting to my brain right now. Please try again or speak to a human teammate.")
        .slice(-15);
        
      const response = await fetch(`${API}/ai-chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ text, history: historyPayload, language: uiLang })
      });

      if (response.status === 401) {
        // Not signed in (or session expired) — say so instead of the generic
        // "brain" error, and don't count it toward the human-handoff streak.
        setAiMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: 'AI চ্যাট ব্যবহার করতে প্রথমে লগইন করুন। 🙏\n(Please sign in to use the AI chat.)',
          action: { label: 'লগইন করুন / Sign in', route: '/login' },
        }]);
        return;
      }

      if (!response.ok) {
        throw new Error('API Error');
      }
      
      const data = await response.json();

      if (data?.text || (Array.isArray(data?.properties) && data.properties.length) || data?.videoGuide) {
        setAiMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: data.text || '',
          properties: Array.isArray(data.properties) && data.properties.length ? data.properties : undefined,
          // Direct in-app navigation buttons the AI attached (e.g. "Add
          // Property" under a how-to answer). [{ label, route }]
          actions: Array.isArray(data.actions) && data.actions.length ? data.actions : undefined,
          // The AI can attach ONE admin-published walkthrough video when the
          // question matches a guide (e.g. "how do I rent a house?"). It renders
          // as a "Watch" button under the reply that opens the video modal.
          videoAction: data.videoGuide?.videoUrl
            ? { label: pick(`দেখুন: ${data.videoGuide.title}`, `Watch: ${data.videoGuide.title}`), url: data.videoGuide.videoUrl, title: data.videoGuide.title }
            : undefined,
        }]);
        setUnhelpfulStreak(0); // reset streak on success
      }
    } catch (err) {
      console.error('AI Chat Error:', err);
      // Only real network failures land here now — Gemini quota/outages get a
      // graceful 200 fallback from the server (polite note + video + buttons).
      setAiMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: uiLang === 'bn'
          ? 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না। 🙏 ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন, অথবা আমাদের সাপোর্ট টিমের সাথে কথা বলুন।'
          : "We couldn't reach the server. 🙏 Please check your connection and try again, or talk to our support team.",
      }]);
      setShowHandoffCta(true);
      setUnhelpfulStreak((s) => s + 1);
    } finally {
      setIsTyping(false);
    }
  };

  // ── voice input (Bengali speech-to-text) ───────────────────────────────────
  // Two paths, chosen automatically so it works on every device:
  //   1) Web Speech API (Chrome / Android Chrome): free, on-device, with a live
  //      transcript preview. Tap mic -> speak -> on a final result it auto-sends.
  //   2) Fallback for browsers without Web Speech (notably iOS Safari, Firefox):
  //      record with MediaRecorder, upload to /ai-chat/transcribe (server-side
  //      Gemini, same backend as the chat itself), then auto-send the returned
  //      text. Costs a little per clip.
  // Both feed the SAME handleAiSend pipeline (already understands Bengali + runs
  // the property search).
  const SpeechRec =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
  const voiceSupported = !!SpeechRec;
  const recordSupported =
    typeof navigator !== 'undefined' &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined';
  const micAvailable = voiceSupported || recordSupported;

  // Path 1 — Web Speech API (free, on-device, live preview).
  const startWebSpeech = () => {
    try {
      const rec = new SpeechRec();
      rec.lang = 'bn-BD';        // Bangladeshi Bengali
      rec.interimResults = true; // stream partial words for a live preview
      rec.continuous = false;    // stop automatically when the user pauses
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += chunk;
          else interim += chunk;
        }
        if (interim) setInputText(interim);
        if (final) {
          setInputText('');
          handleAiSend(null, final.trim()); // pass text explicitly (avoids state lag)
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      setInputText('');
      setIsListening(true);
      rec.start();
    } catch (_) {
      setIsListening(false);
    }
  };

  // Path 2 — record audio, transcribe server-side, then send.
  const transcribeAndSend = async (blob) => {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      const res = await fetch(`${API}/ai-chat/transcribe`, { method: 'POST', headers: authHeader(), body: fd });
      if (res.ok) {
        const data = await res.json();
        const t = (data.text || '').trim();
        if (t) handleAiSend(null, t);
      }
    } catch (_) {
      /* ignore — the user can retry or just type */
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch (_) { /* noop */ }
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        if (blob.size > 0) await transcribeAndSend(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsListening(true);
    } catch (_) {
      setIsListening(false);
    }
  };

  const stopVoice = () => {
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (_) { /* noop */ }
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (_) { /* noop */ }
  };

  const toggleVoice = () => {
    if (inputDisabled || isTyping || isTranscribing) return;
    if (isListening) { setIsListening(false); stopVoice(); return; }
    if (voiceSupported) startWebSpeech();
    else if (recordSupported) startRecording();
  };

  // Stop any in-flight recognition / recording on unmount.
  useEffect(() => () => stopVoice(), []);

  // ── handoff: open a real ticket and switch into ticket view ────────────
  const handleHandoff = async () => {
    if (!isAuthenticated) {
      // Send to login, returning to whichever page they were on.
      navigate('/login');
      setIsOpen(false);
      return;
    }
    // Find the user's most recent question to seed the ticket; fall back
    // to a generic message if their last turn was the AI's.
    const lastUser = [...aiMessages].reverse().find((m) => m.sender === 'user');
    const initialMessage =
      lastUser?.text ?? 'I would like help from a human teammate.';
    /** @type {import('../services/supportService.js').TicketMessage[]} */
    const transcript = aiMessages.map((m) => ({
      id: String(m.id),
      author: m.sender === 'ai' ? 'ai' : 'user',
      authorId: m.sender === 'user' ? user?.id : undefined,
      authorName: m.sender === 'user' ? user?.name : 'AI Assistant',
      text: m.text,
      createdAt: new Date(typeof m.id === 'number' ? m.id : Date.now()).toISOString(),
    }));
    try {
      const ticket = await svcOpenTicket({ initialMessage, aiTranscript: transcript });
      setShowHandoffCta(false);
      setUnhelpfulStreak(0);
      setActiveTicketId(ticket.id);
      setView('ticket');
    } catch (e) {
      console.error('Failed to open ticket:', e);
      alert(pick('এই মুহূর্তে সাপোর্ট টিমের সাথে যুক্ত করা যাচ্ছে না।', 'Failed to connect to a human teammate right now.'));
    }
  };

  // ── ticket reply handler (user side) ───────────────────────────────────
  const handleTicketSend = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !activeTicketId || isTyping) return;
    setIsTyping(true);
    try {
      await svcSendMessage(activeTicketId, text);
      setInputText('');
      refreshActiveTicket();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(pick('মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।', 'Failed to send message. Please try again.'));
    } finally {
      setIsTyping(false);
    }
  };

  // Tapping Send (or the mic) took focus off the field, so the keyboard closed,
  // the chat grew back to full height and the reply landed somewhere else on
  // screen — people cancelled and started over. Keep focus in the field.
  const keepKeyboard = (e) => e.preventDefault();

  // ── view-mode dispatch for the input form ──────────────────────────────
  const onSubmit = view === 'ticket' ? handleTicketSend : handleAiSend;
  const inputDisabled = view === 'tickets';
  const placeholder =
    view === 'ai'
      ? pick('যেকোনো কিছু জিজ্ঞেস করুন…', 'Ask me anything…')
      : view === 'ticket'
      ? pick('সাপোর্টকে উত্তর লিখুন…', 'Type your reply to support…')
      : pick('চ্যাট শুরু করতে একটি টিকেট খুলুন', 'Open a ticket to start chatting');

  return (
    <div className="font-sans">
      {isOpen && (
        <Draggable
          nodeRef={chatWindowRef}
          bounds="body"
          handle=".drag-header"
          cancel=".no-drag"
          // A full-screen chat has nowhere to be dragged, and a drag starting on
          // the header fights the scroll on a touch screen.
          disabled={isPhone}
        >
          <div
            ref={chatWindowRef}
            role="dialog"
            aria-label={pick('TO-LET AI সহকারী', 'TO-LET AI Assistant')}
            className={isPhone
              ? 'fixed inset-0 z-[100] flex flex-col bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200'
              : 'fixed bottom-24 right-8 z-[100] w-[400px] h-[600px] max-h-[80vh] flex flex-col bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_30px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.4)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300'}
            // On a phone the panel's bottom edge IS the screen's. The native
            // layer publishes a zero inset while the keyboard is up, so the
            // field sits right on the keyboard then and clears the navigation
            // buttons otherwise.
            style={isPhone ? { paddingBottom: 'var(--sab)' } : undefined}
          >
            {/* ── header (drag handle on desktop) ────────────────────── */}
            <div
              className={`drag-header ${isPhone ? '' : 'cursor-grab active:cursor-grabbing'} bg-gradient-to-r from-[#ba0036] to-[#d91a4d] p-4 flex items-center justify-between shrink-0 relative overflow-hidden`}
              style={isPhone ? { paddingTop: 'calc(var(--sat) + 1rem)' } : undefined}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

              <div className="flex items-center gap-3 relative z-10">
                {view === 'ticket' && (
                  <button
                    onClick={() => {
                      setView('tickets');
                      setActiveTicketId(null);
                      setActiveTicket(null);
                    }}
                    className="no-drag p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    aria-label={pick('টিকেটে ফিরে যান', 'Back to tickets')}
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                  {view === 'ai' ? <Bot size={20} className="text-white" /> : <Headphones size={20} className="text-white" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="font-black text-white text-sm tracking-wide truncate">
                    {view === 'ai'
                      ? pick('TO-LET AI সহকারী', 'TO-LET AI Assistant')
                      : view === 'tickets'
                      ? pick('আপনার সাপোর্ট টিকেট', 'Your Support Tickets')
                      : activeTicket?.ticket?.subject || pick('সাপোর্ট কথোপকথন', 'Support Conversation')}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.6)]"></div>
                    <span className="text-[10px] text-white/80 font-medium">
                      {view === 'ai' ? pick('অনলাইনে আছে', 'Online & Ready') : pick('সাপোর্টের সাথে যুক্ত', 'Connected to support')}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="no-drag p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors relative z-10"
                aria-label={pick('ছোট করুন', 'Minimize')}
              >
                <Minimize2 size={16} />
              </button>
            </div>

            {/* ── view tabs (AI / Tickets) ───────────────────────────── */}
            {view !== 'ticket' && (
              <div className="flex bg-white border-b border-gray-100 shrink-0">
                <button
                  onClick={() => setView('ai')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                    view === 'ai'
                      ? 'text-[#ba0036] border-b-2 border-[#ba0036]'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Bot size={14} /> {pick('AI চ্যাট', 'AI Chat')}
                </button>
                <button
                  onClick={() => setView('tickets')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition-colors relative ${
                    view === 'tickets'
                      ? 'text-[#ba0036] border-b-2 border-[#ba0036]'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Inbox size={14} /> {pick('আমার টিকেট', 'My Tickets')}
                  {tickets.filter((t) => t.status === 'open' || t.status === 'pending_user').length > 0 && (
                    <span className="ml-1 bg-[#ba0036] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {tickets.filter((t) => t.status === 'open' || t.status === 'pending_user').length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* ── content area ────────────────────────────────────────── */}
            {/* min-h-0: without it a flex child refuses to shrink below its
                content, so the keyboard pushed the input row off screen instead
                of shortening the list. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col gap-4 custom-scrollbar bg-[#f8f9fa]/50">
              {view === 'ai' && (
                <>
                  {aiMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${
                        msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      {msg.text ? (
                        <div
                          className={`px-4 py-3 shadow-md ${
                            msg.sender === 'user'
                              ? 'bg-gray-900 text-white rounded-[1.5rem] rounded-tr-sm'
                              : 'bg-white text-gray-800 rounded-[1.5rem] rounded-tl-sm'
                          }`}
                        >
                          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ) : null}
                      {msg.action && (
                        <button
                          onClick={() => {
                            navigate(msg.action.route);
                            setIsOpen(false);
                          }}
                          className="mt-2 flex items-center gap-2 bg-[#ba0036]/10 text-[#ba0036] hover:bg-[#ba0036]/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-[0_2px_8px_rgba(186,0,54,0.15)]"
                        >
                          <Sparkles size={12} /> {msg.action.label} <ExternalLink size={12} />
                        </button>
                      )}
                      {Array.isArray(msg.actions) && msg.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.actions.map((a, i) => (
                            <button
                              key={`${a.route}-${i}`}
                              onClick={() => {
                                navigate(a.route);
                                setIsOpen(false);
                              }}
                              className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 px-4 py-2 rounded-xl text-xs font-black transition-colors shadow-sm"
                            >
                              <Sparkles size={12} /> {a.label} <ExternalLink size={12} />
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.videoAction && (
                        <button
                          onClick={() => setActiveVideoModal({ isOpen: true, url: msg.videoAction.url, title: msg.videoAction.title })}
                          className="mt-2 flex items-center gap-2 bg-[#ba0036]/10 text-[#ba0036] hover:bg-[#ba0036]/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                        >
                          <Play size={12} /> {msg.videoAction.label}
                        </button>
                      )}
                      {Array.isArray(msg.properties) && msg.properties.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2 w-full">
                          {msg.properties.map((p) => (
                            <AiPropertyCard
                              key={p.id}
                              property={p}
                              onOpen={() => { navigate(propertyPath(p)); setIsOpen(false); }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="self-start bg-white shadow-md px-4 py-3.5 rounded-[1.5rem] rounded-tl-sm flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  )}

                  {showHandoffCta && !isTyping && (
                    <div className="self-stretch bg-gradient-to-br from-[#ba0036]/5 to-white border border-[#ba0036]/15 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0">
                          <Headphones size={16} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-gray-900">{pick('মানুষের সাথে কথা বলতে চান?', 'Want a real human?')}</h4>
                          <p className="text-xs font-medium text-gray-600 mt-1">
                            {pick('পুরো কথোপকথনটি সাথে পাঠিয়ে দেব, আবার বলতে হবে না।', 'We\'ll attach this whole conversation so you don\'t have to repeat yourself.')}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={handleHandoff}
                              className="flex-1 bg-[#ba0036] hover:bg-[#d4004a] text-white px-4 py-2 rounded-xl text-xs font-black shadow-[0_4px_12px_rgba(186,0,54,0.25)] transition-colors"
                            >
                              {pick('সাপোর্ট টিমের সাথে কথা বলুন', 'Talk to a human')}
                            </button>
                            <button
                              onClick={() => setShowHandoffCta(false)}
                              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                              {pick('এখন না', 'Not now')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {view === 'tickets' && (
                <>
                  {!isAuthenticated && (
                    <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                      <ShieldCheck size={32} className="text-gray-300 mx-auto mb-3" />
                      <h4 className="font-black text-gray-900 text-sm">{pick('টিকেট দেখতে সাইন ইন করুন', 'Sign in to see your tickets')}</h4>
                      <p className="text-xs font-medium text-gray-500 mt-1">
                        {pick('প্রতিটি সাপোর্ট কথোপকথন আপনার অ্যাকাউন্টে সংরক্ষিত থাকে।', 'We keep a record of every support conversation under your account.')}
                      </p>
                      <button
                        onClick={() => {
                          navigate('/login');
                          setIsOpen(false);
                        }}
                        className="mt-4 bg-[#ba0036] text-white px-5 py-2 rounded-xl text-xs font-black shadow-[0_4px_12px_rgba(186,0,54,0.2)]"
                      >
                        {pick('সাইন ইন', 'Sign in')}
                      </button>
                    </div>
                  )}
                  {isAuthenticated && tickets.length === 0 && (
                    <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                      <Inbox size={32} className="text-gray-300 mx-auto mb-3" />
                      <h4 className="font-black text-gray-900 text-sm">{pick('এখনও কোনো টিকেট নেই', 'No tickets yet')}</h4>
                      <p className="text-xs font-medium text-gray-500 mt-1">
                        {pick('আগে AI-কে জিজ্ঞেস করুন — সমাধান না হলে সাপোর্ট টিমের কাছে পাঠাতে পারবেন।', 'Ask the AI a question first — if it can\'t help, you can hand off to a human.')}
                      </p>
                      <button
                        onClick={() => setView('ai')}
                        className="mt-4 bg-gray-900 text-white px-5 py-2 rounded-xl text-xs font-black"
                      >
                        {pick('AI চ্যাট খুলুন', 'Open AI Chat')}
                      </button>
                    </div>
                  )}
                  {isAuthenticated &&
                    tickets.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setActiveTicketId(t.id);
                          setView('ticket');
                        }}
                        className="text-left bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border border-transparent hover:border-[#ba0036]/20"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-black text-gray-900 line-clamp-1">
                            {t.subject}
                          </h4>
                          <TicketStatusPill status={t.status} />
                        </div>
                        <p className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
                          <Clock size={11} />
                          {timeAgo(t.updatedAt, uiLang === 'bn')}
                          {t.assignedAdminName && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="font-bold">{t.assignedAdminName}</span>
                            </>
                          )}
                        </p>
                      </button>
                    ))}
                </>
              )}

              {view === 'ticket' && activeTicket && (
                <>
                  {activeTicket.messages.map((m) => (
                    <TicketMessageBubble key={m.id} message={m} myUserId={user?.id} />
                  ))}
                  {activeTicket.ticket.status === 'resolved' && (
                    <div className="self-stretch bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
                      <CheckCircle2 size={16} className="text-green-600 inline-block mr-1.5" />
                      <span className="text-xs font-black text-green-700 uppercase tracking-widest">
                        {pick(`${activeTicket.ticket.assignedAdminName ?? 'সাপোর্ট'} সমাধান করেছেন`, `Resolved by ${activeTicket.ticket.assignedAdminName ?? 'Support'}`)}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── input row ───────────────────────────────────────────── */}
            {view !== 'tickets' && (
              <div className="bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0 z-10 relative">
                {aiGuides.length > 0 && view === 'ai' && (
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar px-3 pt-3 pb-1">
                    {aiGuides.map(g => (
                      <button
                        key={g._id}
                        onClick={() => handleGuideClick(g)}
                        className="whitespace-nowrap px-3 py-1.5 bg-[#f4f7fb] hover:bg-[#eaeff5] text-gray-700 rounded-full text-[11px] font-bold transition-colors border border-gray-100"
                      >
                        {g.suggestionText}
                      </button>
                    ))}
                  </div>
                )}
                <div className="p-3 pt-2">
                {/* The focus indicator lives HERE, on the rounded pill, not on
                    the bare <input> inside it. index.css hands every field a
                    brand :focus-visible outline, and a text input matches
                    :focus-visible even when it was focused by TOUCH — so on a
                    phone, tapping to type drew a hard square crimson rectangle
                    straight through the rounded composer. Moving the ring out
                    to the container keeps focus just as visible (more so — the
                    old /10 tint was barely there) and lets it follow the
                    corner radius instead of cutting across it. */}
                <form
                  onSubmit={onSubmit}
                  className="flex items-center bg-[#f4f7fb] rounded-2xl p-1.5 shadow-inner ring-1 ring-transparent focus-within:ring-2 focus-within:ring-[#ba0036]/40 transition-all"
                >
                  {micAvailable && view === 'ai' && (
                    <button
                      type="button"
                      onMouseDown={keepKeyboard}
                      onClick={toggleVoice}
                      disabled={inputDisabled || isTyping || isTranscribing}
                      title={isListening ? 'শোনা বন্ধ করুন' : isTranscribing ? 'রূপান্তর হচ্ছে…' : 'বাংলায় বলুন'}
                      aria-label={isListening ? pick('শোনা বন্ধ করুন', 'Stop listening') : pick('বাংলায় বলুন', 'Speak in Bengali')}
                      className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${
                        isListening
                          ? 'bg-[#ba0036] text-white shadow-[0_4px_12px_rgba(186,0,54,0.3)] animate-pulse'
                          : 'text-gray-500 hover:text-[#ba0036]'
                      } disabled:opacity-50`}
                    >
                      <Mic size={16} />
                    </button>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    enterKeyHint="send"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={isListening ? 'শুনছি... এখন বলুন' : isTranscribing ? 'রূপান্তর হচ্ছে…' : placeholder}
                    disabled={inputDisabled}
                    // 16px on phones: iOS zooms the whole page into any field
                    // smaller than that the moment it is focused.
                    // focus-visible:outline-none is the half that actually wins:
                    // plain `outline-none` ties with the global :focus-visible
                    // rule in index.css on specificity and loses on source
                    // order. The form around it carries the focus ring.
                    className="flex-1 min-w-0 bg-transparent border-none outline-none focus:outline-none focus-visible:outline-none text-base md:text-sm font-medium text-gray-900 placeholder-gray-400 px-3 py-2 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    onMouseDown={keepKeyboard}
                    disabled={!inputText.trim() || isTyping || inputDisabled}
                    className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${
                      inputText.trim() && !isTyping && !inputDisabled
                        ? 'bg-[#ba0036] text-white shadow-[0_4px_12px_rgba(186,0,54,0.3)]'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    <Send size={16} className={inputText.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
                  </button>
                </form>
                <div className="text-center mt-2">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    {view === 'ai'
                      ? pick('AI-এর উত্তর সবসময় ১০০% সঠিক নাও হতে পারে', 'AI responses may not always be 100% accurate')
                      : pick('আপনি আমাদের টিমের একজনের সাথে চ্যাট করছেন', "You're chatting with a human teammate")}
                  </span>
                </div>
                </div>
              </div>
            )}
          </div>
        </Draggable>
      )}

      {!isOpen && (
        <button
          ref={floatingBtnRef}
          type="button"
          data-ai-assistant="true"
          onClick={() => setIsOpen(true)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setIsOpen(true);
          }}
          aria-label={pick('AI সহকারী খুলুন', 'Open AI assistant')}
          // This used to be a literal 110-pixel offset — a guess at "64px rail
          // plus a gap". It holds only while the gesture inset is ~24px:
          // --bottom-nav-h is 64px PLUS that inset, so on a phone with a 48px
          // inset the rail is 112px tall and this button sat behind it. Offset
          // from the token instead, like the chat panel above (line 517)
          // already does, so the gap is a real gap on every device. 24px clear
          // of the rail lands within ~2px of the old value on a typical phone,
          // so nothing moves visibly where it was already correct.
          //
          // (Written in prose, not as the class name: Tailwind scans comments
          // too, and spelling the old class here made it emit a dead rule.)
          className={`fixed bottom-[calc(var(--bottom-nav-h)+1.5rem)] md:bottom-6 right-4 md:right-8 z-[100] group flex items-center justify-center animate-in zoom-in cursor-pointer touch-manipulation select-none transition-all duration-700 ${(!isIconVisible || isMobileMenuOpen) ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}
        >
          <div className="absolute inset-0 bg-[#ba0036] rounded-full blur-xl opacity-40 group-hover:opacity-70 group-hover:scale-110 transition-all duration-300 animate-pulse pointer-events-none"></div>
          <div className="relative w-14 h-14 bg-gradient-to-br from-[#ba0036] to-[#8a0028] rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(186,0,54,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:-translate-y-1 transition-transform duration-300 pointer-events-none">
            <Bot size={24} className="text-white" />
            <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-green-400 shadow-[0_0_0_2px_white] rounded-full"></div>
          </div>
        </button>
      )}

      <VideoModal
        isOpen={activeVideoModal.isOpen}
        onClose={() => setActiveVideoModal({ ...activeVideoModal, isOpen: false })}
        videoUrl={activeVideoModal.url}
        title={activeVideoModal.title}
      />
    </div>
  );
};

// ─── small subcomponents ────────────────────────────────────────────────

// Compact, tappable property card rendered inside an AI reply when the
// assistant runs a search. Tapping opens the full property page.
const AiPropertyCard = ({ property, onOpen }) => {
  const p = property || {};
  const price = (p.price ?? '') === '' ? '' : Number(p.price).toLocaleString('en-IN');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="no-drag w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-gray-100 hover:border-[#ba0036]/30 transition-all active:scale-[0.98] flex"
    >
      <div className="w-24 h-24 bg-gray-100 shrink-0 relative">
        {p.coverPhoto ? (
          <img src={p.coverPhoto} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Building2 size={26} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center">
        <h5 className="text-[13px] font-black text-gray-900 truncate">{p.title}</h5>
        {p.location ? (
          <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1 mt-0.5 min-w-0">
            <MapPin size={11} className="text-gray-400 shrink-0" />
            <span className="truncate">{p.location}</span>
          </p>
        ) : null}
        <div className="flex items-center gap-2.5 mt-1.5 text-[11px] font-bold text-gray-600">
          {price ? <span className="text-[#ba0036] font-black">৳{price}</span> : null}
          {p.beds != null ? <span className="flex items-center gap-0.5"><BedDouble size={11} />{p.beds}</span> : null}
          {p.baths != null ? <span className="flex items-center gap-0.5"><Bath size={11} />{p.baths}</span> : null}
        </div>
      </div>
    </button>
  );
};


const TicketStatusPill = ({ status }) => {
  const isBn = useIsBn();
  const styles = {
    open: 'bg-blue-50 text-blue-600',
    pending_user: 'bg-amber-50 text-amber-700',
    resolved: 'bg-green-50 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
  };
  const label = {
    open: isBn ? 'খোলা' : 'Open',
    pending_user: isBn ? 'আপনার উত্তরের অপেক্ষায়' : 'Awaiting you',
    resolved: isBn ? 'সমাধান হয়েছে' : 'Resolved',
    closed: isBn ? 'বন্ধ' : 'Closed',
  };
  return (
    <span
      className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap ${
        styles[status] ?? 'bg-gray-100 text-gray-500'
      }`}
    >
      {label[status] ?? status}
    </span>
  );
};

const TicketMessageBubble = ({ message, myUserId }) => {
  const isBn = useIsBn();
  if (message.author === 'system') {
    return (
      <div className="self-center bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
        {message.text}
      </div>
    );
  }
  const mine = message.author === 'user' && message.authorId === myUserId;
  return (
    <div className={`flex flex-col max-w-[85%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
      <div
        className={`px-4 py-3 shadow-md ${
          mine
            ? 'bg-gray-900 text-white rounded-[1.5rem] rounded-tr-sm'
            : message.author === 'admin'
            ? 'bg-[#ba0036] text-white rounded-[1.5rem] rounded-tl-sm'
            : 'bg-white text-gray-800 rounded-[1.5rem] rounded-tl-sm'
        }`}
      >
        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{message.text}</p>
      </div>
      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 px-1">
        {message.author === 'admin'
          ? (isBn ? `সাপোর্ট · ${message.authorName ?? 'টিম'}` : `Support · ${message.authorName ?? 'Team'}`)
          : mine
          ? (isBn ? 'আপনি' : 'You')
          : message.authorName}
        {' · '}
        {timeAgo(message.createdAt, isBn)}
      </span>
    </div>
  );
};

// ─── helpers ────────────────────────────────────────────────────────────

function timeAgo(iso, isBn = false) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return isBn ? 'এইমাত্র' : 'just now';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return isBn ? `${min} মিনিট আগে` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isBn ? `${hr} ঘণ্টা আগে` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return isBn ? `${day} দিন আগে` : `${day}d ago`;
}

export default GlobalAIAssistant;