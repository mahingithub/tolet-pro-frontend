// SupportPage.jsx
//
// User-facing Help & Support center. Wired to the real support API via
// services/supportService.js (helpdesk cases):
//   • listMyTickets / openTicket / getTicket / sendMessage / closeTicket
//   • onTicketsChanged — light polling so replies from the support team
//     appear without a manual refresh.
//
// Two views in one component:
//   'list'   → my tickets + "new request" composer + FAQ
//   'detail' → a single ticket thread with a reply box + close action
//
// Guests (not logged in) get a friendly FAQ + a "log in to contact us"
// prompt instead of the ticket UI (the API requires auth).

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, LifeBuoy, Send, Plus, MessageSquare, ChevronRight,
  CheckCircle2, Loader2, HelpCircle, ShieldCheck,
  Sparkles, ChevronDown, User, Building2, CreditCard, Clock, BookOpen, PlayCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext';
import {
  listMyTickets, openTicket, getTicket, sendMessage, closeTicket, onTicketsChanged,
} from '../services/supportService';
import { getSectionGuides } from '../services/aiGuideService';
import VideoGuides from './shared/VideoGuides';

// status → badge styling + bilingual label
const STATUS = {
  open:         { en: 'Open',        bn: 'ওপেন',          cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  pending_user: { en: 'Your reply',  bn: 'আপনার উত্তর',    cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  resolved:     { en: 'Resolved',    bn: 'সমাধান হয়েছে',   cls: 'bg-blue-50 text-blue-600 border-blue-100' },
  closed:       { en: 'Closed',      bn: 'বন্ধ',           cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const FAQS = [
  {
    q: { en: 'How do I contact a property owner?', bn: 'কীভাবে বাড়ির মালিকের সাথে যোগাযোগ করব?' },
    a: {
      en: 'Open any property and tap "Inquire" or "Message". Verified owners typically reply within an hour. All chats stay inside TO-LET PRO for your safety.',
      bn: 'যেকোনো বাড়ি খুলে "যোগাযোগ করুন" বা "মেসেজ" চাপুন। ভেরিফাইড মালিকরা সাধারণত এক ঘণ্টার মধ্যে উত্তর দেন। আপনার নিরাপত্তার জন্য সব চ্যাট টু-লেট প্রো-তেই থাকে।',
    },
  },
  {
    q: { en: 'Is there any brokerage fee?', bn: 'কোনো দালাল ফি আছে কি?' },
    a: {
      en: 'No. Browsing listings and contacting verified owners is free. Landlords may choose premium placement, but tenants never pay brokerage.',
      bn: 'না। লিস্টিং দেখা ও ভেরিফাইড মালিকের সাথে যোগাযোগ ফ্রি। মালিকরা প্রিমিয়াম প্লেসমেন্ট নিতে পারেন, তবে ভাড়াটিয়াদের কোনো দালাল ফি দিতে হয় না।',
    },
  },
  {
    q: { en: 'How do I list my property?', bn: 'কীভাবে আমার বাড়ি লিস্ট করব?' },
    a: {
      en: 'Switch to Host mode from the menu, then tap "List a Property". It takes about 3 minutes. New landlords complete a quick verification first.',
      bn: 'মেনু থেকে হোস্ট মোডে যান, তারপর "বাড়ি দিন" চাপুন। প্রায় ৩ মিনিট লাগে। নতুন মালিকদের প্রথমে একটি দ্রুত ভেরিফিকেশন সম্পন্ন করতে হয়।',
    },
  },
  {
    q: { en: 'How is a listing verified?', bn: 'লিস্টিং কীভাবে ভেরিফাই হয়?' },
    a: {
      en: 'Our team checks ownership documents and property details before a listing gets the verified badge, so you can inquire with confidence.',
      bn: 'ভেরিফাইড ব্যাজ দেওয়ার আগে আমাদের টিম মালিকানার কাগজপত্র ও বাড়ির তথ্য যাচাই করে, যাতে আপনি নিশ্চিন্তে যোগাযোগ করতে পারেন।',
    },
  },
  {
    q: { en: 'How long does verification take?', bn: 'ভেরিফিকেশনে কত সময় লাগে?' },
    a: {
      en: 'Most owner verifications finish within 24\u201348 hours after a valid NID and proof of ownership are submitted. You get a notification the moment it\u2019s approved.',
      bn: 'সঠিক এনআইডি ও মালিকানার প্রমাণ জমা দেওয়ার পর বেশিরভাগ মালিক ভেরিফিকেশন ২৪–৪৮ ঘণ্টার মধ্যে সম্পন্ন হয়। অনুমোদন হওয়ার সাথে সাথেই নোটিফিকেশন পাবেন।',
    },
  },
  {
    q: { en: 'How do I report a suspicious user or listing?', bn: 'সন্দেহজনক ব্যবহারকারী বা লিস্টিং কীভাবে রিপোর্ট করব?' },
    a: {
      en: 'Open the chat or listing, tap the menu and choose Report or Block. Our moderation team reviews every report quickly — or open a request here and we\u2019ll take it from there.',
      bn: 'চ্যাট বা লিস্টিং খুলে মেনুতে ট্যাপ করে রিপোর্ট বা ব্লক বেছে নিন। আমাদের মডারেশন টিম প্রতিটি রিপোর্ট দ্রুত পর্যালোচনা করে — অথবা এখানে একটি অনুরোধ খুলুন, আমরা ব্যবস্থা নেব।',
    },
  },
];

// Quick-start topics — tapping one opens the request composer pre-filled so
// the ticket lands in the admin support inbox already categorised.
const HELP_TOPICS = [
  { Icon: User,        en: 'Account & profile',       bn: 'অ্যাকাউন্ট ও প্রোফাইল' },
  { Icon: Building2,   en: 'Listings & search',       bn: 'লিস্টিং ও সার্চ' },
  { Icon: CreditCard,  en: 'Payments & billing',      bn: 'পেমেন্ট ও বিলিং' },
  { Icon: ShieldCheck, en: 'Safety & verification',   bn: 'নিরাপত্তা ও ভেরিফিকেশন' },
];

// Reassurance chips shown in the hero.
const ASSURANCES = [
  { Icon: Clock,         en: 'Fast replies',      bn: 'দ্রুত উত্তর' },
  { Icon: MessageSquare, en: 'In-app updates',    bn: 'অ্যাপে আপডেট' },
  { Icon: ShieldCheck,   en: 'Real support team', bn: 'আসল সাপোর্ট টিম' },
];

export default function SupportPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const isBn = language === 'বাংলা' || language === 'bn';
  const tr = (en, bn) => (isBn ? bn : en);

  const [view, setView]           = useState('list');   // 'list' | 'detail'
  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composer, setComposer]   = useState('');
  const [creating, setCreating]   = useState(false);

  const [active, setActive]       = useState(null);     // { ticket, messages }
  const [reply, setReply]         = useState('');
  const [replying, setReplying]   = useState(false);
  const [openFaq, setOpenFaq]     = useState(null);
  const [supportVideos, setSupportVideos] = useState([]);

  const threadEndRef = useRef(null);
  const activeIdRef  = useRef(null);

  const loadTickets = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const list = await listMyTickets();
      setTickets(Array.isArray(list) ? list : []);
    } catch {
      /* silent — surfaced by empty state */
    }
  }, [isAuthenticated]);

  const refreshActive = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    try {
      const data = await getTicket(id);
      if (data) setActive(data);
    } catch { /* ignore */ }
  }, []);

  // Initial load + subscribe to polling so support replies stream in.
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    loadTickets().finally(() => setLoading(false));
    const unsub = onTicketsChanged(() => {
      loadTickets();
      refreshActive();
    });
    return unsub;
  }, [isAuthenticated, loadTickets, refreshActive]);

  // Load admin-managed "how to use support" videos. Public — guests see them too.
  useEffect(() => {
    let alive = true;
    getSectionGuides('support').then((v) => { if (alive) setSupportVideos(v); });
    return () => { alive = false; };
  }, []);

  // Auto-scroll the thread to the newest message.
  useEffect(() => {
    if (view === 'detail') threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active, view]);

  const openThread = async (id) => {
    activeIdRef.current = id;
    setView('detail');
    setActive(null);
    try {
      const data = await getTicket(id);
      setActive(data);
    } catch {
      toast.error(tr('Could not open this ticket.', 'টিকিট খোলা যায়নি।'));
      setView('list');
    }
  };

  const handleCreate = async () => {
    const text = composer.trim();
    if (!text) return;
    setCreating(true);
    try {
      const ticket = await openTicket({ initialMessage: text });
      setComposer('');
      setShowComposer(false);
      toast.success(tr('Request sent. Our team will reply soon.', 'অনুরোধ পাঠানো হয়েছে। আমাদের টিম শীঘ্রই উত্তর দেবে।'));
      await loadTickets();
      if (ticket?.id) openThread(ticket.id);
    } catch {
      toast.error(tr('Could not send your request.', 'অনুরোধ পাঠানো যায়নি।'));
    } finally {
      setCreating(false);
    }
  };

  // Tapping a help topic opens the composer with the topic pre-filled so the
  // request reaches the support team already labelled. Guests are sent to
  // login first (the ticket API requires auth).
  const startTopic = (label) => {
    if (!isAuthenticated) {
      navigate('/login?next=%2Fsupport');
      return;
    }
    setShowComposer(true);
    setComposer((prev) => (prev.trim() ? prev : `${label}: `));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReply = async () => {
    const text = reply.trim();
    if (!text || !active?.ticket?.id) return;
    setReplying(true);
    try {
      const msg = await sendMessage(active.ticket.id, text);
      setReply('');
      setActive((prev) => prev ? { ...prev, messages: [...(prev.messages || []), msg] } : prev);
    } catch {
      toast.error(tr('Message not sent.', 'মেসেজ পাঠানো যায়নি।'));
    } finally {
      setReplying(false);
    }
  };

  const handleClose = async () => {
    if (!active?.ticket?.id) return;
    try {
      await closeTicket(active.ticket.id);
      toast.success(tr('Ticket closed.', 'টিকিট বন্ধ করা হয়েছে।'));
      await loadTickets();
      setView('list');
    } catch {
      toast.error(tr('Could not close ticket.', 'টিকিট বন্ধ করা যায়নি।'));
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };
  const fmtTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString(isBn ? 'bn-BD' : 'en-US', { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  const StatusBadge = ({ status }) => {
    const s = STATUS[status] || STATUS.open;
    return (
      <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${s.cls}`}>
        {tr(s.en, s.bn)}
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────── DETAIL VIEW
  if (view === 'detail') {
    const ticket = active?.ticket;
    const messages = active?.messages || [];
    const isClosed = ticket && (ticket.status === 'closed' || ticket.status === 'resolved');
    return (
      <div className="min-h-[100dvh] bg-gray-50 pb-28 md:pb-10">
        <div className="max-w-2xl mx-auto px-4 pt-5">
          <button
            onClick={() => { setView('list'); activeIdRef.current = null; }}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-[#ba0036] mb-4 active:scale-95 transition-all"
          >
            <ArrowLeft size={18} /> {tr('All requests', 'সব অনুরোধ')}
          </button>

          {!ticket ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-lg font-black text-gray-900 leading-snug">{ticket.subject}</h1>
                  <StatusBadge status={ticket.status} />
                </div>
                <p className="text-xs font-medium text-gray-400 mt-1">
                  {tr('Opened', 'খোলা হয়েছে')} {fmtDate(ticket.createdAt)}
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-3 mb-4">
                {messages.map((m) => {
                  const mine = m.author === 'user';
                  const system = m.author === 'system';
                  if (system) {
                    return (
                      <p key={m.id} className="text-center text-[11px] font-medium text-gray-400 py-1">
                        {m.text}
                      </p>
                    );
                  }
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-[#ba0036] text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
                        {!mine && (
                          <p className="text-[10px] font-black uppercase tracking-wide text-[#ba0036] mb-0.5">
                            {m.author === 'admin' ? tr('Support team', 'সাপোর্ট টিম') : (m.authorName || tr('Assistant', 'সহকারী'))}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-gray-400'}`}>{fmtTime(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              {isClosed ? (
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-gray-400 bg-white rounded-2xl border border-gray-100 py-4">
                  <CheckCircle2 size={16} /> {tr('This request is closed.', 'এই অনুরোধটি বন্ধ।')}
                </div>
              ) : (
                <div className="sticky bottom-24 md:bottom-4">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-2 flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                      rows={1}
                      placeholder={tr('Write a reply…', 'একটি উত্তর লিখুন…')}
                      className="flex-1 resize-none bg-transparent px-3 py-2 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none max-h-32"
                    />
                    <button
                      onClick={handleReply}
                      disabled={!reply.trim() || replying}
                      className="shrink-0 w-10 h-10 rounded-xl bg-[#ba0036] text-white flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all"
                      aria-label={tr('Send', 'পাঠান')}
                    >
                      {replying ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  </div>
                  <button onClick={handleClose} className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600 mt-3 transition-colors">
                    {tr('Mark as resolved & close', 'সমাধান হিসেবে চিহ্নিত করে বন্ধ করুন')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────── LIST VIEW
  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-28 md:pb-10">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#ba0036] to-[#e60045] text-white">
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-10 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-bold text-white/90 hover:text-white mb-5 active:scale-95 transition-all"
          >
            <ArrowLeft size={18} /> {tr('Back', 'পেছনে')}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <LifeBuoy size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-tight">{tr('Help & Support', 'সহায়তা ও সাপোর্ট')}</h1>
              <p className="text-sm font-medium text-red-100">{tr("We're here to help you", 'আমরা আপনাকে সাহায্য করতে এখানে আছি')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            {ASSURANCES.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-[11px] font-black">
                <a.Icon size={13} /> {tr(a.en, a.bn)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-5">
        {/* Browse help topics — quick-start into a categorised request */}
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-2 mb-2">
            {tr('Browse help topics', 'সহায়তার বিষয় দেখুন')}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {HELP_TOPICS.map((topic, i) => (
              <button
                key={i}
                onClick={() => startTopic(tr(topic.en, topic.bn))}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <topic.Icon size={18} className="text-[#ba0036]" />
                </div>
                <span className="text-sm font-bold text-gray-900 leading-tight">{tr(topic.en, topic.bn)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* How-to-support videos (admin-managed via /admin/support → AI Video Guides) */}
        {supportVideos.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 px-2 mb-2">
              <PlayCircle size={16} className="text-[#ba0036] shrink-0" />
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                {tr('Watch how support works', 'দেখে নিন সাপোর্ট কীভাবে কাজ করে')}
              </p>
            </div>
            <VideoGuides guides={supportVideos} columns={2} />
          </div>
        )}

        {/* Contact / new request card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-5">
          {isAuthenticated ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-black text-gray-900">{tr('Contact support', 'সাপোর্টে যোগাযোগ')}</h2>
                {!showComposer && (
                  <button
                    onClick={() => setShowComposer(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-black text-[#ba0036] active:scale-95 transition-transform"
                  >
                    <Plus size={16} /> {tr('New request', 'নতুন অনুরোধ')}
                  </button>
                )}
              </div>
              <p className="text-xs font-medium text-gray-400 mb-3">
                {tr('Describe your issue and our team will get back to you.', 'আপনার সমস্যা লিখুন, আমাদের টিম আপনার সাথে যোগাযোগ করবে।')}
              </p>

              {showComposer && (
                <div className="mb-2">
                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder={tr('How can we help you?', 'আমরা কীভাবে সাহায্য করতে পারি?')}
                    className="w-full resize-none rounded-2xl border border-gray-200 focus:border-[#ba0036] focus:ring-2 focus:ring-[#ba0036]/10 px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none transition-all"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleCreate}
                      disabled={!composer.trim() || creating}
                      className="flex-1 bg-[#ba0036] text-white py-3 rounded-xl font-black text-sm shadow-md disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {creating ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                      {tr('Send request', 'অনুরোধ পাঠান')}
                    </button>
                    <button
                      onClick={() => { setShowComposer(false); setComposer(''); }}
                      className="px-4 py-3 rounded-xl font-black text-sm text-gray-500 bg-gray-100 active:scale-95 transition-all"
                    >
                      {tr('Cancel', 'বাতিল')}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} className="text-[#ba0036]" />
              </div>
              <h2 className="text-base font-black text-gray-900 mb-1">{tr('Log in to contact us', 'যোগাযোগ করতে লগইন করুন')}</h2>
              <p className="text-xs font-medium text-gray-400 mb-4 leading-relaxed">
                {tr('Sign in to open a support request and track replies from our team.', 'সাপোর্ট অনুরোধ খুলতে ও আমাদের টিমের উত্তর দেখতে লগইন করুন।')}
              </p>
              <button
                onClick={() => navigate('/login?next=%2Fsupport')}
                className="inline-flex items-center gap-2 bg-[#ba0036] text-white px-6 py-3 rounded-xl font-black text-sm shadow-md active:scale-95 transition-all"
              >
                {tr('Log in', 'লগইন')} <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* My tickets */}
        {isAuthenticated && (
          <div className="mb-5">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-2 mb-2">
              {tr('My requests', 'আমার অনুরোধ')}
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-300">
                <Loader2 className="animate-spin" size={22} />
              </div>
            ) : tickets.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
                <MessageSquare size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-500">{tr('No requests yet', 'এখনো কোনো অনুরোধ নেই')}</p>
                <p className="text-xs font-medium text-gray-400 mt-1">{tr('Your support conversations will show up here.', 'আপনার সাপোর্ট কথোপকথন এখানে দেখা যাবে।')}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tickets.map((tk) => (
                  <button
                    key={tk.id}
                    onClick={() => openThread(tk.id)}
                    className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <MessageSquare size={18} className="text-[#ba0036]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{tk.subject}</p>
                      <p className="text-xs font-medium text-gray-400">{tr('Updated', 'আপডেট')} {fmtDate(tk.updatedAt)}</p>
                    </div>
                    <StatusBadge status={tk.status} />
                    <ChevronRight size={18} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-2 mb-2">
            {tr('Frequently asked', 'সাধারণ প্রশ্ন')}
          </p>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors"
                  >
                    <HelpCircle size={18} className="text-[#ba0036] shrink-0" />
                    <span className="flex-1 text-sm font-bold text-gray-900">{tr(f.q.en, f.q.bn)}</span>
                    <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <p className="px-4 pb-4 pl-[52px] text-sm font-medium text-gray-500 leading-relaxed">
                      {tr(f.a.en, f.a.bn)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Learn more — cross-link to the How it Works guide */}
        <button
          onClick={() => navigate('/how-it-works')}
          className="w-full bg-white rounded-3xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left hover:border-gray-200 hover:shadow-md active:scale-[0.99] transition-all mb-5"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-[#ba0036]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{tr('New here? See how TO-LET PRO works', 'নতুন? দেখুন টু-লেট প্রো যেভাবে কাজ করে')}</p>
            <p className="text-xs font-medium text-gray-400">{tr('A quick guide for tenants and landlords.', 'ভাড়াটিয়া ও বাড়িওয়ালার জন্য দ্রুত গাইড।')}</p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </button>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-400 py-2">
          <Sparkles size={14} className="text-[#ba0036]" />
          {tr('TO-LET PRO — Bangladesh\u2019s trusted rental platform', 'টু-লেট প্রো — বাংলাদেশের বিশ্বস্ত রেন্টাল প্ল্যাটফর্ম')}
        </div>
      </div>
    </div>
  );
}
