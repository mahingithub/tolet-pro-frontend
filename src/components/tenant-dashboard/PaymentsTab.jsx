import React, { useState } from 'react';
import {
  Wallet, FileText, Calendar, ArrowRight, ShieldCheck, CheckCircle2, Lock, Receipt, X, CheckCheck, Hourglass, Search, Filter, ChevronDown, Clock, CreditCard, Home, MapPin, KeyRound
} from 'lucide-react';
import TenantRentPay from '../payments/TenantRentPay';

const isFreshBooking = (b) => {
  const iso = b?.createdAt;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) < 7 * 24 * 60 * 60 * 1000; // 7 days
};

const fmtReceiptDateTime = (r, language) => {
  const iso = r?.issuedAt || r?.createdAt || r?.paidOn;
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return { date: r?.date || r?.paidOn || '', time: '' };
  }
  const locale = language === 'বাংলা' ? 'bn-BD' : 'en-GB';
  const date = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(language === 'বাংলা' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
};

const PaymentsTab = ({
  language,
  paymentReceipts,
  payYear, setPayYear,
  payMonth, setPayMonth,
  payProperty, setPayProperty,
  paySearch, setPaySearch,
  unreadReceiptsCount,
  myBookings,
  rentSubmissions,
  refreshRentData,
  setActiveReceipt,
  markReceiptRead,
  markAllReceiptsRead
}) => {
  // ── derive year/property/month/search-filtered data ─────────
  const monthNamesEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthNamesBn = ['জানু','ফেব','মার্চ','এপ্রিল','মে','জুন','জুল','আগ','সেপ্ট','অক্টো','নভে','ডিসে'];
  const monthNames = language === 'বাংলা' ? monthNamesBn : monthNamesEn;
  const [summaryOpen, setSummaryOpen] = useState(false);
  const now = new Date();
  const thisMonthKey = `${payYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // year set = year of every receipt + the current year so the
  // tenant can always switch to "this year".
  const yearSet = new Set([now.getFullYear()]);
  paymentReceipts.forEach((r) => {
    const y = r.monthKey?.split('-')[0];
    if (y) yearSet.add(Number(y));
  });
  const years = [...yearSet].sort((a, b) => b - a);

  // property dropdown options
  const propMap = new Map();
  paymentReceipts.forEach((r) => {
    const key = r.propertyId || r.propertyTitle;
    if (key) propMap.set(key, r.propertyTitle || key);
  });
  const properties = [...propMap.entries()];

  // bucket receipts by month for the active year (used by month strip)
  const buckets = {};
  paymentReceipts.forEach((r) => {
    if (!r.monthKey) return;
    const [y, m] = r.monthKey.split('-');
    if (Number(y) !== payYear) return;
    if (payProperty !== 'all' && (r.propertyId || r.propertyTitle) !== payProperty) return;
    const list = buckets[m] || (buckets[m] = []);
    list.push(r);
  });

  // search + active-month filter, sorted newest first
  const q = (paySearch || '').toLowerCase().trim();
  const filtered = paymentReceipts
    .filter((r) => {
      if (!r.monthKey) return false;
      const [y, m] = r.monthKey.split('-');
      if (Number(y) !== payYear) return false;
      if (payMonth && m !== payMonth) return false;
      if (payProperty !== 'all' && (r.propertyId || r.propertyTitle) !== payProperty) return false;
      if (!q) return true;
      const hay = `${r.propertyTitle || ''} ${r.monthLabel || ''} ${r.monthKey || ''} ${r.totalPaid || ''} ${r.totalDue || ''}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));

  // KPIs for the hero strip
  const paidThisYear = paymentReceipts
    .filter((r) => r.monthKey?.startsWith(`${payYear}-`))
    .reduce((s, r) => s + (r.totalPaid || 0), 0);
  const outstanding = paymentReceipts.reduce((s, r) => s + (r.balance || 0), 0);
  const partialCount = paymentReceipts.filter((r) => (r.balance || 0) > 0).length;
  const nextDue = paymentReceipts
    .filter((r) => (r.balance || 0) > 0)
    .sort((a, b) => (a.monthKey || '').localeCompare(b.monthKey || ''))[0];

  // ── "Your Bookings" banner — notifies the tenant the moment a host
  //    creates a booking / lease for them (shows even before any rent
  //    is paid, so a fresh booking is never invisible). Newly-created
  //    bookings get a pulsing "New" badge.
  const fmtLeaseDate = (iso) => {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(language === 'বাংলা' ? 'bn-BD' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const activeLeases = (myBookings || []).filter((b) => b.status !== 'cancelled');

  // 🟢 V1 manual rent — a "Pay Your Rent" card per active lease. Shows
  // the landlord's bKash/Nagad/Rocket/Bank account + QR, one-click copy,
  // and the "I Have Paid" / "Upload Proof" submission flow.
  const rentPaySection = activeLeases.length > 0 ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Wallet size={15} /></div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-gray-800 leading-tight">{language === 'বাংলা' ? 'ভাড়া পরিশোধ করুন' : 'Pay Your Rent'}</h3>
          <p className="text-[10px] font-bold text-gray-400 leading-tight">{language === 'বাংলা' ? 'এই মাসের ভাড়া ও পেমেন্ট তথ্য' : "This month's rent & payment details"}</p>
        </div>
      </div>
      {/* Single column — each card now lives in a half-width outer
          column (paired with "Your Bookings"), so it stacks its cards. */}
      <div className="grid grid-cols-1 gap-4">
        {activeLeases.map((b) => (
          <div key={b.id || b._id} id={`payment-${b.id || b._id}`}>
            <TenantRentPay booking={b} submissions={rentSubmissions} onSubmitted={refreshRentData} />
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const leaseBanner = activeLeases.length > 0 ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><KeyRound size={14} /></div>
        <h3 className="text-sm font-black text-gray-800">{language === 'বাংলা' ? 'আপনার বুকিং / লিজ' : 'Your Bookings'}</h3>
        <span className="text-[10px] font-black text-gray-400 tabular-nums">{activeLeases.length}</span>
      </div>
      {/* One box per booking. A single booking fills the column; 2+
          tile into a 2-up grid so they read as distinct boxes. */}
      <div className={`grid gap-3 ${activeLeases.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {activeLeases.map((b) => {
          const fresh = isFreshBooking(b);
          return (
            <div key={b.id || b._id} className={`relative bg-white rounded-2xl p-4 border shadow-sm transition-all ${fresh ? 'border-indigo-200 ring-2 ring-indigo-100' : 'border-gray-100'}`}>
              {fresh && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-md">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />{language === 'বাংলা' ? 'নতুন' : 'New'}
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Home size={16} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 truncate">{b.property || (language === 'বাংলা' ? 'আপনার ভাড়া' : 'Your rental')}</p>
                  {b.location && <p className="text-[10px] font-bold text-gray-400 truncate flex items-center gap-1"><MapPin size={9} /> {b.location}</p>}
                </div>
              </div>
              <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50/70 rounded-lg px-2.5 py-1.5 mb-3">
                {language === 'বাংলা' ? 'আপনার হোস্ট একটি বুকিং তৈরি করেছেন।' : 'Your host created a booking for you.'}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ভাড়া' : 'Rent'}</p>
                  <p className="text-xs font-black text-gray-900 tabular-nums">৳{(Number(b.monthlyRent) || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'অ্যাডভান্স' : 'Advance'}</p>
                  <p className="text-xs font-black text-gray-900 tabular-nums">৳{(Number(b.advancePayment) || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'মেথড' : 'Method'}</p>
                  <p className="text-[10px] font-black text-gray-900 truncate">{b.paymentMethod || '—'}</p>
                </div>
              </div>
              {/* No end date = ongoing tenancy — show the move-in date instead
                  of hiding the line entirely. */}
              {b.leaseStart && (
                <p className="text-[10px] font-bold text-gray-400 mt-2.5 flex items-center gap-1.5">
                  <Calendar size={11} />
                  {b.leaseEnd
                    ? `${fmtLeaseDate(b.leaseStart)} – ${fmtLeaseDate(b.leaseEnd)}`
                    : `${fmtLeaseDate(b.leaseStart)} – ${language === 'বাংলা' ? 'চলমান' : 'ongoing'}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  const bn = language === 'বাংলা';
  const receiptsThisYear = paymentReceipts.filter((r) => r.monthKey?.startsWith(`${payYear}-`)).length;

  // ── Page hero header — removed per user request ──

  // ── Payment Summary — compact purple KPI card (Paid / Outstanding /
  //    Next Due). Replaces the old full-width blue banner and sits
  //    beside the booking card so the row reads as a balanced pair. ──
  const summaryKpis = [
    {
      label: bn ? `${payYear} সালে পরিশোধ` : `Paid in ${payYear}`,
      value: `৳${paidThisYear.toLocaleString(bn ? 'bn-BD' : 'en-IN')}`,
      sub: `${receiptsThisYear} ${bn ? 'রিসিট' : 'receipts'} • ${unreadReceiptsCount} ${bn ? 'নতুন' : 'new'}`,
      Icon: Wallet,
      valueClass: '',
    },
    {
      label: bn ? 'বাকি' : 'Outstanding',
      value: `৳${outstanding.toLocaleString(bn ? 'bn-BD' : 'en-IN')}`,
      sub: partialCount > 0 ? `${partialCount} ${bn ? 'মাসে আংশিক' : 'months partial'}` : (bn ? 'সব পরিশোধিত' : 'Fully up to date'),
      Icon: FileText,
      valueClass: outstanding > 0 ? 'text-rose-200' : '',
    },
    {
      label: bn ? 'পরবর্তী বকেয়া' : 'Next Due',
      value: nextDue ? (nextDue.monthLabel || nextDue.monthKey) : (bn ? 'কিছু বাকি নেই' : 'Nothing due'),
      sub: nextDue ? `৳${(nextDue.balance || 0).toLocaleString(bn ? 'bn-BD' : 'en-IN')}` : (bn ? 'আপনি আপ-টু-ডেট!' : "You're all set!"),
      Icon: Calendar,
      valueClass: '',
      small: true,
    },
  ];

  // Payment Summary card. `full` lays the three KPIs out horizontally
  // (used when there are no bookings and the card spans the whole
  // width, so it never looks sparse); otherwise they stack vertically
  // to sit in the narrow column beside the booking(s).
  const renderSummaryCard = (full) => (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 text-white shadow-[0_20px_45px_-20px_rgba(79,70,229,0.6)] p-5 md:p-6 h-full flex flex-col">
      <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <h3 className="relative text-base md:text-lg font-black mb-4">{bn ? 'পেমেন্ট সামারি' : 'Payment Summary'}</h3>
      <div className={`relative flex-1 ${full ? 'grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6' : 'space-y-3.5'}`}>
        {summaryKpis.map((k, i) => (
          <React.Fragment key={k.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.16em] text-white/60">{k.label}</p>
                <p className={`font-black tabular-nums leading-tight mt-0.5 ${k.small ? 'text-base md:text-lg truncate' : 'text-xl md:text-2xl'} ${k.valueClass}`}>{k.value}</p>
                <p className="text-[10px] font-bold text-white/60 mt-0.5">{k.sub}</p>
              </div>
              {!full && <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><k.Icon size={16} /></div>}
            </div>
            {!full && i < summaryKpis.length - 1 && <div className="h-px bg-white/15" />}
          </React.Fragment>
        ))}
      </div>
      {nextDue && (
        <button
          onClick={() => { setActiveReceipt(nextDue); markReceiptRead(nextDue.id); }}
          className="relative mt-4 w-full inline-flex items-center justify-center gap-1.5 bg-white text-indigo-700 py-2.5 rounded-xl text-[11px] font-black active:scale-95 transition-all shadow-md hover:shadow-lg"
        >
          {bn ? 'রিসিট দেখুন' : 'Open receipt'} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );

  const bookingSummaryRow = leaseBanner ? (
    <div className="w-full">
      {leaseBanner}
    </div>
  ) : null;

  // ── Trust footer — reassures the tenant their data is safe. ──────
  const securityFooter = (
    <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100/70 px-5 py-4 flex items-center gap-3.5">
      <div className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0"><ShieldCheck size={20} className="text-indigo-600" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-gray-900 flex items-center gap-1.5">{bn ? 'আপনার সব পেমেন্ট সুরক্ষিত' : 'All your payments are secure'} <CheckCircle2 size={14} className="text-emerald-500" /></p>
        <p className="text-[11px] font-bold text-gray-500 mt-0.5">{bn ? 'আপনার লেনদেন এনক্রিপ্টেড ও রিসিট নিরাপদে সংরক্ষিত।' : 'Your transactions are encrypted and receipts are stored safely.'}</p>
      </div>
      <Lock size={18} className="text-indigo-300 shrink-0 hidden sm:block" />
    </div>
  );

  // ── Floating Payment Summary Tab ──
  const floatingSummaryTab = (
    <>
      {!summaryOpen && (
        <button
          onClick={() => setSummaryOpen(true)}
          className="fixed right-0 top-[60%] -translate-y-1/2 z-[60] rounded-l-2xl overflow-hidden bg-white border border-r-0 border-gray-100 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.4)] active:scale-95 transition"
          aria-label={bn ? 'পেমেন্ট সামারি খুলুন' : 'Open Payment Summary'}
        >
          <span className="flex flex-col items-center gap-1 bg-gradient-to-b from-[#ba0036] to-[#d4004a] text-white px-2.5 py-3">
            <Calendar size={17} />
            <span className="text-[9px] font-black uppercase tracking-wide leading-none text-center">
              {bn ? 'সামারি' : 'SUMMARY'}
            </span>
          </span>
          <span className="block px-2 py-2 text-center text-[10.5px] font-black text-[#ba0036]">
            {bn ? 'দেখুন' : 'VIEW'}
          </span>
        </button>
      )}

      {summaryOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-[2px] animate-in fade-in">
          {/* Close backdrop area */}
          <div className="absolute inset-0" onClick={() => setSummaryOpen(false)} />
          {/* Side panel */}
          <div className="relative w-full max-w-sm h-full flex flex-col justify-center p-4 md:p-6 animate-in slide-in-from-right duration-300">
             <div className="relative w-full h-[85vh] max-h-[600px] flex flex-col">
               <button onClick={() => setSummaryOpen(false)} className="absolute -top-3 -left-3 z-10 w-8 h-8 bg-white text-gray-600 rounded-full flex items-center justify-center shadow-lg border border-gray-100 hover:scale-105 active:scale-95 transition-all"><X size={16}/></button>
               {renderSummaryCard(false)}
             </div>
          </div>
        </div>
      )}
    </>
  );

  // empty state — no receipts at all (still show any booking banner)
  if (paymentReceipts.length === 0) {
    return (
      <div className="animate-in fade-in duration-500 space-y-4 md:space-y-5">
        {rentPaySection}
        {leaseBanner}
        <div className="text-center py-24 bg-white/40 backdrop-blur-md rounded-[3rem] border border-white shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Receipt className="text-blue-400" size={36} />
          </div>
          <h3 className="text-xl font-black text-gray-500 mb-2">
            {language === 'বাংলা' ? 'কোনো পেমেন্ট রিসিট নেই' : 'No payment receipts yet'}
          </h3>
          <p className="text-sm font-bold text-gray-400 mb-2 max-w-md mx-auto leading-relaxed">
            {language === 'বাংলা'
              ? 'বাড়িওয়ালা ভাড়া পেমেন্ট আপডেট করলে এখানে স্বয়ংক্রিয়ভাবে রিসিট চলে আসবে।'
              : 'When your landlord updates a rent payment, the receipt will appear here automatically.'}
          </p>
        </div>
        {securityFooter}
        {floatingSummaryTab}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-4 md:space-y-5">
      {/* ─── ROW 1: Pay Your Rent / payment status (full width) ─── */}
      {rentPaySection}

      {/* ─── ROW 2: Your Booking (left) + Payment Summary (right) ─── */}
      {bookingSummaryRow}

      {/* ─── PAYMENT HISTORY CARD — the month navigator + search now
          live in one clean white card (was scattered on the page). ─── */}
      <div className="bg-white rounded-2xl md:rounded-[1.75rem] border border-gray-100 shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-3 md:p-6 space-y-3 md:space-y-4">

      {/* ─── PAYMENT HISTORY HEADER ─────────────────────────── */}
      <div className="flex items-center gap-2.5 px-1 pt-1">
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Receipt size={15} /></div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-gray-800 leading-tight">{language === 'বাংলা' ? 'পেমেন্ট হিস্ট্রি' : 'Payment history'}</h3>
          <p className="text-[10px] font-bold text-gray-400 leading-tight">{language === 'বাংলা' ? 'রিসিট ফিল্টার করতে মাসে ট্যাপ করুন' : 'Tap a month to filter your receipts'}</p>
        </div>
      </div>

      {/* ─── YEAR SWITCHER + RESET MONTH ───────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mr-1">
          {language === 'বাংলা' ? 'বছর' : 'Year'}
        </span>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => { setPayYear(y); setPayMonth(null); }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black tabular-nums transition-all active:scale-95 ${
              y === payYear
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
            }`}
          >
            {y}
          </button>
        ))}
        <span className="hidden md:inline-block ml-auto text-[10px] font-bold text-gray-400">
          {payMonth
            ? `${monthNames[Number(payMonth) - 1]} ${payYear}`
            : (language === 'বাংলা' ? `${payYear} সালের সব মাস` : `All months in ${payYear}`)}
        </span>
        {payMonth && (
          <button
            onClick={() => setPayMonth(null)}
            className="ml-auto md:ml-0 inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-[10px] font-black active:scale-95 transition-all"
          >
            <X size={10} /> {language === 'বাংলা' ? 'সব মাস' : 'Clear month'}
          </button>
        )}
      </div>

      {/* ─── MONTH STRIP (12 chips, scrollable on small screens) ─
          Status per chip: full / partial / empty (no receipt).
          Current month gets a subtle ring. Click → filter list. */}
      {/* All 12 months tile as a grid — NO horizontal scroll on mobile
          (4 per row on phones → 6 on sm → all 12 in one row on lg). The
          compact chips let the tenant see the whole year at a glance. */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5 md:gap-2">
        {monthNames.map((label, i) => {
          const mm = String(i + 1).padStart(2, '0');
          const list = buckets[mm] || [];
          const paid = list.reduce((s, r) => s + (r.totalPaid || 0), 0);
          const due = list.reduce((s, r) => s + (r.balance || 0), 0);
          const hasAny = list.length > 0;
          const isFull = hasAny && due <= 0;
          const isPartial = hasAny && due > 0;
          const isActive = payMonth === mm;
          const isCurrent = `${payYear}-${mm}` === thisMonthKey;
          return (
            <button
              key={mm}
              onClick={() => setPayMonth(isActive ? null : mm)}
              className={`relative text-left p-2 md:p-3 rounded-xl md:rounded-2xl border transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900 shadow-lg'
                  : isFull
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:border-emerald-300'
                    : isPartial
                      ? 'bg-amber-50 text-amber-800 border-amber-100 hover:border-amber-300'
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
              } ${isCurrent && !isActive ? 'ring-2 ring-[#ba0036]/30' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wide md:tracking-widest opacity-80">{label}</span>
                {isFull && <CheckCheck size={10} className={`shrink-0 ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`} />}
                {isPartial && <Hourglass size={10} className={`shrink-0 ${isActive ? 'text-amber-300' : 'text-amber-600'}`} />}
              </div>
              <div className="mt-0.5 md:mt-1.5 text-[10px] md:text-[11px] font-black tabular-nums truncate">
                {hasAny ? `৳${paid.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-IN')}` : '—'}
              </div>
              {isPartial && (
                <div className={`hidden md:block text-[9px] font-bold mt-0.5 truncate ${isActive ? 'text-amber-200' : 'text-amber-700'}`}>
                  {language === 'বাংলা' ? 'বাকি' : 'Due'} ৳{due.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-IN')}
                </div>
              )}
              {isCurrent && (
                <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-1.5 h-1.5 rounded-full bg-[#ba0036] animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── PROPERTY FILTER + SEARCH + MARK READ ─────────── */}
      <div className="flex flex-col md:flex-row gap-2.5 md:gap-3 md:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={paySearch}
            onChange={(e) => setPaySearch(e.target.value)}
            placeholder={language === 'বাংলা' ? 'প্রপার্টি, মাস বা রিসিট খুঁজুন…' : 'Find a receipt by property, month or amount…'}
            className="w-full bg-white pl-10 pr-4 py-3 rounded-2xl text-[12px] font-bold text-gray-700 placeholder:text-gray-400 border border-gray-100 focus:border-[#ba0036] focus:ring-4 focus:ring-[#ba0036]/10 outline-none transition-all"
          />
        </div>
        {(properties.length > 1 || unreadReceiptsCount > 0) && (
          <div className="flex items-center gap-2.5">
            {properties.length > 1 && (
              <div className="relative flex-1 md:flex-none">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={payProperty}
                  onChange={(e) => setPayProperty(e.target.value)}
                  className="w-full appearance-none bg-white pl-9 pr-9 py-3 rounded-2xl text-[12px] font-black text-gray-700 border border-gray-100 focus:border-[#ba0036] focus:ring-4 focus:ring-[#ba0036]/10 outline-none transition-all"
                >
                  <option value="all">{language === 'বাংলা' ? 'সব প্রপার্টি' : 'All properties'}</option>
                  {properties.map(([id, title]) => (
                    <option key={id} value={id}>{title}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
            {unreadReceiptsCount > 0 && (
              <button
                onClick={markAllReceiptsRead}
                className="shrink-0 px-4 py-3 bg-white border border-gray-100 hover:border-[#ba0036] hover:text-[#ba0036] text-gray-600 rounded-2xl text-[11px] font-black shadow-sm transition-all active:scale-95 whitespace-nowrap"
              >
                {language === 'বাংলা' ? 'সব পড়া' : 'Mark all read'}
              </button>
            )}
          </div>
        )}
      </div>

      </div>{/* ── end Payment History card ── */}

      {/* ─── FILTERED RECEIPT GRID ─────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-[2rem] border border-gray-100">
          <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Search className="text-gray-400" size={22} />
          </div>
          <p className="text-sm font-black text-gray-500 mb-1">
            {language === 'বাংলা' ? 'এই ফিল্টারে কিছু পাওয়া যায়নি' : 'No receipts match this filter'}
          </p>
          <p className="text-[11px] font-bold text-gray-400">
            {language === 'বাংলা' ? 'অন্য মাস, বছর বা প্রপার্টি বেছে নিন' : 'Try a different month, year or property'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 lg:gap-4">
          {filtered.map(r => {
            const isFull = r.status === 'full' || r.balance <= 0;
            const { date: rDate, time: rTime } = fmtReceiptDateTime(r, language);
            return (
              <button
                id={`receipt-${r.id}`}
                key={r.id}
                onClick={() => { setActiveReceipt(r); markReceiptRead(r.id); }}
                className={`text-left bg-white/80 backdrop-blur-xl p-2.5 md:p-4 rounded-xl md:rounded-2xl border shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.99] relative overflow-hidden ${
                  !r.read ? 'border-[#ba0036]/30 ring-2 ring-[#ba0036]/10' : 'border-gray-100'
                }`}
              >
                {/* Status-tinted halo */}
                <div className={`absolute -bottom-12 -right-12 w-40 h-40 rounded-full blur-3xl pointer-events-none ${
                  isFull ? 'bg-blue-200/30' : 'bg-amber-200/30'
                }`} />

                {!r.read && (
                  <span className="absolute top-2.5 right-2.5 md:top-4 md:right-4 inline-flex items-center gap-1 bg-[#ba0036] text-white text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-widest shadow-md z-10">
                    <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-white rounded-full animate-pulse"></span>
                    {language === 'বাংলা' ? 'নতুন' : 'New'}
                  </span>
                )}

                {/* Header */}
                <div className="relative z-10 flex items-start gap-2 md:gap-3 mb-2.5 md:mb-4">
                  <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                    isFull ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                  }`}>
                    {isFull ? <CheckCheck className="w-4 h-4 md:w-[22px] md:h-[22px]" strokeWidth={3} /> : <Hourglass className="w-4 h-4 md:w-[22px] md:h-[22px]" strokeWidth={2.5} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] md:text-base font-black text-gray-900 leading-tight truncate">{r.propertyTitle}</p>
                    <p className="text-[10px] md:text-[11px] font-bold text-gray-500 mt-0.5 flex items-center gap-1 md:gap-1.5">
                      <Calendar size={10} className="text-gray-400 shrink-0" />
                      <span className="truncate">{r.monthLabel || r.monthKey}</span>
                    </p>
                    {(rDate || rTime) && (
                      <span className="hidden md:inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black tabular-nums">
                        <Clock size={11} className="shrink-0" />
                        {language === 'বাংলা' ? 'গৃহীত' : 'Received'}
                        {rDate ? ` ${rDate}` : ''}{rTime ? ` • ${rTime}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body — price block */}
                <div className={`relative z-10 rounded-xl md:rounded-2xl p-2.5 md:p-3 lg:p-4 mb-2.5 md:mb-3 border ${
                  isFull
                    ? 'bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border-blue-100/60'
                    : 'bg-gradient-to-br from-amber-50/80 to-orange-50/60 border-amber-100/60'
                }`}>
                  <div className="flex items-center justify-between gap-1 mb-1 md:mb-1.5">
                    <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      {language === 'বাংলা' ? 'পেইড' : 'Paid'}
                    </span>
                    <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-1.5 md:px-2 py-0.5 rounded-md shrink-0 ${
                      isFull ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isFull
                        ? (language === 'বাংলা' ? 'পূর্ণ' : 'FULL')
                        : (language === 'বাংলা' ? 'আংশিক' : 'PARTIAL')}
                    </span>
                  </div>
                  <p className={`text-lg md:text-2xl lg:text-xl xl:text-2xl font-black flex items-center gap-1.5 leading-none tabular-nums tracking-tight ${
                    isFull
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent'
                      : 'bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-transparent'
                  }`}>
                    ৳{(r.totalPaid || 0).toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-IN')}
                    {isFull && <CheckCheck className="hidden lg:block w-[18px] h-[18px] text-blue-600 shrink-0" strokeWidth={3} />}
                  </p>
                  <div className="flex flex-col gap-0.5 mt-1.5 md:mt-2 text-[10px] md:text-[11px] font-bold text-gray-500">
                    <span className="truncate">{language === 'বাংলা' ? 'মোট বকেয়া' : 'Total Due'}: ৳{(r.totalDue || 0).toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-IN')}</span>
                    <span className={`shrink-0 ${r.balance > 0 ? 'text-[#ba0036]' : 'text-green-600'}`}>
                      {language === 'বাংলা' ? 'বাকি' : 'Balance'}: {r.balance > 0 ? `৳${r.balance.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-IN')}` : '✓'}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-1 text-[10px] md:text-[11px] font-bold">
                  <span className="text-gray-400 flex items-center gap-1 md:gap-1.5 min-w-0">
                    <CreditCard size={11} className="text-gray-400 shrink-0" />
                    <span className="truncate">#{r.id?.slice(-6)}</span>
                  </span>
                  <span className="text-[#ba0036] flex items-center gap-1 group shrink-0">
                    {language === 'বাংলা' ? 'দেখুন' : 'View'} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── SECURITY / TRUST FOOTER ─── */}
      {securityFooter}
      {floatingSummaryTab}
    </div>
  );
};

export default PaymentsTab;
