import React, { useState } from 'react';
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
  const [buildingSearch, setBuildingSearch] = useState('');

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
                    <h3 className="text-[12px] md:text-[13px] font-black text-gray-900 dark:text-white leading-tight">
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
                    <h3 className="text-[12px] md:text-[13px] font-black text-gray-900 dark:text-white leading-tight">
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
      {/* ─── SHARED LEDGER OVERVIEW & TWO-COLUMN DASHBOARD (MOCKUP TARGET) ─── */}
      {(() => {
        const todayDate = today;
        const baseBookings = scopeBookings(bookings, landlordProfile?.buildings, currentBuildingId);
        const rentUnits = baseBookings.flatMap(rentUnitsOf);
        const sm = getMonthCollectionSummary(rentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
        const collectedPct = sm.expectedTotal > 0 ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100)) : 0;
        const allBuildings = landlordProfile?.buildings || [];
        const displayedBuildings = allBuildings.filter(b =>
          !buildingSearch.trim() || (b.name || '').toLowerCase().includes(buildingSearch.toLowerCase().trim())
        );

        return (
          <div className="space-y-5">
            {/* ১. Shared Ledger Overview (Full width card) */}
            <div
              data-tour="host-shared-ledger"
              onClick={() => setActiveTab('rent')}
              className="group relative w-full cursor-pointer bg-white dark:bg-gray-900/40 rounded-2xl md:rounded-[1.5rem] p-5 md:p-6 border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_15px_45px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white leading-tight">
                    {language === 'বাংলা' ? 'ভাড়া লেজার ওভারভিউ' : 'Shared Ledger Overview'}
                  </h3>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5">
                    {monthFullLabel(sm.key, language)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#ba0036] dark:text-rose-400 group-hover:translate-x-0.5 transition-transform">
                  <span>{language === 'বাংলা' ? 'লেজার দেখুন' : 'Open ledger'}</span>
                  <ArrowUpRight size={15} />
                </div>
              </div>

              {/* 4-KPI Row with Dividers */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 my-5 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800">
                {/* KPI 1: Collected */}
                <div className="flex items-center gap-3.5 pr-2 lg:px-4 py-2 lg:py-0">
                  <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Wallet size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 leading-none">
                      {language === 'বাংলা' ? 'আদায়' : 'Collected'}
                    </p>
                    <p className="text-xl lg:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1 leading-tight truncate">
                      {formatBDT(sm.collectedTotal)}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 leading-none">
                      {sm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'cleared'}
                    </p>
                  </div>
                </div>

                {/* KPI 2: Outstanding */}
                <div className="flex items-center gap-3.5 pr-2 lg:px-6 py-2 lg:py-0">
                  <div className="w-11 h-11 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 leading-none">
                      {language === 'বাংলা' ? 'বকেয়া' : 'Outstanding'}
                    </p>
                    <p className="text-xl lg:text-2xl font-black text-[#ba0036] dark:text-rose-400 tabular-nums mt-1 leading-tight truncate">
                      {formatBDT(sm.outstandingTotal)}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 leading-none">
                      {sm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'due'}
                    </p>
                  </div>
                </div>

                {/* KPI 3: Partial */}
                <div className="flex items-center gap-3.5 pr-2 lg:px-6 py-2 lg:py-0">
                  <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Hourglass size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 leading-none">
                      {language === 'বাংলা' ? 'আংশিক' : 'Partial'}
                    </p>
                    <p className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white tabular-nums mt-1 leading-tight truncate">
                      {sm.partialCount}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 leading-none">
                      {language === 'বাংলা' ? 'আংশিক পরিশোধ' : 'Partially paid'}
                    </p>
                  </div>
                </div>

                {/* KPI 4: Expected */}
                <div className="flex items-center gap-3.5 pr-2 lg:px-6 py-2 lg:py-0">
                  <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 leading-none">
                      {language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}
                    </p>
                    <p className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white tabular-nums mt-1 leading-tight truncate">
                      {formatBDT(sm.expectedTotal)}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 leading-none">
                      {sm.totalDueCount} {language === 'বাংলা' ? 'ভাড়াটিয়া' : 'tenants'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Collection Rate Bar */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {language === 'বাংলা' ? 'কালেকশন রেট' : 'Collection rate'}
                  </span>
                  <span className="text-sm font-black text-[#ba0036] dark:text-rose-400 tabular-nums">
                    {collectedPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700"
                    style={{ width: `${collectedPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ২. Two-Column Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* বাম কলাম: Collection by Building (বিল্ডিং অনুযায়ী কালেকশন টেবিল) */}
              <div className="lg:col-span-8 bg-white dark:bg-gray-900/40 rounded-2xl md:rounded-[1.5rem] p-5 border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none">
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white">
                      {language === 'বাংলা' ? 'বিল্ডিং অনুযায়ী কালেকশন' : 'Collection by Building'}
                    </h3>
                    <span className="text-xs font-medium text-gray-400">
                      {allBuildings.length} {language === 'বাংলা' ? 'বিল্ডিং' : 'buildings'}
                    </span>
                  </div>
                  <div className="relative w-full sm:w-60">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={language === 'বাংলা' ? 'বিল্ডিং সার্চ করুন' : 'Search buildings'}
                      value={buildingSearch}
                      onChange={(e) => setBuildingSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#ba0036] focus:border-[#ba0036] transition-all"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-400 dark:text-gray-500">
                        <th className="py-2.5 pr-3 font-bold">{language === 'বাংলা' ? 'বিল্ডিং' : 'Building'}</th>
                        <th className="py-2.5 px-3 font-bold text-right">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</th>
                        <th className="py-2.5 px-3 font-bold text-right">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</th>
                        <th className="py-2.5 px-3 font-bold text-right">{language === 'বাংলা' ? 'বকেয়া' : 'Outstanding'}</th>
                        <th className="py-2.5 px-3 font-bold text-center">{language === 'বাংলা' ? 'ক্লিয়ার / বাকি' : 'Cleared / Due'}</th>
                        <th className="py-2.5 pl-3 font-bold">{language === 'বাংলা' ? 'কালেকশন' : 'Collection'}</th>
                        <th className="py-2.5 pl-2 w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50 text-xs">
                      {displayedBuildings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs font-semibold text-gray-400">
                            {language === 'বাংলা' ? 'কোনো বিল্ডিং পাওয়া যায়নি' : 'No buildings found'}
                          </td>
                        </tr>
                      ) : (
                        displayedBuildings.map((bldg) => {
                          const bldgBookings = bookings.filter(b => bookingInBuilding(b, bldg));
                          const bldgRentUnits = bldgBookings.flatMap(rentUnitsOf);
                          const bldgSm = getMonthCollectionSummary(bldgRentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
                          const bldgPct = bldgSm.expectedTotal > 0 ? Math.min(100, Math.round((bldgSm.collectedTotal / bldgSm.expectedTotal) * 100)) : 0;
                          const dueCount = Math.max(0, bldgSm.totalDueCount - bldgSm.paidCount);

                          return (
                            <tr
                              key={bldg.id}
                              onClick={() => {
                                if (typeof setPropertyFilter === 'function') setPropertyFilter('all');
                                setActiveTab('rent');
                              }}
                              className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                            >
                              <td className="py-3.5 pr-3 font-bold text-gray-900 dark:text-white truncate max-w-[140px]">
                                {bldg.name}
                              </td>
                              <td className="py-3.5 px-3 text-right font-medium text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
                                {formatBDT(bldgSm.expectedTotal)}
                              </td>
                              <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                                {formatBDT(bldgSm.collectedTotal)}
                              </td>
                              <td className="py-3.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">
                                {bldgSm.outstandingTotal > 0 ? formatBDT(bldgSm.outstandingTotal) : '৳ 0'}
                              </td>
                              <td className="py-3.5 px-3 text-center text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                                {bldgSm.paidCount} / {dueCount}
                              </td>
                              <td className="py-3.5 pl-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 sm:w-20 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        bldgPct >= 70 ? 'bg-emerald-500' : bldgPct > 0 ? 'bg-[#ba0036]' : 'bg-transparent'
                                      }`}
                                      style={{ width: `${bldgPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 tabular-nums w-8 text-right">
                                    {bldgSm.expectedTotal === 0 ? '—' : `${bldgPct}%`}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 pl-2 text-right">
                                <ChevronRight size={15} className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {language === 'বাংলা'
                      ? `সকল ${displayedBuildings.length}টি বিল্ডিং প্রদর্শিত`
                      : `Showing all ${displayedBuildings.length} buildings`}
                  </span>
                </div>
              </div>

              {/* ডান কলাম: Quick Actions + More Actions + Your Properties */}
              <div className="lg:col-span-4 space-y-4">
                {/* Card 1: Quick Actions */}
                <div data-tour="host-quick-actions" className="bg-white dark:bg-gray-900/40 rounded-2xl md:rounded-[1.5rem] p-5 border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none">
                  <h3 className="text-base font-black text-gray-900 dark:text-white mb-3">
                    {language === 'বাংলা' ? 'জরুরী কাজ' : 'Quick Actions'}
                  </h3>
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('bookings')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all shadow-sm active:scale-[0.99]"
                    >
                      <Calendar size={18} className="text-gray-700 dark:text-gray-300" />
                      <span>{language === 'বাংলা' ? 'ভাড়াটিয়া যোগ করুন' : 'Add Tenant'}</span>
                    </button>

                    {/* Highlighted in Crimson/Red like the mockup */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('rent')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ba0036] hover:bg-[#9e002e] text-white text-xs font-bold transition-all shadow-md shadow-red-500/20 active:scale-[0.99]"
                    >
                      <Wallet size={18} className="text-white" />
                      <span>{language === 'বাংলা' ? 'ভাড়া কালেকশন' : 'Rent Collection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('payments')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all shadow-sm active:scale-[0.99]"
                    >
                      <CreditCard size={18} className="text-gray-700 dark:text-gray-300" />
                      <span>{language === 'বাংলা' ? 'পেমেন্ট সেটিংস' : 'Payment Settings'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('smartAlerts')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all shadow-sm active:scale-[0.99]"
                    >
                      <BellRing size={18} className="text-gray-700 dark:text-gray-300" />
                      <span>{language === 'বাংলা' ? 'স্মার্ট অ্যালার্ট' : 'Smart Alerts'}</span>
                    </button>
                  </div>
                </div>

                {/* Card 2: More Actions */}
                <div data-tour="host-more-actions" className="bg-white dark:bg-gray-900/40 rounded-2xl md:rounded-[1.5rem] border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden">
                  <button
                    id="host-more-actions-btn"
                    type="button"
                    onClick={() => setMoreActionsOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0">
                        <LayoutGrid size={16} strokeWidth={2.2} />
                      </span>
                      <span className="text-xs md:text-sm font-black text-gray-800 dark:text-gray-200">
                        {language === 'বাংলা' ? 'আরও অ্যাকশন' : 'More Actions'}
                      </span>
                    </span>
                    {moreActionsOpen
                      ? <ChevronUp size={16} className="text-gray-400 shrink-0" strokeWidth={2.6} />
                      : <ChevronDown size={16} className="text-gray-400 shrink-0" strokeWidth={2.6} />}
                  </button>

                  {moreActionsOpen && (
                    <div id="host-more-actions-dropdown" className="p-4 pt-0 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
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
                          className={`group flex items-center gap-3 bg-white dark:bg-gray-900/50 px-3.5 py-2.5 rounded-xl border ${action.border} shadow-sm active:scale-95 transition-all hover:shadow-md w-full`}
                        >
                          <div className={`w-7 h-7 ${action.bg} ${action.color} rounded-lg flex items-center justify-center shrink-0`}>
                            <action.icon size={14} />
                          </div>
                          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 text-left leading-tight">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card 3: Your Properties */}
                <div className="bg-white dark:bg-gray-900/40 rounded-2xl md:rounded-[1.5rem] p-4 border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs md:text-sm font-black text-gray-900 dark:text-white truncate">
                        {language === 'বাংলা' ? 'আপনার প্রপার্টিসমূহ' : 'Your Properties'}
                      </h4>
                      <p className="text-[11px] text-gray-400 font-medium">
                        {allBuildings.length > 0 
                          ? `${allBuildings.length} ${language === 'বাংলা' ? 'বিল্ডিং' : 'buildings'}` 
                          : `${properties.length} ${language === 'বাংলা' ? 'প্রপার্টি' : 'properties'}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('properties')}
                    className="text-[#ba0036] hover:text-[#9e002e] text-xs font-bold flex items-center gap-1 hover:underline transition-all shrink-0 ml-2"
                  >
                    <span>{language === 'বাংলা' ? 'সব দেখুন' : 'View all'}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="hidden md:block mt-8">
        <Footer />
      </div>
    </div>
  );
}
