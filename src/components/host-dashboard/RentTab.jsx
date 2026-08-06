import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, LayoutGrid, Building, Building2, MessageSquare, Calendar,
  Settings, HelpCircle, Plus, PlusCircle, Search, Bell, Filter, ArrowUpDown,
  Edit3, PauseCircle, PlayCircle, FileText, MapPin, Globe, CheckCircle2,
  X, CreditCard, MoreVertical, Download, Trash2, MessageCircle, Archive,
  Send, Paperclip, Smile, Mail, Shield, ShieldCheck, LogOut, BadgeCheck, Camera, Check,
  Hourglass, Upload, User, UserCircle, Image as ImageIcon, CheckCircle, ScanFace, Zap,
  BellRing, Folder, Scale, ClipboardCheck, Receipt, UploadCloud, ArrowLeft,
  File, Eye, FileEdit, Megaphone, FileSpreadsheet, Phone, Bot, CheckCheck, Video,
  Activity, TrendingUp, Crown, Lock, Sparkles, DollarSign, Wallet,
  XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MinusCircle,
  Banknote, ArrowRight, ArrowUpRight, Clock, Smartphone,
  BellOff, CalendarRange, BarChart3,
  Bed, Bath, Maximize2, Sofa, Trash, ImagePlus, BedDouble, Home, Utensils, Users, Coffee, Map, Leaf
} from 'lucide-react';
import MembersManager from "../MembersManager.jsx";

// Month labels for the 12-month rent matrix cells. Kept local to this file so
// the tab renders standalone — the parent has its own copy for other tabs.
const MONTH_NAMES_EN_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_BN_SHORT = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্ট','অক্টো','নভে','ডিসে'];


export default function RentTab(props) {
  const {
    today, bookings, language, searchQuery, setSearchQuery, rentPriorityFilter, setRentPriorityFilter,
    expandedRentId, setExpandedRentId, activeDropdownId, setActiveDropdownId,
    handleCallUser, resolveTenantUserId, setActiveTab, t, openMarkPaid, ledgerYear, setLedgerYear,
    rentUnitsOf, getMonthCollectionSummary, enumerateLeaseMonths, getRentStatus, monthKey,
    monthFullLabel, monthShortLabel, getDueDate, parseMonthKey, formatBDT, formatDate,
    computeBookingStatus, daysUntilNextDue, computeLeaseStage,
    sendRentReminder, openTenantProfile, openChatPanel, setActiveModal, exportRentCsv, isPremium
  } = props;

          const todayDate = today;
          // Rent Collection counts one unit per occupant: expand each booking
          // into its active members (each carrying their split share + own
          // ledger), so the KPI hero + overdue list are per person and match the
          // per-roommate cards below.
          const rentUnits = bookings.flatMap(rentUnitsOf);
          const sm = getMonthCollectionSummary(rentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
          const collectedPct = sm.expectedTotal > 0 ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100)) : 0;
          const yearMonths = Array.from({ length: 12 }, (_, i) => monthKey(ledgerYear, i + 1));
          // Bucket tenants by their CURRENT-month rent state — drives the
          // priority filter pills + per-row status badge. Aligned with the
          // matrix vocabulary so colours stay consistent across the tab.
          const tenantBucket = (booking) => {
            const months = enumerateLeaseMonths(booking.leaseStart, booking.leaseEnd);
            if (!months.includes(sm.key)) return 'none';
            const entry = booking.ledger?.[sm.key];
            if (entry?.paid) {
              const isPartial = entry.status === 'partial' || (Number(entry.balance) || 0) > 0;
              return isPartial ? 'partial' : 'cleared';
            }
            const due = getDueDate(sm.key, booking.rentDueDay);
            if (entry?.status === 'due' || (due && todayDate > due)) return 'overdue';
            return 'upcoming';
          };
          const matchesQuery = (b) => b.tenant.toLowerCase().includes(searchQuery.toLowerCase()) || b.property.toLowerCase().includes(searchQuery.toLowerCase());

          // Year scope: a booking belongs to the selected ledger year when its
          // lease term overlaps that year. Bad/missing dates fall back to
          // "included" so a parse error never hides real data.
          const leaseTouchesYear = (b, year) => {
            const sy = new Date(b.leaseStart).getFullYear();
            const ey = new Date(b.leaseEnd).getFullYear();
            if (Number.isNaN(sy) || Number.isNaN(ey)) return true;
            return sy <= year && year <= ey;
          };
          const viewingPastYear = ledgerYear < today.getFullYear();
          // Base list for the year: overlaps the picked year, not cancelled, and
          // — for the current/future year — not an already-ended (expired) lease.
          // Ended tenants therefore drop off the live Rent Collection view, but
          // stay visible when the host reviews a past year they were active in.
          const yearBookings = bookings.filter(b => {
            if (b.status === 'cancelled') return false;
            if (!leaseTouchesYear(b, ledgerYear)) return false;
            if (!viewingPastYear && computeLeaseStage(b, today) === 'done') return false;
            return true;
          });
          // One card per occupant: expand each in-scope booking into its active
          // members (each carrying their divided share + own ledger). Bookings
          // without members render as a single card exactly as before.
          const rentRows = yearBookings.flatMap(rentUnitsOf);
          const filteredBookings = rentRows.filter(b => {
            if (!matchesQuery(b)) return false;
            if (rentPriorityFilter === 'all') return true;
            return tenantBucket(b) === rentPriorityFilter;
          });
          const counts = rentRows.reduce((acc, b) => { const k = tenantBucket(b); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
          // Auto-pin: overdue + partial when filter is "all" — the rows the
          // host actually needs to do something about.
          const attentionRent = rentPriorityFilter === 'all'
            ? filteredBookings.filter(b => { const k = tenantBucket(b); return k === 'overdue' || k === 'partial'; })
            : [];
          const otherRent = rentPriorityFilter === 'all'
            ? filteredBookings.filter(b => { const k = tenantBucket(b); return k !== 'overdue' && k !== 'partial'; })
            : filteredBookings;

          // Coloured palette per current-month bucket — re-used across the
          // avatar gradient, status pill, and progress bar.
          const bucketTheme = {
            cleared:  { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'CLEARED', icon: <CheckCircle2 size={10} strokeWidth={3}/>, bar: 'bg-emerald-500', avatar: 'bg-gradient-to-br from-emerald-500 to-green-600' },
            partial:  { cls: 'bg-amber-50 text-amber-700 border-amber-100',       label: language === 'বাংলা' ? 'আংশিক' : 'PARTIAL',     icon: <Hourglass size={10} strokeWidth={3}/>,    bar: 'bg-amber-500',   avatar: 'bg-gradient-to-br from-amber-500 to-orange-500' },
            overdue:  { cls: 'bg-rose-50 text-rose-700 border-rose-100',          label: language === 'বাংলা' ? 'বকেয়া' : 'OVERDUE',     icon: <AlertCircle size={10} strokeWidth={3}/>,  bar: 'bg-rose-500',    avatar: 'bg-gradient-to-br from-rose-500 to-red-600' },
            upcoming: { cls: 'bg-orange-50 text-orange-700 border-orange-100',    label: language === 'বাংলা' ? 'আসন্ন' : 'UPCOMING',    icon: <Clock size={10} strokeWidth={3}/>,        bar: 'bg-orange-400',  avatar: 'bg-gradient-to-br from-[#ba0036] to-[#ff004c]' },
            none:     { cls: 'bg-gray-100 text-gray-600 border-gray-200',         label: language === 'বাংলা' ? 'লিজের বাইরে' : 'OUTSIDE', icon: <MinusCircle size={10} strokeWidth={3}/>, bar: 'bg-gray-300',    avatar: 'bg-gradient-to-br from-gray-400 to-gray-500' },
          };

          // ── RENDER ONE COMPACT ROW (collapsed-by-default accordion) ────
          // Collapsed: avatar + tenant + property + ৳outstanding + status pill + chevron (~76px tall)
          // Expanded: collapsed header + this-month ledger panel + 12-month matrix + per-month rows + actions
          //
          // `forceOpen` (set by the list mapping when ≤ AUTO_EXPAND_THRESHOLD
          // tenants match) skips the tap-to-toggle behaviour and the chevron
          // entirely — every row renders fully expanded on first paint and
          // stays that way. Hosts with a handful of tenants get a static,
          // fully-readable layout instead of accordion friction.
          const renderRentRow = (booking, forceOpen = false) => {
            const bucket = tenantBucket(booking);
            const theme = bucketTheme[bucket];
            const leaseMonths = enumerateLeaseMonths(booking.leaseStart, booking.leaseEnd);
            const monthEntry = booking.ledger?.[sm.key];
            const monthInLease = leaseMonths.includes(sm.key);
            const expectedThisMonth = monthInLease ? Number(booking.monthlyRent || 0) : 0;
            const paidThisMonth = monthEntry?.paid ? Number(monthEntry.amount || 0) : 0;
            const balanceThisMonth = Math.max(0, expectedThisMonth - paidThisMonth);
            const nextDue = daysUntilNextDue(booking, todayDate);
            const status = computeBookingStatus(booking, todayDate);
            const paidThisYear = yearMonths.filter(k => booking.ledger?.[k]?.paid).length;
            const monthsThisYearInLease = yearMonths.filter(k => leaseMonths.includes(k)).length;
            const isExpanded = forceOpen || expandedRentId === booking.id;
            const collectedPctRow = expectedThisMonth > 0 ? Math.min(100, Math.round((paidThisMonth / expectedThisMonth) * 100)) : 0;

            // Show the REAL occupant. When a tenant joins the room via invite
            // code they become a member; the booking's original `tenant` (typed
            // at creation) can go stale — e.g. the card shows "Mahin" while the
            // person on the booking is "Mofizul Islam". Prefer the primary active
            // member's name + avatar so Rent Collection matches the Bookings tab.
            const rentMembers = Array.isArray(booking.members) ? booking.members.filter(m => m && m.status !== 'moved-out') : [];
            const primaryMember = rentMembers[0] || null;
            const displayTenant = String(primaryMember?.name || booking.tenant || (language === 'বাংলা' ? 'ভাড়াটিয়া' : 'Tenant')).trim();
            const displayAvatar = primaryMember?.avatar || booking.tenantAvatar || '';
            const displayInit = (displayTenant[0] || '?').toUpperCase();
            const extraMembers = Math.max(0, rentMembers.length - 1);

            return (
              <div id={`rent-${booking.id}`} key={booking.id} className={`bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100/80 overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-[0_8px_30px_rgba(0,0,0,0.08)]' : 'hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)]'}`}>

                {/* ── Compact row — always visible. Click-to-toggle suppressed in forceOpen mode. ── */}
                <button
                  type="button"
                  onClick={forceOpen ? undefined : () => setExpandedRentId(isExpanded ? null : booking.id)}
                  className={`w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 text-left transition-colors ${forceOpen ? 'cursor-default' : 'hover:bg-gray-50/50'}`}
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-black text-[11px] sm:text-xs shrink-0 ${theme.avatar} overflow-hidden`}>
                    {displayAvatar ? (
                      <img src={displayAvatar} alt={displayTenant} className="w-full h-full object-cover" />
                    ) : (
                      displayInit
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-[13px] sm:text-sm font-black text-gray-900 truncate">{displayTenant}</h4>
                      {extraMembers > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-gray-100 text-gray-600 border border-gray-200 shrink-0 tabular-nums" title={language === 'বাংলা' ? 'আরও সদস্য' : 'more members'}>+{extraMembers}</span>
                      )}
                      {booking.floorNumber && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0 inline-flex items-center gap-0.5">
                          {language === 'বাংলা' ? 'ফ্লোর' : 'Floor'} {booking.floorNumber}
                        </span>
                      )}
                      {/* Residential / Commercial property badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 inline-flex items-center gap-0.5 ${booking.dealType === 'commercial' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {booking.dealType === 'commercial'
                          ? (<>🏢<span> {language === 'বাংলা' ? 'কমার্শিয়াল' : 'Commercial'}</span></>)
                          : (<>🏠<span> {language === 'বাংলা' ? 'আবাসিক' : 'Residential'}</span></>)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 inline-flex items-center gap-0.5 ${theme.cls}`}>
                        {theme.icon} <span className="hidden sm:inline">{theme.label}</span>
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-gray-500 truncate">
                      <span className="text-emerald-600 font-black">{booking.property}</span>
                      {booking.roomNumber && (
                        <>
                          <span className="mx-1 text-gray-300">·</span>
                          {language === 'বাংলা' ? 'রুম' : 'Room'} {booking.roomNumber}
                        </>
                      )}
                      {monthInLease && (
                        <>
                          <span className="mx-1 text-gray-300">·</span>
                          {bucket === 'cleared'
                            ? <span className="text-emerald-600 tabular-nums">{formatBDT(paidThisMonth)} {language === 'বাংলা' ? 'পেইড' : 'paid'}</span>
                            : bucket === 'partial'
                              ? <span className="text-amber-600 tabular-nums">{formatBDT(balanceThisMonth)} {language === 'বাংলা' ? 'বাকি' : 'due'}</span>
                              : bucket === 'overdue'
                                ? <span className="text-rose-600 tabular-nums">{formatBDT(expectedThisMonth)} {language === 'বাংলা' ? 'বকেয়া' : 'overdue'}</span>
                                : <span className="text-gray-600 tabular-nums">{formatBDT(expectedThisMonth)} {language === 'বাংলা' ? 'আসন্ন' : 'upcoming'}</span>}
                          {nextDue && (
                            <>
                              <span className="mx-1 text-gray-300">·</span>
                              <span className={`${nextDue.daysFromNow < 0 ? 'text-rose-600' : nextDue.daysFromNow <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                                {nextDue.daysFromNow < 0 ? `${Math.abs(nextDue.daysFromNow)}d late` : nextDue.daysFromNow === 0 ? 'today' : `${nextDue.daysFromNow}d`}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 mr-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest tabular-nums">{paidThisYear}/{monthsThisYearInLease || 12}</span>
                    <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${collectedPctRow}%` }}/>
                    </div>
                  </div>
                  {!forceOpen && (
                    <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 text-gray-400">
                      {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </div>
                  )}
                </button>

                {/* ── Expanded body — ledger panel + 12-month matrix ───── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/40 px-3 sm:px-4 py-4 animate-in slide-in-from-top-2 fade-in duration-300">

                    {/* Every rent card — flat / single-room / hostel — uses the
                        SAME classic ledger layout so Rent Collection looks
                        uniform. Per-seat management stays on the Bookings tab. */}

                    {/* This-month ledger panel — totals + progress + edit */}
                    <div className="bg-white rounded-2xl p-3.5 border border-gray-100">
                      <div className="flex items-center justify-between mb-2.5 gap-2">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest truncate">
                          {language === 'বাংলা' ? 'এই মাস' : 'This Month'} · {monthFullLabel(sm.key, language)}
                        </p>
                        {monthInLease && (
                          <button
                            onClick={() => openMarkPaid(booking, sm.key)}
                            className="px-2.5 py-1 rounded-lg bg-[#ba0036] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#90002a] transition-colors flex items-center gap-1 shrink-0"
                          >
                            <Edit3 size={10} strokeWidth={3}/> {monthEntry?.paid ? (language === 'বাংলা' ? 'এডিট' : 'Edit') : (language === 'বাংলা' ? 'মার্ক পেইড' : 'Mark Paid')}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'মোট ডিউ' : 'Due'}</p>
                          <p className="text-xs sm:text-sm font-black text-gray-900 tabular-nums mt-0.5">{formatBDT(expectedThisMonth)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'পেইড' : 'Paid'}</p>
                          <p className="text-xs sm:text-sm font-black text-emerald-600 tabular-nums mt-0.5">{formatBDT(paidThisMonth)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বাকি' : 'Balance'}</p>
                          <p className={`text-xs sm:text-sm font-black tabular-nums mt-0.5 ${balanceThisMonth > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{formatBDT(balanceThisMonth)}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
                             style={{ width: expectedThisMonth > 0 ? `${(paidThisMonth / expectedThisMonth) * 100}%` : '0%' }} />
                      </div>
                    </div>

                    {/* Year stepper (inline) — lets the host browse other years */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex bg-white p-1 rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] items-center gap-0.5">
                        <button onClick={() => setLedgerYear(y => y - 1)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50" aria-label="Prev year">
                          <ArrowLeft size={12} />
                        </button>
                        <span className="px-2 text-[11px] font-black text-gray-900 tabular-nums">{ledgerYear}</span>
                        <button onClick={() => setLedgerYear(y => y + 1)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50" aria-label="Next year">
                          <ArrowRight size={12} />
                        </button>
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest tabular-nums">{paidThisYear}/{monthsThisYearInLease || 12} {language === 'বাংলা' ? 'মাস' : 'months'}</span>
                    </div>

                    {/* 12-month rent grid — the headline feature */}
                    <div className="mt-2 bg-white p-2.5 rounded-2xl border border-gray-100">
                      <div className="grid grid-cols-12 gap-1">
                        {yearMonths.map(k => {
                          const inLease = leaseMonths.includes(k);
                          const cellStatus = inLease ? getRentStatus(booking, k, todayDate) : 'before-lease';
                          const entry = booking.ledger?.[k];
                          const isCurrent = k === monthKey(todayDate.getFullYear(), todayDate.getMonth() + 1);
                          // Tooltip — surfaces sub-status (full/partial/due) on hover.
                          const tooltip = inLease
                            ? (entry?.paid
                                ? (cellStatus === 'partial'
                                    ? `${monthFullLabel(k, language)} · Partial ${formatBDT(entry.amount)} / ${formatBDT(booking.monthlyRent)} · Balance ${formatBDT(entry.balance)} · ${formatDate(entry.paidOn, language)}`
                                    : `${monthFullLabel(k, language)} · Paid ${formatBDT(entry.amount)} ${formatDate(entry.paidOn, language)}${entry.method ? ' (' + entry.method + ')' : ''}`)
                                : (cellStatus === 'due-marked'
                                    ? `${monthFullLabel(k, language)} · Marked due${entry?.dueNote ? ' — ' + entry.dueNote : ''}`
                                    : `${monthFullLabel(k, language)} · ${cellStatus.replace('-', ' ')} · due ${formatDate(getDueDate(k, booking.rentDueDay)?.toISOString(), language)}`))
                            : `${monthFullLabel(k, language)} · ${language === 'বাংলা' ? 'লিজের বাইরে' : 'outside lease'}`;
                          // Colour vocabulary — matches the legend + tenant receipts.
                          const colorClass =
                            cellStatus === 'paid' ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.35)]' :
                            cellStatus === 'partial' ? 'bg-amber-400 text-white hover:bg-amber-500' :
                            cellStatus === 'due-marked' ? 'bg-red-500 text-white hover:bg-red-600' :
                            cellStatus === 'overdue' ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' :
                            cellStatus === 'due-soon' ? 'bg-orange-400 text-white hover:bg-orange-500' :
                            cellStatus === 'upcoming' ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' :
                            'bg-gray-50 text-gray-300 cursor-not-allowed border border-dashed border-gray-200';
                          return (
                            <button
                              key={k}
                              type="button"
                              title={tooltip}
                              disabled={!inLease}
                              onClick={(e) => { e.stopPropagation(); inLease && openMarkPaid(booking, k); }}
                              className={`relative aspect-square rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-tight transition-all flex flex-col items-center justify-center ${colorClass} ${isCurrent ? 'ring-2 ring-offset-1 ring-gray-900' : ''}`}
                            >
                              <span className="leading-none">{(language === 'বাংলা' ? MONTH_NAMES_BN_SHORT : MONTH_NAMES_EN_SHORT)[parseMonthKey(k).month - 1]}</span>
                              {cellStatus === 'paid' && <CheckCheck size={9} className="mt-0.5" strokeWidth={3} />}
                              {cellStatus === 'partial' && <Hourglass size={8} className="mt-0.5" strokeWidth={3} />}
                              {cellStatus === 'due-marked' && <AlertCircle size={8} className="mt-0.5" strokeWidth={3} />}
                            </button>
                          );
                        })}
                      </div>
                      {nextDue && status !== 'completed' && (
                        <div className="mt-2.5 flex items-center justify-end">
                          <p className={`text-[9px] font-black tracking-wide whitespace-nowrap shrink-0 px-2 py-1 rounded-lg ${nextDue.daysFromNow < 0 ? 'bg-red-50 text-red-600' : nextDue.daysFromNow <= (booking.reminderLeadDays || 3) ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                            <Clock size={10} className="inline -mt-0.5 mr-1" />
                            {nextDue.daysFromNow < 0
                              ? `${Math.abs(nextDue.daysFromNow)}d ${language === 'বাংলা' ? 'দেরি' : 'late'} · ${monthShortLabel(nextDue.key, language)}`
                              : nextDue.daysFromNow === 0
                                ? `${language === 'বাংলা' ? 'আজ ডিউ' : 'Due today'} · ${monthShortLabel(nextDue.key, language)}`
                                : `${language === 'বাংলা' ? 'ডিউ' : 'Due in'} ${nextDue.daysFromNow}d · ${monthShortLabel(nextDue.key, language)}`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action row — payment-focused */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const k = nextDue?.key || monthKey(todayDate.getFullYear(), todayDate.getMonth() + 1);
                            openMarkPaid(booking, k);
                          }}
                          className="px-2.5 py-2 bg-green-50 hover:bg-green-100 text-green-700 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} /> {language === 'বাংলা' ? 'পেইড মার্ক' : 'Mark Paid'}
                        </button>
                        {nextDue && nextDue.daysFromNow <= (booking.reminderLeadDays || 3) && (
                          <button onClick={() => sendRentReminder(booking, nextDue.key)} className="px-2.5 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 flex items-center gap-1">
                            <BellRing size={12}/> {language === 'বাংলা' ? 'রিমাইন্ডার' : 'Remind'}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Profile — opens the tenant's trust card (/tenant/:id). */}
                        <button
                          onClick={() => openTenantProfile(resolveTenantUserId(booking), { name: booking.tenant, avatar: booking.tenantAvatar })}
                          className="px-2.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 flex items-center gap-1"
                          title={language === 'বাংলা' ? 'টেন্যান্ট প্রোফাইল' : 'Tenant profile'}
                        >
                          <UserCircle size={12}/> {language === 'বাংলা' ? 'প্রোফাইল' : 'Profile'}
                        </button>
                        <button
                          onClick={() => openChatPanel(booking.chatId || `chat-${booking.id}`, { source: 'host-rent', peerUserId: resolveTenantUserId(booking), peerName: booking.tenant, peerAvatar: booking.tenantAvatar, tenantName: booking.tenant, tenantPhone: booking.tenantPhone, propertyTitle: booking.property })}
                          className="px-3 py-2 bg-gray-900 text-white hover:bg-[#ba0036] transition-all rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-md flex items-center gap-1.5"
                        >
                          <MessageCircle size={12}/> {language === 'বাংলা' ? 'মেসেজ' : 'Message'}
                        </button>
                      </div>
                    </div>

                    {/* Per-month ledger detail rows — collapsible secondary view */}
                    <details className="mt-3 group">
                      <summary className="cursor-pointer list-none flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100/60 transition-colors">
                        <ChevronDown size={12} className="text-gray-400 group-open:rotate-180 transition-transform"/>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          {language === 'বাংলা' ? `${ledgerYear} সালের বিবরণ` : `${ledgerYear} Ledger Details`}
                        </span>
                      </summary>
                      <div className="mt-2 space-y-1">
                        {yearMonths.filter(k => leaseMonths.includes(k)).map(k => {
                          const cellStatus = getRentStatus(booking, k, todayDate);
                          const entry = booking.ledger?.[k];
                          const due = getDueDate(k, booking.rentDueDay);
                          const dotClass =
                            cellStatus === 'paid' ? 'bg-blue-500' :
                            cellStatus === 'partial' ? 'bg-amber-400' :
                            cellStatus === 'due-marked' ? 'bg-red-500' :
                            cellStatus === 'overdue' ? 'bg-red-500' :
                            cellStatus === 'due-soon' ? 'bg-orange-400' : 'bg-gray-300';
                          return (
                            <div key={k} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-gray-100">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}></span>
                              <span className="text-[10px] font-black text-gray-900 w-14 sm:w-16 shrink-0 truncate">{monthShortLabel(k, language)}</span>
                              <span className="text-[9px] font-bold text-gray-500 hidden sm:inline w-20 shrink-0 truncate">{formatDate(due?.toISOString(), language)}</span>
                              <span className="text-[10px] font-bold flex-1 truncate">
                                {cellStatus === 'paid' && (
                                  <span className="text-blue-700 inline-flex items-center gap-1"><CheckCheck size={10} strokeWidth={3}/> {formatBDT(entry.amount || booking.monthlyRent)}{entry.method ? ` · ${entry.method}` : ''}</span>
                                )}
                                {cellStatus === 'partial' && (
                                  <span className="text-amber-700 inline-flex items-center gap-1"><Hourglass size={10} strokeWidth={3}/> {language === 'বাংলা' ? 'বাকি' : 'Bal'} {formatBDT(entry.balance)}</span>
                                )}
                                {cellStatus === 'due-marked' && (
                                  <span className="text-red-600 inline-flex items-center gap-1"><AlertCircle size={10} strokeWidth={3}/> {language === 'বাংলা' ? 'বকেয়া' : 'Marked Due'}</span>
                                )}
                                {cellStatus === 'overdue' && (<span className="text-red-600">{language === 'বাংলা' ? 'বকেয়া' : 'Overdue'}</span>)}
                                {cellStatus === 'due-soon' && (<span className="text-orange-600">{language === 'বাংলা' ? 'শীঘ্রই' : 'Soon'}</span>)}
                                {cellStatus === 'upcoming' && (<span className="text-gray-500">{language === 'বাংলা' ? 'আসন্ন' : 'Upcoming'}</span>)}
                              </span>
                              {entry?.paid ? (
                                <button onClick={(e) => { e.stopPropagation(); openMarkPaid(booking, k); }} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 shrink-0" title="Edit"><Edit3 size={11}/></button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); openMarkPaid(booking, k); }} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${cellStatus === 'due-marked' ? 'bg-red-50 hover:bg-red-100 text-red-700' : 'bg-green-50 hover:bg-green-100 text-green-700'}`}>
                                  {cellStatus === 'due-marked' ? (language === 'বাংলা' ? 'এডিট' : 'Update') : (language === 'বাংলা' ? 'রেকর্ড' : 'Record')}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          };

          return (
          <div className="w-full animate-in fade-in zoom-in-95 duration-500">

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 xl:h-[calc(100vh-140px)] overflow-visible xl:overflow-hidden">

              {/* ── LEFT RAIL — full Shared Ledger ALWAYS visible (mobile + desktop) ── */}
              <aside className="xl:col-span-4 w-full flex flex-col gap-3 xl:gap-5 xl:h-full xl:overflow-y-auto custom-scrollbar xl:pt-1 xl:pb-4 xl:pr-1">

                {/* Shared Ledger hero — full KPI card, always visible. */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl xl:rounded-[2rem] p-5 xl:p-7 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] xl:shadow-[0_15px_40px_rgba(0,0,0,0.2)] relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                  <div className="flex items-start justify-between mb-1 relative z-10">
                    <h3 className="text-lg xl:text-2xl font-black">{language === 'বাংলা' ? 'শেয়ার্ড লেজার' : 'Shared Ledger'}</h3>
                    {isPremium ? (
                      <div className="bg-[#ba0036] text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md">
                         <Crown size={10} /> PRO
                      </div>
                    ) : (
                      <button onClick={() => setActiveModal('premium_gate')} className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                         <Lock size={10} /> Free
                      </button>
                    )}
                  </div>
                  <p className="text-white/50 text-[9px] xl:text-[10px] font-bold uppercase tracking-widest mb-4 xl:mb-7 relative z-10">
                    {monthFullLabel(sm.key, language)} · {language === 'বাংলা' ? 'এই মাসের আদায়' : "This Month's Collection"}
                  </p>
                  <div className="space-y-4 xl:space-y-6 relative z-10">
                    <div>
                      <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">{language === 'বাংলা' ? 'প্রত্যাশিত আয়' : 'Expected'}</p>
                      <p className="text-3xl xl:text-4xl font-black text-white tracking-tight tabular-nums">{formatBDT(sm.expectedTotal)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 xl:gap-4">
                      <div className="bg-white/5 rounded-xl xl:rounded-2xl p-2.5 xl:p-3">
                        <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">{language === 'বাংলা' ? 'আদায় হয়েছে' : 'Collected'}</p>
                        <p className="text-lg xl:text-xl font-black text-green-400 tracking-tight tabular-nums">{formatBDT(sm.collectedTotal)}</p>
                        <p className="text-[9px] text-white/60 font-bold mt-1">{sm.paidCount}/{sm.totalDueCount} {language === 'বাংলা' ? 'ভাড়াটিয়া' : 'tenants'}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl xl:rounded-2xl p-2.5 xl:p-3">
                        <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">{language === 'বাংলা' ? 'বাকি' : 'Outstanding'}</p>
                        <p className="text-lg xl:text-xl font-black text-orange-400 tracking-tight tabular-nums">{formatBDT(sm.outstandingTotal)}</p>
                        <p className="text-[9px] text-white/60 font-bold mt-1">
                          <span className={sm.overdueCount > 0 ? 'text-red-300' : 'text-white/60'}>
                            {sm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'overdue'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white/50 text-[9px] font-black uppercase tracking-widest">{language === 'বাংলা' ? 'কালেকশন রেট' : 'Collection Rate'}</span>
                        <span className="text-xs font-black text-white tabular-nums">{collectedPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300 transition-all duration-700"
                             style={{ width: `${collectedPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {sm.overdueTenants.length > 0 && (
                  <div className="bg-white rounded-2xl xl:rounded-[2rem] p-4 xl:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none shrink-0">
                    <div className="flex items-center justify-between mb-3 xl:mb-4">
                      <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500" />
                        {language === 'বাংলা' ? 'বকেয়া ভাড়াটিয়া' : 'Overdue Tenants'}
                      </h4>
                      <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-lg text-xs font-black tabular-nums">{sm.overdueTenants.length}</span>
                    </div>
                    <div className="space-y-2">
                      {sm.overdueTenants.slice(0, 4).map(b => (
                        <div key={b.id} className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                          <button onClick={() => setExpandedRentId(b.id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-[10px] font-black shrink-0">{b.tenantInit}</div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-gray-900 truncate">{b.tenant}</p>
                              <p className="text-[9px] font-bold text-gray-500 truncate tabular-nums">{formatBDT(b.monthlyRent)} · {b.property}</p>
                            </div>
                          </button>
                          <button onClick={() => sendRentReminder(b, sm.key)} className="shrink-0 p-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors" title="Send reminder">
                            <BellRing size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legend — desktop only. Hidden on mobile + iPad (below xl,
                    where the rail stacks on top of the list); shown only in the
                    xl sidebar layout so it doesn't crowd the smaller screens. */}
                <div className="hidden xl:block bg-white rounded-2xl xl:rounded-[2rem] p-4 xl:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none shrink-0">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">{language === 'বাংলা' ? 'লেজেন্ড' : 'Legend'}</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[10px] font-bold text-gray-600">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-blue-500 inline-block"></span>{language === 'বাংলা' ? 'পেইড' : 'Paid'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-400 inline-block"></span>{language === 'বাংলা' ? 'আংশিক' : 'Partial'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-red-500 inline-block"></span>{language === 'বাংলা' ? 'বকেয়া' : 'Overdue'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-orange-400 inline-block"></span>{language === 'বাংলা' ? 'শীঘ্রই' : 'Due soon'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-gray-100 inline-block"></span>{language === 'বাংলা' ? 'আসন্ন' : 'Upcoming'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-gray-50 inline-block border border-dashed border-gray-300"></span>{language === 'বাংলা' ? 'লিজের বাইরে' : 'Outside'}</span>
                  </div>
                </div>
              </aside>

              {/* ── RIGHT MAIN — main IS the scroll container; sticky toolbar pins inside it ── */}
              <main className="xl:col-span-8 w-full xl:h-full xl:overflow-y-auto custom-scrollbar pb-24 xl:pr-3 min-w-0">

                {/* Sticky toolbar — two rows. Row 1 = controls (title chip, year
                    stepper, search, export); Row 2 = the filter pills, which wrap
                    instead of scrolling sideways on mobile / iPad. */}
                <div className="sticky top-0 z-30 bg-gray-50/85 backdrop-blur-md -mx-3 sm:-mx-4 xl:mx-0 px-3 sm:px-4 xl:px-0 pt-2 pb-3 mb-2 xl:pt-1">
                  {/* Row 1 — controls: title chip, year stepper, search, export.
                      Filter pills live on their own wrapping row (Row 2) below so
                      nothing needs horizontal scrolling on mobile / iPad. */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Title corner chip — small, gray, with live count. */}
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/70 text-[9px] xl:text-[10px] font-black text-gray-700 uppercase tracking-widest shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <Wallet size={11} className="text-emerald-600"/>
                      <span className="hidden sm:inline">{language === 'বাংলা' ? 'রেন্ট' : 'Rent'}</span>
                      <span className="text-gray-400 tabular-nums">{filteredBookings.length}</span>
                    </span>
                    {/* Year stepper. */}
                    <div className="shrink-0 flex items-center gap-1 bg-white rounded-xl px-1 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                      <button onClick={() => setLedgerYear(y => y - 1)} className="p-1 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"><ChevronLeft size={12}/></button>
                      <span className="text-[11px] font-black text-gray-900 tabular-nums w-10 text-center">{ledgerYear}</span>
                      <button onClick={() => setLedgerYear(y => y + 1)} className="p-1 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"><ChevronRight size={12}/></button>
                    </div>
                    {/* Search input — grows to fill the rest of the row. */}
                    <div className="relative flex-1 min-w-0 xl:max-w-[220px]">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={language === 'বাংলা' ? 'খুঁজুন...' : 'Search tenants...'}
                        className="w-full pl-7 pr-2 py-2 rounded-xl bg-white text-[11px] font-bold text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent focus:border-gray-200 focus:outline-none placeholder:text-gray-400"
                      />
                    </div>
                    {/* Export action. */}
                    <button
                      onClick={() => exportRentCsv(filteredBookings, ledgerYear)}
                      className="shrink-0 px-3 py-2 bg-white text-gray-700 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-1.5 active:scale-95"
                      title={language === 'বাংলা' ? `${ledgerYear} সালের রেন্ট CSV` : `Export ${ledgerYear} rent as CSV`}
                    >
                      <FileSpreadsheet size={12}/> <span className="hidden sm:inline">{language === 'বাংলা' ? 'এক্সপোর্ট' : 'Export'}</span>
                    </button>
                  </div>
                  {/* Row 2 — priority filter pills on their own row. They WRAP
                      onto a second line on small screens so every filter
                      (Overdue / Partial / Upcoming / Cleared) is visible without
                      any sideways scrolling. */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    {[
                      { k: 'all',      label: language === 'বাংলা' ? 'সকল' : 'All',        cls: 'bg-gray-900 text-white' },
                      { k: 'overdue',  label: language === 'বাংলা' ? 'বকেয়া' : 'Overdue',  cls: 'bg-rose-600 text-white' },
                      { k: 'partial',  label: language === 'বাংলা' ? 'আংশিক' : 'Partial',  cls: 'bg-amber-500 text-white' },
                      { k: 'upcoming', label: language === 'বাংলা' ? 'আসন্ন' : 'Upcoming', cls: 'bg-orange-500 text-white' },
                      { k: 'cleared',  label: language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'Cleared', cls: 'bg-emerald-600 text-white' },
                    ].map(pill => (
                      <button
                        key={pill.k}
                        onClick={() => setRentPriorityFilter(pill.k)}
                        className={`shrink-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap inline-flex items-center gap-1 ${rentPriorityFilter === pill.k ? `${pill.cls} shadow-[0_2px_8px_rgba(0,0,0,0.15)]` : 'bg-white text-gray-500 hover:text-gray-900 shadow-[0_2px_6px_rgba(0,0,0,0.03)]'}`}
                      >
                        {pill.label}
                        {pill.k !== 'all' && counts[pill.k] > 0 && <span className={`tabular-nums ${rentPriorityFilter === pill.k ? 'opacity-90' : 'opacity-60'}`}>·{counts[pill.k]}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* List — compact rows. forceOpen auto-engages when filtered
                    list is ≤5; small portfolios get a fully-readable static
                    layout instead of accordion friction. */}
                {(() => {
                  const AUTO_EXPAND_THRESHOLD = 5;
                  const forceOpen = filteredBookings.length > 0 && filteredBookings.length <= AUTO_EXPAND_THRESHOLD;
                  if (filteredBookings.length === 0) {
                    return (
                      <div className="text-center py-20 bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border-none">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                           <Receipt className="text-gray-300" size={26} />
                        </div>
                        <h3 className="text-sm font-black text-gray-900">{language === 'বাংলা' ? 'এই ফিল্টারে কোনো ভাড়াটিয়া পাওয়া যায়নি।' : 'No tenants match this filter.'}</h3>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {rentPriorityFilter === 'all' && attentionRent.length > 0 ? (
                        <>
                          <div className="flex items-center gap-2 mt-1 px-1 pt-1">
                            <AlertCircle size={12} className="text-rose-600 shrink-0"/>
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">
                              {language === 'বাংলা' ? 'এখনই দরকার' : 'Needs Attention'} · {attentionRent.length}
                            </span>
                            <div className="flex-1 h-px bg-rose-200/60"/>
                          </div>
                          {attentionRent.map(b => renderRentRow(b, forceOpen))}
                          {otherRent.length > 0 && (
                            <div className="flex items-center gap-2 px-1 pt-3 pb-1">
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                {language === 'বাংলা' ? 'অন্যান্য' : 'All Other Tenants'} · {otherRent.length}
                              </span>
                              <div className="flex-1 h-px bg-gray-200"/>
                            </div>
                          )}
                          {otherRent.map(b => renderRentRow(b, forceOpen))}
                        </>
                      ) : (
                        filteredBookings.map(b => renderRentRow(b, forceOpen))
                      )}
                    </div>
                  );
                })()}
              </main>

            </div>
          </div>
  );
}
