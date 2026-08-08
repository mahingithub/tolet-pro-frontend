import React from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, X, Heart, MessageCircle, DollarSign, Wallet, MessageSquare, Wrench, Bell, ChevronRight, ShieldAlert, RefreshCw, Home, ArrowRight, Shield, ScanFace, BadgeCheck, Calendar, MapPin, Clock, Receipt, Search, Trash2 } from 'lucide-react';
import RentProofCard from '../payments/TenantRentPay'; // Assuming this is correct
// Import other missing components as needed

const OverviewTab = ({
  language, setAddLandlordOpen, addLandlordOpen, inviteCodeInput, setInviteCodeInput,
  handleJoinByInvite, joinBusy, savedProperties, myInquiries, paymentReceipts,
  unreadReceiptsCount, totalDueAmount, tenantAlertCount, primaryLease, activeLeases,
  loggedInUser, authUser, isVerified, verifRejected, rejectionReason, setVerifModalOpen,
  isAlsoLandlord, hideBecomeLandlord, dismissBecomeLandlord, openBecomeLandlordPrompt,
  hideVerificationBanner, dismissVerificationBanner, verifPending, verifPct,
  QuickSearchCard, hideUpcomingTours, dismissUpcomingTours, t, navigate, setActiveTab,
  isInquiryUnread, inqSeen
}) => {
  return (
    <>
            {/* ── CONNECT TO LANDLORD — join a rent/seat by invite code ──── */}
            <div className="mb-5 md:mb-7 rounded-2xl p-4 bg-white border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0"><KeyRound size={18} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900">{language === 'বাংলা' ? 'বাড়িওয়ালার সাথে যুক্ত হোন' : 'Add your landlord'}</p>
                  <p className="text-[11px] font-bold text-gray-500 leading-snug">{language === 'বাংলা' ? 'ইনভাইট কোড দিয়ে আপনার ভাড়া ও রিসিট দেখুন' : 'Enter an invite code to see your rent & receipts'}</p>
                </div>
              </div>
              <button onClick={() => setAddLandlordOpen(true)} className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#ba0036] text-white font-black text-xs uppercase tracking-widest hover:bg-[#a1002f] active:scale-95 transition-all">
                <KeyRound size={14} /> {language === 'বাংলা' ? 'কোড যোগ করুন' : 'Add code'}
              </button>
            </div>

            {addLandlordOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setAddLandlordOpen(false)}>
                <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-black text-gray-900">{language === 'বাংলা' ? 'বাড়িওয়ালার কোড' : 'Landlord invite code'}</h3>
                    <button onClick={() => setAddLandlordOpen(false)} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
                  </div>
                  <p className="text-[12px] font-bold text-gray-500 mb-3">{language === 'বাংলা' ? 'আপনার বাড়িওয়ালার দেওয়া কোডটি লিখুন।' : 'Enter the code your landlord shared with you.'}</p>
                  <input
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                    placeholder="A7X2K9"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-black tracking-widest uppercase outline-none focus:border-[#ba0036] mb-3"
                  />
                  <button
                    onClick={handleJoinByInvite}
                    disabled={joinBusy || !inviteCodeInput.trim()}
                    className="w-full py-2.5 rounded-xl bg-[#ba0036] text-white font-black text-sm uppercase tracking-widest disabled:opacity-40 hover:bg-[#a1002f] transition-colors"
                  >
                    {joinBusy ? (language === 'বাংলা' ? 'যুক্ত হচ্ছে…' : 'Connecting…') : (language === 'বাংলা' ? 'যুক্ত হোন' : 'Connect')}
                  </button>
                </div>
              </div>
            )}

            {/* ── STAT CARDS — Saved · Inquiries · Payments · Due Amount ──
                2-up on phones, 4-up on desktop. Each tile is a tap-target that
                drills into the matching tab. The Due Amount tile carries a
                dark accent so an outstanding balance is impossible to miss. */}
            <div className="mb-4 md:mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {[
                {
                  id: 'saved', icon: Heart, iconBg: 'bg-rose-100', iconColor: 'text-[#ba0036]', bar: 'bg-[#ba0036]',
                  label: language === 'বাংলা' ? 'সেভ করা প্রপার্টি' : 'Saved Properties',
                  sub: language === 'বাংলা' ? 'সেভ করা লিস্টিং দেখুন' : 'View your saved listings',
                  value: savedProperties.length, onClick: () => setActiveTab('saved'),
                },
                {
                  id: 'applications', icon: MessageCircle, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', bar: 'bg-emerald-500',
                  label: language === 'বাংলা' ? 'ইনকোয়ারি' : 'Inquiries',
                  sub: language === 'বাংলা' ? 'যেসব প্রপার্টিতে যোগাযোগ' : 'Properties you inquired',
                  value: myInquiries.length, onClick: () => setActiveTab('applications'),
                  // Turn the box red when the landlord has responded to an inquiry the tenant hasn't opened.
                  unread: (myInquiries || []).some((inq) => isInquiryUnread(inq, 'tenant', inqSeen)),
                },
                {
                  id: 'payments', icon: DollarSign, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', bar: 'bg-violet-500',
                  label: language === 'বাংলা' ? 'পেমেন্ট' : 'Payments',
                  sub: language === 'বাংলা' ? 'মোট পেমেন্ট' : 'Total payments made',
                  value: paymentReceipts.length, badge: unreadReceiptsCount > 0 ? unreadReceiptsCount : null,
                  onClick: () => setActiveTab('payments'),
                },
              ].map((stat) => (
                <button
                  key={stat.id}
                  onClick={stat.onClick}
                  className={`relative text-left backdrop-blur-sm p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex items-center justify-between gap-2 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-all duration-300 overflow-hidden ${stat.unread ? 'bg-gradient-to-br from-red-50 to-rose-50 border border-[#ba0036]/30 ring-2 ring-[#ba0036]/40' : 'bg-white/90 border border-white'}`}
                >
                  {stat.badge ? (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-[#ba0036] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-10">
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse" />{stat.badge}
                    </span>
                  ) : stat.unread ? (
                    <span className="absolute top-2.5 right-2.5 z-10 flex h-2.5 w-2.5" title={language === 'বাংলা' ? 'নতুন আপডেট' : 'New update'}>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba0036] opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba0036]" />
                    </span>
                  ) : null}
                  {/* Left: icon + label */}
                  <div className="min-w-0 flex-1">
                    <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm mb-2.5 md:mb-3 ${stat.unread ? 'bg-[#ba0036]/10 text-[#ba0036]' : `${stat.iconBg} ${stat.iconColor}`}`}>
                      <stat.icon size={17} className="md:w-[20px] md:h-[20px]" strokeWidth={2.4} />
                    </div>
                    <p className={`text-[11px] md:text-sm font-black leading-tight ${stat.unread ? 'text-[#ba0036]' : 'text-gray-800'}`}>{stat.label}</p>
                    <p className="hidden md:block text-[11px] font-bold text-gray-400 leading-tight mt-0.5 truncate">{stat.sub}</p>
                  </div>
                  {/* Right: number + accent bar */}
                  <div className="shrink-0 flex flex-col items-end">
                    <h3 className={`text-2xl md:text-[2.25rem] font-black leading-none tabular-nums tracking-tight ${stat.unread ? 'text-[#ba0036]' : 'text-gray-900'}`}>{stat.value}</h3>
                    <div className={`h-1 rounded-full w-7 md:w-9 mt-2 ${stat.unread ? 'bg-[#ba0036]' : stat.bar}`} />
                  </div>
                </button>
              ))}

              {/* Due Amount — dark accent tile (mockup's 4th card). Amount is
                  live from the tenant's active-lease ledger; turns emerald and
                  reads "All clear" when nothing is owed. */}
              <button
                onClick={() => setActiveTab('payments')}
                className="relative text-left p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] flex items-center justify-between gap-2 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-[#3a0011]"
              >
                <div className="absolute -bottom-10 -right-8 w-32 h-32 rounded-full blur-3xl pointer-events-none bg-amber-500/10" />
                {/* Left: icon + label */}
                <div className="relative min-w-0 flex-1">
                  <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm mb-2.5 md:mb-3 ${totalDueAmount > 0 ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'}`}>
                    <Wallet size={17} className="md:w-[20px] md:h-[20px]" strokeWidth={2.4} />
                  </div>
                  <p className="text-[11px] md:text-sm font-black text-white leading-tight">{language === 'বাংলা' ? 'বকেয়া' : 'Due Amount'}</p>
                  <p className="hidden md:block text-[11px] font-bold text-white/50 leading-tight mt-0.5 truncate">{language === 'বাংলা' ? 'মোট বকেয়া পরিমাণ' : 'Total amount due'}</p>
                </div>
                {/* Right: amount + accent bar */}
                <div className="relative shrink-0 flex flex-col items-end">
                  <h3 className={`text-lg md:text-[1.6rem] font-black leading-none tabular-nums tracking-tight ${totalDueAmount > 0 ? 'text-white' : 'text-emerald-300'}`}>
                    {totalDueAmount > 0
                      ? `৳${totalDueAmount.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-IN')}`
                      : (language === 'বাংলা' ? 'ক্লিয়ার' : 'All clear')}
                  </h3>
                  <div className={`h-1 rounded-full w-7 md:w-9 mt-2 ${totalDueAmount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                </div>
              </button>
            </div>

            {/* ── NAV CARDS — Messages · Services · Smart Alerts ──────────
                Wider horizontal cards (icon + title + subtitle + chevron).
                Stack to full-width rows on phones for big tap targets. */}
            <div className="mb-4 md:mb-6 grid grid-cols-3 gap-2.5 md:gap-4">
              {[
                {
                  label: language === 'বাংলা' ? 'মেসেজ' : 'Messages',
                  sub: language === 'বাংলা' ? 'আপনার চ্যাট দেখুন' : 'View your chats',
                  Icon: MessageSquare, iconBg: 'bg-blue-50 border-blue-100', iconColor: 'text-blue-600',
                  onClick: () => navigate('/messages'),
                },
                {
                  label: language === 'বাংলা' ? 'সার্ভিস' : 'Services',
                  sub: language === 'বাংলা' ? 'সার্ভিস রিকোয়েস্ট করুন' : 'Raise or track a service',
                  Icon: Wrench, iconBg: 'bg-gray-100 border-gray-200', iconColor: 'text-gray-600',
                  onClick: () => navigate('/services'),
                },
                {
                  label: language === 'বাংলা' ? 'স্মার্ট অ্যালার্ট' : 'Smart Alerts',
                  sub: language === 'বাংলা' ? 'নোটিফিকেশন ম্যানেজ করুন' : 'Manage notifications',
                  Icon: Bell, iconBg: 'bg-amber-50 border-amber-100', iconColor: 'text-amber-600',
                  badge: tenantAlertCount > 0 ? tenantAlertCount : null,
                  onClick: () => setActiveTab('alerts'),
                },
              ].map(({ label, sub, Icon, iconBg, iconColor, badge, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="group flex flex-col items-center text-center gap-2 p-3 md:flex-row md:text-left md:items-center md:gap-3 md:p-4 rounded-2xl bg-white border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
                >
                  <span className={`relative w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${iconBg} ${iconColor} group-hover:scale-105 transition-transform`}>
                    <Icon size={19} strokeWidth={2.4} />
                    {badge ? (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#ba0036] text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm border border-white">{badge}</span>
                    ) : null}
                  </span>
                  <span className="min-w-0 w-full md:flex-1">
                    <span className="block text-[11px] md:text-sm font-black text-gray-900 leading-tight md:truncate">{label}</span>
                    <span className="hidden md:block text-[11px] font-bold text-gray-400 leading-tight mt-0.5 truncate">{sub}</span>
                  </span>
                  <ChevronRight size={16} className="hidden md:block text-gray-300 group-hover:text-[#ba0036] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>

            {/* ── PAYMENT PROOF — live rent tracker for the active lease ──
                Renders only when the tenant has a booking. Year navigator +
                12-month status strip + this-month summary + one-tap "Pay".
                Multiple leases: primary shows here, the rest live in Payments. */}
            {primaryLease && (
              <div className="mb-4 md:mb-6">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-7 h-7 rounded-lg bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center"><Receipt size={14} /></div>
                  <h3 className="text-[13px] font-black text-gray-800 uppercase tracking-[0.14em]">{language === 'বাংলা' ? 'পেমেন্ট প্রুফ' : 'Payment Proof'}</h3>
                  {activeLeases.length > 1 && (
                    <button onClick={() => setActiveTab('payments')} className="ml-auto text-[10px] font-black text-[#ba0036] hover:underline">
                      +{activeLeases.length - 1} {language === 'বাংলা' ? 'আরও লিজ' : 'more'} →
                    </button>
                  )}
                </div>
                <RentProofCard
                  booking={primaryLease}
                  receipts={paymentReceipts}
                  language={language}
                  tenantName={loggedInUser}
                  avatar={authUser?.avatar}
                  isVerified={isVerified}
                  onPay={() => setActiveTab('payments')}
                />
              </div>
            )}

            {/* ── VERIFICATION REJECTED BANNER ────────────────────────────
                Surfaces the admin's rejection reason so the user understands
                what to fix, with a one-tap "resubmit" CTA that re-opens the
                same modal. Without this banner a rejected user would see a
                blank dashboard and assume nothing happened. Backend field:
                tenantProfile.verification.rejectionReason — set by
                admin.controller.js → rejectUser(). */}
            {verifRejected && (
              <div className="mb-5 md:mb-7 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 bg-white border-2 border-[#ba0036]/15 shadow-[0_8px_30px_-10px_rgba(186,0,54,0.15)] relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-5">
                  <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center">
                    <ShieldAlert size={22} strokeWidth={2.4} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ba0036] mb-1">
                      {language === 'বাংলা' ? 'ভেরিফিকেশন বাতিল' : 'Verification rejected'}
                    </p>
                    <h3 className="text-lg md:text-xl font-black text-gray-900 leading-tight">
                      {language === 'বাংলা'
                        ? 'আপনার ডকুমেন্ট গ্রহণ করা হয়নি'
                        : 'Your submission wasn’t accepted'}
                    </h3>
                    {rejectionReason ? (
                      <div className="mt-3 p-3 rounded-xl bg-[#ba0036]/5 border border-[#ba0036]/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#ba0036] mb-1">
                          {language === 'বাংলা' ? 'অ্যাডমিনের মন্তব্য' : 'Admin note'}
                        </p>
                        <p className="text-sm font-bold text-gray-800 leading-snug">
                          {rejectionReason}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm font-bold text-gray-600 leading-snug">
                        {language === 'বাংলা'
                          ? 'অনুগ্রহ করে আপনার তথ্য পুনরায় চেক করে আবার জমা দিন।'
                          : 'Please review your information and submit again.'}
                      </p>
                    )}
                    <button
                      onClick={() => setVerifModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ba0036] to-[#d11147] text-white font-black text-sm shadow-[0_8px_20px_rgba(186,0,54,0.25)] hover:shadow-[0_12px_30px_rgba(186,0,54,0.35)] hover:-translate-y-0.5 transition-all"
                    >
                      <RefreshCw size={14} />
                      {language === 'বাংলা' ? 'আবার চেষ্টা করুন' : 'Try again'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── BECOME A LANDLORD BANNER (roadmap-v2 §4 / tenant §T4) ──
                Only renders when the user does NOT yet have the landlord
                role on their account. One click adds the role on the
                server and flips them into host mode. Verified tenants get
                a subtle "your trust score carries over" line so they know
                they don't lose progress when switching modes. */}
            {!isAlsoLandlord && !hideBecomeLandlord && !authUser?.landlordProfile?.verification?.status && (
              <div className="mb-5 md:mb-7 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 bg-gradient-to-br from-[#ba0036] via-[#7c0026] to-[#3a0011] text-white shadow-[0_20px_50px_-20px_rgba(186,0,54,0.5)] relative overflow-hidden">
                <button
                  onClick={dismissBecomeLandlord}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors z-20"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
                <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/15">
                    <Home size={22} strokeWidth={2.4} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-200 mb-1">
                      {language === 'বাংলা' ? 'নতুন!' : 'New'}
                    </p>
                    <h3 className="text-lg md:text-xl font-black leading-tight">
                      {language === 'বাংলা' ? 'বাড়িওয়ালা হয়ে আপনার সম্পত্তি লিস্ট করুন' : 'Become a landlord — list your property'}
                    </h3>
                    <p className="mt-1 text-[12px] md:text-sm font-bold text-white/75 leading-snug max-w-prose">
                      {isVerified
                        ? (language === 'বাংলা'
                            ? 'আপনার ভেরিফাইড ট্রাস্ট স্কোর হোস্ট প্রোফাইলে চলে যাবে।'
                            : 'Your verified trust score carries over to your host profile.')
                        : (language === 'বাংলা'
                            ? 'এক ক্লিকেই হোস্ট মোডে যান — কোনো নতুন একাউন্ট লাগবে না।'
                            : 'One click to switch into host mode — no separate account required.')}
                    </p>
                  </div>
                  <button
                    onClick={openBecomeLandlordPrompt}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#ba0036] font-black text-sm shadow-[0_10px_25px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95 transition-transform"
                  >
                    {language === 'বাংলা' ? 'হোস্ট হন' : 'Become a Host'} <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ── VERIFICATION BANNER — futuristic rebuild ───────────────
                Dark glassy card with a holographic red→indigo accent
                gradient, a "breathing" shield icon ringed by two animated
                pulse rings, a shimmering progress bar, and a CTA that
                stacks UNDER the copy on mobile so the headline never
                gets squashed into a 3-line column. The same component
                covers three states:
                  - not started / in progress (default)
                  - submitted for review (`verifPending`)
                  - verified (`isVerified`) — flips to a green success row */}
            {hideVerificationBanner ? null : !isVerified ? (
              <div className="mb-5 md:mb-7 relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] p-[1px] bg-gradient-to-br from-[#ba0036]/40 via-rose-400/20 to-indigo-500/30 shadow-[0_20px_60px_-20px_rgba(186,0,54,0.35)]">
                <button
                  onClick={dismissVerificationBanner}
                  className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors z-30"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
                {/* Inline keyframes for shimmer + breathing pulse rings. */}
                <style>{`
                  @keyframes tolet-shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                  }
                  @keyframes tolet-breath {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50%      { transform: scale(1.08); opacity: 0.9; }
                  }
                  @keyframes tolet-grid-drift {
                    0%   { background-position: 0 0; }
                    100% { background-position: 32px 32px; }
                  }
                `}</style>

                <div className="relative rounded-[calc(1.5rem-1px)] md:rounded-[calc(2rem-1px)] bg-gradient-to-br from-[#1a0a14] via-[#2a0a18] to-[#15042b] p-5 md:p-7 overflow-hidden">
                  {/* Holographic background layer: faint dot-grid that
                      slowly drifts diagonally + a couple of soft glow
                      orbs. Pure decoration; pointer-events disabled. */}
                  <div
                    className="absolute inset-0 opacity-[0.08] pointer-events-none"
                    style={{
                      backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)',
                      backgroundSize: '16px 16px',
                      animation: 'tolet-grid-drift 18s linear infinite',
                    }}
                  />
                  <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#ba0036]/40 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-32 -right-24 w-72 h-72 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
                    {/* LEFT: animated shield with two breathing pulse rings */}
                    <div className="relative shrink-0 self-start md:self-center">
                      <span
                        className="absolute inset-0 -m-2 rounded-[1.4rem] bg-[#ba0036]/40 blur-md"
                        style={{ animation: 'tolet-breath 2.6s ease-in-out infinite' }}
                      />
                      <span
                        className="absolute inset-0 -m-4 rounded-[1.6rem] border border-[#ba0036]/40"
                        style={{ animation: 'tolet-breath 2.6s ease-in-out infinite 0.6s' }}
                      />
                      <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-[#ff4d6d] via-[#ba0036] to-[#65001e] text-white flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(255,77,109,0.6)] border border-white/10">
                        <Shield size={26} strokeWidth={2.3} />
                      </div>
                    </div>

                    {/* CENTER: pre-label + headline + subcopy */}
                    <div className="flex-1 min-w-0 text-white">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-black tracking-[0.18em] uppercase text-rose-200 backdrop-blur-sm">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-300" />
                          </span>
                          {language === 'বাংলা' ? 'আইডেন্টিটি ভেরিফিকেশন' : 'Identity Verification'}
                        </span>
                        <span className="hidden sm:inline-flex text-[9px] font-black tracking-widest uppercase text-white/40">
                          {language === 'বাংলা' ? 'এআই' : 'AI'}-secured
                        </span>
                      </div>
                      <h3 className="text-lg md:text-2xl font-black tracking-tight leading-tight">
                        {verifPending
                          ? (language === 'বাংলা' ? 'রিভিউয়ের জন্য সাবমিট হয়েছে' : 'Submitted for review')
                          : (language === 'বাংলা' ? 'আপনার অ্যাকাউন্ট ভেরিফাই করুন' : 'Verify your account')}
                      </h3>
                      <p className="mt-1.5 text-[12px] md:text-sm font-bold text-white/65 leading-snug max-w-prose">
                        {verifPending
                          ? (language === 'বাংলা' ? 'আমরা আপনার ডকুমেন্ট যাচাই করছি। সাধারণত ২৪ ঘণ্টার মধ্যে শেষ হয়।' : 'We\u2019re reviewing your documents. Usually done within 24 hours.')
                          : (language === 'বাংলা' ? 'ভেরিফাইড ভাড়াটিয়ারা বাড়িওয়ালার কাছ থেকে দ্রুত অ্যাপ্রুভাল পান।' : 'Verified tenants get faster landlord approvals.')}
                      </p>
                    </div>
                  </div>

                  {/* PROGRESS + CTA — full-width on mobile, side-by-side
                      on md+. The progress bar carries a moving "shimmer"
                      sweep so it feels alive even when stuck at 0%. */}
                  <div className="relative z-10 mt-5 md:mt-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden relative">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#ff4d6d] via-[#ba0036] to-[#ff4d6d] transition-[width] duration-700 shadow-[0_0_12px_rgba(255,77,109,0.6)]"
                          style={{ width: `${Math.max(verifPct, 4)}%` }}
                        />
                        {/* Shimmer sweep */}
                        <div
                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                          style={{ animation: 'tolet-shimmer 2.4s linear infinite' }}
                        />
                      </div>
                      <span className="text-xs font-black text-white tabular-nums shrink-0">{verifPct}%</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="group w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#ff4d6d] via-[#ba0036] to-[#90002a] text-white font-black text-xs md:text-sm shadow-[0_12px_30px_-8px_rgba(255,77,109,0.55)] hover:shadow-[0_18px_40px_-8px_rgba(255,77,109,0.7)] hover:-translate-y-0.5 active:translate-y-0 transition-all whitespace-nowrap relative overflow-hidden"
                    >
                      <span
                        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{ animation: 'tolet-shimmer 2.8s linear infinite' }}
                      />
                      <ScanFace size={15} strokeWidth={2.5} className="relative z-10" />
                      <span className="relative z-10">
                        {verifPending
                          ? (language === 'বাংলা' ? 'ডকুমেন্ট দেখুন' : 'Review documents')
                          : (language === 'বাংলা' ? 'ভেরিফাই করুন' : 'Get verified')}
                      </span>
                      <ArrowRight size={14} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-5 md:mb-7 rounded-[1.5rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 p-4 md:p-5 flex items-center gap-3 shadow-[0_10px_30px_-15px_rgba(16,185,129,0.4)] relative">
                <button
                  onClick={dismissVerificationBanner}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-600 hover:text-emerald-800 transition-colors z-20"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
                <div className="relative shrink-0">
                  <span className="absolute inset-0 rounded-2xl bg-emerald-400/40 blur-md animate-pulse" />
                  <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow">
                    <BadgeCheck size={22} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-emerald-700">{language === 'বাংলা' ? 'আপনি ভেরিফাইড' : "You're verified"}</p>
                  <p className="text-[11px] font-bold text-emerald-700/80">{language === 'বাংলা' ? 'বাড়িওয়ালারা আপনার প্রোফাইল সবুজ ব্যাজ-সহ দেখেন।' : 'Landlords see your profile with a green verified badge.'}</p>
                </div>
              </div>
            )}

            {/* Stat cards + nav cards + Payment Proof now render at the top of
                the overview (right after the "Add landlord" banner). */}

            {/* ── QUICK SEARCH — free-text + area + budget, popular-area
                chips, and the geolocation "homes near you" hint. Deep-links
                into /properties using the same URL contract as the home
                hero, so results behave identically from either surface. */}
            <QuickSearchCard language={language} />

            {/* ── UPCOMING TOURS ─────────────────────────────────────── */}
            {(!hideUpcomingTours && myInquiries.some(inq => inq.visitSchedule?.date && inq.status !== 'rejected')) && (
            <div className="relative bg-white/95 backdrop-blur-sm p-5 md:p-7 rounded-[1.5rem] md:rounded-[2rem] border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
              <button
                onClick={dismissUpcomingTours}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors z-20"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
              <div className="relative z-10 flex items-center justify-between mb-5 md:mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ba0036] to-rose-500 text-white flex items-center justify-center shadow-md">
                    <Calendar size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#ba0036] uppercase tracking-[0.16em]">
                      {language === 'বাংলা' ? 'ভিজিট সিডিউল' : 'TOUR SCHEDULE'}
                    </p>
                    <h3 className="text-base md:text-lg font-black text-gray-900 leading-tight">
                      {t.upcomingTours || (language === 'বাংলা' ? 'আসন্ন ট্যুর' : 'Upcoming Tours')}
                    </h3>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {language === 'বাংলা' ? 'নির্ধারিত' : 'Scheduled'}
                </span>
              </div>

              <div className="relative z-10 flex flex-col gap-3">
                {myInquiries
                  .filter(inq => inq.visitSchedule?.date && inq.status !== 'rejected')
                  .sort((a, b) => new Date(a.visitSchedule.date) - new Date(b.visitSchedule.date))
                  .map((inq) => {
                    const d = new Date(inq.visitSchedule.date);
                    const isInvalid = isNaN(d.getTime());
                    const month = isInvalid ? 'TBD' : d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                    const dateNum = isInvalid ? '--' : d.getDate();
                    const day = isInvalid ? 'TBD' : d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
                    return (
                      <div key={inq.id || inq._id} className="flex flex-col gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3 md:gap-4 p-4 md:p-5 bg-white border border-gray-100 rounded-2xl">
                          <div className="bg-gradient-to-br from-[#ba0036] via-rose-500 to-orange-500 text-center p-3 rounded-2xl shadow-[0_6px_16px_rgba(186,0,54,0.22)] min-w-[60px] md:min-w-[72px]">
                            <p className="text-[9px] font-black text-white/90 uppercase tracking-[0.16em]">{month}</p>
                            <p className="text-2xl md:text-3xl font-black text-white leading-none mt-0.5 tabular-nums">{dateNum}</p>
                            <p className="text-[8px] font-black text-white/80 uppercase tracking-widest mt-0.5">{day}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm md:text-base font-black text-gray-900 truncate">{inq.propTitle || 'Property Tour'}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold text-gray-500">
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin size={11} className="text-gray-400" /> {inq.visitSchedule.location || 'See message for details'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                <Clock size={10} /> {inq.visitSchedule.time || 'TBD'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/messages', { state: { peerUserId: inq.propertyOwnerId } })}
                          className="w-full inline-flex items-center justify-center gap-2 py-3 bg-white text-[#ba0036] border border-[#ba0036]/20 rounded-2xl font-black text-xs hover:bg-[#ba0036] hover:text-white hover:border-[#ba0036] transition-all"
                        >
                          <MessageSquare size={14} /> {t.contactHost || (language === 'বাংলা' ? 'যোগাযোগ' : 'Contact')}
                        </button>
                      </div>
                    );
                })}
              </div>
            </div>
            )}
          </>
);
};

export default OverviewTab;
