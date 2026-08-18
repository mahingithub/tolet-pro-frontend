import React from 'react';
import { Search, RefreshCw, MessageSquare, MapPin, Calendar, Clock, Smile, Trash2, CheckCircle2, XCircle, ArrowRight, Hourglass, BadgeCheck, Lock, Sparkles, ChevronDown, Send, Check, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { updateInquiryStatus } from '../../services/inquiryService.js';
import {
  INQUIRY_BUCKETS, inquiryBucket, isInBucket, countInquiryBuckets,
  inquiryBucketLabel, inquiryBucketHint, inquiryStageLabel,
} from '../../utils/inquiryStatus.js';

export default function InquiriesTab({
  activeTab, t, language, inquiries, setInquiries, inquiryTab, setInquiryTab,
  hostStats, isPremium, expandedHostInquiryId, setExpandedHostInquiryId,
  inquiryReplies, setInquiryReplies, replyingId, sendInquiryReply, acceptInquiry,
  rejectInquiry, cutInquiry, openConvertInquiry, hostRespondVisit, markInquirySeen,
  inqSeen, setInqSeen, openChatPanel, handleCallUser, openTenantProfile, showToast,
  isInquiryUnread, openModal
}) {
  // Bucket every inquiry through the shared map (utils/inquiryStatus.js) so the
  // tabs, the chip counts, the sidebar summary and the dashboard KPI all read
  // from ONE rulebook. The old inline filter tested `status === 'new'`, a label
  // the backend never writes (its default is 'sent'), so brand-new inquiries
  // matched no tab: the dashboard counted 4 while the tabs could only show 3.
  const displayedInquiries = inquiries.filter(i => isInBucket(i, inquiryTab));

  // Live per-bucket counts for the chips. Because inquiryBucket() is total,
  // pending + accepted + rented + rejected === total === the dashboard's number.
  const bucketCounts = countInquiryBuckets(inquiries);

  // Per-bucket chip colour, kept next to the buckets themselves rather than
  // spread across four near-identical ternaries. Unchanged from before, so the
  // tabs look exactly as the landlord already knows them.
  const CHIP_ACTIVE = {
    pending:  'bg-[#ba0036] text-white',
    accepted: 'bg-green-600 text-white',
    rented:   'bg-blue-600 text-white',
    rejected: 'bg-red-600 text-white',
  };

  return (
<div className="w-full animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-10 items-start">
              
              <div className="xl:col-span-4 w-full flex flex-col gap-5 order-2 xl:order-1">
                
                <div className="bg-gradient-to-br from-[#ba0036] to-[#ff004c] rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 text-white shadow-[0_15px_40px_rgba(186,0,54,0.2)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                  <h3 className="text-base sm:text-2xl font-black mb-0.5 sm:mb-1 relative z-10">{language === 'বাংলা' ? 'আপনার পারফরম্যান্স' : 'Host Performance'}</h3>
                  <p className="text-white/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-3 sm:mb-8 relative z-10">{language === 'বাংলা' ? 'সার্বিক পারফরম্যান্স' : 'Performance Overview'}</p>
                  
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-1 sm:gap-6 relative z-10">
                    <div>
                      <p className="text-white/70 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5 sm:mb-1">{language === 'বাংলা' ? 'রেসপন্স রেট' : 'Response Rate'}</p>
                      <p className="text-base sm:text-3xl font-black">{hostStats.responseRate}%</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5 sm:mb-1">{language === 'বাংলা' ? 'গড় রেসপন্স টাইম' : 'Avg Response Time'}</p>
                      <p className="text-base sm:text-3xl font-black">{hostStats.avgResponseTime >= 60 ? `${Math.floor(hostStats.avgResponseTime / 60)}${language === 'বাংলা' ? 'ঘ ' : 'h '}${hostStats.avgResponseTime % 60}${language === 'বাংলা' ? 'মি' : 'm'}` : `${hostStats.avgResponseTime} ${language === 'বাংলা' ? 'মিনিট' : 'min'}`}</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5 sm:mb-1">{language === 'বাংলা' ? 'কনভার্সন রেট' : 'Conversion Rate'}</p>
                      <p className="text-base sm:text-3xl font-black">{hostStats.conversionRate}%</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shrink-0"><Smile size={22}/></div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900">{language === 'বাংলা' ? 'দারুণ কাজ!' : 'Great Job!'}</h4>
                      <p className="text-[10px] text-gray-500 font-bold mt-0.5">{language === 'বাংলা' ? 'আপনার প্রপার্টি জনপ্রিয় হচ্ছে।' : 'Your properties are trending.'}</p>
                    </div>
                  </div>
                </div>

                {/* Inquiry Summary — sidebar-only detail; hidden on mobile/tablet where 10-15 inquiries make it noise (per request).
                    Every row is a live filter button and every count comes from the
                    shared bucket map, so this panel can no longer disagree with the
                    tabs beside it (it used to count 'sent' as "New" while the Pending
                    tab looked for 'new', hiding the row from both). All four rows sum
                    to the Total line, which equals the dashboard's INQUIRIES card. */}
                <div className="hidden xl:block bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">{language === 'বাংলা' ? 'ইনকোয়ারি সামারি' : 'Inquiry Summary'}</h4>
                  <div className="space-y-1.5">
                    {[
                      { bucket: 'pending',  badge: 'bg-blue-50 text-blue-600' },
                      { bucket: 'accepted', badge: 'bg-green-50 text-green-600' },
                      { bucket: 'rented',   badge: 'bg-indigo-50 text-indigo-600' },
                      { bucket: 'rejected', badge: 'bg-red-50 text-[#ba0036]' },
                    ].map(({ bucket, badge }) => (
                      <button
                        key={bucket}
                        onClick={() => setInquiryTab(bucket)}
                        aria-pressed={inquiryTab === bucket}
                        className={`w-full flex justify-between items-center text-sm font-bold text-left px-2.5 py-2 -mx-2.5 rounded-xl transition-colors ${inquiryTab === bucket ? 'bg-gray-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50/70'}`}
                      >
                        <span>{inquiryBucketLabel(bucket, language)}</span>
                        <span className={`${badge} px-2.5 py-1 rounded-lg text-xs tabular-nums`}>{bucketCounts[bucket]}</span>
                      </button>
                    ))}
                    <div className="flex justify-between items-center text-sm font-black text-gray-900 pt-3 mt-1.5 border-t border-gray-100 px-2.5">
                      <span>{language === 'বাংলা' ? 'মোট' : 'Total'}</span>
                      <span className="bg-gray-100 text-gray-900 px-2.5 py-1 rounded-lg text-xs tabular-nums">{bucketCounts.total}</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="xl:col-span-8 w-full flex flex-col xl:h-[calc(100vh-160px)] order-1 xl:order-2">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
                   <div className="flex flex-col gap-2">
                     <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                       {t?.newInquiries || (language === 'বাংলা' ? 'যোগাযোগ সমূহ' : 'Inquiries')}
                     </h3>
                     {/* Every tab carries its own live count, so the landlord sees the
                         whole pipeline at a glance and an empty tab is never a
                         surprise — they can tell instantly which tab holds the rest. */}
                     <div className="flex flex-wrap gap-2">
                       {INQUIRY_BUCKETS.map((bucket) => {
                         const isActive = inquiryTab === bucket;
                         const count = bucketCounts[bucket];
                         return (
                           <button
                             key={bucket}
                             onClick={() => setInquiryTab(bucket)}
                             aria-pressed={isActive}
                             className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${isActive ? CHIP_ACTIVE[bucket] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                           >
                             {inquiryBucketLabel(bucket, language)}
                             <span className={`min-w-[1.25rem] px-1 py-0.5 rounded-full text-[10px] leading-none font-black tabular-nums ${isActive ? 'bg-white/25 text-white' : count > 0 ? 'bg-white text-gray-700' : 'bg-gray-200/70 text-gray-400'}`}>
                               {count}
                             </span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                   {/* Total reconciles with the dashboard's INQUIRIES card — the four
                       tab counts above always add up to exactly this number. */}
                   <span className="bg-[#ba0036]/10 text-[#ba0036] px-5 py-2.5 rounded-full font-black text-[11px] tracking-wide border border-[#ba0036]/10 shrink-0 tabular-nums">
                     {bucketCounts.total} {language === 'বাংলা' ? 'মোট যোগাযোগ' : bucketCounts.total === 1 ? 'Total Inquiry' : 'Total Inquiries'}
                   </span>
                </div>

                {/* Plain-language explanation of the tab the landlord is looking at. */}
                <p className="text-[11px] md:text-xs font-bold text-gray-500 leading-relaxed -mt-3 mb-5 shrink-0">
                  {inquiryBucketHint(inquiryTab, language)}
                </p>

                <div className="flex-1 xl:overflow-y-auto custom-scrollbar xl:pr-4 pb-10 space-y-6">
                  {displayedInquiries.length === 0 ? (
                     <div className="text-center py-16 md:py-20 bg-white rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none px-6">
                       <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
                         <Search className="text-gray-300" size={32} />
                       </div>
                       <h3 className="text-lg font-black text-gray-900">
                         {language === 'বাংলা'
                           ? `${inquiryBucketLabel(inquiryTab, language)} তালিকায় কিছু নেই।`
                           : `No ${inquiryBucketLabel(inquiryTab, language).toLowerCase()} inquiries.`}
                       </h3>
                       {/* An empty tab used to be a dead end. Now it says exactly where
                           the landlord's other inquiries are and takes them there in
                           one tap — no hunting through four tabs. */}
                       {bucketCounts.total > 0 ? (
                         <>
                           <p className="text-xs font-bold text-gray-500 mt-2">
                             {language === 'বাংলা'
                               ? `আপনার ${bucketCounts.total} টি যোগাযোগ অন্য ট্যাবে আছে:`
                               : `Your ${bucketCounts.total} ${bucketCounts.total === 1 ? 'inquiry is' : 'inquiries are'} in other tabs:`}
                           </p>
                           <div className="flex flex-wrap justify-center gap-2 mt-4">
                             {INQUIRY_BUCKETS.filter((b) => b !== inquiryTab && bucketCounts[b] > 0).map((b) => (
                               <button
                                 key={b}
                                 onClick={() => setInquiryTab(b)}
                                 className="px-3.5 py-2 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-700 text-[11px] font-black transition-all flex items-center gap-1.5 border border-gray-100"
                               >
                                 {inquiryBucketLabel(b, language)}
                                 <span className="bg-white text-gray-700 min-w-[1.25rem] px-1 py-0.5 rounded-full text-[10px] leading-none tabular-nums">{bucketCounts[b]}</span>
                                 <ArrowRight size={12} />
                               </button>
                             ))}
                           </div>
                         </>
                       ) : (
                         <p className="text-xs font-bold text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                           {language === 'বাংলা'
                             ? 'এখনো কোনো যোগাযোগ আসেনি। ভাড়াটিয়া আপনার প্রপার্টিতে অনুরোধ পাঠালে এখানে দেখতে পাবেন।'
                             : "No inquiries yet. When a tenant requests one of your properties, it'll show up here."}
                         </p>
                       )}
                     </div>
                  ) : (
                    displayedInquiries.map((inquiry) => {
                      const isExpanded = expandedHostInquiryId === inquiry.id;
                      // Derive the row's stage from the row itself, not from the active
                      // tab. They agree today (the list is already bucket-filtered), but
                      // reading the row means an optimistic status flip can never leave a
                      // card showing another bucket's actions for a render.
                      const bucket = inquiryBucket(inquiry);
                      // Conversation stays locked until the host Accepts. Pending inquiries
                      // are review-only: the host reads the request + profile, then decides.
                      const conversationLocked = bucket === 'pending';
                      // Highlight until opened — a new inquiry or a fresh tenant reply the host hasn't seen.
                      const unread = isInquiryUnread(inquiry, 'host', inqSeen);
                      const openInquiry = () => {
                        const opening = !isExpanded;
                        setExpandedHostInquiryId(isExpanded ? null : inquiry.id);
                        if (opening) setInqSeen((prev) => markInquirySeen('host', inquiry, prev));
                      };
                      return (
                      <div id={`inquiry-${inquiry.id}`} key={inquiry.id} className={`bg-white rounded-2xl md:rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.06)] transition-all duration-300 border-none overflow-hidden ${unread ? 'ring-2 ring-[#ba0036]/40' : ''}`}>

                        {/* ===== Compact header (always visible) — tap to expand / collapse. Keeps the list short on mobile with 10-15 inquiries. ===== */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={openInquiry}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInquiry(); } }}
                          className={`flex items-center gap-3 p-3.5 md:p-5 cursor-pointer select-none ${unread ? 'bg-[#ba0036]/[0.035]' : ''}`}
                        >
                          <div className="w-11 h-11 md:w-12 md:h-12 bg-red-50 rounded-xl flex items-center justify-center text-[#ba0036] font-black text-sm md:text-lg shadow-sm overflow-hidden shrink-0">
                            {inquiry.userAvatar ? (
                              <img src={inquiry.userAvatar} alt={inquiry.user} className="w-full h-full object-cover" />
                            ) : (
                              inquiry.init
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {inquiry.inquirerUserId ? (
                                <Link
                                  to={`/tenant/${inquiry.inquirerUserId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm md:text-base font-black text-gray-900 hover:text-[#ba0036] transition-colors truncate leading-tight"
                                >
                                  {inquiry.user}
                                </Link>
                              ) : (
                                <h4 className="text-sm md:text-base font-black text-gray-900 truncate leading-tight">{inquiry.user}</h4>
                              )}
                              {/* Accurate per-row stage. This used to be a hardcoded
                                  "New" on every Pending row — it stayed there after
                                  the landlord had opened the inquiry, so it told them
                                  nothing. Now it reflects the real status. */}
                              {(() => {
                                const stage = inquiryStageLabel(inquiry, language);
                                if (!stage) return null;
                                return (
                                  <span className={`shrink-0 ${stage.tone} px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest`}>
                                    {stage.text}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-[10px] md:text-[11px] font-bold text-gray-400 truncate">
                              <span className="text-[#ba0036] font-black">{inquiry.propTitle}</span>
                              <span className="text-gray-300"> · </span>
                              {inquiry.timeAgo}
                            </p>
                          </div>
                          {unread && (
                            <span className="shrink-0 flex h-2.5 w-2.5 relative" aria-label={language === 'বাংলা' ? 'নতুন / দেখা হয়নি' : 'Unread'} title={language === 'বাংলা' ? 'নতুন / দেখা হয়নি' : 'Unread'}>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba0036] opacity-60" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba0036]" />
                            </span>
                          )}
                          <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 text-gray-400">
                            <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* ===== Expandable body — full details, thread, reply & actions ===== */}
                        {isExpanded && (
                        <div className="px-3.5 md:px-5 pb-4 md:pb-5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col xl:flex-row gap-5 xl:gap-8 items-stretch border-t border-gray-100 pt-4">
                          
                      <div className="flex-1 w-full flex flex-col justify-between">
                            <div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <div className="bg-gray-50/80 p-3 md:p-4 rounded-xl border-none">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t?.phoneNumber || (language === 'বাংলা' ? 'ফোন নাম্বার' : 'Phone Number')}</p>
                                  <p className="text-xs md:text-base font-black text-gray-900">{inquiry.phone}</p>
                                </div>
                                <div className="bg-gray-50/80 p-3 md:p-4 rounded-xl border-none">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{t?.propertyInterested || (language === 'বাংলা' ? 'প্রপার্টি' : 'Property')}</p>
                                  <p className="text-xs md:text-base font-black text-[#ba0036] truncate">{inquiry.propTitle}</p> 
                                </div>
                              </div>
                              
                              <div className="bg-gray-50/80 p-3 md:p-4 rounded-xl border-none mb-4 flex flex-col gap-3 max-h-[250px] overflow-y-auto">
                                {(() => {
                                  const msgs = (Array.isArray(inquiry.messages) && inquiry.messages.length > 0)
                                    ? inquiry.messages.map(m => typeof m === 'string' ? { text: m, sender: 'tenant' } : m)
                                    : (inquiry.msg ? [{ text: inquiry.msg, sender: 'tenant' }] : []);
                                  
                                  if (msgs.length === 0) {
                                    return (
                                      <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{language === 'বাংলা' ? 'মেসেজ' : 'Message'}</p>
                                        <p className="text-xs md:text-sm font-bold text-gray-700 whitespace-pre-wrap leading-relaxed">{language === 'বাংলা' ? 'কোনো মেসেজ নেই' : 'No message provided'}</p>
                                      </div>
                                    );
                                  }

                                  return msgs.map((m, idx) => {
                                    const isHost = m.sender === 'host' || m.sender === 'landlord';
                                    const text = m.text || m.message || m.content || '';
                                    if (!text) return null;
                                    
                                    return (
                                      <div key={idx} className={`flex flex-col ${isHost ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-3.5 py-2.5 rounded-2xl text-xs md:text-sm font-bold max-w-[90%] whitespace-pre-wrap leading-relaxed shadow-sm ${isHost ? 'bg-[#ba0036] text-white rounded-tr-sm' : 'bg-white text-gray-700 border border-gray-100 rounded-tl-sm'}`}>
                                          {text}
                                        </div>
                                        <span className="text-[8px] md:text-[9px] font-black text-gray-400 mt-1 uppercase tracking-widest">
                                          {isHost ? (language === 'বাংলা' ? 'আপনি' : 'You') : inquiry.user}
                                        </span>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            {conversationLocked ? (
                              /* ===== Locked (pending): review-only. Accept unlocks the conversation,
                                  replies, calls & visit scheduling. Reject dismisses the inquiry.
                                  The tenant's message above stays readable so the host can decide. ===== */
                              <div className="mt-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/70 p-4 md:p-5 flex flex-col items-center text-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0"><Lock size={20} /></div>
                                <p className="text-[11px] md:text-xs font-bold text-gray-500 max-w-xs leading-relaxed">
                                  {language === 'বাংলা'
                                    ? 'কথোপকথন লক করা আছে। প্রোফাইল দেখে সিদ্ধান্ত নিন — একসেপ্ট করলে মেসেজ, কল ও ভিজিট চালু হবে।'
                                    : 'Conversation is locked. Review the profile, then decide — Accept unlocks messaging, calls & visits.'}
                                </p>
                                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                                  <button
                                    onClick={() => acceptInquiry(inquiry)}
                                    className={`w-full py-3 rounded-2xl font-black text-[12px] md:text-[13px] shadow-[0_8px_20px_rgba(34,197,94,0.25)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 ${isPremium ? 'bg-gradient-to-br from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white' : 'bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'}`}
                                  >
                                    <CheckCircle2 size={16} /> {language === 'বাংলা' ? 'একসেপ্ট' : 'Accept'}
                                  </button>
                                  <button
                                    onClick={() => rejectInquiry(inquiry)}
                                    className="w-full py-3 rounded-2xl font-black text-[12px] md:text-[13px] bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                  >
                                    <XCircle size={16} /> {language === 'বাংলা' ? 'রিজেক্ট' : 'Reject'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Inline Reply — থ্রেডে যোগ হয়, tenant টাইমলাইনে দেখে */}
                                <div className="mt-2 flex items-center gap-2">
                                  <input type="text" value={inquiryReplies[inquiry.id] || ''} onChange={e => setInquiryReplies(prev => ({ ...prev, [inquiry.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') sendInquiryReply(inquiry); }} placeholder={language === 'বাংলা' ? 'রিপ্লাই লিখুন...' : 'Write a reply...'} className="flex-1 p-2.5 md:p-3 bg-gray-50 rounded-xl text-xs md:text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-[#ba0036]/20 transition-all" />
                                  <button onClick={() => sendInquiryReply(inquiry)} disabled={replyingId === inquiry.id || !(inquiryReplies[inquiry.id] || '').trim()} className="shrink-0 w-10 h-10 rounded-xl bg-[#ba0036] hover:bg-[#90002a] disabled:opacity-40 text-white flex items-center justify-center transition-colors"><Send size={14} /></button>
                                </div>

                                {inquiry.visitSchedule?.status === 'pending' && inquiry.visitSchedule?.proposedBy === 'tenant' && (
                                  <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5 flex items-center justify-between gap-2">
                                    <span className="text-[10px] md:text-[11px] font-bold text-amber-800">{language === 'বাংলা' ? 'ভাড়াটিয়া ভিজিট চেয়েছে:' : 'Tenant proposed:'} {inquiry.visitSchedule.date} {inquiry.visitSchedule.time}</span>
                                    <span className="flex gap-1.5 shrink-0">
                                      <button onClick={() => hostRespondVisit(inquiry, 'accept')} className="px-2.5 py-1 md:py-1.5 rounded-lg bg-green-600 text-white text-[10px] md:text-[11px] font-black">{language === 'বাংলা' ? 'গ্রহণ' : 'Accept'}</button>
                                      <button onClick={() => hostRespondVisit(inquiry, 'reject')} className="px-2.5 py-1 md:py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-[10px] md:text-[11px] font-black">{language === 'বাংলা' ? 'বাতিল' : 'Reject'}</button>
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div className="w-full xl:w-[240px] flex flex-col gap-4 justify-between shrink-0 mt-2 xl:mt-0">
                            
                            <div className="space-y-3">

                              {/* Messaging, calling & visit scheduling all unlock only after Accept —
                                  kept hidden while the inquiry is pending (Accept/Reject live in the
                                  centered lock panel on the left). */}
                              {!conversationLocked && (
                              <>
                              <div className="grid grid-cols-2 gap-3">
                                {bucket === 'accepted' ? (
                                  <button
                                    onClick={() => openConvertInquiry(inquiry)}
                                    className="col-span-2 w-full py-3.5 md:py-4 rounded-2xl font-black text-[12px] md:text-[13px] shadow-[0_8px_20px_rgba(34,197,94,0.25)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 bg-gradient-to-br from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white"
                                  >
                                    <Sparkles size={16} /> {language === 'বাংলা' ? 'বুকিং এ রূপান্তর করুন' : 'Convert to Booking'}
                                  </button>
                                ) : bucket === 'rented' ? (
                                  <button
                                    onClick={() => {
                                      setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, status: 'accepted' } : i));
                                      updateInquiryStatus(inquiry.id, 'accepted').catch(err => console.warn('[host] return to accepted failed:', err.message || err));
                                      showToast(language === 'বাংলা' ? 'ইনকোয়ারি একসেপ্টেড এ ফিরে গেছে।' : 'Inquiry returned to Accepted.');
                                      setInquiryTab('accepted');
                                    }}
                                    className="col-span-2 w-full py-3.5 md:py-4 rounded-2xl font-black text-[12px] md:text-[13px] shadow-[0_8px_20px_rgba(59,130,246,0.25)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
                                  >
                                    <RefreshCw size={16} /> {language === 'বাংলা' ? 'রিটার্ন করুন' : 'Return to Accepted'}
                                  </button>
                                ) : (
                                  <div className="col-span-2 text-center text-red-600 font-bold text-xs py-3 border border-red-100 rounded-2xl bg-red-50">
                                    {language === 'বাংলা' ? 'রিজেক্টেড ইনকোয়ারি' : 'Rejected Inquiry'}
                                  </div>
                                )}
                              </div>

                              {inquiry?.visitSchedule?.status === 'accepted' ? (
                                <div className="w-full bg-blue-50/60 border border-blue-200 rounded-2xl p-5 mb-2 mt-2">
                                  <h4 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                                    <BadgeCheck className="text-blue-600" size={20} />
                                    {language === 'বাংলা' ? 'ভিজিট নিশ্চিত হয়েছে' : 'Visit Confirmed'}
                                    <Check className="text-blue-600" size={16} strokeWidth={3} />
                                  </h4>
                                  <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
                                      <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                                        <Clock size={18} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{language === 'বাংলা' ? 'তারিখ ও সময়' : 'Date & Time'}</p>
                                        <p className="text-sm font-bold text-gray-900 break-words">
                                          {inquiry.visitSchedule.date} • {inquiry.visitSchedule.time}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
                                      <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                                        <MapPin size={18} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{language === 'বাংলা' ? 'লোকেশন' : 'Location'}</p>
                                        <p className="text-sm font-bold text-gray-900 break-words">{inquiry.visitSchedule.location || inquiry.propTitle}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => openModal('update_inquiry', inquiry)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-black text-[11px] md:text-[12px] shadow-[0_8px_20px_rgba(37,99,235,0.18)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                                  <Calendar size={14} /> {language === 'বাংলা' ? 'ভিজিট অ্যাড করুন' : 'Add Visit'}
                                </button>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => openChatPanel(inquiry.chatId, { source: 'host-inquiries', peerUserId: inquiry.inquirerUserId, peerName: inquiry.user, tenantName: inquiry.user, tenantPhone: inquiry.phone, propertyTitle: inquiry.propTitle, prefillMessage: '' })} className="w-full bg-[#ba0036] hover:bg-[#90002a] text-white py-3.5 rounded-2xl font-bold text-[11px] shadow-[0_4px_15px_rgba(186,0,54,0.2)] transition-all flex items-center justify-center gap-1.5 border-none active:scale-95">
                                  <MessageSquare size={14} /> {t?.openMessage || (language === 'বাংলা' ? 'মেসেজ' : 'Message')}
                                </button>
                                <button onClick={() => handleCallUser(inquiry.inquirerUserId, inquiry.user)} className="w-full bg-white text-gray-700 py-3.5 rounded-2xl font-bold text-[11px] hover:bg-gray-50 hover:text-[#ba0036] shadow-[0_4px_15px_rgba(0,0,0,0.03)] transition-all flex items-center justify-center gap-1.5 border border-gray-100">
                                  <Phone size={14} /> {t?.callUser || (language === 'বাংলা' ? 'কল' : 'Call')}
                                </button>
                              </div>
                              </>
                              )}

                              <button onClick={() => cutInquiry(inquiry.id)} className="w-full bg-white text-red-500 py-2.5 rounded-2xl font-bold text-[11px] hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-1.5 border border-red-100">
                                <Trash2 size={14} /> {language === 'বাংলা' ? 'পুরোপুরি মুছে ফেলুন' : 'Cut / Delete Completely'}
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => openTenantProfile(inquiry.inquirerUserId, { name: inquiry.user })}
                              className="w-full text-left bg-gray-50/80 p-5 rounded-2xl border-none mt-auto hover:bg-gray-100 transition-colors active:scale-[0.99] group"
                            >
                               <div className="flex items-center justify-between mb-3">
                                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'টেন্যান্ট প্রোফাইল' : 'Tenant Profile'}</p>
                                 <span className="text-[9px] font-black text-[#ba0036] uppercase tracking-widest inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                                   {language === 'বাংলা' ? 'দেখুন' : 'View'} <ArrowRight size={11} />
                                 </span>
                               </div>
                               <div className="flex flex-col gap-3">
                                 <div className="flex items-center gap-2.5 text-xs font-bold text-gray-700">
                                    {inquiry.verified ? <CheckCircle2 size={16} className="text-green-500" /> : <Hourglass size={16} className="text-orange-400" />}
                                    {inquiry.verified ? 'Verified Identity' : 'Pending Verification'}
                                 </div>
                                 <div className="flex items-center gap-2.5 text-xs font-bold text-gray-700">
                                    <Calendar size={16} className="text-gray-400" />
                                    Joined {inquiry.memberSince || 'Recently'}
                                 </div>
                               </div>
                            </button>

                          </div>

                        </div>
                        </div>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>

              </div>
              
            </div>
          </div>
  );
}
