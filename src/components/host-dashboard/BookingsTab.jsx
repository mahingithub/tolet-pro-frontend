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


export default function BookingsTab(props) {
  const {
    today, bookings, language, searchQuery, setSearchQuery, leaseStageFilter, setLeaseStageFilter,
    expandedBookingId, setExpandedBookingId, activeDropdownId, setActiveDropdownId,
    confirmDeleteBookingId, setConfirmDeleteBookingId, handleCallUser, resolveTenantUserId,
    setActiveTab, setExpandedRentId, downloadAgreement, t, showToast, toggleAutoReminder,
    openTenantProfile, openChatPanel, openModal, isPremium, openBlankLease, setActiveModal,
    handleBookingUpdated,
    getLeaseSummary, computeLeaseStage, isLeaseEndingSoon, leaseDaysLeft, openTenantChangeLease,
    formatBDT, daysUntilNextDue, computeBookingProgress,
    isHostelBooking, formatDate, stageLabel
  } = props;

          const isBn = language === 'বাংলা';
          const todayDate = today;
          const leaseSummary = getLeaseSummary(bookings, todayDate);
          const matchesSearch = (b) => b.tenant.toLowerCase().includes(searchQuery.toLowerCase()) || b.property.toLowerCase().includes(searchQuery.toLowerCase());
          // Only 'active' and 'done' are real stages now. `leaseStageFilter` is
          // shared with the Documents tab (which reuses the same state for its
          // own pills), so anything we don't recognise falls back to "All"
          // rather than silently rendering an empty list.
          const stageFilter = (leaseStageFilter === 'active' || leaseStageFilter === 'done') ? leaseStageFilter : 'all';
          const filtered = bookings.filter(b => {
            const stage = computeLeaseStage(b, todayDate);
            return (stageFilter === 'all' || stage === stageFilter) && matchesSearch(b);
          });
          // Stage → coloured pill class for the compact row badge. Two stages
          // only (active | done); a live lease inside its renewal window gets
          // the amber treatment without being a stage of its own.
          const stageBadge = (stage, endingSoon) => {
            if (stage === 'active') {
              return endingSoon
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-green-50 text-green-700 border-green-100';
            }
            return 'bg-gray-100 text-gray-600 border-gray-200';
          };
          // "Needs Attention" group — live leases whose term runs out within the
          // next 30 days, so the host can renew or line up the next tenant before
          // the unit sits empty. Only auto-pinned on the "All" filter; picking a
          // specific filter renders a flat list instead.
          const attentionLeases = filtered.filter(b => isLeaseEndingSoon(b, todayDate));
          const otherLeases     = filtered.filter(b => !isLeaseEndingSoon(b, todayDate));

          // ── RENDER ONE COMPACT ROW (collapsed-by-default accordion) ────
          // Collapsed: avatar + tenant + property + ৳rent + stage pill + next-due chip + chevron (~76px tall on mobile)
          // Expanded: collapsed header + 4-tile financial breakdown + 3-tile lease term + progress bar + auto-reminder + actions
          //
          // `forceOpen` (set by the list mapping when ≤ AUTO_EXPAND_THRESHOLD
          // rows match) skips the tap-to-toggle behaviour and the chevron
          // entirely — the row renders fully expanded on first paint and
          // stays that way. Small portfolios get a static, fully-readable
          // layout instead of accordion friction.
          const renderBookingRow = (booking, forceOpen = false) => {
            const stage = computeLeaseStage(booking, todayDate);
            const endingSoon = isLeaseEndingSoon(booking, todayDate);
            const daysLeft = leaseDaysLeft(booking, todayDate);
            const progress = computeBookingProgress(booking, todayDate);
            const progressBar = stage !== 'active' ? 'bg-gray-400' : endingSoon ? 'bg-amber-500' : 'bg-green-500';
            const next = daysUntilNextDue(booking, todayDate);
            const monthlyTotal = Number(booking.monthlyRent || 0) + Number(booking.serviceCharge || 0);
            const tenantsLabel = (booking.tenantsCount || 1) === 1
              ? (language === 'বাংলা' ? '১ ভাড়াটিয়া' : '1 Tenant')
              : (language === 'বাংলা' ? `${booking.tenantsCount} ভাড়াটিয়া` : `${booking.tenantsCount} Tenants`);
            const isExpanded = forceOpen || expandedBookingId === booking.id;
            // HOSTEL bookings are identified by the PROPERTY (house · room · floor),
            // NOT a tenant — the tenants are the per-seat rent boxes inside. Other
            // formats keep the tenant name as the card title.
            const hostelBooking = isHostelBooking(booking);
            const roomLabelTxt = booking.roomNumber ? `${language === 'বাংলা' ? 'রুম' : 'Room'} ${booking.roomNumber}` : '';
            const cardTitle = hostelBooking ? [booking.property, roomLabelTxt].filter(Boolean).join(' · ') : booking.tenant;
            const cardSubLead = hostelBooking ? (booking.floorNumber ? `${language === 'বাংলা' ? 'ফ্লোর' : 'Floor'} ${booking.floorNumber}` : tenantsLabel) : booking.property;
            const cardAvatarText = hostelBooking ? ((booking.property || 'H').trim()[0] || 'H').toUpperCase() : booking.tenantInit;
            const stageAvatar = stage !== 'active' ? 'bg-gradient-to-br from-gray-400 to-gray-500'
                              : endingSoon ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                              : 'bg-gradient-to-br from-green-500 to-emerald-600';

            return (
              <div id={`booking-${booking.id}`} key={booking.id} className={`bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100/80 overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-[0_8px_30px_rgba(0,0,0,0.08)]' : 'hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)]'}`}>

                {/* Compact row — always visible. Click-to-toggle suppressed in
                    forceOpen mode. Rendered as a div (not a <button>) so the 3-dot
                    actions menu can live at the header's top-right without nesting
                    a button inside a button. */}
                <div
                  role={forceOpen ? undefined : 'button'}
                  tabIndex={forceOpen ? undefined : 0}
                  onClick={forceOpen ? undefined : () => setExpandedBookingId(isExpanded ? null : booking.id)}
                  onKeyDown={forceOpen ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedBookingId(isExpanded ? null : booking.id); } }}
                  className={`w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 text-left transition-colors ${forceOpen ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50/50'}`}
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-black text-[11px] sm:text-xs shrink-0 ${stageAvatar} overflow-hidden`}>
                    {(!hostelBooking && booking.tenantAvatar) ? (
                      <img src={booking.tenantAvatar} alt={booking.tenant} className="w-full h-full object-cover" />
                    ) : (
                      cardAvatarText
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-[13px] sm:text-sm font-black text-gray-900 truncate">{cardTitle}</h4>
                      {booking.dealType === 'commercial' && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-violet-200 bg-violet-50 text-violet-700 shrink-0">
                          🏢 {language === 'বাংলা' ? 'কমার্শিয়াল' : 'Commercial'}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 ${stageBadge(stage, endingSoon)}`}>
                        {stageLabel(stage, language)}
                      </span>
                      {/* Renewal window chip — the lease is live but runs out
                          soon, so the host can renew or line up the next tenant. */}
                      {endingSoon && daysLeft != null && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-amber-200 bg-amber-100 text-amber-800 shrink-0 tabular-nums">
                          {daysLeft === 0 ? (isBn ? 'আজ শেষ' : 'ends today') : (isBn ? `${daysLeft}দিন বাকি` : `${daysLeft}d left`)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-gray-500 truncate">
                      {cardSubLead} <span className="mx-0.5 text-gray-300">·</span> <span className="tabular-nums">{formatBDT(monthlyTotal)}</span>
                      {next && (
                        <>
                          <span className="mx-0.5 text-gray-300">·</span>
                          <span className={`${next.daysFromNow < 0 ? 'text-rose-600' : next.daysFromNow <= (booking.reminderLeadDays || 3) ? 'text-amber-600' : 'text-gray-500'}`}>
                            {next.daysFromNow < 0 ? `${Math.abs(next.daysFromNow)}d ${language === 'বাংলা' ? 'দেরি' : 'late'}` : next.daysFromNow === 0 ? (language === 'বাংলা' ? 'আজ' : 'today') : `${next.daysFromNow}d`}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  {/* Progress mini-bar — desktop, COLLAPSED only. Hidden once
                      expanded (the body already shows the full Lease Progress bar),
                      freeing the top-right corner for the 3-dot menu. */}
                  <div className={`flex-col items-end gap-0.5 shrink-0 mr-1 ${isExpanded ? 'hidden' : 'hidden sm:flex'}`}>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest tabular-nums">{progress}%</span>
                    <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${progressBar}`} style={{ width: `${progress}%` }}/>
                    </div>
                  </div>
                  {/* 3-dot actions menu — top-right of the card, next to the profile
                      photo/name. Shown when the lease is expanded. stopPropagation
                      keeps opening it from toggling the row; it opens downward into
                      the (tall) body so the card's overflow never clips it. */}
                  {isExpanded && (
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdownId(activeDropdownId === booking.id ? null : booking.id)}
                        className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all border border-gray-100"
                        title={language === 'বাংলা' ? 'আরও অ্যাকশন' : 'More actions'}
                      >
                        <MoreVertical size={16}/>
                      </button>
                      {activeDropdownId === booking.id && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white shadow-[0_15px_40px_rgba(0,0,0,0.12)] rounded-2xl p-1.5 z-[50] animate-in fade-in zoom-in-95 origin-top-right border border-gray-100">
                          {/* Tenant change — the outgoing tenant left, so hand
                              this unit to the next one. Carries the whole unit
                              over; the host only edits name + phone. */}
                          <button onClick={() => openTenantChangeLease(booking)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-xs font-bold text-gray-700 hover:text-emerald-700 transition-colors text-left"><RefreshCw size={14}/> {isBn ? 'নতুন ভাড়াটিয়া · নতুন লিজ' : 'New Tenant · New Lease'}</button>
                          <button onClick={() => { handleCallUser(resolveTenantUserId(booking), booking.tenant, booking.tenantAvatar); setActiveDropdownId(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 text-xs font-bold text-gray-700 hover:text-blue-600 transition-colors text-left"><Phone size={14}/> {language === 'বাংলা' ? 'কল করুন' : 'Call Tenant'}</button>
                          <button onClick={() => { setActiveTab('rent'); setExpandedRentId(booking.id); setActiveDropdownId(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-xs font-bold text-gray-700 hover:text-emerald-600 transition-colors text-left"><Receipt size={14}/> {language === 'বাংলা' ? 'রেন্ট লেজার' : 'Rent Ledger'}</button>
                          <button onClick={() => { downloadAgreement(booking); setActiveDropdownId(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors text-left"><Download size={14}/> {language === 'বাংলা' ? 'অ্যাগ্রিমেন্ট ডাউনলোড' : 'Download Agreement'}</button>
                          <div className="h-px w-full bg-gray-100 my-1"></div>
                          <button onClick={() => { setActiveDropdownId(null); setConfirmDeleteBookingId(booking.id); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-xs font-bold text-red-600 transition-colors text-left"><Trash2 size={14}/> {t?.remove || (language === 'বাংলা' ? 'লিজ রিমুভ' : 'Remove Lease')}</button>
                        </div>
                      )}
                    </div>
                  )}
                  {!forceOpen && (
                    <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 text-gray-400">
                      {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </div>
                  )}
                </div>

                {/* Expanded body — full agreement details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/40 px-3 sm:px-4 py-4 animate-in slide-in-from-top-2 fade-in duration-300">

                    {/* Location + commercial terms — ONE horizontal row on every
                        device. Pills never wrap or change position: on a narrow
                        phone (iPhone 14 / Pixel 7 / Galaxy) the text just shrinks,
                        and the row scrolls sideways only if the license number is
                        too long to fit. Same layout & positions across all sizes. */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-3 overflow-x-auto no-scrollbar">
                      {booking.location && (
                        <div className="shrink-0 px-2 sm:px-2.5 py-1 bg-white border border-gray-100 rounded-lg text-[9px] sm:text-[10px] font-bold text-gray-600 inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                          <MapPin size={11} className="text-[#ba0036] shrink-0"/> {booking.location}
                        </div>
                      )}
                      {booking.dealType === 'commercial' ? (
                        <>
                          {booking.commercialTerms?.businessName && (
                            <span className="shrink-0 px-2 sm:px-2.5 py-1 bg-violet-50 border border-violet-100 rounded-lg text-[9px] sm:text-[10px] font-black text-violet-700 inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">🏢 {booking.commercialTerms.businessName}</span>
                          )}
                          {Number(booking.commercialTerms?.leaseTermMonths) > 0 && (
                            <span className="shrink-0 px-2 sm:px-2.5 py-1 bg-white border border-gray-100 rounded-lg text-[9px] sm:text-[10px] font-black text-gray-700 inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">{language === 'বাংলা' ? 'মেয়াদ' : 'Term'}: {booking.commercialTerms.leaseTermMonths}{language === 'বাংলা' ? ' মাস' : 'mo'}</span>
                          )}
                          {booking.commercialTerms?.licenseNumber && (
                            <span className="shrink-0 px-2 sm:px-2.5 py-1 bg-white border border-gray-100 rounded-lg text-[9px] sm:text-[10px] font-bold text-gray-600 inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">{language === 'বাংলা' ? 'লাইসেন্স' : 'License'}: {booking.commercialTerms.licenseNumber}</span>
                          )}
                        </>
                      ) : (
                        <div className="shrink-0 px-2 sm:px-2.5 py-1 bg-white border border-gray-100 rounded-lg text-[9px] sm:text-[10px] font-black text-gray-700 inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                          <User size={11}/> {tenantsLabel}
                        </div>
                      )}
                    </div>

                    {/* Financial breakdown — Monthly Rent / Service / Deposit / Total.
                        Full-responsive: a spacious 2×2 grid on phones so every tile
                        stays readable (no cramped 4-across squeeze), then a single
                        row of 4 from the sm breakpoint up (tablet · desktop) to match
                        the wide card. Padding + font stay generous at all sizes. */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                      <div className="bg-white rounded-xl p-3 border border-gray-100 min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">{language === 'বাংলা' ? 'মাসিক ভাড়া' : 'Monthly Rent'}</p>
                        <p className="text-sm font-black text-gray-900 tabular-nums mt-1 leading-tight">{formatBDT(booking.monthlyRent)}</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">{language === 'বাংলা' ? 'সার্ভিস' : 'Service'}</p>
                        <p className="text-sm font-black text-gray-900 tabular-nums mt-1 leading-tight">{formatBDT(booking.serviceCharge || 0)}</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">{language === 'বাংলা' ? 'ডিপোজিট (অগ্রিম)' : 'Deposit (Advance)'}</p>
                        <p className="text-sm font-black text-gray-900 tabular-nums mt-1 leading-tight">{formatBDT(booking.advancePayment || 0)}</p>
                        {booking.paymentMethod ? (
                          <span className="mt-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 max-w-full">
                            <CreditCard size={10} strokeWidth={3} className="shrink-0"/> <span className="truncate">{booking.paymentMethod}</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="bg-gradient-to-br from-[#ba0036]/5 to-[#ff004c]/5 border border-[#ba0036]/10 rounded-xl p-3 min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-black text-[#ba0036] uppercase tracking-widest leading-tight">{language === 'বাংলা' ? 'মোট মাসিক' : 'Total/mo'}</p>
                        <p className="text-sm font-black text-[#ba0036] tabular-nums mt-1 leading-tight">{formatBDT(monthlyTotal)}</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-1 leading-tight">{language === 'বাংলা' ? 'ভাড়া + সার্ভিস' : 'Rent + Service'}</p>
                      </div>
                    </div>

                    {/* Advance money is shown in the "Deposit (Advance)" tile above. */}

                    {/* Lease term — Move-In · Next Payment · Lease Expiry.
                        3 columns on EVERY width (matches the mobile card design)
                        instead of stacking to one column on phones. */}
                    <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-3">
                      <div className="rounded-xl p-2 sm:p-2.5 border border-gray-100 bg-white min-w-0">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={9} className="shrink-0"/> <span className="truncate">{language === 'বাংলা' ? 'মুভ-ইন' : 'Move-In'}</span></p>
                        <p className="text-[10px] sm:text-xs font-black text-gray-900 mt-0.5">{formatDate(booking.leaseStart, language)}</p>
                      </div>
                      <div className="rounded-xl p-2 sm:p-2.5 border border-gray-100 bg-white min-w-0">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Clock size={9} className="shrink-0"/> <span className="truncate">{language === 'বাংলা' ? 'পরবর্তী পেমেন্ট' : 'Next Payment'}</span></p>
                        <p className="text-[10px] sm:text-xs font-black text-gray-900 mt-0.5">
                          {next ? formatDate(next.due.toISOString(), language) : (language === 'বাংলা' ? 'বকেয়া নেই' : 'No upcoming')}
                        </p>
                        {next && (
                          <p className={`text-[9px] font-bold mt-0.5 ${next.daysFromNow < 0 ? 'text-rose-600' : next.daysFromNow <= (booking.reminderLeadDays || 3) ? 'text-amber-600' : 'text-gray-500'}`}>
                            {next.daysFromNow < 0 ? `${Math.abs(next.daysFromNow)}d ${language === 'বাংলা' ? 'দেরি' : 'late'}` : next.daysFromNow === 0 ? (language === 'বাংলা' ? 'আজ ডিউ' : 'Due today') : `${language === 'বাংলা' ? 'বাকি' : 'In'} ${next.daysFromNow}d`}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl p-2 sm:p-2.5 border border-gray-100 bg-white min-w-0">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><CalendarRange size={9} className="shrink-0"/> <span className="truncate">{language === 'বাংলা' ? 'লিজ এক্সপায়ারি' : 'Lease Expiry'}</span></p>
                        <p className="text-[10px] sm:text-xs font-black text-gray-900 mt-0.5">{formatDate(booking.leaseEnd, language)}</p>
                      </div>
                    </div>

                    {/* Lease progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'লিজের অগ্রগতি' : 'Lease Progress'}</span>
                        <span className="text-[10px] font-black text-gray-700 tabular-nums">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${progressBar}`} style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>

                    {/* Seats — HOSTEL bookings only (each seat = a member with
                        their own rent box). Flat / sublet stay single-tenant. */}
                    {isHostelBooking(booking) && (
                      <MembersManager booking={booking} language={language} onChange={handleBookingUpdated} today={todayDate} showLedger={false} />
                    )}

                    {/* Tenant connection code — non-hostel (hostels show it in
                        the members panel). Share so the tenant can self-connect. */}
                    {!isHostelBooking(booking) && booking.inviteCode && (
                      <div className="mt-3 bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Lock size={14} className="text-[#ba0036] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'টেন্যান্ট কানেকশন কোড' : 'Tenant Connection Code'}</p>
                            <p className="text-sm font-black text-gray-900 tracking-widest tabular-nums">{booking.inviteCode}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { try { navigator.clipboard.writeText(booking.inviteCode); showToast(language === 'বাংলা' ? 'কোড কপি হয়েছে' : 'Code copied'); } catch { /* clipboard unavailable */ } }}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[10px] font-black text-gray-700 inline-flex items-center gap-1"
                        >
                          <ClipboardCheck size={12} /> {language === 'বাংলা' ? 'কপি' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {/* ── Hand the unit to the next tenant ──────────────────
                        A landlord sets a unit up ONCE. When the tenancy ends —
                        or is about to — this is the whole "old tenant out, new
                        tenant in" step: the unit, rent, service charge, due day
                        and reminders carry over, the host edits just the name +
                        number, and saving closes this lease while starting a
                        fresh one with its own rent ledger. */}
                    {(stage === 'done' || endingSoon) && (
                      <div className={`mt-3 rounded-xl border p-3 flex items-center gap-2.5 ${stage === 'done' ? 'bg-white border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stage === 'done' ? 'bg-gray-100 text-gray-500' : 'bg-white text-amber-600 border border-amber-200'}`}>
                          <RefreshCw size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-gray-900 leading-tight">
                            {stage === 'done'
                              ? (isBn ? 'এই লিজ শেষ হয়েছে' : 'This lease has ended')
                              : (isBn ? 'লিজ শেষ হতে চলেছে' : 'Lease is ending soon')}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500 leading-tight mt-0.5">
                            {isBn
                              ? 'নতুন ভাড়াটিয়া এলে শুধু নাম ও নম্বর বদলে সেভ করুন — নতুন লিজ ও রেন্ট কালেকশন চালু হবে।'
                              : 'When the next tenant arrives, just change the name + number — a new lease and rent ledger start.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openTenantChangeLease(booking)}
                          className={`shrink-0 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all inline-flex items-center gap-1 ${stage === 'done' ? 'bg-gray-900 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                        >
                          <Plus size={12} className="shrink-0" /> {isBn ? 'নতুন লিজ' : 'New Lease'}
                        </button>
                      </div>
                    )}

                    {/* Auto-reminder + actions row — stays on ONE line on every
                        device. Never wraps (that's what pushed the ⋮ menu onto its
                        own line before); on phones the labels + padding shrink so
                        the whole row keeps its position instead of reflowing. */}
                    <div className="mt-3 flex flex-nowrap items-center justify-between gap-1 sm:gap-1.5">
                      <button
                        onClick={() => toggleAutoReminder(booking.id)}
                        className={`shrink-0 px-1.5 sm:px-2.5 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide sm:tracking-widest transition-all flex items-center gap-1 ${booking.autoReminder ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        title={booking.autoReminder ? `Auto-remind ${booking.reminderLeadDays}d before due` : 'Auto-reminder off'}
                      >
                        {booking.autoReminder ? <BellRing size={12}/> : <BellOff size={12}/>}
                        <span className="hidden sm:inline">{language === 'বাংলা' ? 'অটো রিমাইন্ডার' : 'Auto Reminder'}</span> · {booking.reminderLeadDays}d
                      </button>

                      <div className="flex flex-nowrap items-center gap-1 sm:gap-1.5">
                        {/* Profile — opens the tenant's trust card (/tenant/:id). */}
                        <button
                          onClick={() => openTenantProfile(resolveTenantUserId(booking), { name: booking.tenant, avatar: booking.tenantAvatar })}
                          className="shrink-0 px-1.5 sm:px-2.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide sm:tracking-widest active:scale-95 flex items-center gap-1"
                          title={language === 'বাংলা' ? 'টেন্যান্ট প্রোফাইল' : 'Tenant profile'}
                        >
                          <UserCircle size={12} className="shrink-0"/> {language === 'বাংলা' ? 'প্রোফাইল' : 'Profile'}
                        </button>
                        {/* Message — single button. Routes to /messages so every conversation
                            lives in one place; ChatSystem hydrates the right thread from
                            location.state. */}
                        <button
                          onClick={() => openChatPanel(booking.chatId || `chat-${booking.id}`, { source: 'host-bookings', peerUserId: resolveTenantUserId(booking), peerName: booking.tenant, peerAvatar: booking.tenantAvatar, tenantName: booking.tenant, tenantPhone: booking.tenantPhone, propertyTitle: booking.property })}
                          className="shrink-0 px-2 sm:px-3 py-2 bg-gray-900 text-white hover:bg-[#ba0036] transition-all rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide sm:tracking-widest active:scale-95 shadow-md flex items-center gap-1"
                        >
                          <MessageCircle size={12} className="shrink-0"/> {language === 'বাংলা' ? 'মেসেজ' : 'Message'}
                        </button>
                        {/* Invoice — jumps to Rent Collection focused on this tenant. */}
                        <button
                          onClick={() => { setActiveTab('rent'); setExpandedRentId(booking.id); }}
                          className="shrink-0 px-1.5 sm:px-2.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide sm:tracking-widest active:scale-95 flex items-center gap-1"
                          title={language === 'বাংলা' ? 'রেন্ট কালেকশনে দেখুন' : 'Open in Rent Collection'}
                        >
                          <Wallet size={12} className="shrink-0"/> {language === 'বাংলা' ? 'ইনভয়েস' : 'Invoice'}
                        </button>
                        {/* Docs — agreement document vault */}
                        <button onClick={() => openModal('download_user_document')} className="shrink-0 px-1.5 sm:px-2.5 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide sm:tracking-widest active:scale-95 flex items-center gap-1">
                          <Folder size={12} className="shrink-0"/> {language === 'বাংলা' ? 'ডকস' : 'Docs'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          };
          return (
          <div className="w-full animate-in fade-in zoom-in-95 duration-500">

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 xl:h-[calc(100vh-140px)] overflow-visible xl:overflow-hidden">

              {/* ── LEFT RAIL — full Financial Overview ALWAYS visible (mobile + desktop) ── */}
              <aside className="xl:col-span-4 w-full flex flex-col gap-3 xl:gap-5 xl:h-full xl:overflow-y-auto custom-scrollbar xl:pt-1 xl:pb-4 xl:pr-1">

                {/* Financial Overview — always visible, but SLIM on mobile.
                    The card used to run ~340px tall on a phone (big title, four
                    stage tiles, generous padding) and pushed the actual lease
                    list below the fold. On mobile it now reads as one compact
                    block: revenue + deposits side by side, then a single inline
                    row of counts. Desktop (xl) keeps the roomy hero treatment. */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl xl:rounded-[2rem] p-3.5 xl:p-7 text-white shadow-[0_6px_20px_rgba(0,0,0,0.15)] xl:shadow-[0_15px_40px_rgba(0,0,0,0.2)] relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                  <div className="flex items-center justify-between gap-2 mb-2.5 xl:mb-1 relative z-10">
                    <h3 className="text-[13px] xl:text-2xl font-black truncate">{isBn ? 'ফাইন্যান্সিয়াল ওভারভিউ' : 'Financial Overview'}</h3>
                    {isPremium ? (
                      <div className="bg-[#ba0036] text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md shrink-0">
                         <Crown size={10} /> PRO
                      </div>
                    ) : (
                      <button onClick={() => setActiveModal('premium_gate')} className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors shrink-0">
                         <Lock size={10} /> Free
                      </button>
                    )}
                  </div>
                  {/* Subtitle is desktop-only — on a phone the card title plus
                      the KPI labels already say what this is. */}
                  <p className="hidden xl:block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-7 relative z-10">
                    {isBn ? 'লিজ পোর্টফোলিও সারাংশ' : 'Lease Portfolio Snapshot'}
                  </p>
                  <div className="space-y-2.5 xl:space-y-6 relative z-10">
                    {/* Revenue + Security Deposits side by side at every width.
                        min-w-0 + break-words keep the currency figures inside
                        narrow phone columns. */}
                    <div className="grid grid-cols-2 gap-2 xl:gap-3 items-stretch">
                      <div className="min-w-0">
                        <p className="text-white/50 text-[8px] xl:text-[9px] font-black uppercase tracking-widest mb-0.5 xl:mb-1 leading-tight">{isBn ? 'মাসিক আয়' : 'Monthly Revenue'}</p>
                        <p className="text-xl sm:text-2xl xl:text-4xl font-black text-white tracking-tight tabular-nums break-words leading-none">{formatBDT(leaseSummary.totalMonthlyRevenue)}</p>
                        <p className="text-[8px] xl:text-[9px] font-bold text-white/50 mt-1 leading-tight">{isBn ? 'চলমান লিজ (ভাড়া + সার্ভিস)' : 'live leases (rent + service)'}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl xl:rounded-2xl p-2 xl:p-3 min-w-0">
                        <p className="text-white/50 text-[8px] xl:text-[9px] font-black uppercase tracking-widest mb-0.5 xl:mb-1 leading-tight">{isBn ? 'সিকিউরিটি ডিপোজিট' : 'Security Deposits'}</p>
                        <p className="text-base sm:text-lg xl:text-2xl font-black text-white tabular-nums break-words leading-none">{formatBDT(leaseSummary.totalSecurityDeposits)}</p>
                        <p className="text-[8px] xl:text-[9px] font-bold text-white/50 mt-1 leading-tight">{isBn ? 'লিজ শেষে রিটার্নযোগ্য' : 'returnable at lease end'}</p>
                      </div>
                    </div>
                    {/* Stage counts — Active / Done only (Draft + Notice are gone;
                        a unit is either rented or it isn't). "Ending soon" rides
                        along as an amber chip since it's a nudge, not a stage. */}
                    <div className="grid grid-cols-2 gap-2 xl:gap-3">
                      <div className="bg-white/5 rounded-xl xl:rounded-2xl px-2.5 py-2 xl:p-3 flex items-center justify-between gap-2 xl:flex-col xl:items-start">
                        <p className="text-white/50 text-[9px] font-black uppercase tracking-widest xl:mb-1">{stageLabel('active', language)}</p>
                        <p className="text-lg xl:text-2xl font-black text-green-400 tabular-nums leading-none">{leaseSummary.activeCount}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl xl:rounded-2xl px-2.5 py-2 xl:p-3 flex items-center justify-between gap-2 xl:flex-col xl:items-start">
                        <p className="text-white/50 text-[9px] font-black uppercase tracking-widest xl:mb-1">{stageLabel('done', language)}</p>
                        <p className="text-lg xl:text-2xl font-black text-white/70 tabular-nums leading-none">{leaseSummary.doneCount}</p>
                      </div>
                    </div>
                    {leaseSummary.endingSoonCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setLeaseStageFilter('active')}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-amber-400/15 border border-amber-300/25 text-left transition-colors hover:bg-amber-400/25"
                      >
                        <AlertCircle size={13} className="text-amber-300 shrink-0" />
                        <span className="text-[10px] font-black text-amber-200 uppercase tracking-wider flex-1 truncate">
                          {isBn ? '৩০ দিনে শেষ হচ্ছে' : 'Ending within 30 days'}
                        </span>
                        <span className="text-[11px] font-black text-amber-100 tabular-nums shrink-0">{leaseSummary.endingSoonCount}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Lease status flow — desktop only. Hidden on mobile + tablet
                    (iPad); the stacked rail would push the lease list too far
                    down on those widths, and the same stage counts are already
                    reachable via the toolbar filter pills. Shown from xl up. */}
                <div className="hidden xl:block bg-white rounded-2xl xl:rounded-[2rem] p-4 xl:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none shrink-0">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 xl:mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-gray-400" />
                    {language === 'বাংলা' ? 'লিজ স্ট্যাটাস ফ্লো' : 'Lease Status Flow'}
                  </h4>
                  <div className="space-y-2 xl:space-y-3">
                    {[
                      { stage: 'active', count: leaseSummary.activeCount, dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', hint: isBn ? 'ভাড়াটিয়া আছেন' : 'unit is rented' },
                      { stage: 'done',   count: leaseSummary.doneCount,   dot: 'bg-gray-400',  bg: 'bg-gray-100', text: 'text-gray-600',  hint: isBn ? 'শেষ · নতুন লিজ দেওয়া যাবে' : 'ended · ready to re-let' },
                    ].map(row => (
                      <button key={row.stage} onClick={() => setLeaseStageFilter(row.stage)} className="w-full flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors text-left">
                        <span className={`w-2 h-2 rounded-full ${row.dot}`}></span>
                        <span className="text-xs font-black text-gray-900 w-20 capitalize">{stageLabel(row.stage, language)}</span>
                        <span className="text-[10px] font-bold text-gray-500 flex-1 truncate">{row.hint}</span>
                        <span className={`${row.bg} ${row.text} px-2.5 py-1 rounded-lg text-xs font-black tabular-nums`}>{row.count}</span>
                      </button>
                    ))}
                    {leaseSummary.endingSoonCount > 0 && (
                      <div className="flex items-center gap-3 p-2 -mx-2 rounded-xl bg-amber-50/60">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-xs font-black text-gray-900 w-20">{isBn ? 'শেষ হচ্ছে' : 'Ending'}</span>
                        <span className="text-[10px] font-bold text-gray-500 flex-1 truncate">{isBn ? 'রিনিউয়াল উইন্ডো · শেষ ৩০ দিন' : 'renewal window · last 30 days'}</span>
                        <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-black tabular-nums">{leaseSummary.endingSoonCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('rent')}
                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-2xl xl:rounded-[2rem] p-4 xl:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3 transition-colors shrink-0 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <Wallet size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-emerald-900">{language === 'বাংলা' ? 'ভাড়া কালেকশন' : 'Rent Collection'}</p>
                      <p className="text-[10px] font-bold text-emerald-700/70 leading-tight">{language === 'বাংলা' ? '১২ মাসের লেজার, পেমেন্ট আপডেট' : '12-month ledger, mark paid, reminders'}</p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-emerald-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </aside>

              {/* ── RIGHT MAIN — main IS the scroll container; sticky toolbar pins inside it ── */}
              <main className="xl:col-span-8 w-full xl:h-full xl:overflow-y-auto custom-scrollbar pb-24 xl:pr-3 min-w-0">

                {/* Sticky toolbar — ONE row. Title is a tiny chip in the
                    corner; search + filter pills + New Lease share the same
                    sticky line. Because <main> is the scroll container, this
                    bar pins to the top of the list as the host scrolls (works
                    on both desktop and mobile). */}
                <div className="sticky top-0 z-30 bg-gray-50/85 backdrop-blur-md -mx-3 sm:-mx-4 xl:mx-0 px-3 sm:px-4 xl:px-0 pt-2 pb-3 mb-2 xl:pt-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap xl:flex-nowrap">
                    {/* Title corner chip — small, gray, with live count. */}
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/70 text-[9px] xl:text-[10px] font-black text-gray-700 uppercase tracking-widest shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <CalendarRange size={11} className="text-[#ba0036]"/>
                      <span className="hidden sm:inline">{language === 'বাংলা' ? 'লিজ' : 'Leases'}</span>
                      <span className="text-gray-400 tabular-nums">{filtered.length}</span>
                    </span>
                    {/* Search input — flexes to fill, capped on desktop. */}
                    <div className="relative flex-1 min-w-[120px] xl:max-w-[260px] order-3 sm:order-none basis-full sm:basis-auto">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={language === 'বাংলা' ? 'খুঁজুন...' : 'Search tenants...'}
                        className="w-full pl-7 pr-2 py-2 rounded-xl bg-white text-[11px] font-bold text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent focus:border-gray-200 focus:outline-none placeholder:text-gray-400"
                      />
                    </div>
                    {/* Filter pills — horizontal scroll on narrow viewports.
                        No flex-1 so the pills stay content-width and the New
                        Lease (+) button sits right next to the "Done" pill
                        instead of being pushed to the far edge. */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar xl:flex-none order-1 sm:order-none min-w-0">
                      {/* Three filters, nothing more: All / Active / Done.
                          Draft and Notice were removed — they described dates,
                          not decisions, and hosts read them as broken states. */}
                      {['all', 'active', 'done'].map(f => (
                        <button
                          key={f}
                          onClick={() => setLeaseStageFilter(f)}
                          className={`shrink-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] font-black capitalize transition-all whitespace-nowrap ${stageFilter === f ? 'bg-gray-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]' : 'bg-white text-gray-500 hover:text-gray-900 shadow-[0_2px_6px_rgba(0,0,0,0.03)]'}`}
                        >
                          {stageLabel(f, language)}
                        </button>
                      ))}
                    </div>
                    {/* New Lease action (add booking) — sits right next to the
                        "Done" filter pill on mobile (order-2, after the pills),
                        then reverts to its corner-pinned spot from sm up. */}
                    <button
                      onClick={() => isPremium ? openBlankLease() : setActiveModal('premium_gate')}
                      className="shrink-0 bg-[#ba0036] hover:bg-[#90002a] text-white px-3 py-2 rounded-xl font-black text-[10px] shadow-[0_4px_12px_rgba(186,0,54,0.25)] transition-all flex items-center gap-1.5 active:scale-95 order-2 sm:order-none sm:ml-auto"
                    >
                      {isPremium ? <Plus size={13}/> : <Crown size={13}/>}
                      <span className="hidden sm:inline">{language === 'বাংলা' ? 'নতুন লিজ' : 'New Lease'}</span>
                    </button>
                  </div>
                </div>

                {/* List — flat sequence of compact rows. Sticky toolbar above
                    floats on scroll. forceOpen auto-engages when the filtered
                    list is ≤5 rows; small portfolios then get a fully-readable
                    static layout instead of accordion friction. */}
                {(() => {
                  const AUTO_EXPAND_THRESHOLD = 5;
                  const forceOpen = filtered.length > 0 && filtered.length <= AUTO_EXPAND_THRESHOLD;
                  if (filtered.length === 0) {
                    // Empty state carries the primary action. A host with no
                    // bookings yet used to land on a dead card that only told
                    // them to "convert an inquiry" — with no way to start a
                    // lease from here. The + New Lease button is now right in
                    // the box, so the next step is obvious and one tap away.
                    const filteredOut = bookings.length > 0;
                    return (
                      <div className="text-center py-12 sm:py-16 px-5 bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border-none">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                           <Calendar className="text-gray-300" size={26} />
                        </div>
                        <h3 className="text-sm font-black text-gray-900">
                          {filteredOut
                            ? (isBn ? 'এই ফিল্টারে কোনো লিজ নেই।' : 'No leases match this filter.')
                            : (t?.noBookingsFound || (isBn ? 'এখনো কোনো লিজ নেই।' : 'No leases yet.'))}
                        </h3>
                        <p className="text-[11px] font-bold text-gray-500 mt-1.5 max-w-[320px] mx-auto leading-relaxed">
                          {filteredOut
                            ? (isBn ? '"সকল" ফিল্টার দেখুন, অথবা নতুন ভাড়াটিয়ার জন্য নতুন লিজ তৈরি করুন।' : 'Try the "All" filter, or add a new lease for an incoming tenant.')
                            : (isBn ? 'ভাড়াটিয়া যোগ করতে নতুন লিজ তৈরি করুন — ফ্ল্যাট, সিঙ্গেল রুম, হোস্টেল বা কমার্শিয়াল। সেভ করলেই রেন্ট কালেকশন চালু হবে।' : 'Add a tenant by creating a lease — flat, single room, hostel or commercial. Saving it starts Rent Collection.')}
                        </p>
                        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
                          <button
                            onClick={() => isPremium ? openBlankLease() : setActiveModal('premium_gate')}
                            className="w-full sm:w-auto bg-[#ba0036] hover:bg-[#90002a] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_6px_18px_rgba(186,0,54,0.28)] transition-all inline-flex items-center justify-center gap-2 active:scale-95"
                          >
                            {isPremium ? <Plus size={15}/> : <Crown size={15}/>}
                            {isBn ? 'নতুন লিজ' : 'New Lease'}
                          </button>
                          {filteredOut && stageFilter !== 'all' && (
                            <button
                              onClick={() => setLeaseStageFilter('all')}
                              className="w-full sm:w-auto bg-white border-2 border-gray-200 text-gray-600 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all inline-flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              {isBn ? 'সকল লিজ দেখুন' : 'Show all leases'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {stageFilter === 'all' && attentionLeases.length > 0 ? (
                        <>
                          <div className="flex items-center gap-2 mt-1 px-1 pt-1">
                            <AlertCircle size={12} className="text-amber-600 shrink-0"/>
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                              {language === 'বাংলা' ? 'এখনই দরকার' : 'Needs Attention'} · {attentionLeases.length}
                            </span>
                            <div className="flex-1 h-px bg-amber-200/60"/>
                          </div>
                          {attentionLeases.map((b) => renderBookingRow(b, forceOpen))}
                          {otherLeases.length > 0 && (
                            <div className="flex items-center gap-2 px-1 pt-3 pb-1">
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                {language === 'বাংলা' ? 'সকল লিজ' : 'All Leases'} · {otherLeases.length}
                              </span>
                              <div className="flex-1 h-px bg-gray-200"/>
                            </div>
                          )}
                          {otherLeases.map((b) => renderBookingRow(b, forceOpen))}
                        </>
                      ) : (
                        filtered.map((b) => renderBookingRow(b, forceOpen))
                      )}
                    </div>
                  );
                })()}
              </main>

            </div>
          </div>
          );
}
