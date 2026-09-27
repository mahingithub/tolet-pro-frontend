import React, { useMemo, useState } from 'react';
import {
  X, CreditCard, ArrowUpRight, Crown, LayoutGrid, ChevronUp, ChevronDown,
  FileText, FileEdit, Megaphone, Download, BellRing, AlertCircle, Building2,
  Plus, MapPin, Wallet, Calendar, RefreshCw, Search, ChevronRight,
  CheckCircle2, Hourglass, TrendingUp, MessageSquare, KeyRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { bookingInBuilding } from '../../utils/buildingScope';
import { isInquiryUnread } from '../../utils/inquiryUnread';

// A listing's status as the landlord reads it — the same words and colours as
// the badge in the Properties tab, so one listing reads the same in both
// places. This card used to print the raw value, so a rented flat said
// "RENTED" in English on a Bangla screen, under a green "live" pulse.
const LISTING_STATUS = {
  active:   { en: 'Active',   bn: 'অ্যাক্টিভ',    ink: 'text-green-600',  dot: 'bg-green-500 animate-pulse' },
  paused:   { en: 'Paused',   bn: 'পজড',          ink: 'text-orange-500', dot: 'bg-orange-500' },
  rented:   { en: 'Rented',   bn: 'ভাড়া হয়েছে',   ink: 'text-gray-500',   dot: 'bg-gray-400' },
  inactive: { en: 'Inactive', bn: 'নিষ্ক্রিয়',    ink: 'text-gray-500',   dot: 'bg-gray-400' },
  draft:    { en: 'Draft',    bn: 'ড্রাফট',        ink: 'text-gray-500',   dot: 'bg-gray-400' },
};

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
  openBuildingLedger,
  rentUnitsOf,
  properties,
  inquiries,
  inqSeen,
  setPropertyFilter,
  ledgerKnown = true,
}) {
  const [buildingSearch, setBuildingSearch] = useState('');
  const [showAllBuildings, setShowAllBuildings] = useState(false);
  const bn = language === 'বাংলা';

  // Both lists are normalised once, here. `rows` used to be guarded by
  // scopeBookings (`Array.isArray(...) ? ... : []`) — dropping that helper took
  // the guard with it, and a corrupt host_bookings_cache that parses to
  // anything but an array would take the whole dashboard down on .flatMap.
  // `blds` is memoised because `?? []` hands back a NEW array every render,
  // which defeated the per-building memo below and re-ran the month summary
  // once per building on every keystroke in the search box.
  const rows = Array.isArray(bookings) ? bookings : [];
  const allBuildings = useMemo(
    () => (Array.isArray(landlordProfile?.buildings) ? landlordProfile.buildings : []),
    [landlordProfile?.buildings],
  );

  // PORTFOLIO TOTALS — every building, always.
  //
  // These used to be scoped by `currentBuildingId`, which survives a drill-in:
  // open a building from the table, come back to the dashboard, and the header
  // still read that one building's money while the table underneath listed all
  // of them. Two numbers for the same question, and only a page reload — which
  // resets the id to null — put it right. The drill-in belongs to Rent
  // Collection; the dashboard is the view from above.
  const sm = useMemo(() => getMonthCollectionSummary(
    rows.flatMap(rentUnitsOf),
    today.getFullYear(),
    today.getMonth() + 1,
    today,
  ), [rows, getMonthCollectionSummary, rentUnitsOf, today]);

  const collectedPct = sm.expectedTotal > 0
    ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100))
    : 0;

  // One summary per building, computed once and rendered twice (table on the
  // desktop column, stacked rows on a phone) so the two layouts can never drift
  // apart on the numbers — only on how they are set.
  const buildingRows = useMemo(() => allBuildings.map((bldg) => {
    const units = rows.filter((b) => bookingInBuilding(b, bldg)).flatMap(rentUnitsOf);
    const s = getMonthCollectionSummary(units, today.getFullYear(), today.getMonth() + 1, today);
    return {
      id: bldg.id,
      name: bldg.name || '',
      expected: s.expectedTotal,
      collected: s.collectedTotal,
      outstanding: s.outstandingTotal,
      cleared: s.paidCount,
      due: Math.max(0, s.totalDueCount - s.paidCount),
      pct: s.expectedTotal > 0 ? Math.min(100, Math.round((s.collectedTotal / s.expectedTotal) * 100)) : 0,
      noRent: s.expectedTotal === 0,
    };
  }), [allBuildings, rows, getMonthCollectionSummary, rentUnitsOf, today]);

  // ── ACCOUNT STATE ─────────────────────────────────────────────────────────
  // Three landlords open this screen, and they need different first screens —
  // the same way the tenant dashboard hides dues and payments until the
  // tenant is linked to a landlord:
  //
  //   has a rent ledger (buildings / tenants)  → the ledger, as always
  //   has listings                              → listing tiles on top
  //   has neither                               → one "start" card that
  //                                               offers both, nothing else
  //
  // The screen used to know this — the inline version had a
  // `properties.length > 0` branch — and the one-layout redesign dropped it.
  // A brand-new landlord, AND one with a live listing but no tenants yet, then
  // got a first screen of ৳0 boxes and "no buildings found", with their
  // listing pushed below the fold.
  //
  // Neither "empty" is trusted until it has been answered: `ledgerKnown` waits
  // for the first bookings + buildings read, and listings wait for the first
  // fetch unless the cache already has some. Until then the ledger renders as
  // it always has, rather than flashing "start your ledger" at a landlord with
  // forty tenants on a fresh device.
  const listings = Array.isArray(properties) ? properties : [];
  const hasListings = listings.length > 0;
  const listingsKnown = !isPropertiesLoading || hasListings;
  const hasLedger = rows.length > 0 || allBuildings.length > 0;
  const showLedger = hasLedger || !ledgerKnown;
  const brandNew = !showLedger && listingsKnown && !hasListings;

  // The rent ledger (Bookings + Rent tabs) is a Pro feature: on the free plan
  // HostDashboard's tab guard sends "bookings" straight to /subscription. The
  // start card says so on its button, and offers the free share-trial first
  // while it is still unclaimed, rather than landing on a paywall unannounced.
  const ledgerIsPro = !isPremium;
  const startLedger = () => {
    if (ledgerIsPro && canClaimShareTrial) { setTrialModalOpen(true); return; }
    setActiveTab('bookings');
  };

  const inquiryList = Array.isArray(inquiries) ? inquiries : [];
  const rentedCount = listings.filter((p) => p.status === 'rented').length;
  const listingTiles = [
    {
      key: 'all', Icon: Building2, value: listings.length,
      label: bn ? 'মোট বাসা' : 'Listings',
      chip: 'bg-rose-50 dark:bg-rose-950/40 text-[#ba0036] dark:text-rose-400',
      onClick: () => { setPropertyFilter?.('all'); setActiveTab('properties'); },
    },
    {
      key: 'active', Icon: TrendingUp, value: listings.filter((p) => p.status === 'active').length,
      label: bn ? 'অ্যাক্টিভ' : 'Active',
      chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
      onClick: () => { setPropertyFilter?.('active'); setActiveTab('properties'); },
    },
    // Only once something has actually been let. A landlord whose one flat is
    // rented otherwise saw "Active 0" and nothing else — true, but it read
    // like a problem rather than the good news it is.
    ...(rentedCount > 0 ? [{
      key: 'rented', Icon: KeyRound, value: rentedCount,
      label: bn ? 'ভাড়া হয়েছে' : 'Rented',
      chip: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
      onClick: () => { setPropertyFilter?.('rented'); setActiveTab('properties'); },
    }] : []),
    {
      key: 'inquiries', Icon: MessageSquare, value: inquiryList.length,
      label: bn ? 'যোগাযোগ' : 'Inquiries',
      chip: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
      // Red the moment a tenant writes and the landlord hasn't opened it.
      unread: inquiryList.some((inq) => isInquiryUnread(inq, 'host', inqSeen)),
      onClick: () => setActiveTab('inquiries'),
    },
  ];

  const q = buildingSearch.trim().toLowerCase();
  const displayedRows = q ? buildingRows.filter((r) => r.name.toLowerCase().includes(q)) : buildingRows;
  // "Not found" is the answer to a search. With no search typed, an empty
  // table means the landlord has tenants on the ledger but no building yet —
  // it used to say "no buildings found" to someone who had never made one.
  const emptyBuildingsText = q
    ? (bn ? 'কোনো বিল্ডিং পাওয়া যায়নি' : 'No buildings found')
    : (bn ? 'এখনো কোনো বিল্ডিং যোগ করা হয়নি' : 'No buildings added yet');

  // Five buildings, then "See more" — same cut on desktop and mobile. A
  // twenty-building portfolio otherwise pushes the properties section off the
  // bottom of the dashboard on every visit.
  const COLLAPSED_BUILDINGS = 5;
  const canCollapse = displayedRows.length > COLLAPSED_BUILDINGS;
  const visibleRows = canCollapse && !showAllBuildings
    ? displayedRows.slice(0, COLLAPSED_BUILDINGS)
    : displayedRows;

  // A building that is 70%+ collected is "on track" and reads green; anything
  // less is the landlord's problem for the month and reads crimson.
  const barTone = (row) => (row.noRent ? 'bg-transparent' : row.pct >= 70 ? 'bg-emerald-500' : 'bg-[#ba0036]');
  const pctTone = (row) => (row.pct >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#ba0036] dark:text-rose-400');

  // Each figure sits on its own tinted card, the way the landlord reads them
  // today: colour carries the meaning, the number leads, and a small icon marks
  // the footnote. `tint`/`ink` are the card and the text of one colour family.
  const kpis = [
    {
      key: 'collected',
      Icon: CheckCircle2,
      label: bn ? 'আদায়' : 'Collected',
      value: formatBDT(sm.collectedTotal),
      note: `${sm.paidCount} ${bn ? 'ক্লিয়ার্ড' : 'cleared'}`,
      tint: 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-800/50',
      ink: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      key: 'outstanding',
      Icon: AlertCircle,
      label: bn ? 'বকেয়া' : 'Outstanding',
      value: formatBDT(sm.outstandingTotal),
      note: `${sm.overdueCount} ${bn ? 'বকেয়া' : 'due'}`,
      tint: 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-100 dark:border-rose-800/50',
      ink: 'text-rose-700 dark:text-rose-400',
    },
    {
      key: 'partial',
      Icon: Hourglass,
      label: bn ? 'আংশিক' : 'Partial',
      value: String(sm.partialCount),
      note: bn ? 'আংশিক পরিশোধ' : 'Partially paid',
      tint: 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-100 dark:border-amber-800/50',
      ink: 'text-amber-700 dark:text-amber-400',
    },
    {
      key: 'expected',
      Icon: Calendar,
      label: bn ? 'প্রত্যাশিত' : 'Expected',
      value: formatBDT(sm.expectedTotal),
      note: `${sm.totalDueCount} ${bn ? 'ভাড়াটিয়া' : 'tenants'}`,
      tint: 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-100 dark:border-blue-800/50',
      ink: 'text-blue-700 dark:text-blue-400',
    },
  ];

  /**
   * How big the figure can be printed without clipping. A half-width tinted
   * card on a 375px phone has ~130px of room: "৳ 12,34,567" at 26px needs more
   * than that and truncates to an ellipsis — the exact number the landlord came
   * to read. Stepping down by length keeps the everyday four- and five-figure
   * totals big and keeps the rare six-figure one whole.
   */
  const kpiValueSize = (text) => {
    const len = String(text ?? '').length;
    if (len <= 8) return 'text-[24px] lg:text-[30px]';
    if (len <= 11) return 'text-[21px] lg:text-[26px]';
    return 'text-[17px] lg:text-[21px]';
  };

  // `onMobile` — a phone shows only the two everyday jobs; the other two stay
  // on the desktop rail, and are still reachable on a phone from the sidebar.
  const quickActions = [
    { id: 'add_tenant', Icon: Calendar, label: bn ? 'ভাড়াটিয়া যোগ করুন' : 'Add Tenant', onClick: () => setActiveTab('bookings'), onMobile: true },
    { id: 'rent_collection', Icon: Wallet, label: bn ? 'ভাড়া কালেকশন' : 'Rent Collection', onClick: () => setActiveTab('rent'), onMobile: true },
    { id: 'payment_settings', Icon: CreditCard, label: bn ? 'পেমেন্ট সেটিংস' : 'Payment Settings', onClick: () => setActiveTab('payments') },
    { id: 'smart_alerts', Icon: BellRing, label: bn ? 'স্মার্ট অ্যালার্ট' : 'Smart Alerts', onClick: () => setActiveTab('smartAlerts') },
  ];

  const moreActions = [
    { id: 'documents', icon: FileText, label: bn ? 'ডকুমেন্ট ও অ্যানালিটিক্স' : 'Docs & Analytics', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-100 dark:border-violet-800/50', onClick: () => setActiveTab('documents') },
    { id: 'create_lease', icon: FileEdit, label: bn ? 'নতুন চুক্তি' : 'New Contract', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-100 dark:border-blue-800/50', onClick: () => (isPremium ? openBlankLease() : setActiveModal('premium_gate')) },
    { id: 'message_all', icon: Megaphone, label: bn ? 'সবাইকে মেসেজ' : 'Message All', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-green-100 dark:border-green-800/50', onClick: () => openModal('message_all') },
    { id: 'export_report', icon: Download, label: bn ? 'রিপোর্ট' : 'Report', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-100 dark:border-orange-800/50', onClick: () => openModal('export_report') },
    { id: 'send_reminders', icon: BellRing, label: bn ? 'রিমাইন্ডার' : 'Reminder', color: 'text-[#ba0036] dark:text-rose-400', bg: 'bg-red-50 dark:bg-rose-950/40', border: 'border-red-100 dark:border-rose-800/50', onClick: () => openModal('send_reminders') },
  ];

  const card = 'bg-white dark:bg-gray-900/40 rounded-2xl lg:rounded-[1.5rem] border border-gray-100 dark:border-gray-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none';

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-4 lg:space-y-5">

      {/* 0. Promos — payment settings + trial/upgrade. Full width on a phone,
          side by side from tablet up. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 empty:hidden">

        {!paymentMethodsLoading && (
          !hasActivePaymentMethod ? (
            rows.length > 0 && !hidePaymentPromo && (
              <div
                onClick={() => setActiveTab('payments')}
                className="relative group cursor-pointer bg-gradient-to-br from-emerald-50 to-green-50/60 dark:from-emerald-950/30 dark:to-green-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(16,185,129,0.12)] hover:shadow-[0_12px_35px_rgba(16,185,129,0.20)] hover:-translate-y-0.5 transition-all flex flex-col h-full"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setHidePaymentPromo(true); }}
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
                        {bn ? 'পেমেন্ট সেটিংস সম্পূর্ণ করুন' : 'Complete Payment Settings'}
                      </h3>
                      <p className="text-[11px] md:text-xs font-bold text-emerald-700 dark:text-emerald-300/90 leading-relaxed md:truncate">
                        {bn
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
              className={`group cursor-pointer ${card} p-3.5 md:p-4 hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all flex flex-col h-full`}
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
                      {bn ? 'পেমেন্ট সেটিংস' : 'Payment Settings'}
                    </h3>
                    <p className="text-[11px] md:text-xs font-bold text-gray-500 dark:text-gray-400 leading-relaxed truncate">
                      {pendingRentCount > 0
                        ? (bn
                            ? `${pendingRentCount} টি পেমেন্ট যাচাইয়ের অপেক্ষায়`
                            : `${pendingRentCount} payment${pendingRentCount > 1 ? 's' : ''} awaiting verification`)
                        : (defaultPaymentMethod
                            ? `${({ bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank' })[defaultPaymentMethod.type] || ''} • ${defaultPaymentMethod.accountNumber}`
                            : (bn ? 'পেমেন্ট অ্যাকাউন্ট কনফিগার করা আছে' : 'Payment account configured'))}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <div className={`w-fit px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1 md:gap-2 md:group-hover:scale-105 transition-transform ${pendingRentCount > 0 ? 'bg-[#ba0036] text-white shadow-lg shadow-red-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                    {pendingRentCount > 0 ? (bn ? 'যাচাই করুন' : 'Verify Now') : (bn ? 'ম্যানেজ করুন' : 'Manage')}
                    <ArrowUpRight size={14} className="md:w-4 md:h-4" />
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {canClaimShareTrial ? (
          <div
            onClick={() => setTrialModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTrialModalOpen(true); } }}
            className="group cursor-pointer bg-white dark:bg-gray-900/40 border border-amber-200 dark:border-amber-500/30 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(245,158,11,0.08)] hover:shadow-[0_12px_35px_rgba(245,158,11,0.15)] hover:-translate-y-0.5 transition-all flex flex-col w-full h-full"
          >
            <div className="flex flex-col gap-2 md:gap-3 h-full justify-center">
              <div className="flex flex-row items-center gap-3 md:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(245,158,11,0.7)]">
                  <Crown size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 flex-1 min-w-0">
                  <h3 className="text-[12px] md:text-[13px] font-black text-gray-900 dark:text-white leading-tight">
                    {bn ? '২ মাসের ফ্রি প্রো ট্রায়াল নিন' : 'Get 2 Months of Pro — Free'}
                  </h3>
                  <div className="w-fit px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1 shadow-sm md:shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform shrink-0">
                    {bn ? 'ফ্রি ট্রায়াল' : 'Free Trial'} <ArrowUpRight size={12} className="md:w-4 md:h-4" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] md:text-xs font-bold text-amber-600 dark:text-amber-500 leading-snug md:leading-relaxed md:pl-[64px]">
                {bn
                  ? 'অ্যাপের লিংক শেয়ার করলেই ৫০টি ছবি, ভিডিও ট্যুর আর সার্চে শীর্ষ অবস্থান আনলক।'
                  : 'Unlock 50 photos, video tours, and a top search position just by sharing the app link'}
              </p>
            </div>
          </div>
        ) : (subStatus.planState === 'trial_lapsed' || subStatus.planState === 'paid_expired') ? (() => {
          const isRenewal = subStatus.planState === 'paid_expired';
          const title = isRenewal
            ? (bn ? 'আপনার প্ল্যান রিনিউ করুন' : 'Renew Your Plan')
            : (bn ? 'প্রো-তে আপগ্রেড করুন' : 'Upgrade to Pro');
          const blurb = isRenewal
            ? (bn
                ? 'আপনার প্ল্যানের মেয়াদ শেষ — রিনিউ করে ছবি, ভিডিও ও টপ পজিশন আবার চালু করুন।'
                : 'Your plan expired — renew to restore photos, videos and top position.')
            : (bn
                ? 'আপনার ফ্রি ট্রায়াল শেষ — প্রো নিয়ে ৫০টি ছবি, ভিডিও ট্যুর আর টপ পজিশন ফিরে পান।'
                : 'Free trial ended — go Pro for 50 photos, video tours and top position.');
          const cta = isRenewal ? (bn ? 'রিনিউ করুন' : 'Renew Now') : (bn ? 'আপগ্রেড করুন' : 'Upgrade Now');
          const go = () => navigate('/subscription?from=dashboard');

          return (
            <div
              onClick={go}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
              className="group cursor-pointer bg-gradient-to-br from-violet-50 to-indigo-50/60 dark:from-violet-950/30 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800/50 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(99,102,241,0.12)] hover:shadow-[0_12px_35px_rgba(99,102,241,0.20)] hover:-translate-y-0.5 transition-all flex flex-col h-full w-full"
            >
              <div className="flex flex-col gap-2 md:gap-3 h-full justify-center">
                <div className="flex flex-row items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(99,102,241,0.7)]">
                    <Crown size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 flex-1 min-w-0">
                    <h3 className="text-[12px] md:text-[13px] font-black text-gray-900 dark:text-white leading-tight">{title}</h3>
                    <div className="w-fit px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-[9px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1 shadow-sm md:shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
                      {cta} <ArrowUpRight size={12} className="md:w-4 md:h-4" />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] md:text-xs font-bold text-violet-700 dark:text-violet-300/90 leading-snug md:leading-relaxed md:pl-[64px]">{blurb}</p>
              </div>
            </div>
          );
        })() : null}
      </div>

      {/* 0.5 Listing tiles — only for a landlord who has listed something.
          Each is a one-tap deep link: Listings → all, Active → active only,
          Rented → rented only, Inquiries → the inquiries tab. These were
          dropped with the old `properties.length > 0` branch, which left a
          listing landlord with no count of their listings or inquiries
          anywhere on the dashboard.

          Three tiles sit 3-up everywhere (stacked icon/label on a phone).
          With the Rented tile there are four, and four columns do not fit a
          phone's labels — so that case is 2×2 on a phone, 4-up on desktop,
          with each tile laid out as a row. */}
      {hasListings && (
        <div className={`grid gap-2.5 lg:gap-4 ${listingTiles.length > 3 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`}>
          {listingTiles.map(({ key, Icon, value, label, chip, unread, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className={`relative min-w-0 text-left rounded-2xl lg:rounded-[1.5rem] p-3 lg:p-5 flex ${listingTiles.length > 3 ? 'flex-row items-center justify-between' : 'flex-col lg:flex-row lg:items-center lg:justify-between'} gap-2 lg:gap-3 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.98] transition-all ${
                unread
                  ? 'bg-rose-50 dark:bg-rose-950/30 border border-[#ba0036]/30 ring-2 ring-[#ba0036]/30'
                  : 'bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800/60'
              }`}
            >
              {unread && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5" title={bn ? 'নতুন যোগাযোগ' : 'New inquiry'}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba0036] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba0036]" />
                </span>
              )}
              <span className={`flex min-w-0 ${listingTiles.length > 3 ? 'flex-row items-center gap-2 lg:gap-3' : 'flex-col lg:flex-row items-start lg:items-center gap-1.5 lg:gap-3'}`}>
                <span className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center shrink-0 ${unread ? 'bg-[#ba0036]/10 text-[#ba0036]' : chip}`}>
                  <Icon size={16} strokeWidth={2.4} />
                </span>
                <span className={`text-[11px] lg:text-sm font-black leading-tight truncate max-w-full ${unread ? 'text-[#ba0036]' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
              </span>
              <span className={`text-2xl lg:text-4xl font-black leading-none tabular-nums ${unread ? 'text-[#ba0036]' : 'text-gray-900 dark:text-white'}`}>{value}</span>
            </button>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          ONE ARCHITECTURE, TWO BREAKPOINTS.

          On a phone the whole thing is a single flex column, so `order-*` sets
          the reading order: quick actions → ledger → buildings → more actions
          → properties. On desktop the same children fall into a 12-column
          grid: full-width ledger on top, building table (8) bottom left,
          action rail (4) bottom right.

          With no rent ledger yet (see ACCOUNT STATE) the ledger and building
          table give way to one "start" card in the building table's slot, so
          the rail moves up beside it and properties move up a row.

          The rail is `contents` on mobile, so its two cards become direct
          children of the outer flex and can be ordered individually. That is
          what lets one markup serve both layouts instead of two copies — the
          duplication that made the old inline dashboard drift.
          ───────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start">

        {/* Right rail — quick actions + more actions */}
        <div className={`contents lg:block lg:col-start-9 lg:col-span-4 ${showLedger ? 'lg:row-start-2' : 'lg:row-start-1'} lg:space-y-4`}>

          {/* 1. Quick actions — 2 columns on a phone, vertical list on desktop */}
          <div data-tour="host-quick-actions" className={`order-1 ${card} p-4 lg:p-5`}>
            <h3 className="text-base lg:text-lg font-black text-gray-900 dark:text-white mb-3">
              {bn ? 'জরুরী কাজ' : 'Quick Actions'}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
              {/* One face for all four, no odd one out. A raised fill, a real
                  border and a pressed state are what make these read as buttons
                  on a white card — singling one out in crimson made the other
                  three look like list rows beside it. */}
              {quickActions.map(({ id, Icon, label, onClick, onMobile }) => (
                <button
                  key={id}
                  type="button"
                  onClick={onClick}
                  className={`group w-full min-w-0 items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-3 rounded-xl text-[12px] lg:text-xs font-bold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-white dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)] active:scale-[0.98] active:shadow-none transition-all ${
                    onMobile ? 'flex' : 'hidden lg:flex'
                  }`}
                >
                  <Icon size={18} className="shrink-0 text-gray-600 dark:text-gray-300" />
                  <span className="text-left leading-tight lg:truncate">{label}</span>
                  <ChevronRight size={15} className="hidden lg:block ml-auto shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* 4. More actions — collapsible, closed by default to keep the screen clean */}
          <div data-tour="host-more-actions" className={`order-4 ${card} overflow-hidden`}>
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
                <span className="text-sm font-black text-gray-800 dark:text-gray-200">
                  {bn ? 'আরও অ্যাকশন' : 'More Actions'}
                </span>
              </span>
              {moreActionsOpen
                ? <ChevronUp size={16} className="text-gray-400 shrink-0" strokeWidth={2.6} />
                : <ChevronDown size={16} className="text-gray-400 shrink-0" strokeWidth={2.6} />}
            </button>

            {moreActionsOpen && (
              <div id="host-more-actions-dropdown" className="p-4 pt-0 grid grid-cols-2 lg:grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                {moreActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    className={`group flex items-center gap-3 bg-white dark:bg-gray-900/50 px-3.5 py-2.5 rounded-xl border ${action.border} shadow-sm active:scale-95 transition-all hover:shadow-md w-full min-w-0`}
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
        </div>

        {showLedger ? (
        <>
        {/* 2. Shared ledger overview — full width */}
        <div
          data-tour="host-shared-ledger"
          onClick={() => setActiveTab('rent')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('rent'); } }}
          className={`order-2 lg:col-start-1 lg:col-span-12 lg:row-start-1 group relative w-full cursor-pointer ${card} p-4 lg:p-6 hover:shadow-[0_15px_45px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg lg:text-xl font-black text-gray-900 dark:text-white leading-tight">
                {bn ? 'ভাড়া লেজার ওভারভিউ' : 'Shared Ledger Overview'}
              </h3>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5">
                {monthFullLabel(sm.key, language)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 whitespace-nowrap text-xs font-bold text-[#ba0036] dark:text-rose-400 group-hover:translate-x-0.5 transition-transform">
              <span>{bn ? 'লেজার দেখুন' : 'Open ledger'}</span>
              <ArrowUpRight size={15} />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4 lg:my-5">
            {kpis.map(({ key, Icon, label, value, note, tint, ink }) => (
              <div key={key} className={`min-w-0 rounded-2xl border p-3.5 lg:p-4 ${tint}`}>
                <p className={`text-[13px] lg:text-sm font-black ${ink} leading-none`}>{label}</p>
                <p className={`${kpiValueSize(value)} font-black ${ink} tabular-nums mt-2 leading-none truncate`}>{value}</p>
                <p className={`text-[12px] lg:text-[13px] font-bold ${ink} opacity-80 mt-2 flex items-center gap-1.5 leading-none truncate`}>
                  <Icon size={14} strokeWidth={3} className="shrink-0" />
                  <span className="truncate">{note}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {bn ? 'কালেকশন রেট' : 'Collection rate'}
              </span>
              <span className="text-sm font-black text-[#ba0036] dark:text-rose-400 tabular-nums">{collectedPct}%</span>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700"
                style={{ width: `${collectedPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. Collection by building — table on desktop, stacked rows on a phone */}
        <div data-tour="host-collection" className={`order-3 lg:col-start-1 lg:col-span-8 lg:row-start-2 ${card} p-4 lg:p-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 lg:mb-4">
            <div className="flex items-baseline gap-2 min-w-0">
              <h3 className="text-base lg:text-lg font-black text-gray-900 dark:text-white truncate">
                {bn ? 'বিল্ডিং অনুযায়ী কালেকশন' : 'Collection by Building'}
              </h3>
              <span className="text-xs font-medium text-gray-400 shrink-0">
                {allBuildings.length} {bn ? 'বিল্ডিং' : allBuildings.length === 1 ? 'building' : 'buildings'}
              </span>
            </div>
            {/* Phone rows scroll on their own; the search box only earns its
                space on the wider table layout. */}
            <div className={`relative w-full sm:w-60 shrink-0 ${allBuildings.length > 0 ? 'hidden sm:block' : 'hidden'}`}>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={bn ? 'বিল্ডিং সার্চ করুন' : 'Search buildings'}
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#ba0036] focus:border-[#ba0036] transition-all"
                />
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-400 dark:text-gray-500">
                  <th className="py-2.5 pr-3 font-bold">{bn ? 'বিল্ডিং' : 'Building'}</th>
                  <th className="py-2.5 px-3 font-bold text-right">{bn ? 'প্রত্যাশিত' : 'Expected'}</th>
                  <th className="py-2.5 px-3 font-bold text-right">{bn ? 'আদায়' : 'Collected'}</th>
                  <th className="py-2.5 px-3 font-bold text-right">{bn ? 'বকেয়া' : 'Outstanding'}</th>
                  <th className="py-2.5 px-3 font-bold text-center">{bn ? 'ক্লিয়ার / বাকি' : 'Cleared / Due'}</th>
                  <th className="py-2.5 pl-3 font-bold">{bn ? 'কালেকশন' : 'Collection'}</th>
                  <th className="py-2.5 pl-2 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50 text-xs">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs font-semibold text-gray-400">
                      {emptyBuildingsText}
                    </td>
                  </tr>
                ) : visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openBuildingLedger(row.id)}
                    className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 pr-3 font-bold text-gray-900 dark:text-white truncate max-w-[140px]">{row.name}</td>
                    <td className="py-3.5 px-3 text-right font-medium text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">{formatBDT(row.expected)}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">{formatBDT(row.collected)}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">{row.outstanding > 0 ? formatBDT(row.outstanding) : '৳ 0'}</td>
                    <td className="py-3.5 px-3 text-center text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{row.cleared} / {row.due}</td>
                    <td className="py-3.5 pl-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${barTone(row)}`} style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 tabular-nums w-8 text-right">
                          {row.noRent ? '—' : `${row.pct}%`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 pl-2 text-right">
                      <ChevronRight size={15} className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone rows — the same numbers as the table, set to be read down a column */}
          <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {displayedRows.length === 0 ? (
              <p className="py-8 text-center text-xs font-semibold text-gray-400">
                {emptyBuildingsText}
              </p>
            ) : visibleRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => openBuildingLedger(row.id)}
                className="w-full text-left py-3.5 first:pt-1 last:pb-1 active:opacity-70 transition-opacity"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-[15px] font-black text-gray-900 dark:text-white truncate">{row.name}</h4>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400">{formatBDT(row.collected)}</span>
                      {bn ? ' / ' : ' of '}
                      <span className="text-gray-700 dark:text-gray-300">{formatBDT(row.expected)}</span>
                      {bn ? ' আদায়' : ' collected'}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5 tabular-nums">
                      {row.cleared} {bn ? 'ক্লিয়ার' : 'cleared'} · {row.due} {bn ? 'বাকি' : 'due'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {row.noRent ? (
                      <span className="text-[11px] font-bold text-gray-400">{bn ? 'ভাড়া ধার্য নেই' : 'No rent expected'}</span>
                    ) : (
                      <span className={`text-lg font-black tabular-nums ${pctTone(row)}`}>{row.pct}%</span>
                    )}
                    <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
                  </div>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2.5">
                  <div className={`h-full rounded-full transition-all duration-500 ${barTone(row)}`} style={{ width: `${row.pct}%` }} />
                </div>
              </button>
            ))}
          </div>

          {/* The count stays desktop-only as before; the See more toggle shows on
              both, so the row only collapses away when there is neither. */}
          <div className={`mt-3 lg:mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 items-center justify-between gap-3 text-xs text-gray-400 ${canCollapse ? 'flex' : displayedRows.length > 0 ? 'hidden lg:flex' : 'hidden'}`}>
            <span className="hidden lg:inline">
              {canCollapse && !showAllBuildings
                ? (bn
                    ? `${displayedRows.length}টির মধ্যে ${visibleRows.length}টি বিল্ডিং প্রদর্শিত`
                    : `Showing ${visibleRows.length} of ${displayedRows.length} buildings`)
                : (bn
                    ? `সকল ${displayedRows.length}টি বিল্ডিং প্রদর্শিত`
                    : `Showing all ${displayedRows.length} buildings`)}
            </span>
            {canCollapse && (
              <button
                type="button"
                onClick={() => setShowAllBuildings((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800 text-[#ba0036] dark:text-rose-400 text-xs font-bold transition-all active:scale-[0.98]"
              >
                {showAllBuildings
                  ? (bn ? 'কম দেখুন' : 'See less')
                  : (bn ? `আরও দেখুন (${displayedRows.length - visibleRows.length})` : `See more (${displayedRows.length - visibleRows.length})`)}
                <ChevronDown size={14} className={`transition-transform ${showAllBuildings ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        </>
        ) : (
          /* 2–3. No ledger yet — one card instead of a ledger of ৳0 boxes and
             an empty building table. "Start" opens the Bookings tab, which
             already walks a landlord with no building through setup (one
             house or several) before the first tenant. A brand-new landlord
             also gets the other way in — listing a place — here rather than
             at the bottom of the page. First on a phone: it is the next step,
             and the quick actions under it are the same jobs in short. */
          <div className={`order-first lg:col-start-1 lg:col-span-8 lg:row-start-1 ${card} p-4 lg:p-6`}>
            <div className="flex items-start gap-3 lg:gap-4">
              <span className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Wallet size={20} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base lg:text-lg font-black text-gray-900 dark:text-white leading-tight">
                  {bn ? 'ভাড়ার খাতা শুরু করুন' : 'Start your rent ledger'}
                </h3>
                <p className="text-xs lg:text-[13px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                  {bn
                    ? 'আপনার বিল্ডিং আর ভাড়াটিয়া যোগ করুন — প্রতি মাসের আদায়, বকেয়া আর রিসিটের হিসাব এখানে দেখাবে।'
                    : 'Add your building and tenants — each month\'s collection, dues and receipts will show up here.'}
                </p>
                <button
                  type="button"
                  onClick={startLedger}
                  className="mt-3.5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ba0036] hover:bg-[#90002a] text-white text-xs font-black active:scale-95 transition-all shadow-[0_4px_12px_rgba(186,0,54,0.25)]"
                >
                  <Plus size={14} strokeWidth={2.6} />
                  {bn ? 'বিল্ডিং ও ভাড়াটিয়া যোগ করুন' : 'Add building & tenants'}
                  {ledgerIsPro && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-black uppercase tracking-wider">
                      <Crown size={10} strokeWidth={2.6} /> {bn ? 'প্রো' : 'Pro'}
                    </span>
                  )}
                </button>
                {ledgerIsPro && (
                  <p className="mt-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-snug">
                    {canClaimShareTrial
                      ? (bn ? 'প্রো ফিচার — অ্যাপ শেয়ার করলে ২ মাস ফ্রি।' : 'A Pro feature — free for 2 months when you share the app.')
                      : (bn ? 'ভাড়ার খাতা প্রো প্ল্যানে পাওয়া যায়।' : 'The rent ledger is part of the Pro plan.')}
                  </p>
                )}
              </div>
            </div>

            {brandNew && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
                <span className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/50 text-[#ba0036] dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Building2 size={20} strokeWidth={2.2} />
                </span>
                <div className="min-w-[11rem] flex-1">
                  <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                    {bn ? 'খালি বাসা আছে?' : 'Have a place to let?'}
                  </p>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                    {bn ? 'লিস্ট করুন — ভাড়াটিয়ারা খুঁজে পেয়ে সরাসরি যোগাযোগ করবে।' : 'List it — tenants find it and contact you directly.'}
                  </p>
                </div>
                <Link
                  to="/list-property"
                  className="ml-auto shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 text-gray-800 dark:text-gray-100 text-xs font-black active:scale-95 transition-all"
                >
                  <Plus size={14} strokeWidth={2.6} />
                  {bn ? 'বাসা লিস্ট করুন' : 'List Property'}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 5. Your properties — full width, below everything. Left out for a
            brand-new landlord: the start card above already offers listing,
            and "no properties yet" under it only repeated that. */}
        {!brandNew && (
        <div data-tour="host-properties" className={`order-5 lg:col-start-1 lg:col-span-12 ${showLedger ? 'lg:row-start-3' : 'lg:row-start-2'}`}>
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white tracking-tight">{dashboardPropTitle}</h3>
            <button
              onClick={() => setActiveTab('properties')}
              className="text-[#ba0036] text-[10px] font-black uppercase tracking-widest hover:underline underline-offset-4 transition-all"
            >
              {bn ? 'সব দেখুন' : 'View All'}
            </button>
          </div>

          {/* One column on phones (matches the homepage feed), 2-up from sm:, 3-up from lg: */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {isPropertiesLoading && dashboardProperties.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900/40 rounded-[1.5rem] p-3 shadow-sm border border-gray-50 dark:border-gray-800 animate-pulse">
                  <div className="h-44 md:h-60 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  <div className="py-3 px-1">
                    <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
                    <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800 mt-3" />
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="h-9 rounded-xl bg-gray-100 dark:bg-gray-800" />
                      <div className="h-9 rounded-xl bg-gray-100 dark:bg-gray-800" />
                    </div>
                  </div>
                </div>
              ))
            ) : propertyLoadError && dashboardProperties.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 bg-white dark:bg-gray-900/40 rounded-[1.5rem] p-6 border border-red-100 dark:border-rose-900/40 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-rose-950/40 text-[#ba0036] dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm md:text-base font-black text-gray-900 dark:text-white">
                      {bn ? 'প্রপার্টি লোড করা যায়নি' : 'Could not load your properties'}
                    </h4>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{propertyLoadError}</p>
                    <button
                      onClick={retryLoadProperties}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ba0036] text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      <RefreshCw size={13} />
                      {bn ? 'আবার চেষ্টা করুন' : 'Retry'}
                    </button>
                  </div>
                </div>
              </div>
            ) : dashboardProperties.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 bg-white dark:bg-gray-900/40 rounded-[1.5rem] p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-rose-950/40 text-[#ba0036] dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm md:text-base font-black text-gray-900 dark:text-white">
                      {bn ? 'এখনও কোনো বাসা নেই' : 'No properties listed yet'}
                    </h4>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                      {bn ? 'আপনার প্রথম বাসা লিস্ট করলে এটি এখানে দেখা যাবে।' : 'Your first uploaded property will appear here as soon as it is saved.'}
                    </p>
                    <Link
                      to="/list-property"
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ba0036] text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      <Plus size={13} />
                      {bn ? 'বাসা লিস্ট করুন' : 'List Property'}
                    </Link>
                  </div>
                </div>
              </div>
            ) : dashboardProperties.map((prop) => (
              <div key={prop.id} className="bg-white dark:bg-gray-900/40 rounded-[1.5rem] p-3 shadow-sm border border-gray-50 dark:border-gray-800 flex flex-col hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-300">
                <div className="relative h-44 md:h-60 overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${prop.img})` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {(() => {
                      const st = LISTING_STATUS[prop.status] || LISTING_STATUS.inactive;
                      return (
                        <div className={`bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${st.ink} shadow-sm flex items-center gap-1`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {bn ? st.bn : st.en}
                        </div>
                      );
                    })()}
                    {isRecent(prop.addedDate) && (
                      <div className="bg-[#ba0036] px-2.5 py-1 rounded-full text-[9px] font-black uppercase text-white shadow-sm">
                        {bn ? 'নতুন' : 'NEW'}
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-gray-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg">৳ {prop.price}</div>
                </div>
                <div className="py-3 px-1 flex flex-col flex-1">
                  <h4 className="text-sm md:text-base font-black text-gray-900 dark:text-white line-clamp-1">{prop.title}</h4>
                  <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin size={10} className="text-[#ba0036] shrink-0" /> {prop.location}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => openModal('edit', prop)} className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 rounded-xl text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 active:scale-95 transition-all">
                      {bn ? 'এডিট' : 'Edit'}
                    </button>
                    <button onClick={() => setActiveTab('inquiries')} className="bg-[#ba0036] hover:bg-[#90002a] text-white py-2.5 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all shadow-[0_4px_10px_rgba(186,0,54,0.2)]">
                      {bn ? 'ইনকোয়ারি' : 'Inquiries'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
