import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import callProvider from '../services/callProvider';
import { replyToInquiry, proposeVisit, respondVisit } from '../services/inquiryService';
import {
  Check, Clock, Eye, MessageSquare, Calendar, Flag, XCircle,
  CheckCircle2, MapPin, Send, BadgeCheck, CalendarPlus
} from 'lucide-react';

const STEPS = [
  { id: 'sent', bn: 'পাঠানো হয়েছে', en: 'Sent', icon: Clock },
  { id: 'delivered', bn: 'পৌঁছেছে', en: 'Delivered', icon: Check },
  { id: 'viewed', bn: 'দেখা হয়েছে', en: 'Viewed', icon: Eye },
  { id: 'answered', bn: 'উত্তর দেওয়া হয়েছে', en: 'Answered', icon: MessageSquare },
  { id: 'visit', bn: 'ভিজিট শিডিউল', en: 'Visit Scheduled', icon: Calendar, optional: true },
  { id: 'decision', bn: 'সিদ্ধান্ত', en: 'Decision', icon: Flag }
];

// Commercial deals speak a different language: a site visit + terms negotiation
// ending in a signed lease agreement (not a residential viewing → move-in).
// Same ids so the status → step-index mapping is unchanged; only the labels
// differ.
const STEPS_COMMERCIAL = [
  { id: 'sent', bn: 'পাঠানো হয়েছে', en: 'Sent', icon: Clock },
  { id: 'delivered', bn: 'পৌঁছেছে', en: 'Delivered', icon: Check },
  { id: 'viewed', bn: 'দেখা হয়েছে', en: 'Viewed', icon: Eye },
  { id: 'answered', bn: 'আলোচনা', en: 'Discussion', icon: MessageSquare },
  { id: 'visit', bn: 'সাইট ভিজিট', en: 'Site Visit', icon: Calendar, optional: true },
  { id: 'decision', bn: 'লিজ চুক্তি', en: 'Lease Agreement', icon: Flag }
];

export default function InquiryStatusTimeline({ inquiry, onCancelVisit }) {
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const inquiryId = inquiry?.id || inquiry?._id;
  const isCommercial = inquiry?.dealType === 'commercial';
  const STEP_SET = isCommercial ? STEPS_COMMERCIAL : STEPS;

  const [currentStatus, setCurrentStatus] = useState(inquiry?.status || 'sent');
  const [messages, setMessages] = useState(inquiry?.messages || []);
  const [visit, setVisit] = useState(inquiry?.visitSchedule || null);

  // Tenant reply box
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Tenant propose-visit form
  const [showPropose, setShowPropose] = useState(false);
  const [visitForm, setVisitForm] = useState({ date: '', time: '', location: '' });
  const [proposing, setProposing] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null); // 'accept' | 'reject' while in-flight

  const threadEndRef = useRef(null);

  useEffect(() => {
    setCurrentStatus(inquiry?.status || 'sent');
    setMessages(inquiry?.messages || []);
    setVisit(inquiry?.visitSchedule || null);
  }, [inquiry]);

  // ── Realtime: server emits 'inquiry:status_updated' with optional
  //    { status, message, visitSchedule } so we patch in place (no refetch). ──
  useEffect(() => {
    const socket = callProvider.getSocket();
    if (!socket) return;

    const handleUpdate = (data) => {
      if (data.inquiryId !== inquiryId) return;
      if (data.status) setCurrentStatus(data.status);
      if (data.message) setMessages(prev => [...prev, data.message]);
      if (data.visitSchedule) setVisit(data.visitSchedule);
    };

    socket.on('inquiry:status_updated', handleUpdate);
    return () => socket.off('inquiry:status_updated', handleUpdate);
  }, [inquiryId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const getStepIndex = (status) => {
    switch (status) {
      case 'sent': return 0;
      case 'delivered': return 1;
      case 'viewed': return 2;
      case 'accepted':
      case 'rejected': return 3;
      case 'visit_scheduled': return 4;
      case 'final_booking':
      case 'converted':
      case 'completed':
      case 'rented': return 5;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(currentStatus);
  const isRejected = currentStatus === 'rejected';
  const isTerminal = isRejected || ['final_booking', 'converted', 'completed', 'rented'].includes(currentStatus);

  // A landlord has replied if any message is from the landlord.
  const landlordReplied = messages.some(m => m.sender === 'landlord');
  const visitAccepted = visit?.status === 'accepted';
  const visitPending = visit?.status === 'pending';
  // Tenant can act on a pending visit only if the LANDLORD proposed it.
  const canAcceptVisit = visitPending && visit?.proposedBy === 'landlord';
  // Tenant may propose once the inquiry is accepted and there's no live visit.
  const canProposeVisit = currentStatus === 'accepted' && !visitAccepted && !visitPending;

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await replyToInquiry(inquiryId, text);
      setMessages(prev => [...prev, { sender: 'tenant', text, createdAt: new Date().toISOString() }]);
      setReplyText('');
    } catch (err) {
      console.error('[timeline] reply failed:', err.message);
    } finally {
      setSending(false);
    }
  };

  const handleProposeVisit = async () => {
    if (!visitForm.date || !visitForm.time || proposing) return;
    setProposing(true);
    try {
      const updated = await proposeVisit(inquiryId, visitForm);
      setVisit(updated?.visitSchedule || { ...visitForm, proposedBy: 'tenant', status: 'pending' });
      setShowPropose(false);
      setVisitForm({ date: '', time: '', location: '' });
    } catch (err) {
      console.error('[timeline] propose visit failed:', err.message);
    } finally {
      setProposing(false);
    }
  };

  const handleRespondVisit = async (action) => {
    if (respondingTo) return;
    setRespondingTo(action);
    try {
      const updated = await respondVisit(inquiryId, action);
      setVisit(updated?.visitSchedule || { ...visit, status: action === 'accept' ? 'accepted' : 'rejected' });
      if (action === 'accept') setCurrentStatus('visit_scheduled');
    } catch (err) {
      console.error('[timeline] respond visit failed:', err.message);
    } finally {
      setRespondingTo(null);
    }
  };

  const inputCls = 'w-full p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all';

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
      {isCommercial && (
        <div className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-black text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
          🏢 {isBn ? 'কমার্শিয়াল লিজ' : 'Commercial Lease'}
        </div>
      )}
      {/* Timeline */}
      <div className="relative flex justify-between items-center mb-10 sm:mb-12 mt-4 px-2 sm:px-4">
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-100 -translate-y-1/2 rounded-full z-0"></div>
        <div
          className={`absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full z-0 transition-all duration-700 ease-in-out ${isRejected ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${(Math.min(currentIndex, 5) / 5) * 100}%` }}
        ></div>

        {STEP_SET.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          let iconBg = 'bg-gray-100 text-gray-400';
          let ring = '';

          if (isCompleted) {
            iconBg = isRejected && index >= 3 ? 'bg-gray-100 text-gray-300' : 'bg-blue-500 text-white';
          } else if (isCurrent) {
            if (isRejected && index === 3) {
              iconBg = 'bg-red-500 text-white';
              ring = 'ring-4 ring-red-100';
            } else if ((currentStatus === 'final_booking' || currentStatus === 'converted') && index === 5) {
              iconBg = 'bg-green-500 text-white';
              ring = 'ring-4 ring-green-100';
            } else {
              iconBg = 'bg-blue-600 text-white';
              ring = 'ring-4 ring-blue-100 animate-pulse';
            }
          }

          // Blue tick on the Visit step once a visit is accepted.
          const showVisitTick = step.id === 'visit' && visitAccepted;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${showVisitTick ? 'bg-blue-500 text-white' : iconBg} ${ring}`}>
                {showVisitTick
                  ? <BadgeCheck size={isCurrent ? 24 : 16} className="sm:w-6 sm:h-6" />
                  : (isRejected && index === 3)
                    ? <XCircle size={isCurrent ? 24 : 16} className="sm:w-6 sm:h-6" />
                    : <Icon size={isCurrent ? 24 : 16} className="sm:w-6 sm:h-6" />}
              </div>
              <div className="absolute -bottom-8 w-24 flex flex-col items-center">
                <span className={`text-[9px] sm:text-[11px] font-black text-center leading-tight ${isCurrent || isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                  {isBn ? step.bn : step.en}
                </span>
                {step.optional && <span className="text-[8px] sm:text-[9px] block text-center font-bold text-gray-400">({isBn ? 'ঐচ্ছিক' : 'Optional'})</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 sm:mt-12 space-y-5">

        {/* ── Conversation thread (landlord reply + tenant follow-ups) ── */}
        {(messages.length > 0 || (!isTerminal && currentIndex >= 1)) && (
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 sm:p-5">
            <h4 className="font-black text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <MessageSquare className="text-blue-600" size={18} />
              {isBn ? 'কথোপকথন' : 'Conversation'}
            </h4>

            <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {messages.length === 0 && (
                <p className="text-xs font-bold text-gray-400 text-center py-3">
                  {isBn ? 'এখনো কোনো রিপ্লাই নেই। নিচে মেসেজ পাঠান।' : 'No replies yet. Send a message below.'}
                </p>
              )}
              {messages.map((m, i) => {
                const mine = m.sender === 'tenant';
                return (
                  <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'}`}>
                      {!mine && (
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-0.5">
                          {isBn ? 'ল্যান্ডলর্ড' : 'Landlord'}
                        </p>
                      )}
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            {!isTerminal && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendReply(); }}
                  placeholder={isBn ? 'মেসেজ লিখুন...' : 'Type a message...'}
                  className={inputCls}
                />
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                  className="shrink-0 w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Status banners ── */}
        {currentStatus === 'accepted' && !visitPending && !visitAccepted && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 sm:p-5 flex items-start sm:items-center gap-3">
            <CheckCircle2 className="text-green-600 shrink-0 mt-0.5 sm:mt-0" size={20} />
            <p className="text-green-800 font-bold text-sm leading-relaxed">
              {isBn ? 'ইনকোয়ারি গ্রহণ করা হয়েছে। চাইলে একটি ভিজিট প্রস্তাব করুন।' : 'Inquiry accepted. You can propose a visit if you like.'}
            </p>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 sm:p-5 flex items-start sm:items-center gap-3">
            <XCircle className="text-red-600 shrink-0 mt-0.5 sm:mt-0" size={20} />
            <p className="text-red-800 font-bold text-sm">
              {isBn ? 'ইনকোয়ারি প্রত্যাখ্যান করা হয়েছে।' : 'Inquiry rejected.'}
            </p>
          </div>
        )}

        {/* ── Two-way Visit card ── */}
        {(visitPending || visitAccepted) && (
          <div className={`rounded-2xl p-5 sm:p-6 shadow-sm border ${visitAccepted ? 'bg-blue-50/60 border-blue-200' : 'bg-amber-50/60 border-amber-200'}`}>
            <h4 className="font-black text-gray-900 mb-4 flex items-center gap-2">
              {visitAccepted ? <BadgeCheck className="text-blue-600" size={20} /> : <Calendar className="text-amber-600" size={20} />}
              {visitAccepted
                ? (isBn ? 'ভিজিট নিশ্চিত হয়েছে' : 'Visit Confirmed')
                : (isBn ? 'ভিজিট অনুরোধ' : 'Visit Request')}
              {visitAccepted && <Check className="text-blue-600" size={16} strokeWidth={3} />}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0"><Clock size={18} /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{isBn ? 'তারিখ ও সময়' : 'Date & Time'}</p>
                  <p className="text-sm font-bold text-gray-900">{visit?.date || 'TBD'} • {visit?.time || 'TBD'}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0"><MapPin size={18} /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{isBn ? 'ঠিকানা/লোকেশন' : 'Location'}</p>
                  <p className="text-sm font-bold text-gray-900">{visit?.location || inquiry?.propTitle || 'TBD'}</p>
                </div>
              </div>
            </div>

            {/* Landlord proposed → tenant accepts/rejects */}
            {canAcceptVisit && (
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => handleRespondVisit('accept')}
                  disabled={!!respondingTo}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-1.5"
                >
                  {respondingTo === 'accept' ? '...' : <><Check size={16} strokeWidth={3} /> {isBn ? 'গ্রহণ করুন' : 'Accept'}</>}
                </button>
                <button
                  onClick={() => handleRespondVisit('reject')}
                  disabled={!!respondingTo}
                  className="flex-1 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 px-5 py-2.5 rounded-xl text-sm font-black transition-all"
                >
                  {respondingTo === 'reject' ? '...' : (isBn ? 'প্রত্যাখ্যান' : 'Reject')}
                </button>
              </div>
            )}

            {/* Tenant proposed → waiting on landlord */}
            {visitPending && visit?.proposedBy === 'tenant' && (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                {isBn ? 'ল্যান্ডলর্ডের অনুমোদনের অপেক্ষায়...' : 'Waiting for the landlord to accept...'}
              </p>
            )}

            {visitAccepted && (
              <button onClick={onCancelVisit} className="w-full sm:w-auto bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 px-6 py-2.5 rounded-xl text-sm font-black transition-all">
                {isBn ? 'বাতিল করার অনুরোধ' : 'Request Cancel'}
              </button>
            )}
          </div>
        )}

        {/* Tenant can propose a visit */}
        {canProposeVisit && (
          <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 sm:p-5">
            {!showPropose ? (
              <button
                onClick={() => setShowPropose(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2"
              >
                <CalendarPlus size={16} /> {isBn ? 'ভিজিট প্রস্তাব করুন' : 'Propose a Visit'}
              </button>
            ) : (
              <div className="space-y-3">
                <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                  <CalendarPlus className="text-blue-600" size={18} /> {isBn ? 'ভিজিট প্রস্তাব' : 'Propose a Visit'}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={visitForm.date} onChange={e => setVisitForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                  <input type="time" value={visitForm.time} onChange={e => setVisitForm(f => ({ ...f, time: e.target.value }))} className={inputCls} />
                </div>
                <input type="text" value={visitForm.location} onChange={e => setVisitForm(f => ({ ...f, location: e.target.value }))} placeholder={isBn ? 'লোকেশন (ঐচ্ছিক)' : 'Location (optional)'} className={inputCls} />
                <div className="flex gap-2">
                  <button onClick={handleProposeVisit} disabled={proposing || !visitForm.date || !visitForm.time} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all">
                    {proposing ? '...' : (isBn ? 'পাঠান' : 'Send')}
                  </button>
                  <button onClick={() => setShowPropose(false)} className="px-5 py-2.5 rounded-xl text-sm font-black bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Deal confirmed ── */}
        {(currentStatus === 'final_booking' || currentStatus === 'converted' || currentStatus === 'completed' || currentStatus === 'rented') && (
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 sm:gap-4 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
                  <Flag className="text-white" size={24} />
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight">{isBn ? 'ডিল নিশ্চিত হয়েছে 🎉' : 'Deal Confirmed 🎉'}</h3>
              </div>
              <p className="text-purple-100 text-sm sm:text-base font-medium sm:ml-16 leading-relaxed">
                {isBn ? 'অভিনন্দন! আপনি সফলভাবে প্রপার্টিটি ভাড়া নিয়েছেন:' : 'Congratulations! You have successfully rented:'} <strong className="text-white block mt-1 text-lg">{inquiry?.propTitle}</strong>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}