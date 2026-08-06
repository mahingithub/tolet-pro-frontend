import React from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, BarChart3, Search, Phone, Send } from 'lucide-react';

const AnalyticsTab = ({
  today,
  ledgerYear,
  setLedgerYear,
  bookings,
  properties,
  searchQuery,
  setSearchQuery,
  rentPriorityFilter,
  setRentPriorityFilter,
  language,
  handleCallUser,
  openChatPanel,
  enumerateLeaseMonths,
  getDueDate,
  computeLeaseStage,
  formatBDT,
  monthShortLabel
}) => {
  const todayDate = today;
  const currentYear = todayDate.getFullYear();
  const ledgerScopeYear = ledgerYear;
  const yearMonths = Array.from({length: 12}, (_, i) => `${ledgerScopeYear}-${String(i+1).padStart(2,'0')}`);

  const scorecards = bookings.map((b) => {
    const leaseMonths = enumerateLeaseMonths(b.leaseStart, b.leaseEnd);
    const inLeaseYearMonths = yearMonths.filter(k => leaseMonths.includes(k));
    const cutoffIdx = ledgerScopeYear === currentYear ? todayDate.getMonth() : 11;
    const dueSoFar = inLeaseYearMonths.filter(k => {
      const [, mm] = k.split('-').map(Number);
      return (mm - 1) <= cutoffIdx;
    });
    const paidSoFar = dueSoFar.filter(k => b.ledger?.[k]?.paid).length;
    const partialSoFar = dueSoFar.filter(k => {
      const e = b.ledger?.[k];
      return e?.paid && Number(e?.amount || 0) > 0 && Number(e?.amount || 0) < Number(b.monthlyRent || 0);
    }).length;
    const overdueSoFar = dueSoFar.filter(k => {
      const e = b.ledger?.[k];
      if (e?.paid) return false;
      const due = getDueDate(k, b.rentDueDay);
      return due && todayDate > due;
    }).length;
    const score = dueSoFar.length ? Math.round((paidSoFar / dueSoFar.length) * 100) : 100;
    const ytdCollected = dueSoFar.reduce((sum, k) => {
      const e = b.ledger?.[k];
      return sum + (e?.paid ? Number(e?.amount || 0) : 0);
    }, 0);
    const ytdExpected = dueSoFar.length * Number(b.monthlyRent || 0);
    return {
      booking: b,
      score,
      paidSoFar,
      partialSoFar,
      overdueSoFar,
      dueSoFar: dueSoFar.length,
      ytdCollected,
      ytdExpected,
      activeInYear: inLeaseYearMonths.length > 0,
      bucket: score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 50 ? 'risk' : 'critical',
    };
  }).filter((c) => c.activeInYear);

  const totalRevenueYTD = scorecards.reduce((s, c) => s + c.ytdCollected, 0);
  const totalExpectedYTD = scorecards.reduce((s, c) => s + c.ytdExpected, 0);
  const collectionRate = totalExpectedYTD > 0
    ? Math.round((totalRevenueYTD / totalExpectedYTD) * 100)
    : 0;
  const activeLeases = bookings.filter(b => computeLeaseStage(b, todayDate) === 'active').length;
  const noticeLeases = bookings.filter(b => computeLeaseStage(b, todayDate) === 'notice').length;
  const draftLeases  = bookings.filter(b => computeLeaseStage(b, todayDate) === 'draft').length;
  const doneLeases   = bookings.filter(b => computeLeaseStage(b, todayDate) === 'done').length;
  const totalProperties = properties.length;
  const occupancyRate = totalProperties > 0
    ? Math.round(((activeLeases + noticeLeases) / totalProperties) * 100)
    : 0;
  const totalMonthlyRevenue = bookings
    .filter(b => ['active','notice'].includes(computeLeaseStage(b, todayDate)))
    .reduce((s, b) => s + Number(b.monthlyRent || 0), 0);
  const avgRentPerProperty = totalProperties > 0
    ? Math.round(totalMonthlyRevenue / totalProperties)
    : 0;

  const monthly = yearMonths.map((k, i) => {
    const collected = bookings.reduce((sum, b) => {
      const e = b.ledger?.[k];
      return sum + (e?.paid ? Number(e?.amount || 0) : 0);
    }, 0);
    const expected = bookings.reduce((sum, b) => {
      const leaseMonths = enumerateLeaseMonths(b.leaseStart, b.leaseEnd);
      return sum + (leaseMonths.includes(k) ? Number(b.monthlyRent || 0) : 0);
    }, 0);
    return { key: k, monthIdx: i, collected, expected };
  });
  const peakRevenue = Math.max(1, ...monthly.map(m => m.collected || m.expected));

  const analyticsFilter = rentPriorityFilter;
  const filteredCards = scorecards
    .filter(c => {
      if (analyticsFilter === 'all') return true;
      if (analyticsFilter === 'overdue') return c.overdueSoFar > 0;
      if (analyticsFilter === 'partial') return c.partialSoFar > 0 && c.overdueSoFar === 0;
      if (analyticsFilter === 'upcoming') return c.bucket === 'good';
      if (analyticsFilter === 'cleared')  return c.bucket === 'excellent';
      return true;
    })
    .filter(c => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return c.booking.tenant?.toLowerCase().includes(q)
          || c.booking.property?.toLowerCase().includes(q)
          || c.booking.tenantPhone?.toLowerCase().includes(q);
    })
    .sort((a, b) => b.score - a.score);

  const bucketBadge = {
    excellent: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: language === 'বাংলা' ? 'অসাধারণ' : 'Excellent', ring: 'ring-emerald-200' },
    good:      { dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    label: language === 'বাংলা' ? 'ভালো'      : 'Good',      ring: 'ring-blue-200' },
    risk:      { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   label: language === 'বাংলা' ? 'ঝুঁকিতে'   : 'Risk',      ring: 'ring-amber-200' },
    critical:  { dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50',    label: language === 'বাংলা' ? 'সঙ্কটাপন্ন' : 'Critical',  ring: 'ring-rose-200' },
  };

  const pill = (id, lbl, count) => (
    <button
      type="button"
      onClick={() => setRentPriorityFilter(id)}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
        analyticsFilter === id
          ? 'bg-gray-900 text-white border-gray-900 shadow-[0_4px_12px_rgba(0,0,0,0.18)]'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
      }`}
    >
      {lbl}
      <span className={`text-[9px] px-1.5 py-px rounded-full tabular-nums ${analyticsFilter === id ? 'bg-white/15' : 'bg-gray-100'}`}>{count}</span>
    </button>
  );

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 items-start">
        <aside className="xl:col-span-4 w-full flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <div className="relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white shadow-[0_20px_45px_rgba(15,23,42,0.35)]"
               style={{background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)'}}>
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-500/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-200">
                  {language === 'বাংলা' ? 'অ্যানালিটিক্স' : 'Analytics'}
                </p>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                  {language === 'বাংলা' ? 'পোর্টফোলিও পারফরম্যান্স' : 'Portfolio Performance'}
                </h3>
              </div>
              <div className="shrink-0 inline-flex items-center gap-1 bg-white/10 backdrop-blur rounded-full p-1 border border-white/15">
                <button
                  type="button"
                  onClick={() => setLedgerYear(y => y - 1)}
                  className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label="Previous year"
                >
                  <ChevronLeft size={14}/>
                </button>
                <span className="text-[11px] font-black tabular-nums px-2 min-w-[44px] text-center">{ledgerScopeYear}</span>
                <button
                  type="button"
                  onClick={() => setLedgerYear(y => y + 1)}
                  className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label="Next year"
                >
                  <ChevronRight size={14}/>
                </button>
              </div>
            </div>
            <div className="relative z-10 grid grid-cols-2 gap-2.5">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-indigo-200 mb-1">
                  {language === 'বাংলা' ? 'YTD আয়' : 'YTD Revenue'}
                </p>
                <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{formatBDT(totalRevenueYTD)}</p>
                <p className="text-[9px] font-bold text-emerald-300 mt-1 flex items-center gap-1">
                  <TrendingUp size={10}/> {language === 'বাংলা' ? `${collectionRate}% সংগৃহীত` : `${collectionRate}% collected`}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-indigo-200 mb-1">
                  {language === 'বাংলা' ? 'মাসিক রাজস্ব' : 'Monthly Revenue'}
                </p>
                <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{formatBDT(totalMonthlyRevenue)}</p>
                <p className="text-[9px] font-bold text-indigo-200 mt-1">
                  {language === 'বাংলা' ? `${activeLeases + noticeLeases} সক্রিয় লিজ` : `${activeLeases + noticeLeases} active leases`}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-indigo-200 mb-1">
                  {language === 'বাংলা' ? 'অকুপেন্সি' : 'Occupancy'}
                </p>
                <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{occupancyRate}%</p>
                <p className="text-[9px] font-bold text-indigo-200 mt-1 tabular-nums">
                  {activeLeases + noticeLeases}/{totalProperties} {language === 'বাংলা' ? 'প্রপার্টি' : 'units'}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-indigo-200 mb-1">
                  {language === 'বাংলা' ? 'গড় ভাড়া' : 'Avg Rent'}
                </p>
                <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{formatBDT(avgRentPerProperty)}</p>
                <p className="text-[9px] font-bold text-indigo-200 mt-1">
                  {language === 'বাংলা' ? 'প্রতি প্রপার্টি' : 'per property'}
                </p>
              </div>
            </div>
            <div className="relative z-10 mt-4 pt-4 border-t border-white/10">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-indigo-200 mb-2">
                {language === 'বাংলা' ? 'লিজ স্টেজ' : 'Lease Stages'}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-black tabular-nums">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>{activeLeases}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>{noticeLeases}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"/>{draftLeases}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-gray-300 border border-white/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"/>{doneLeases}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-[1.75rem] p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[12px] font-black text-gray-900 tracking-tight">
                {language === 'বাংলা' ? `মাসিক আয় - ${ledgerScopeYear}` : `Monthly Revenue · ${ledgerScopeYear}`}
              </h4>
              <span className="text-[8px] font-black uppercase tracking-[0.16em] text-gray-400">
                {language === 'বাংলা' ? 'প্রকৃত' : 'Actual'}
              </span>
            </div>
            <div className="h-40 flex items-end justify-between gap-1 relative">
              <div className="absolute inset-0 flex flex-col justify-between pb-0 pt-0 z-0 pointer-events-none">
                <div className="w-full h-px bg-gray-50"/>
                <div className="w-full h-px bg-gray-50"/>
                <div className="w-full h-px bg-gray-50"/>
                <div className="w-full h-px bg-gray-50"/>
              </div>
              {monthly.map((m, i) => {
                const isCurrent = m.key === `${currentYear}-${String(todayDate.getMonth()+1).padStart(2,'0')}`;
                const h = m.collected > 0 ? Math.max(6, Math.round((m.collected / peakRevenue) * 100)) : 4;
                const expectedH = m.expected > 0 ? Math.max(6, Math.round((m.expected / peakRevenue) * 100)) : 4;
                return (
                  <div key={m.key} className="flex flex-col items-center gap-1 flex-1 relative z-10 group cursor-default">
                    <span className="text-[8px] font-black tabular-nums text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap">{formatBDT(m.collected)}</span>
                    <div className="w-full max-w-[18px] relative" style={{height: '100%'}}>
                      <div className="absolute bottom-0 inset-x-0 rounded-t-md bg-gray-100" style={{height: `${expectedH}%`}}/>
                      <div className={`absolute bottom-0 inset-x-0 rounded-t-md transition-all duration-700 ${isCurrent ? 'bg-gradient-to-t from-[#ba0036] to-[#ff4d7a]' : 'bg-gradient-to-t from-indigo-500 to-violet-400'}`} style={{height: `${h}%`}}/>
                    </div>
                    <span className={`text-[8px] font-black tracking-widest uppercase ${isCurrent ? 'text-[#ba0036]' : 'text-gray-400'}`}>{monthShortLabel(m.key)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.16em] text-gray-400 mt-3 pt-3 border-t border-gray-100">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-indigo-500 to-violet-400"/>{language === 'বাংলা' ? 'সংগৃহীত' : 'Collected'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-gray-200"/>{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-[#ba0036] to-[#ff4d7a]"/>{language === 'বাংলা' ? 'এই মাস' : 'Now'}
              </span>
            </div>
          </div>
        </aside>
        <main className="xl:col-span-8 w-full flex flex-col xl:h-[calc(100vh-160px)] xl:overflow-y-auto xl:pr-2 custom-scrollbar bg-white rounded-[1.75rem] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 px-3 sm:px-4 py-2.5 rounded-t-[1.75rem]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">
                <BarChart3 size={11}/>{language === 'বাংলা' ? 'অ্যানালিটিক্স' : 'Analytics'}
              </span>
              <div className="flex-1 min-w-[140px] relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'বাংলা' ? 'ভাড়াটিয়া খুঁজুন...' : 'Search tenants...'}
                  className="w-full pl-7 pr-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-indigo-300 transition-colors"
                />
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-black tabular-nums">
                {filteredCards.length}<span className="text-gray-400">/{scorecards.length}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto -mx-1 px-1 pb-0.5 no-scrollbar">
              {pill('all',      language === 'বাংলা' ? 'সব'        : 'All',       scorecards.length)}
              {pill('cleared',  language === 'বাংলা' ? 'অসাধারণ'   : 'Excellent', scorecards.filter(c => c.bucket === 'excellent').length)}
              {pill('upcoming', language === 'বাংলা' ? 'ভালো'      : 'Good',      scorecards.filter(c => c.bucket === 'good').length)}
              {pill('partial',  language === 'বাংলা' ? 'আংশিক'     : 'Partial',   scorecards.filter(c => c.partialSoFar > 0 && c.overdueSoFar === 0).length)}
              {pill('overdue',  language === 'বাংলা' ? 'বকেয়া'    : 'Overdue',   scorecards.filter(c => c.overdueSoFar > 0).length)}
            </div>
          </div>
          <div className="flex-1 px-3 sm:px-4 py-3 space-y-2">
            {filteredCards.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="text-gray-300" size={22}/>
                </div>
                {bookings.length === 0 ? (
                  <>
                    <h3 className="text-sm font-black text-gray-900">
                      {language === 'বাংলা' ? 'কোনো ডেটা নেই' : 'No tenant data yet'}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 max-w-xs mx-auto">
                      {language === 'বাংলা' ? 'বুকিং তৈরি করলে এখানে স্কোরকার্ড আসবে।' : 'Create a booking and the scorecard will populate here.'}
                    </p>
                  </>
                ) : scorecards.length === 0 ? (
                  <>
                    <h3 className="text-sm font-black text-gray-900">
                      {language === 'বাংলা' ? `${ledgerScopeYear} সালে কোনো সক্রিয় ভাড়াটিয়া নেই` : `No active tenants in ${ledgerScopeYear}`}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 max-w-xs mx-auto">
                      {language === 'বাংলা' ? 'অন্য একটি বছর নির্বাচন করে দেখুন।' : 'Try selecting a different year.'}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-black text-gray-900">
                      {language === 'বাংলা' ? 'কোনো ফলাফল নেই' : 'No matching tenants'}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 max-w-xs mx-auto">
                      {language === 'বাংলা' ? 'ফিল্টার বা সার্চ পরিবর্তন করে দেখুন।' : 'Try changing the filter or search.'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredCards.map((c) => {
                const badge = bucketBadge[c.bucket];
                const init = c.booking.tenantInit || c.booking.tenant?.slice(0, 2).toUpperCase() || '?';
                const collectedPct = c.ytdExpected > 0 ? Math.round((c.ytdCollected / c.ytdExpected) * 100) : 0;
                return (
                  <div
                    key={c.booking.id}
                    className="group relative rounded-2xl border border-gray-100 hover:border-gray-200 bg-white hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all overflow-hidden"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${badge.dot}`}/>
                    <div className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3">
                      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-black overflow-hidden bg-gradient-to-br ${
                        c.bucket === 'excellent' ? 'from-emerald-500 to-green-600' :
                        c.bucket === 'good'      ? 'from-blue-500 to-indigo-600'   :
                        c.bucket === 'risk'      ? 'from-amber-500 to-orange-500'  :
                                                    'from-rose-500 to-red-600'
                      }`}>
                        {c.booking.tenantAvatar ? (
                          <img src={c.booking.tenantAvatar} alt={c.booking.tenant} className="w-full h-full object-cover" />
                        ) : (
                          init
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[12px] font-black text-gray-900 truncate">{c.booking.tenant}</p>
                          <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text} text-[8px] font-black uppercase tracking-widest`}>
                            <span className={`w-1 h-1 rounded-full ${badge.dot}`}/>{badge.label}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 truncate">{c.booking.property}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${
                              c.bucket === 'excellent' ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                              c.bucket === 'good'      ? 'bg-gradient-to-r from-blue-400 to-indigo-500'   :
                              c.bucket === 'risk'      ? 'bg-gradient-to-r from-amber-400 to-orange-500'  :
                                                          'bg-gradient-to-r from-rose-400 to-red-500'
                            }`} style={{width: `${Math.max(2, collectedPct)}%`}}/>
                          </div>
                          <span className={`shrink-0 text-[10px] font-black tabular-nums ${badge.text}`}>{c.score}%</span>
                        </div>
                      </div>
                      <div className="hidden sm:flex shrink-0 flex-col items-end gap-0.5 text-right">
                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-gray-400">
                          {language === 'বাংলা' ? `YTD সংগ্রহ` : `YTD Collected`}
                        </p>
                        <p className="text-[12px] font-black text-gray-900 tabular-nums">{formatBDT(c.ytdCollected)}</p>
                        <p className="text-[9px] font-bold text-gray-400 tabular-nums">
                          {c.paidSoFar}/{c.dueSoFar} {language === 'বাংলা' ? 'মাস' : 'months'}
                          {c.overdueSoFar > 0 && <span className="ml-1 text-rose-500">• {c.overdueSoFar} {language === 'বাংলা' ? 'বকেয়া' : 'overdue'}</span>}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCallUser(c.booking.tenantId, c.booking.tenant, c.booking.tenantAvatar)}
                          className="p-2 rounded-xl bg-gray-50 hover:bg-emerald-600 text-gray-500 hover:text-white transition-colors active:scale-95"
                          title={language === 'বাংলা' ? 'কল' : 'Call tenant'}
                        >
                          <Phone size={13}/>
                        </button>
                        <button
                          type="button"
                          onClick={() => openChatPanel(c.booking.chatId || `chat-${c.booking.id}`, {
                            source: 'host-analytics',
                            peerUserId: c.booking.tenantId,
                            peerName: c.booking.tenant,
                            peerAvatar: c.booking.tenantAvatar,
                            bookingId: c.booking.id,
                            tenantName: c.booking.tenant,
                            tenantPhone: c.booking.tenantPhone,
                            propertyTitle: c.booking.property,
                            prefillMessage: c.overdueSoFar > 0
                              ? (language === 'বাংলা' ? `হাই ${c.booking.tenant}, ${c.overdueSoFar} মাসের ভাড়া বকেয়া আছে। দয়া করে পরিশোধের তারিখ জানান।` : `Hi ${c.booking.tenant}, you have ${c.overdueSoFar} overdue month${c.overdueSoFar > 1 ? 's' : ''}. Could you confirm your next payment date?`)
                              : '',
                          })}
                          className="p-2 rounded-xl bg-gray-50 hover:bg-gray-900 text-gray-500 hover:text-white transition-colors active:scale-95"
                          title={language === 'বাংলা' ? 'মেসেজ' : 'Message tenant'}
                        >
                          <Send size={13}/>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AnalyticsTab;
