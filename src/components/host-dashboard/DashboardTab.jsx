import React from 'react';
import {
  X, CreditCard, ArrowUpRight, Crown, Building, TrendingUp,
  MessageSquare, LayoutGrid, ChevronUp, ChevronDown, FileText,
  FileEdit, Megaphone, Download, BellRing, AlertCircle,
  Building2, Plus, MapPin, Wallet, MessageCircle, CheckCircle2,
  Hourglass, Calendar, RefreshCw, Settings, Camera, Search, Filter, Trash2, ArrowRight, ChevronRight, Smartphone, Sparkles, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '../Footer';
import { isInquiryUnread } from '../../utils/inquiryUnread';
import { scopeBookings, bookingInBuilding } from '../../utils/buildingScope';

export default function DashboardTab({
  language,
  paymentMethodsLoading,
  hasActivePaymentMethod,
  bookings,
  hidePaymentPromo,
  setHidePaymentPromo,
  setActiveTab,
  pendingRentCount,
  defaultPaymentMethod,
  canClaimShareTrial,
  setTrialModalOpen,
  subStatus,
  navigate,
  isPropertiesLoading,
  properties,
  inquiries,
  inqSeen,
  setPropertyFilter,
  moreActionsOpen,
  setMoreActionsOpen,
  isPremium,
  openBlankLease,
  setActiveModal,
  openModal,
  dashboardPropTitle,
  dashboardProperties,
  propertyLoadError,
  retryLoadProperties,
  isRecent,
  getMonthCollectionSummary,
  today,
  monthFullLabel,
  formatBDT,
  landlordProfile,
  currentBuildingId,
  rentUnitsOf
}) {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-3 md:space-y-4">
      {/* ০. প্রমো কার্ড গ্রিড — পেমেন্ট সেটিংস + ট্রায়াল/আপগ্রেড। মোবাইলে ১ কলাম,
          ট্যাবলেট+ এ ২ কলাম। ইমেজের মতো বড় সাইড-বাই-সাইড কার্ড। */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">

        {/* ০.১ পেমেন্ট সেটিংস */}
        {!paymentMethodsLoading && (
          !hasActivePaymentMethod ? (
            bookings.length > 0 && !hidePaymentPromo && (
              <div
                onClick={() => setActiveTab('payments')}
                className="relative group cursor-pointer bg-gradient-to-br from-emerald-50 to-green-50/60 dark:from-emerald-950/30 dark:to-green-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(16,185,129,0.12)] hover:shadow-[0_12px_35px_rgba(16,185,129,0.20)] hover:-translate-y-0.5 transition-all flex flex-col h-full"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHidePaymentPromo(true);
                  }}
                className="absolute top-2 right-2 md:top-1/2 md:-translate-y-1/2 md:right-4 p-1.5 rounded-full bg-emerald-100/50 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 transition-colors z-10"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
              <div className="flex flex-row md:items-center justify-between gap-3 md:gap-4 h-full pt-2 md:pt-0">
                <div className="flex flex-row items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="relative w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CreditCard size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#ba0036] text-white text-[9px] md:text-[10px] font-black flex items-center justify-center animate-pulse">!</span>
                  </div>
                  <div className="flex flex-col gap-1 md:gap-0.5 flex-1 min-w-0 pr-8 md:pr-4">
                    <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight">
                      {language === 'বাংলা' ? 'পেমেন্ট সেটিংস সম্পূর্ণ করুন' : 'Complete Payment Settings'}
                    </h3>
                    <p className="text-[11px] md:text-xs font-bold text-emerald-700 dark:text-emerald-300/90 leading-relaxed md:truncate">
                      {language === 'বাংলা'
                        ? 'পেমেন্ট অ্যাকাউন্ট যোগ করুন যাতে ভাড়াটিয়া সরাসরি ভাড়া পাঠাতে পারে।'
                        : 'Add your account so tenants can send rent directly to you.'}
                    </p>
                  </div>
                </div>
              </div>
              </div>
            )
          ) : (
            <div
              onClick={() => setActiveTab('payments')}
              className="group cursor-pointer bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_35px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 transition-all flex flex-col h-full"
            >
              <div className="flex flex-row items-center justify-between gap-3 md:gap-4 h-full">
                <div className="flex flex-row items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="relative w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CreditCard size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                    {pendingRentCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 md:min-w-5 md:h-5 px-1 md:px-1.5 rounded-full bg-[#ba0036] text-white text-[9px] md:text-[10px] font-black flex items-center justify-center">{pendingRentCount}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight">
                      {language === 'বাংলা' ? 'পেমেন্ট সেটিংস' : 'Payment Settings'}
                    </h3>
                    <p className="text-[11px] md:text-xs font-bold text-gray-500 dark:text-gray-400 leading-relaxed truncate">
                      {pendingRentCount > 0
                        ? (language === 'বাংলা'
                            ? `${pendingRentCount} টি পেমেন্ট যাচাইয়ের অপেক্ষায়`
                            : `${pendingRentCount} payment${pendingRentCount > 1 ? 's' : ''} awaiting verification`)
                        : (defaultPaymentMethod
                            ? `${({ bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank' })[defaultPaymentMethod.type] || ''} • ${defaultPaymentMethod.accountNumber}`
                            : (language === 'বাংলা' ? 'পেমেন্ট অ্যাকাউন্ট কনফিগার করা আছে' : 'Payment account configured'))}
                    </p>
                  </div>
                </div>

                <div className="md:hidden shrink-0">
                  <div className={`w-fit px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${pendingRentCount > 0 ? 'bg-[#ba0036] text-white shadow-lg shadow-red-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                    {pendingRentCount > 0 ? (language === 'বাংলা' ? 'যাচাই করুন' : 'Verify Now') : (language === 'বাংলা' ? 'ম্যানেজ করুন' : 'Manage')} <ArrowUpRight size={14} />
                  </div>
                </div>
                <div className="hidden md:flex shrink-0">
                  <div className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 group-hover:scale-105 transition-transform ${pendingRentCount > 0 ? 'bg-[#ba0036] text-white shadow-lg shadow-red-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                    {pendingRentCount > 0 ? (language === 'বাংলা' ? 'যাচাই করুন' : 'Verify Now') : (language === 'বাংলা' ? 'ম্যানেজ করুন' : 'Manage')} <ArrowUpRight size={16} />
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* ০.২ ফ্রি প্রো ট্রায়াল / আপগ্রেড / রিনিউ */}
        {canClaimShareTrial ? (
          <div
            onClick={() => setTrialModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTrialModalOpen(true); } }}
            className="group cursor-pointer bg-white dark:bg-gray-900/40 border border-amber-200 dark:border-amber-500/30 rounded-2xl md:rounded-[1.5rem] p-2.5 md:p-5 shadow-[0_4px_25px_rgba(245,158,11,0.08)] hover:shadow-[0_12px_35px_rgba(245,158,11,0.15)] hover:-translate-y-0.5 transition-all flex flex-col w-full h-full"
          >
            <div className="flex flex-col gap-1.5 md:gap-3 h-full justify-center">
              <div className="flex flex-row items-center gap-2 md:gap-4 flex-1 min-w-0">
                <div className="w-8 h-8 md:w-12 md:h-12 shrink-0 rounded-lg md:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(245,158,11,0.7)]">
                  <Crown size={16} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 flex-1">
                  <h3 className="hidden md:block text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight">
                    {language === 'বাংলা' ? '২ মাসের ফ্রি প্রো ট্রায়াল নিন' : 'Get 2 Months of Pro — Free'}
                  </h3>
                  <div className="w-fit px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-md md:rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1 shadow-sm md:shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
                    {language === 'বাংলা' ? 'ফ্রি ট্রায়াল' : 'Free Trial'} <ArrowUpRight size={12} className="md:w-4 md:h-4" />
                  </div>
                </div>
              </div>
              <p className="text-[9px] md:text-xs font-bold text-amber-600 dark:text-amber-500 leading-snug md:leading-relaxed md:pl-[64px]">
                {language === 'বাংলা'
                  ? 'অ্যাপের লিংক শেয়ার করলেই ৫০টি ছবি, ভিডিও ট্যুর আর সার্চে শীর্ষ অবস্থান আনলক।'
                  : 'Unlock 50 photos, video tours, and a top search position just by sharing the app link'}
              </p>
            </div>
          </div>
        ) : (subStatus.planState === 'trial_lapsed' || subStatus.planState === 'paid_expired') ? (() => {
          const isRenewal = subStatus.planState === 'paid_expired';
          const title = isRenewal
            ? (language === 'বাংলা' ? 'আপনার প্ল্যান রিনিউ করুন' : 'Renew Your Plan')
            : (language === 'বাংলা' ? 'প্রো-তে আপগ্রেড করুন' : 'Upgrade to Pro');
          const blurb = isRenewal
            ? (language === 'বাংলা'
                ? 'আপনার প্ল্যানের মেয়াদ শেষ — রিনিউ করে ছবি, ভিডিও ও টপ পজিশন আবার চালু করুন।'
                : 'Your plan expired — renew to restore photos, videos and top position.')
            : (language === 'বাংলা'
                ? 'আপনার ফ্রি ট্রায়াল শেষ — প্রো নিয়ে ৫০টি ছবি, ভিডিও ট্যুর আর টপ পজিশন ফিরে পান।'
                : 'Free trial ended — go Pro for 50 photos, video tours and top position.');
          const cta = isRenewal
            ? (language === 'বাংলা' ? 'রিনিউ করুন' : 'Renew Now')
            : (language === 'বাংলা' ? 'আপগ্রেড করুন' : 'Upgrade Now');
          const go = () => navigate('/subscription?from=dashboard');

          return (
            <div
              onClick={go}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
              className="group cursor-pointer bg-gradient-to-br from-violet-50 to-indigo-50/60 dark:from-violet-950/30 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800/50 rounded-2xl md:rounded-[1.5rem] p-2.5 md:p-5 shadow-[0_4px_25px_rgba(99,102,241,0.12)] hover:shadow-[0_12px_35px_rgba(99,102,241,0.20)] hover:-translate-y-0.5 transition-all flex flex-col h-full w-full"
            >
              <div className="flex flex-col gap-1.5 md:gap-3 h-full justify-center">
                <div className="flex flex-row items-center gap-2 md:gap-4 flex-1 min-w-0">
                  <div className="w-8 h-8 md:w-12 md:h-12 shrink-0 rounded-lg md:rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(99,102,241,0.7)]">
                    <Crown size={16} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 flex-1">
                    <h3 className="hidden md:block text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight">{title}</h3>
                    <div className="w-fit px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-md md:rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-[9px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1 shadow-sm md:shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                      {cta} <ArrowUpRight size={12} className="md:w-4 md:h-4" />
                    </div>
                  </div>
                </div>
                <p className="text-[9px] md:text-xs font-bold text-violet-700 dark:text-violet-300/90 leading-snug md:leading-relaxed md:pl-[64px]">{blurb}</p>
              </div>
            </div>
          );
        })() : null}
      </div>
      {(isPropertiesLoading || properties.length > 0) ? (
        <>

      {/* ১. Stats Bento Grid
          NOTE: the `data-tour` anchors on this block, Quick Actions and the
          Shared Ledger card below are steps 2–4 of the host dashboard tour.
          They were missing here while the live markup (still inline in
          HostDashboard.jsx) carried them, so wiring this component in would
          have silently pruned three steps. Keep them in sync. */}
      <div data-tour="host-stats-grid" className="grid grid-cols-3 gap-3 md:gap-5">
        {[
          {
            icon: Building, bg: 'bg-gradient-to-br from-red-50 to-rose-100/60', iconColor: 'text-[#ba0036]',
            label: language === 'বাংলা' ? 'মোট বাসা' : 'PROPERTIES',
            value: isPropertiesLoading && properties.length === 0 ? '...' : properties.length, shadow: 'shadow-[0_4px_20px_rgba(186,0,54,0.08)]',
            indicator: 'bg-[#ba0036]'
          },
          {
            icon: TrendingUp, bg: 'bg-gradient-to-br from-emerald-50 to-green-100/60', iconColor: 'text-emerald-600',
            label: language === 'বাংলা' ? 'অ্যাক্টিভ' : 'ACTIVE',
            value: isPropertiesLoading && properties.length === 0 ? '...' : properties.filter(p => p.status === 'active').length, shadow: 'shadow-[0_4px_20px_rgba(16,185,129,0.08)]',
            indicator: 'bg-emerald-500'
          },
          {
            icon: MessageSquare, bg: 'bg-gradient-to-br from-violet-50 to-purple-100/60', iconColor: 'text-violet-600',
            label: language === 'বাংলা' ? 'যোগাযোগ' : 'INQUIRIES',
            value: inquiries.length, shadow: 'shadow-[0_4px_20px_rgba(124,58,237,0.08)]',
            indicator: 'bg-violet-500',
            // Turn the box red the moment a new inquiry / reply the host hasn't opened arrives.
            unread: inquiries.some((inq) => isInquiryUnread(inq, 'host', inqSeen)),
          },
        ].map((stat, i) => {
          // KPI boxes are one-tap deep links: Properties → all listings,
          // Active → active-filtered listings, Inquiries → the inquiries tab.
          const onCardClick = i === 0
            ? () => { setPropertyFilter('all'); setActiveTab('properties'); }
            : i === 1
              ? () => { setPropertyFilter('active'); setActiveTab('properties'); }
              : () => setActiveTab('inquiries');
          return (
          <div key={i} onClick={onCardClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(); } }} className={`p-3 md:px-7 md:py-6 rounded-2xl md:rounded-[1.5rem] ${stat.shadow} flex flex-col items-center justify-center md:flex-row md:items-center md:justify-between md:gap-3 group hover:scale-[1.02] hover:shadow-[0_12px_35px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-300 cursor-pointer relative overflow-hidden ${stat.unread ? 'bg-gradient-to-br from-red-50 to-rose-50 border border-[#ba0036]/30 ring-2 ring-[#ba0036]/40' : 'bg-white border border-white/80'}`}>
            {/* New-inquiry pulse dot — makes the red box unmistakable. */}
            {stat.unread && (
              <span className="absolute top-2 right-2 z-10 flex h-2.5 w-2.5" title={language === 'বাংলা' ? 'নতুন যোগাযোগ' : 'New inquiry'}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba0036] opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba0036]" />
              </span>
            )}
            <div className={`absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 rounded-full -translate-y-1/2 translate-x-1/2 ${stat.unread ? 'bg-rose-200' : stat.bg} blur-2xl opacity-60 pointer-events-none`}></div>
            {/* Left cluster — icon + label. On desktop this sits on the left
                of the horizontal card; on mobile it stays centered on top. */}
            <div className="flex flex-col items-center md:items-start shrink-0">
              <div className={`w-8 h-8 md:w-11 md:h-11 rounded-xl flex items-center justify-center mb-2 shrink-0 ${stat.unread ? 'bg-[#ba0036]/10 text-[#ba0036]' : `${stat.bg} ${stat.iconColor}`}`}>
                <stat.icon size={15} className="md:w-5 md:h-5" />
              </div>
              <p className={`text-[7px] md:text-[10px] font-black uppercase tracking-widest text-center md:text-left leading-tight ${stat.unread ? 'text-[#ba0036]' : 'text-gray-400'}`}>{stat.label}</p>
            </div>
            {/* Right cluster — big value + accent bar, right-aligned on desktop. */}
            <div className="flex flex-col items-center md:items-end mt-0.5 md:mt-0">
              <h3 className={`text-2xl md:text-5xl font-black leading-none ${stat.unread ? 'text-[#ba0036]' : 'text-gray-900'}`}>{stat.value}</h3>
              <div className={`w-6 h-1 rounded-full mt-2 md:mt-3 ${stat.unread ? 'bg-[#ba0036] opacity-70' : `${stat.indicator} opacity-40`}`}></div>
            </div>
          </div>
          );
        })}
      </div>



      {/* ১.২ দ্রুত অ্যাকশন — ৪ টাইল, সহজ ও কেন্দ্রস্থ। */}
      <div data-tour="host-quick-actions" className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800/60 rounded-2xl md:rounded-[1.5rem] p-4 md:p-5 shadow-[0_4px_25px_rgba(0,0,0,0.02)] dark:shadow-none">
        <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-4">
          {language === 'বাংলা' ? 'দ্রুত অ্যাকশন' : 'Quick Actions'}
        </h3>
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {[
            { id: 'add_tenant', label: language === 'বাংলা' ? <><span className="md:hidden whitespace-pre-line text-[10px] leading-tight">{'ভাড়াটিয়া যোগ\nকরুন'}</span><span className="hidden md:block">ভাড়াটিয়া যোগ করুন</span></> : 'Add Tenant', Icon: Calendar,      iconColor: 'text-blue-500 dark:text-blue-400',     onClick: () => setActiveTab('bookings') },
            { id: 'rent_collection', label: language === 'বাংলা' ? <><span className="md:hidden whitespace-pre-line text-[10px] leading-tight">{'ভাড়া\nকালেকশন'}</span><span className="hidden md:block">ভাড়া কালেকশন</span></> : 'Rent', Icon: Wallet,        iconColor: 'text-emerald-500 dark:text-emerald-400', onClick: () => setActiveTab('rent') },
            { id: 'messages', label: language === 'বাংলা' ? 'মেসেজ' : 'Messages',     Icon: MessageCircle, iconColor: 'text-violet-500 dark:text-violet-400', onClick: () => navigate('/messages') },
            { id: 'smart_alerts', label: language === 'বাংলা' ? <><span className="md:hidden whitespace-pre-line text-[10px] leading-tight">{'স্মার্ট\nঅ্যালার্ট'}</span><span className="hidden md:block">স্মার্ট অ্যালার্ট</span></> : 'Smart Alerts', Icon: BellRing,      iconColor: 'text-amber-500 dark:text-amber-400',   onClick: () => setActiveTab('smartAlerts') },
          ].map(({ id, label, Icon, iconColor, onClick }) => (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={onClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
              className="group min-w-0 w-full overflow-hidden flex flex-col items-center justify-start gap-2 md:gap-3 px-1 py-3 md:p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-transparent dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              <Icon size={24} strokeWidth={2.2} className={`shrink-0 md:w-[26px] md:h-[26px] ${iconColor} group-hover:scale-110 transition-transform duration-300`} />
              <span className="w-full block text-[11px] md:text-sm font-bold text-gray-700 dark:text-gray-300 text-center leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </div>



      {/* ১.৫ Shared Ledger Overview — bird's-eye snapshot of the new
          Rent Collection tab. Tapping anywhere on the card (or the
          top-right "OPEN LEDGER" pill) jumps the host into the full
          Shared Ledger view. The four mini-cards mirror the KPI row
          on that page so the host learns the same vocabulary. */}
      {(() => {
        const todayDate = today;
        
        // Scoped by buildingId, in one shared place — see utils/buildingScope.js.
        // The name-equality filters that used to live here (one copy per screen)
        // are why hostel and single-room leases vanished after a successful save.
        const baseBookings = scopeBookings(bookings, landlordProfile?.buildings, currentBuildingId);

        const rentUnits = baseBookings.flatMap(rentUnitsOf);
        const sm = getMonthCollectionSummary(rentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
        const collectedPct = sm.expectedTotal > 0 ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100)) : 0;
        
        return (
          <div
            data-tour="host-shared-ledger"
            onClick={() => setActiveTab('rent')}
            className="group relative w-full cursor-pointer bg-white dark:bg-gray-900/40 rounded-[1.5rem] p-5 md:p-7 border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_15px_45px_rgba(0,0,0,0.08)] dark:hover:bg-gray-800/60 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                  <Wallet size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight">
                    {language === 'বাংলা' ? 'ভাড়া লেজার ওভারভিউ' : 'Shared Ledger Overview'}
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                    {monthFullLabel(sm.key, language)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] md:text-[11px] font-black text-[#ba0036] dark:text-rose-400 uppercase tracking-widest group-hover:translate-x-0.5 transition-transform">
                {language === 'বাংলা' ? 'লেজার দেখুন' : 'Open Ledger'}
                <ArrowUpRight size={14} />
              </div>
            </div>

            {landlordProfile?.buildingMode === 'multi' && !currentBuildingId ? (
              <div className="mt-5 space-y-3">
                {(landlordProfile.buildings || []).map(bldg => {
                  const bldgBookings = bookings.filter(b => bookingInBuilding(b, bldg));
                  const bldgRentUnits = bldgBookings.flatMap(rentUnitsOf);
                  const bldgSm = getMonthCollectionSummary(bldgRentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
                  return (
                    <div key={bldg.id} className="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700/50">
                      <h4 className="text-xs font-black text-gray-900 dark:text-white mb-2 flex items-center justify-between">
                        <span>{bldg.name}</span>
                        {bldgSm.overdueCount > 0 && (
                          <span className="text-[8px] font-black bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{bldgSm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'Overdue'}</span>
                        )}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 text-[8px] font-black uppercase tracking-widest mb-0.5">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                          <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{formatBDT(bldgSm.expectedTotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 text-[8px] font-black uppercase tracking-widest mb-0.5">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatBDT(bldgSm.collectedTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3 border-t border-gray-200 dark:border-gray-700/50 pt-2.5 text-[9px] font-black uppercase tracking-widest">
                        <span className="text-emerald-600 dark:text-emerald-400">{bldgSm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার' : 'Cleared'}</span>
                        <span className="text-orange-500 dark:text-orange-400">{bldgSm.totalDueCount - bldgSm.paidCount} {language === 'বাংলা' ? 'বাকি' : 'Due'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Collection rate progress bar */}
                <div className="mt-3 md:mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] md:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      {language === 'বাংলা' ? 'কালেকশন রেট' : 'Collection Rate'}
                    </span>
                    <span className="text-xs md:text-sm font-black text-[#ba0036] dark:text-rose-400 tabular-nums">{collectedPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700" style={{ width: `${collectedPct}%` }} />
                  </div>
                </div>

                {/* 4-KPI strip — same vocabulary as the Rent Collection tab */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-transparent border border-emerald-100/80 dark:border-emerald-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                    <p className="text-lg md:text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1 leading-none">{formatBDT(sm.collectedTotal)}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-emerald-700/70 dark:text-emerald-400/70 mt-1.5 inline-flex items-center gap-1">
                      <CheckCircle2 size={10} strokeWidth={3}/> {sm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'cleared'}
                    </p>
                  </div>
                  <div className="bg-transparent border border-rose-100/80 dark:border-rose-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বকেয়া' : 'Outstanding'}</p>
                    <p className="text-lg md:text-2xl font-black text-rose-700 dark:text-rose-400 tabular-nums mt-1 leading-none">{formatBDT(sm.outstandingTotal)}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-rose-700/70 dark:text-rose-400/70 mt-1.5 inline-flex items-center gap-1">
                      <AlertCircle size={10} strokeWidth={3}/> {sm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'unpaid'}
                    </p>
                  </div>
                  <div className="bg-transparent border border-amber-100/80 dark:border-amber-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{language === 'বাংলা' ? 'আংশিক' : 'Partial'}</p>
                    <p className="text-lg md:text-2xl font-black text-amber-700 dark:text-amber-400 tabular-nums mt-1 leading-none">{sm.partialCount}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-amber-700/70 dark:text-amber-400/70 mt-1.5 inline-flex items-center gap-1">
                      <Hourglass size={10} strokeWidth={3}/> {language === 'বাংলা' ? 'আংশিক পেমেন্ট' : 'partially paid'}
                    </p>
                  </div>
                  <div className="bg-transparent border border-blue-100/80 dark:border-blue-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                    <p className="text-lg md:text-2xl font-black text-blue-700 dark:text-blue-400 tabular-nums mt-1 leading-none">{formatBDT(sm.expectedTotal)}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-blue-700/70 dark:text-blue-400/70 mt-1.5 inline-flex items-center gap-1">
                      <Calendar size={10} strokeWidth={3}/> {sm.totalDueCount} {language === 'বাংলা' ? 'ভাড়াটিয়া' : 'tenants'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

        </>
      ) : (
        <>


      {/* ১.৫ Shared Ledger Overview — bird's-eye snapshot of the new
          Rent Collection tab. Tapping anywhere on the card (or the
          top-right "OPEN LEDGER" pill) jumps the host into the full
          Shared Ledger view. The four mini-cards mirror the KPI row
          on that page so the host learns the same vocabulary. */}
      {(() => {
        const todayDate = today;
        
        // Scoped by buildingId, in one shared place — see utils/buildingScope.js.
        // The name-equality filters that used to live here (one copy per screen)
        // are why hostel and single-room leases vanished after a successful save.
        const baseBookings = scopeBookings(bookings, landlordProfile?.buildings, currentBuildingId);

        const rentUnits = baseBookings.flatMap(rentUnitsOf);
        const sm = getMonthCollectionSummary(rentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
        const collectedPct = sm.expectedTotal > 0 ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100)) : 0;
        
        return (
          <div
            data-tour="host-shared-ledger"
            onClick={() => setActiveTab('rent')}
            className="group relative w-full cursor-pointer bg-white dark:bg-gray-900/40 rounded-[1.5rem] p-5 md:p-7 border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_15px_45px_rgba(0,0,0,0.08)] dark:hover:bg-gray-800/60 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                  <Wallet size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight">
                    {language === 'বাংলা' ? 'ভাড়া লেজার ওভারভিউ' : 'Shared Ledger Overview'}
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                    {monthFullLabel(sm.key, language)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] md:text-[11px] font-black text-[#ba0036] dark:text-rose-400 uppercase tracking-widest group-hover:translate-x-0.5 transition-transform">
                {language === 'বাংলা' ? 'লেজার দেখুন' : 'Open Ledger'}
                <ArrowUpRight size={14} />
              </div>
            </div>

            {landlordProfile?.buildingMode === 'multi' && !currentBuildingId ? (
              <div className="mt-5 space-y-3">
                {(landlordProfile.buildings || []).map(bldg => {
                  const bldgBookings = bookings.filter(b => bookingInBuilding(b, bldg));
                  const bldgRentUnits = bldgBookings.flatMap(rentUnitsOf);
                  const bldgSm = getMonthCollectionSummary(bldgRentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
                  return (
                    <div key={bldg.id} className="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700/50">
                      <h4 className="text-xs font-black text-gray-900 dark:text-white mb-2 flex items-center justify-between">
                        <span>{bldg.name}</span>
                        {bldgSm.overdueCount > 0 && (
                          <span className="text-[8px] font-black bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{bldgSm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'Overdue'}</span>
                        )}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 text-[8px] font-black uppercase tracking-widest mb-0.5">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                          <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{formatBDT(bldgSm.expectedTotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 text-[8px] font-black uppercase tracking-widest mb-0.5">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatBDT(bldgSm.collectedTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3 border-t border-gray-200 dark:border-gray-700/50 pt-2.5 text-[9px] font-black uppercase tracking-widest">
                        <span className="text-emerald-600 dark:text-emerald-400">{bldgSm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার' : 'Cleared'}</span>
                        <span className="text-orange-500 dark:text-orange-400">{bldgSm.totalDueCount - bldgSm.paidCount} {language === 'বাংলা' ? 'বাকি' : 'Due'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Collection rate progress bar */}
                <div className="mt-3 md:mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] md:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      {language === 'বাংলা' ? 'কালেকশন রেট' : 'Collection Rate'}
                    </span>
                    <span className="text-xs md:text-sm font-black text-[#ba0036] dark:text-rose-400 tabular-nums">{collectedPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700" style={{ width: `${collectedPct}%` }} />
                  </div>
                </div>

                {/* 4-KPI strip — same vocabulary as the Rent Collection tab */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-transparent border border-emerald-100/80 dark:border-emerald-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                    <p className="text-lg md:text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1 leading-none">{formatBDT(sm.collectedTotal)}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-emerald-700/70 dark:text-emerald-400/70 mt-1.5 inline-flex items-center gap-1">
                      <CheckCircle2 size={10} strokeWidth={3}/> {sm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'cleared'}
                    </p>
                  </div>
                  <div className="bg-transparent border border-rose-100/80 dark:border-rose-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বকেয়া' : 'Outstanding'}</p>
                    <p className="text-lg md:text-2xl font-black text-rose-700 dark:text-rose-400 tabular-nums mt-1 leading-none">{formatBDT(sm.outstandingTotal)}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-rose-700/70 dark:text-rose-400/70 mt-1.5 inline-flex items-center gap-1">
                      <AlertCircle size={10} strokeWidth={3}/> {sm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'unpaid'}
                    </p>
                  </div>
                  <div className="bg-transparent border border-amber-100/80 dark:border-amber-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{language === 'বাংলা' ? 'আংশিক' : 'Partial'}</p>
                    <p className="text-lg md:text-2xl font-black text-amber-700 dark:text-amber-400 tabular-nums mt-1 leading-none">{sm.partialCount}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-amber-700/70 dark:text-amber-400/70 mt-1.5 inline-flex items-center gap-1">
                      <Hourglass size={10} strokeWidth={3}/> {language === 'বাংলা' ? 'আংশিক পেমেন্ট' : 'partially paid'}
                    </p>
                  </div>
                  <div className="bg-transparent border border-blue-100/80 dark:border-blue-800/50 rounded-2xl p-3 md:p-4">
                    <p className="text-[8px] md:text-[9px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                    <p className="text-lg md:text-2xl font-black text-blue-700 dark:text-blue-400 tabular-nums mt-1 leading-none">{formatBDT(sm.expectedTotal)}</p>
                    <p className="text-[8px] md:text-[9px] font-bold text-blue-700/70 dark:text-blue-400/70 mt-1.5 inline-flex items-center gap-1">
                      <Calendar size={10} strokeWidth={3}/> {sm.totalDueCount} {language === 'বাংলা' ? 'ভাড়াটিয়া' : 'tenants'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}



      {/* ১.২ দ্রুত অ্যাকশন — ৪ টাইল, সহজ ও কেন্দ্রস্থ। */}
      <div data-tour="host-quick-actions" className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800/60 rounded-2xl md:rounded-[1.5rem] p-4 md:p-5 shadow-[0_4px_25px_rgba(0,0,0,0.02)] dark:shadow-none">
        <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-4">
          {language === 'বাংলা' ? 'দ্রুত অ্যাকশন' : 'Quick Actions'}
        </h3>
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {[
            { id: 'add_tenant', label: language === 'বাংলা' ? <><span className="md:hidden whitespace-pre-line text-[10px] leading-tight">{'ভাড়াটিয়া যোগ\nকরুন'}</span><span className="hidden md:block">ভাড়াটিয়া যোগ করুন</span></> : 'Add Tenant', Icon: Calendar,      iconColor: 'text-blue-500 dark:text-blue-400',     onClick: () => setActiveTab('bookings') },
            { id: 'rent_collection', label: language === 'বাংলা' ? <><span className="md:hidden whitespace-pre-line text-[10px] leading-tight">{'ভাড়া\nকালেকশন'}</span><span className="hidden md:block">ভাড়া কালেকশন</span></> : 'Rent', Icon: Wallet,        iconColor: 'text-emerald-500 dark:text-emerald-400', onClick: () => setActiveTab('rent') },
            { id: 'messages', label: language === 'বাংলা' ? 'মেসেজ' : 'Messages',     Icon: MessageCircle, iconColor: 'text-violet-500 dark:text-violet-400', onClick: () => navigate('/messages') },
            { id: 'smart_alerts', label: language === 'বাংলা' ? <><span className="md:hidden whitespace-pre-line text-[10px] leading-tight">{'স্মার্ট\nঅ্যালার্ট'}</span><span className="hidden md:block">স্মার্ট অ্যালার্ট</span></> : 'Smart Alerts', Icon: BellRing,      iconColor: 'text-amber-500 dark:text-amber-400',   onClick: () => setActiveTab('smartAlerts') },
          ].map(({ id, label, Icon, iconColor, onClick }) => (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={onClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
              className="group min-w-0 w-full overflow-hidden flex flex-col items-center justify-start gap-2 md:gap-3 px-1 py-3 md:p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-transparent dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              <Icon size={24} strokeWidth={2.2} className={`shrink-0 md:w-[26px] md:h-[26px] ${iconColor} group-hover:scale-110 transition-transform duration-300`} />
              <span className="w-full block text-[11px] md:text-sm font-bold text-gray-700 dark:text-gray-300 text-center leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </div>

        </>
      )}
      {/* ২. আরও অ্যাকশন — কোলাপসিবল।  {/* ১.৩.২ Rent Card - Dashboard e ar dorkar nai, 
          যা উপরের শর্টকাট সারির সাথে মিলে ডুপ্লিকেট মনে হতো। সব
          অপশন রেখে ডিফল্টে লুকানো, যাতে ড্যাশবোর্ড পরিষ্কার থাকে। */}
      <div data-tour="host-more-actions">
        <button
          id="host-more-actions-btn"
          type="button"
          onClick={() => setMoreActionsOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] active:scale-[0.99] transition-all"
        >
          <span className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center">
              <LayoutGrid size={18} strokeWidth={2.2} />
            </span>
            <span className="text-sm font-black text-gray-800 dark:text-gray-200">
              {language === 'বাংলা' ? 'আরও অ্যাকশন' : 'More Actions'}
            </span>
          </span>
          {moreActionsOpen
            ? <ChevronUp size={18} className="text-gray-400 shrink-0" strokeWidth={2.6} />
            : <ChevronDown size={18} className="text-gray-400 shrink-0" strokeWidth={2.6} />}
        </button>

        {moreActionsOpen && (
          <div id="host-more-actions-dropdown" className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
            {[
              { id: 'documents',       icon: FileText,  label: language === 'বাংলা' ? 'ডকুমেন্ট ও অ্যানালিটিক্স' : 'Docs & Analytics', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-100 dark:border-violet-800/50', onClick: () => setActiveTab('documents') },
              { id: 'create_lease',    icon: FileEdit,  label: language === 'বাংলা' ? 'নতুন চুক্তি' : 'New Contract',      color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-100 dark:border-blue-800/50',     onClick: () => (isPremium ? openBlankLease() : setActiveModal('premium_gate')) },
              { id: 'message_all',     icon: Megaphone, label: language === 'বাংলা' ? 'সবাইকে মেসেজ' : 'Message All',     color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-950/40',   border: 'border-green-100 dark:border-green-800/50',   onClick: () => openModal('message_all') },
              { id: 'export_report',   icon: Download,  label: language === 'বাংলা' ? 'রিপোর্ট' : 'Report',               color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-100 dark:border-orange-800/50', onClick: () => openModal('export_report') },
              { id: 'send_reminders',  icon: BellRing,  label: language === 'বাংলা' ? 'রিমাইন্ডার' : 'Reminder',           color: 'text-[#ba0036] dark:text-rose-400',    bg: 'bg-red-50 dark:bg-rose-950/40',      border: 'border-red-100 dark:border-rose-800/50',      onClick: () => openModal('send_reminders') },
            ].map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                className={`group flex items-center gap-3 bg-white dark:bg-gray-900/50 px-4 py-3.5 rounded-2xl border ${action.border} shadow-sm active:scale-95 transition-all duration-200 hover:shadow-md w-full`}
              >
                <div className={`w-9 h-9 ${action.bg} ${action.color} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                  <action.icon size={17} />
                </div>
                <span className="text-[11px] font-black text-gray-700 dark:text-gray-300 text-left leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ৩. Recent Properties Grid */}
      <div>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight">{dashboardPropTitle}</h3>
          <button onClick={() => setActiveTab('properties')} className="text-[#ba0036] text-[10px] font-black uppercase tracking-widest hover:underline underline-offset-4 transition-all">
            {language === 'বাংলা' ? 'সব দেখুন' : 'View All'}
          </button>
        </div>
        {/* Dashboard overview cards — single-column on phones (matches
            the homepage feed), 2-up from sm:, 3-up from lg:. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {isPropertiesLoading && dashboardProperties.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[1.5rem] p-3 shadow-sm border border-gray-50 animate-pulse">
                <div className="h-44 md:h-60 rounded-2xl bg-gray-100" />
                <div className="py-3 px-1">
                  <div className="h-4 w-2/3 rounded bg-gray-100" />
                  <div className="h-3 w-1/2 rounded bg-gray-100 mt-3" />
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="h-9 rounded-xl bg-gray-100" />
                    <div className="h-9 rounded-xl bg-gray-100" />
                  </div>
                </div>
              </div>
            ))
          ) : propertyLoadError && dashboardProperties.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-[1.5rem] p-6 border border-red-100 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#ba0036] flex items-center justify-center shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm md:text-base font-black text-gray-900">
                    {language === 'বাংলা' ? 'প্রপার্টি লোড করা যায়নি' : 'Could not load your properties'}
                  </h4>
                  <p className="text-xs font-bold text-gray-500 mt-1">
                    {propertyLoadError}
                  </p>
                  <button
                    onClick={retryLoadProperties}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ba0036] text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    <RefreshCw size={13} />
                    {language === 'বাংলা' ? 'আবার চেষ্টা করুন' : 'Retry'}
                  </button>
                </div>
              </div>
            </div>
          ) : dashboardProperties.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#ba0036] flex items-center justify-center shrink-0">
                  <Building2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm md:text-base font-black text-gray-900">
                    {language === 'বাংলা' ? 'এখনও কোনো বাসা নেই' : 'No properties listed yet'}
                  </h4>
                  <p className="text-xs font-bold text-gray-500 mt-1">
                    {language === 'বাংলা' ? 'আপনার প্রথম বাসা লিস্ট করলে এটি এখানে দেখা যাবে।' : 'Your first uploaded property will appear here as soon as it is saved.'}
                  </p>
                  <Link
                    to="/list-property"
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ba0036] text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    <Plus size={13} />
                    {language === 'বাংলা' ? 'বাসা লিস্ট করুন' : 'List Property'}
                  </Link>
                </div>
              </div>
            </div>
          ) : dashboardProperties.map((prop) => (
            <div key={prop.id} className="bg-white rounded-[1.5rem] p-3 shadow-sm border border-gray-50 flex flex-col hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="relative h-44 md:h-60 overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${prop.img})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <div className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-black uppercase text-green-600 shadow-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> {prop.status}
                  </div>
                  {isRecent(prop.addedDate) && (
                    <div className="bg-[#ba0036] px-2.5 py-1 rounded-full text-[9px] font-black uppercase text-white shadow-sm">
                      {language === 'বাংলা' ? 'নতুন' : 'NEW'}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-3 right-3 bg-gray-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg">৳ {prop.price}</div>
              </div>
              <div className="py-3 px-1 flex flex-col flex-1">
                <h4 className="text-sm md:text-base font-black text-gray-900 line-clamp-1">{prop.title}</h4>
                <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 mt-1">
                  <MapPin size={10} className="text-[#ba0036] shrink-0" /> {prop.location}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => openModal('edit', prop)} className="bg-gray-50 hover:bg-gray-100 py-2.5 rounded-xl text-[10px] font-black uppercase text-gray-600 active:scale-95 transition-all">
                    {language === 'বাংলা' ? 'এডিট' : 'Edit'}
                  </button>
                  <button onClick={() => setActiveTab('inquiries')} className="bg-[#ba0036] hover:bg-[#90002a] text-white py-2.5 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all shadow-[0_4px_10px_rgba(186,0,54,0.2)]">
                    {language === 'বাংলা' ? 'ইনকোয়ারি' : 'Inquiries'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      <div className="hidden md:block mt-8">
        <Footer />
      </div>
    </div>
  );
}
