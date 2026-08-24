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
  BellOff, CalendarRange, BarChart3, ScanLine,
  Bed, Bath, Maximize2, Sofa, Trash, ImagePlus, BedDouble, Home, Utensils, Users, Coffee, Map, Leaf
} from 'lucide-react';
import MembersManager from "../MembersManager.jsx";
import AiLedgerScannerModal from "./AiLedgerScannerModal.jsx";



export default function BookingsTab(props) {
  const {
    today, bookings, language, searchQuery, setSearchQuery, leaseStageFilter, setLeaseStageFilter,
    expandedBookingId, setExpandedBookingId, activeDropdownId, setActiveDropdownId,
    confirmDeleteBookingId, setConfirmDeleteBookingId, handleCallUser, resolveTenantUserId,
    setActiveTab, setExpandedRentId, downloadAgreement, t, showToast, toggleAutoReminder,
    openTenantProfile, openChatPanel, openModal, isPremium, openBlankLease, setActiveModal,
    handleBookingUpdated,
    getLeaseSummary, computeLeaseStage, isLeaseEndingSoon, leaseDaysLeft, openTenantChangeLease,
    isOpenEndedLease, leaseMonthsRunning,
    formatBDT, daysUntilNextDue, computeBookingProgress,
    isHostelBooking, formatDate, stageLabel,
    landlordProfile, setLandlordProfile, currentBuildingId, setCurrentBuildingId
  } = props;

          const isBn = language === 'বাংলা';
          const [showBuildingForm, setShowBuildingForm] = useState(false);
          const [newBuilding, setNewBuilding] = useState({ name: '', location: '', type: 'residential', category: 'flat' });
          const [editingBuildingId, setEditingBuildingId] = useState(null);
          const [editBuildingData, setEditBuildingData] = useState({ name: '', location: '', type: 'residential' });
          const [deleteBuildingId, setDeleteBuildingId] = useState(null);
          const [activeBldgDropdown, setActiveBldgDropdown] = useState(null);
          const [showAllBuildings, setShowAllBuildings] = useState(false);
          // AI Ledger Scanner modal toggle
          const [showAiScanner, setShowAiScanner] = useState(false);
          const todayDate = today;
          
          let baseBookings = bookings;
          if (landlordProfile?.buildingMode === 'multi') {
            if (currentBuildingId) {
              const bldg = landlordProfile.buildings?.find(b => b.id === currentBuildingId);
              baseBookings = bldg ? bookings.filter(b => b.property === bldg.name) : [];
            } else {
              const bldgNames = (landlordProfile.buildings || []).map(b => b.name);
              baseBookings = bookings.filter(b => bldgNames.includes(b.property));
            }
          } else if (landlordProfile?.buildingMode === 'single') {
            const bldgName = landlordProfile.buildings?.[0]?.name;
            baseBookings = bldgName ? bookings.filter(b => b.property === bldgName) : [];
          }
          
          const leaseSummary = getLeaseSummary(baseBookings, todayDate);
          
          const getPrefillBuilding = () => {
            if (landlordProfile?.buildingMode === 'single' && landlordProfile.buildings?.length > 0) {
              return landlordProfile.buildings[0];
            }
            if (landlordProfile?.buildingMode === 'multi' && currentBuildingId) {
              return landlordProfile.buildings?.find(b => b.id === currentBuildingId);
            }
            return null;
          };

          const matchesSearch = (b) => b.tenant.toLowerCase().includes(searchQuery.toLowerCase()) || b.property.toLowerCase().includes(searchQuery.toLowerCase());
          // Only 'active' and 'done' are real stages now. `leaseStageFilter` is
          // shared with the Documents tab (which reuses the same state for its
          // own pills), so anything we don't recognise falls back to "All"
          // rather than silently rendering an empty list.
          const stageFilter = (leaseStageFilter === 'active' || leaseStageFilter === 'done') ? leaseStageFilter : 'all';
          
          let searchMatched = baseBookings.filter(matchesSearch);

          const filtered = searchMatched.filter(b => {
            const stage = computeLeaseStage(b, todayDate);
            return stageFilter === 'all' || stage === stageFilter;
          });
          // How many rows each filter would yield, so a pill says what it does
          // before it's tapped instead of after.
          const stageCounts = {
            all: searchMatched.length,
            active: searchMatched.filter(b => computeLeaseStage(b, todayDate) === 'active').length,
            done: searchMatched.filter(b => computeLeaseStage(b, todayDate) === 'done').length,
          };
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
            // Ongoing tenancy — no end date, so there is no term to be a
            // percentage of. computeBookingProgress returns null and we show how
            // long the tenant has actually been here instead of a bar stuck at 0%.
            const openEnded = isOpenEndedLease(booking);
            const progress = computeBookingProgress(booking, todayDate);
            const monthsRunning = leaseMonthsRunning(booking, todayDate);
            const runningLabel = isBn ? `${monthsRunning} মাস চলছে` : `${monthsRunning} mo running`;
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
            const cardTitle = hostelBooking ? booking.property : booking.tenant;
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
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <h4 className="text-[13px] sm:text-sm font-black text-gray-900 truncate max-w-[130px] sm:max-w-[200px]">{cardTitle}</h4>
                      {booking.floorNumber && (
                        <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0 inline-flex items-center gap-0.5">
                          {language === 'বাংলা' ? 'ফ্লোর' : 'Floor'} {booking.floorNumber}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 inline-flex items-center gap-0.5 ${booking.dealType === 'commercial' ? 'bg-violet-50 text-violet-700 border-violet-200' : hostelBooking ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {booking.dealType === 'commercial'
                          ? (<>🏢<span> {language === 'বাংলা' ? 'কমার্শিয়াল' : 'Commercial'}</span></>)
                          : hostelBooking
                            ? (<>🛏️<span> {language === 'বাংলা' ? 'হোস্টেল' : 'Hostel'}</span></>)
                            : (<>🏠<span> {language === 'বাংলা' ? 'আবাসিক' : 'Residential'}</span></>)}
                      </span>
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
                      <span className="text-emerald-600 font-black">{hostelBooking ? tenantsLabel : booking.property}</span>
                      {booking.roomNumber && (
                        <>
                          <span className="mx-1 text-gray-300">·</span>
                          {language === 'বাংলা' ? 'রুম' : 'Room'} {booking.roomNumber}
                        </>
                      )}
                      <span className="mx-0.5 text-gray-300">·</span> <span className="tabular-nums">{formatBDT(monthlyTotal)}</span>
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
                  {/* Right-hand meter — desktop, COLLAPSED only. Hidden once
                      expanded (the body already shows the full detail), freeing
                      the top-right corner for the 3-dot menu.
                      Fixed term ⇒ % complete. Ongoing tenancy ⇒ how long the
                      tenant has been here, which is the only honest number. */}
                  <div className={`flex-col items-end gap-0.5 shrink-0 mr-1 ${isExpanded ? 'hidden' : 'hidden sm:flex'}`}>
                    {progress == null ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-wider tabular-nums whitespace-nowrap">
                        {monthsRunning}{isBn ? ' মাস' : ' mo'}
                      </span>
                    ) : (
                      <>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest tabular-nums">{progress}%</span>
                        <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${progressBar}`} style={{ width: `${progress}%` }}/>
                        </div>
                      </>
                    )}
                  </div>
                  {/* 3-dot actions menu — top-right of the card, next to the profile
                      photo/name. stopPropagation keeps opening it from toggling the row; 
                      it opens downward so it doesn't get clipped. */}
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
                  <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 text-gray-400">
                    {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </div>
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

                    {/* Lease term — Move-In · Next Payment · Tenancy.
                        3 columns on EVERY width (matches the mobile card design)
                        instead of stacking to one column on phones. The third
                        tile reads "Ongoing" for a tenancy with no end date — the
                        normal case — and only shows an expiry when the host
                        actually set one. */}
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
                      <div className={`rounded-xl p-2 sm:p-2.5 border min-w-0 ${openEnded && stage === 'active' ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-white'}`}>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><CalendarRange size={9} className="shrink-0"/> <span className="truncate">{openEnded ? (isBn ? 'ভাড়ার মেয়াদ' : 'Tenancy') : (isBn ? 'লিজ এক্সপায়ারি' : 'Lease Expiry')}</span></p>
                        {openEnded ? (
                          <>
                            <p className={`text-[10px] sm:text-xs font-black mt-0.5 ${stage === 'active' ? 'text-green-700' : 'text-gray-900'}`}>
                              {stage === 'done'
                                ? (isBn ? 'বন্ধ করা হয়েছে' : 'Closed out')
                                : (isBn ? 'চলমান' : 'Ongoing')}
                            </p>
                            <p className="text-[9px] font-bold text-gray-500 mt-0.5 tabular-nums leading-tight">
                              {stage === 'done' ? (isBn ? 'নতুন ভাড়াটিয়া দেওয়া হয়েছে' : 'unit handed over') : runningLabel}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] sm:text-xs font-black text-gray-900 mt-0.5">{formatDate(booking.leaseEnd, language)}</p>
                        )}
                      </div>
                    </div>

                    {/* Late fee — shown so the landlord can see at a glance what
                        this tenant is actually being told. No fee set ⇒ the row
                        says so, because "no late fee" is a real answer, not a
                        missing setting. */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {Number(booking.lateFeeAmount) > 0 ? (
                        <>
                          <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[9px] sm:text-[10px] font-black text-amber-700 inline-flex items-center gap-1">
                            <AlertCircle size={10} className="shrink-0"/>
                            {isBn ? 'লেট ফি' : 'Late fee'} {formatBDT(booking.lateFeeAmount)}
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-white border border-gray-100 text-[9px] sm:text-[10px] font-bold text-gray-600">
                            {isBn
                              ? `${booking.rentDueDay || 5} তারিখের পর ${booking.gracePeriodDays ?? 5} দিন গ্রেস`
                              : `${booking.gracePeriodDays ?? 5}d grace after the ${booking.rentDueDay || 5}th`}
                          </span>
                        </>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-white border border-gray-100 text-[9px] sm:text-[10px] font-bold text-gray-500 inline-flex items-center gap-1">
                          <MinusCircle size={10} className="shrink-0"/> {isBn ? 'কোনো লেট ফি নেই' : 'No late fee'}
                        </span>
                      )}
                    </div>

                    {/* Term progress — only where there IS a term. An ongoing
                        tenancy gets a plain "living here since X" line instead:
                        a bar can't show progress toward a date that doesn't
                        exist, and one frozen at 0% just looked broken. */}
                    {progress == null ? (
                      <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white border border-gray-100">
                        <Clock size={12} className="text-green-600 shrink-0" />
                        <span className="text-[10px] font-black text-gray-700 tracking-wide">
                          {isBn ? 'বাস করছেন' : 'Living here since'} <span className="tabular-nums">{formatDate(booking.leaseStart, language)}</span>
                        </span>
                        <span className="ml-auto shrink-0 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-wider tabular-nums">
                          {runningLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'লিজের অগ্রগতি' : 'Lease Progress'}</span>
                          <span className="text-[10px] font-black text-gray-700 tabular-nums">{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ease-out ${progressBar}`} style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    )}

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
                    {/* Always available — a tenant can leave on any day, not
                        only when the term happens to be running out. The copy
                        adapts to where the lease stands; the action is the same. */}
                    <div className={`mt-3 rounded-xl border p-3 flex items-center gap-2.5 ${stage === 'done' ? 'bg-white border-gray-200' : endingSoon ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stage === 'done' ? 'bg-gray-100 text-gray-500' : endingSoon ? 'bg-white text-amber-600 border border-amber-200' : 'bg-white text-emerald-600 border border-emerald-100'}`}>
                        <RefreshCw size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* For an ongoing tenancy this panel IS how a lease
                            ends, so it names the actual event — the tenant
                            moved out — rather than a vague "changed". */}
                        <p className="text-[11px] font-black text-gray-900 leading-tight">
                          {stage === 'done'
                            ? (isBn ? 'এই লিজ শেষ হয়েছে' : 'This lease has ended')
                            : endingSoon
                              ? (isBn ? 'লিজ শেষ হতে চলেছে' : 'Lease is ending soon')
                              : (isBn ? 'ভাড়াটিয়া চলে গেছেন?' : 'Tenant moved out?')}
                        </p>
                        <p className="text-[10px] font-bold text-gray-500 leading-tight mt-0.5">
                          {isBn
                            ? 'নতুন ভাড়াটিয়া এলে শুধু নাম ও নম্বর বদলে সেভ করুন — একই ইউনিটে নতুন লিজ ও নতুন রেন্ট লেজার চালু হবে।'
                            : 'When the next tenant arrives, just change the name + number — the same unit gets a new lease and a fresh rent ledger.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTenantChangeLease(booking)}
                        className={`shrink-0 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all inline-flex items-center gap-1 ${stage === 'done' ? 'bg-gray-900 text-white hover:bg-black' : endingSoon ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                      >
                        <Plus size={12} className="shrink-0" /> {isBn ? 'নতুন লিজ' : 'New Lease'}
                      </button>
                    </div>

                    {/* Auto-reminder + actions row — stays on ONE line on every
                        device. Never wraps (that's what pushed the ⋮ menu onto its
                        own line before); on phones the labels + padding shrink so
                        the whole row keeps its position instead of reflowing. 
                        Added overflow-x-auto so they don't squish. */}
                    <div className="mt-3 flex flex-nowrap items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar pb-1 -mb-1">
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
          // ── TOOLBAR PIECES ─────────────────────────────────────────────
          // Built once, positioned three different ways so each screen gets a
          // layout that suits it rather than one row squeezed or stretched:
          //   mobile  → identity + Add Tenant on line 1, full-width search on
          //             line 2, filter pills on line 3
          //   tablet  → identity + search + Add Tenant on line 1, pills below
          //   desktop → everything on a single line, action pinned right
          const searchField = (
            <div className="relative w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'ভাড়াটিয়া বা বাড়ি খুঁজুন...' : 'Search tenant or property...'}
                aria-label={isBn ? 'ভাড়াটিয়া খুঁজুন' : 'Search tenants'}
                className="w-full pl-8 pr-8 py-2.5 rounded-xl bg-white text-[11px] font-bold text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent focus:border-[#ba0036]/25 focus:shadow-[0_4px_14px_rgba(186,0,54,0.08)] focus:outline-none placeholder:text-gray-400 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={isBn ? 'সার্চ মুছুন' : 'Clear search'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              )}
            </div>
          );

          // Three filters, nothing more: All / Active / Done. Draft and Notice
          // were removed — they described dates, not decisions, and hosts read
          // them as broken states. Each pill carries its own result count.
          const filterPills = ['all', 'active', 'done'].map(f => {
            const on = stageFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setLeaseStageFilter(f)}
                aria-pressed={on}
                className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black capitalize transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${on ? 'bg-gray-900 text-white shadow-[0_3px_10px_rgba(0,0,0,0.18)]' : 'bg-white text-gray-500 hover:text-gray-900 shadow-[0_2px_6px_rgba(0,0,0,0.03)]'}`}
              >
                {stageLabel(f, language)}
                <span className={`tabular-nums ${on ? 'text-white/70' : 'text-gray-400'}`}>{stageCounts[f]}</span>
              </button>
            );
          });

          // Primary action. A landlord's whole reason for being on this tab is
          // to put a tenant in a unit, so it looks like the main thing: brand
          // gradient, a lifted shadow, an icon chip, and a label that never
          // collapses to a bare "+" (an unlabelled icon is guesswork).
          // Fills the remaining width on a phone, content-width from tablet up,
          // pinned to the right edge on desktop.
          const addTenantButton = (
            <div className="flex items-center gap-1.5 lg:ml-auto">
              {/* ── AI Scan: photo of khata → auto-fill all tenants at once ── */}
              <button
                type="button"
                onClick={() => isPremium ? setShowAiScanner(true) : setActiveModal('premium_gate')}
                aria-label={isBn ? 'খাতা স্ক্যান করে ভাড়াটিয়া যোগ' : 'Scan rent ledger with AI'}
                title={isBn ? 'খাতার ছবি তুলে সব ভাড়াটিয়া একবারে যোগ করুন' : 'Photo your rent book — AI fills all tenants at once'}
                className="group relative overflow-hidden shrink-0 px-2.5 sm:px-3 py-2.5 rounded-xl bg-white border border-[#ba0036]/20 text-[#ba0036] hover:bg-[#ba0036]/5 shadow-[0_2px_8px_rgba(186,0,54,0.1)] hover:shadow-[0_4px_14px_rgba(186,0,54,0.2)] active:scale-[0.97] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ba0036]/40"
              >
                <span className="relative flex items-center justify-center gap-1.5">
                  <ScanLine size={13} strokeWidth={2.5} className="shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    {isBn ? 'খাতা স্ক্যান' : 'AI Scan'}
                  </span>
                </span>
              </button>

              {/* ── Manual add: blank lease form ── */}
              <button
                type="button"
                onClick={() => isPremium ? openBlankLease(getPrefillBuilding()) : setActiveModal('premium_gate')}
                aria-label={isBn ? 'নতুন ভাড়াটিয়া যোগ করুন' : 'Add a new tenant'}
                className="group relative overflow-hidden flex-1 sm:flex-none sm:shrink-0 min-w-0 px-3 sm:px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-[#ba0036] via-[#d1003d] to-[#ff004c] text-white shadow-[0_5px_16px_rgba(186,0,54,0.32)] hover:shadow-[0_9px_24px_rgba(186,0,54,0.42)] active:scale-[0.97] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ba0036]/40 focus-visible:ring-offset-2"
              >
                {/* Soft top-light sheen on hover — depth without a colour change. */}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center justify-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                    {isPremium ? <Plus size={13} strokeWidth={3.5} /> : <Crown size={12} strokeWidth={3} />}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wider truncate">
                    {isBn ? (
                      <><span className="sm:hidden">ম্যানুয়াল</span><span className="hidden sm:inline">ভাড়াটিয়া যোগ</span></>
                    ) : (
                      <><span className="sm:hidden">Manual</span><span className="hidden sm:inline">Add Tenant</span></>
                    )}
                  </span>
                </span>
              </button>
            </div>
          );


          const countChip = (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white text-[10px] font-black text-gray-700 uppercase tracking-widest shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
              <CalendarRange size={12} className="text-[#ba0036]"/>
              <span className="hidden sm:inline">{isBn ? 'ভাড়াটিয়া' : 'Tenants'}</span>
              <span className="text-gray-400 tabular-nums">{filtered.length}</span>
            </span>
          );

          if (!landlordProfile?.buildingMode) {
            return (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                  <div className="text-center mb-6">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2">{isBn ? 'আপনার কয়টা বাসা/বিল্ডিং আছে?' : 'How many houses/buildings do you have?'}</h2>
                    <p className="text-sm font-bold text-gray-500">{isBn ? 'পরে যেকোনো সময় পাল্টাতে পারবেন' : 'You can change this anytime later'}</p>
                  </div>
                  <div className="space-y-4">
                    <button 
                      onClick={() => setLandlordProfile({...landlordProfile, buildingMode: 'single'})}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-[#ba0036] hover:bg-red-50 text-left group transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-red-100 text-[#ba0036] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Home size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900 group-hover:text-[#ba0036] transition-colors">{isBn ? 'একটা বাসা' : 'One house'}</h3>
                        <p className="text-xs font-bold text-gray-500">{isBn ? 'একটা বিল্ডিং ম্যানেজ করছি' : 'I am managing one building'}</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => {
                        // If they switch to multi and have a single building already, we keep it. Otherwise they just go to multi dashboard.
                        setLandlordProfile({...landlordProfile, buildingMode: 'multi'})
                      }}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-blue-600 hover:bg-blue-50 text-left group transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">{isBn ? 'একাধিক বাসা' : 'Multiple houses'}</h3>
                        <p className="text-xs font-bold text-gray-500">{isBn ? 'একাধিক বিল্ডিং ম্যানেজ করছি' : 'I am managing multiple buildings'}</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (landlordProfile?.buildingMode === 'single' && (!landlordProfile.buildings || landlordProfile.buildings.length === 0)) {
            return (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-gray-900 mb-2">{isBn ? 'বাসার তথ্য দিন' : 'Enter House Details'}</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">{isBn ? 'বাসার নাম' : 'House Name'}</label>
                      <input type="text" value={newBuilding.name} onChange={(e) => setNewBuilding({...newBuilding, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ba0036]/20 focus:border-[#ba0036]" placeholder={isBn ? 'যেমন: স্কাই ভিউ টাওয়ার' : 'e.g. Sky View Tower'} />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">{isBn ? 'ঠিকানা / লোকেশন' : 'Location'}</label>
                      <input type="text" value={newBuilding.location} onChange={(e) => setNewBuilding({...newBuilding, location: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ba0036]/20 focus:border-[#ba0036]" placeholder={isBn ? 'যেমন: মিরপুর ১০' : 'e.g. Mirpur 10'} />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">{isBn ? 'ধরন' : 'Type'}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'residential', label: isBn ? 'Residential' : 'Residential', icon: <Home size={18}/>, sub: isBn ? 'ফ্ল্যাট/বাসা' : 'Flat/House' },
                          { value: 'commercial', label: isBn ? 'Commercial' : 'Commercial', icon: <Building2 size={18}/>, sub: isBn ? 'অফিস/দোকান' : 'Office/Shop' },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => setNewBuilding({...newBuilding, type: opt.value, category: opt.value === 'residential' ? 'flat' : ''})}
                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${newBuilding.type === opt.value ? 'border-[#ba0036] bg-red-50 text-[#ba0036]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            {opt.icon}
                            <span className="text-[10px] font-black uppercase tracking-wider">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Categories are handled via 'Add Tenant' format selection */}
                    <button 
                      onClick={() => {
                        if(!newBuilding.name || !newBuilding.location) return;
                        setLandlordProfile({
                          ...landlordProfile, 
                          buildings: [{ ...newBuilding, id: 'bldg_' + Date.now(), createdAt: new Date().toISOString() }]
                        });
                      }}
                      className="w-full bg-[#ba0036] hover:bg-[#a0002f] text-white font-black py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                      {isBn ? 'সেভ করুন' : 'Save Details'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
          <>
          <div className="w-full animate-in fade-in zoom-in-95 duration-500">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 lg:h-[calc(100vh-140px)] overflow-visible lg:overflow-hidden">

              {/* ── LEFT RAIL — full Financial Overview ALWAYS visible (mobile + desktop) ── */}
              <aside className="lg:col-span-4 w-full flex flex-col gap-3 lg:gap-5 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pt-1 lg:pb-4 lg:pr-1">
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl lg:rounded-[2rem] p-3.5 lg:p-7 text-white shadow-[0_6px_20px_rgba(0,0,0,0.15)] lg:shadow-[0_15px_40px_rgba(0,0,0,0.2)] relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                  <div className="flex items-center justify-between gap-2 mb-2.5 lg:mb-1 relative z-10">
                    <h3 className="text-[13px] lg:text-2xl font-black truncate">{isBn ? 'ফাইন্যান্সিয়াল ওভারভিউ' : 'Financial Overview'}</h3>
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
                  <p className="hidden lg:block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-7 relative z-10">
                    {isBn ? 'লিজ পোর্টফোলিও সারাংশ' : 'Lease Portfolio Snapshot'}
                  </p>
                  
                  <div className="space-y-2.5 lg:space-y-6 relative z-10">
                    {(landlordProfile?.buildingMode === 'multi' && !currentBuildingId) && (
                      <div className="hidden md:block space-y-3">
                        {(landlordProfile.buildings || []).map((bldg, idx) => {
                          const bldgBookings = bookings.filter(b => b.property === bldg.name);
                          const bldgSummary = getLeaseSummary(bldgBookings, todayDate);
                          return (
                            <div key={bldg.id} className={`bg-white/5 rounded-xl p-3 ${!showAllBuildings && idx >= 5 ? 'hidden' : ''}`}>
                              <h4 className="text-xs font-black text-white mb-2">{bldg.name} <span className="text-[9px] font-bold text-white/50 bg-white/10 px-1.5 py-0.5 rounded-md ml-1">{bldgBookings.length} {isBn ? 'ভাড়াটিয়া' : 'Tenants'}</span></h4>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-white/50 text-[8px] font-black uppercase tracking-widest mb-0.5">{isBn ? 'মাসিক আয়' : 'Monthly Revenue'}</p>
                                  <p className="text-sm font-black text-white tabular-nums">{formatBDT(bldgSummary.totalMonthlyRevenue)}</p>
                                </div>
                                <div>
                                  <p className="text-white/50 text-[8px] font-black uppercase tracking-widest mb-0.5">{isBn ? 'সিকিউরিটি' : 'Security'}</p>
                                  <p className="text-sm font-black text-white tabular-nums">{formatBDT(bldgSummary.totalSecurityDeposits)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(landlordProfile.buildings || []).length > 5 && (
                          <button
                            onClick={() => setShowAllBuildings(!showAllBuildings)}
                            className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                          >
                            {showAllBuildings ? (isBn ? 'কম দেখুন' : 'See Less') : (isBn ? 'সি মোর' : 'See More')}
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className={(landlordProfile?.buildingMode === 'multi' && !currentBuildingId) ? "block md:hidden" : "block"}>
                      <div className="grid grid-cols-2 gap-2 lg:gap-3 items-stretch">
                        <div className="min-w-0">
                          <p className="text-white/50 text-[8px] lg:text-[9px] font-black uppercase tracking-widest mb-0.5 lg:mb-1 leading-tight">{isBn ? 'মাসিক আয়' : 'Monthly Revenue'}</p>
                          <p className="text-xl sm:text-2xl lg:text-4xl font-black text-white tracking-tight tabular-nums break-words leading-none">{formatBDT(leaseSummary.totalMonthlyRevenue)}</p>
                          <p className="text-[8px] lg:text-[9px] font-bold text-white/50 mt-1 leading-tight">{isBn ? 'চলমান লিজ (ভাড়া + সার্ভিস)' : 'live leases (rent + service)'}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl lg:rounded-2xl p-2 lg:p-3 min-w-0">
                          <p className="text-white/50 text-[8px] lg:text-[9px] font-black uppercase tracking-widest mb-0.5 lg:mb-1 leading-tight">{isBn ? 'সিকিউরিটি ডিপোজিট' : 'Security Deposits'}</p>
                          <p className="text-base sm:text-lg lg:text-2xl font-black text-white tabular-nums break-words leading-none">{formatBDT(leaseSummary.totalSecurityDeposits)}</p>
                          <p className="text-[8px] lg:text-[9px] font-bold text-white/50 mt-1 leading-tight">{isBn ? 'লিজ শেষে রিটার্নযোগ্য' : 'returnable at lease end'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 lg:gap-3 mt-2 lg:mt-3">
                        <div className="bg-white/5 rounded-xl lg:rounded-2xl px-2.5 py-2 lg:p-3 flex items-center justify-between gap-2 lg:flex-col lg:items-start">
                          <p className="text-white/50 text-[9px] font-black uppercase tracking-widest lg:mb-1">{stageLabel('active', language)}</p>
                          <p className="text-lg lg:text-2xl font-black text-green-400 tabular-nums leading-none">{leaseSummary.activeCount}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl lg:rounded-2xl px-2.5 py-2 lg:p-3 flex items-center justify-between gap-2 lg:flex-col lg:items-start">
                          <p className="text-white/50 text-[9px] font-black uppercase tracking-widest lg:mb-1">{stageLabel('done', language)}</p>
                          <p className="text-lg lg:text-2xl font-black text-white/70 tabular-nums leading-none">{leaseSummary.doneCount}</p>
                        </div>
                      </div>
                      {leaseSummary.endingSoonCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setLeaseStageFilter('active')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 mt-2 lg:mt-3 rounded-xl bg-amber-400/15 border border-amber-300/25 text-left transition-colors hover:bg-amber-400/25"
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
                </div>

                {!(landlordProfile?.buildingMode === 'multi' && !currentBuildingId) && (
                  <>
                    <div className="hidden lg:block bg-white rounded-2xl lg:rounded-[2rem] p-4 lg:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none shrink-0">
                      <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 lg:mb-4 flex items-center gap-2">
                        <Activity size={14} className="text-gray-400" />
                        {language === 'বাংলা' ? 'লিজ স্ট্যাটাস ফ্লো' : 'Lease Status Flow'}
                      </h4>
                      <div className="space-y-2 lg:space-y-3">
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
                      className="bg-white dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800/60 rounded-2xl lg:rounded-[2rem] p-4 lg:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3 transition-colors shrink-0 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 shrink-0">
                          <Wallet size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black text-gray-900 dark:text-white">{language === 'বাংলা' ? 'ভাড়া কালেকশন' : 'Rent Collection'}</p>
                          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-tight">{language === 'বাংলা' ? '১২ মাসের লেজার, পেমেন্ট আপডেট' : '12-month ledger, mark paid, reminders'}</p>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </>
                )}
              </aside>

              {/* ── RIGHT MAIN ── */}
              <main className="lg:col-span-8 w-full lg:h-full lg:overflow-y-auto custom-scrollbar pb-24 lg:pb-4 lg:pr-3 min-w-0">
                {landlordProfile?.buildingMode === 'multi' && !currentBuildingId ? (
                  <div className="w-full">
                    {/* BUILDINGS OVERVIEW */}
                    <div className="sticky top-0 z-30 bg-gray-50/85 backdrop-blur-md -mx-3 sm:-mx-4 lg:-mx-3 px-3 sm:px-4 lg:px-6 pt-2 pb-3 mb-2 lg:pt-1">
                      <div className="flex items-center justify-between">
                        <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white text-[10px] font-black text-gray-700 uppercase tracking-widest shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
                          <Building2 size={12} className="text-[#ba0036]"/>
                          <span className="hidden sm:inline">{isBn ? 'আপনার বিল্ডিংসমূহ' : 'Your Buildings'}</span>
                          <span className="text-gray-400 tabular-nums">{landlordProfile.buildings?.length || 0}</span>
                        </span>
                        <button 
                          onClick={() => setShowBuildingForm(true)}
                          className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-[#ba0036] hover:bg-[#a0002f] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(186,0,54,0.25)] hover:shadow-[0_6px_16px_rgba(186,0,54,0.35)] active:scale-95"
                        >
                          <Plus size={14} strokeWidth={3} className="shrink-0"/> <span className="hidden sm:inline">{isBn ? 'নতুন বিল্ডিং' : 'Add Building'}</span><span className="sm:hidden">{isBn ? 'যোগ করুন' : 'Add'}</span>
                        </button>
                      </div>
                    </div>
                    {showBuildingForm && (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 animate-in slide-in-from-top-2">
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3">{isBn ? 'নতুন বিল্ডিং যোগ করুন' : 'Add New Building'}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <input type="text" value={newBuilding.name} onChange={(e) => setNewBuilding({...newBuilding, name: e.target.value})} placeholder={isBn ? 'বাসার নাম' : 'House Name'} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold" />
                          <input type="text" value={newBuilding.location} onChange={(e) => setNewBuilding({...newBuilding, location: e.target.value})} placeholder={isBn ? 'ঠিকানা' : 'Location'} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {[
                            { value: 'residential', label: 'Residential', icon: <Home size={14}/> },
                            { value: 'commercial', label: 'Commercial', icon: <Building2 size={14}/> },
                          ].map(opt => (
                            <button key={opt.value} type="button" onClick={() => setNewBuilding({...newBuilding, type: opt.value, category: opt.value === 'residential' ? 'flat' : ''})}
                              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${newBuilding.type === opt.value ? 'border-[#ba0036] bg-red-50 text-[#ba0036]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                              {opt.icon} {opt.label}
                            </button>
                          ))}
                        </div>
                        {/* Categories are handled via 'Add Tenant' format selection */}
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowBuildingForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100">{isBn ? 'বাতিল' : 'Cancel'}</button>
                          <button onClick={() => {
                            if(!newBuilding.name) return;
                            setLandlordProfile({ ...landlordProfile, buildings: [...(landlordProfile.buildings||[]), { ...newBuilding, id: 'bldg_' + Date.now(), createdAt: new Date().toISOString() }] });
                            setShowBuildingForm(false);
                            setNewBuilding({ name: '', location: '', type: 'residential', category: 'flat' });
                          }} className="px-4 py-2 rounded-xl text-xs font-black bg-[#ba0036] text-white hover:bg-[#a0002f]">{isBn ? 'যোগ করুন' : 'Save'}</button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(landlordProfile.buildings || []).map(bldg => {
                         if (editingBuildingId === bldg.id) {
                           return (
                             <div key={bldg.id} className="bg-white rounded-2xl shadow-sm border border-[#ba0036]/20 p-5 mb-4 animate-in fade-in">
                               <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3">{isBn ? 'বিল্ডিং এডিট করুন' : 'Edit Building'}</h3>
                               <div className="grid grid-cols-1 gap-3 mb-3">
                                 {/* Name disabled because modifying it breaks existing booking relationships */}
                                 <div>
                                   <p className="text-[10px] font-bold text-gray-400 mb-1 ml-1">{isBn ? 'বিল্ডিংয়ের নাম পরিবর্তন করা যাবে না কারণ এটি ভাড়াটিয়াদের সাথে যুক্ত আছে।' : 'Name cannot be changed as it is linked to existing tenants.'}</p>
                                   <input type="text" disabled value={editBuildingData.name} className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-500 w-full cursor-not-allowed" />
                                 </div>
                                 <input type="text" value={editBuildingData.location} onChange={(e) => setEditBuildingData({...editBuildingData, location: e.target.value})} placeholder={isBn ? 'ঠিকানা' : 'Location'} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold w-full" />
                               </div>
                               <div className="grid grid-cols-2 gap-2 mb-3">
                                 {[
                                   { value: 'residential', label: 'Residential', icon: <Home size={14}/> },
                                   { value: 'commercial', label: 'Commercial', icon: <Building2 size={14}/> },
                                 ].map(opt => (
                                   <button key={opt.value} type="button" onClick={() => setEditBuildingData({...editBuildingData, type: opt.value, category: opt.value === 'residential' ? 'flat' : ''})}
                                     className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${editBuildingData.type === opt.value ? 'border-[#ba0036] bg-red-50 text-[#ba0036]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                     {opt.icon} {opt.label}
                                   </button>
                                 ))}
                               </div>
                               <div className="flex justify-end gap-2">
                                 <button onClick={() => setEditingBuildingId(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100">{isBn ? 'বাতিল' : 'Cancel'}</button>
                                 <button onClick={() => {
                                   setLandlordProfile({ 
                                     ...landlordProfile, 
                                     buildings: landlordProfile.buildings.map(b => b.id === bldg.id ? { ...b, location: editBuildingData.location, type: editBuildingData.type, category: editBuildingData.category } : b)
                                   });
                                   setEditingBuildingId(null);
                                 }} className="px-4 py-2 rounded-xl text-xs font-black bg-[#ba0036] text-white hover:bg-[#a0002f]">{isBn ? 'সেভ করুন' : 'Save Changes'}</button>
                               </div>
                             </div>
                           );
                         }

                         const bldgBookings = bookings.filter(b => b.property === bldg.name);
                         const bldgSummary = getLeaseSummary(bldgBookings, todayDate);
                         const typeLabel = bldg.type === 'residential' ? (isBn ? 'Residential' : 'Residential') : bldg.type === 'commercial' ? (isBn ? 'Commercial' : 'Commercial') : (isBn ? 'Hostel' : 'Hostel');
                         const catLabel = bldg.category ? (bldg.category.charAt(0).toUpperCase() + bldg.category.slice(1)).replace('-', ' ') : '';
                         const typeColor = bldg.type === 'residential' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : bldg.type === 'commercial' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200';
                         const iconBg = bldg.type === 'residential' ? 'bg-emerald-100 text-emerald-600' : bldg.type === 'commercial' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600';
                         
                         return (
                           <div key={bldg.id} onClick={() => setCurrentBuildingId(bldg.id)} 
                             className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 cursor-pointer hover:shadow-lg hover:border-gray-200 transition-all group relative overflow-visible shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                             {/* Top accent line */}
                             <div className={`absolute top-0 left-0 right-0 h-1 ${bldg.type === 'residential' ? 'bg-emerald-500' : bldg.type === 'commercial' ? 'bg-blue-500' : 'bg-purple-500'}`}/>
                             <div className="flex items-start justify-between mb-3 pt-1">
                               <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                                 {bldg.type === 'hostel' ? <Users size={18}/> : bldg.type === 'commercial' ? <Building2 size={18}/> : <Home size={18}/>}
                               </div>
                               <div className="flex items-center gap-2 relative">
                                 <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${typeColor}`}>{typeLabel}</span>
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setActiveBldgDropdown(activeBldgDropdown === bldg.id ? null : bldg.id);
                                   }}
                                   className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors relative z-10"
                                 >
                                   <MoreVertical size={16} />
                                 </button>
                                 {activeBldgDropdown === bldg.id && (
                                   <>
                                     <div 
                                       className="fixed inset-0 z-20" 
                                       onClick={(e) => { e.stopPropagation(); setActiveBldgDropdown(null); }}
                                     />
                                     <div className="absolute right-0 top-8 w-36 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100 py-1 z-30 animate-in fade-in zoom-in-95 origin-top-right">
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setActiveBldgDropdown(null);
                                           setEditBuildingData({ ...bldg });
                                           setEditingBuildingId(bldg.id);
                                         }}
                                         className="w-full text-left px-4 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                       >
                                         <Edit3 size={12} /> {isBn ? 'এডিট করুন' : 'Edit'}
                                       </button>
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setActiveBldgDropdown(null);
                                           setDeleteBuildingId(bldg.id);
                                         }}
                                         className="w-full text-left px-4 py-2 text-[11px] font-black text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                       >
                                         <Trash2 size={12} /> {isBn ? 'ডিলিট করুন' : 'Delete'}
                                       </button>
                                     </div>
                                   </>
                                 )}
                               </div>
                             </div>
                             <h4 className="text-sm font-black text-gray-900 group-hover:text-[#ba0036] transition-colors mb-1 pr-8">{bldg.name}</h4>
                             <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mb-3"><MapPin size={10}/> {bldg.location}</p>
                             
                             <div className="grid grid-cols-2 gap-2 mb-3">
                               <div className="bg-gray-50 rounded-xl p-2.5 min-w-0">
                                 <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{isBn ? 'মাসিক আয়' : 'Monthly Rent'}</p>
                                 <p className="text-xs font-black text-gray-900 tabular-nums leading-none truncate">{formatBDT(bldgSummary.totalMonthlyRevenue)}</p>
                               </div>
                               <div className="bg-gray-50 rounded-xl p-2.5 min-w-0">
                                 <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{isBn ? 'সিকিউরিটি' : 'Security'}</p>
                                 <p className="text-xs font-black text-gray-900 tabular-nums leading-none truncate">{formatBDT(bldgSummary.totalSecurityDeposits)}</p>
                               </div>
                             </div>

                             <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                               <div className="flex items-center gap-2">
                                 {catLabel && <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[9px] font-black uppercase tracking-wider">{catLabel}</span>}
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-gray-500 tabular-nums">{bldgBookings.length} {isBn ? 'ভাড়াটিয়া' : 'Tenants'}</span>
                                 <ArrowRight size={12} className="text-gray-300 group-hover:text-[#ba0036] group-hover:translate-x-1 transition-all"/>
                               </div>
                             </div>
                           </div>
                         );
                      })}
                      {(!landlordProfile.buildings || landlordProfile.buildings.length === 0) && !showBuildingForm && (
                        <div className="text-center py-12 px-5 bg-white rounded-2xl shadow-sm">
                          <Building2 className="text-gray-300 mx-auto mb-3" size={32} />
                          <h3 className="text-sm font-black text-gray-900">{isBn ? 'কোনো বিল্ডিং নেই' : 'No buildings yet'}</h3>
                          <p className="text-xs font-bold text-gray-500 mt-1">{isBn ? 'উপরের বাটনে ক্লিক করে প্রথম বিল্ডিং যোগ করুন' : 'Click the button above to add your first building'}</p>
                        </div>
                      )}
                    </div>
                    {(!landlordProfile.buildings || landlordProfile.buildings.length <= 1) && (
                      <div className="mt-4 flex justify-end">
                        <button onClick={() => {
                          setLandlordProfile({...landlordProfile, buildingMode: 'single'});
                          setCurrentBuildingId(null);
                        }} className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest bg-white/50 hover:bg-white px-3 py-2 rounded-lg w-fit shadow-sm border border-gray-100">
                          <Home size={14}/> {isBn ? 'সিঙ্গেল বিল্ডিং মোডে ফিরে যান' : 'Switch to Single Building Mode'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full">
                    {/* TENANTS VIEW (Current normal view, optionally with Back button) */}
                    {landlordProfile?.buildingMode === 'multi' && currentBuildingId && (
                      <div className="mb-2">
                        <button onClick={() => setCurrentBuildingId(null)} className="flex items-center gap-1 text-[10px] font-black text-gray-500 hover:text-[#ba0036] transition-colors uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-lg w-fit">
                          <ChevronLeft size={12}/> {isBn ? 'সব বিল্ডিং-এ ফিরে যান' : 'Back to Buildings'}
                        </button>
                      </div>
                    )}
                    {landlordProfile?.buildingMode === 'single' && (
                      <div className="mb-2 flex justify-end">
                        <button onClick={() => setLandlordProfile({...landlordProfile, buildingMode: 'multi'})} className="flex items-center gap-1.5 text-[10px] font-black text-[#ba0036] hover:bg-red-50 transition-colors uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg w-fit shadow-sm border border-gray-100">
                          <Plus size={12}/> {isBn ? 'আরও বিল্ডিং যোগ করুন' : 'Add Another Building'}
                        </button>
                      </div>
                    )}
                {/* Sticky toolbar — three layouts, one set of controls.
                    Because <main> is the scroll container this bar pins to the
                    top of the list as the host scrolls, on every device.

                      mobile   line 1 · count chip + Add Tenant (fills the row)
                               line 2 · search, full width
                               line 3 · filter pills
                      tablet   line 1 · count chip + search + Add Tenant
                               line 2 · filter pills
                      desktop  one line · chip + search + pills + Add Tenant

                    The search box and the pills that act on it always sit
                    together, directly above the results they produce. */}
                <div className="sticky top-0 z-30 bg-gray-50/85 backdrop-blur-md -mx-3 sm:-mx-4 lg:-mx-3 px-3 sm:px-4 lg:px-6 pt-2 pb-3 mb-2 lg:pt-1">
                  {/* Line 1 — who/what + the primary action. Search joins this
                      line from the sm breakpoint up. */}
                  <div className="flex items-center gap-2">
                    {countChip}
                    {/* Search absorbs the slack, so it's the one thing that
                        shrinks when the desktop row gets tight — the pills and
                        the action keep their full size. */}
                    <div className="hidden sm:block flex-1 min-w-0">{searchField}</div>
                    {/* Desktop: pills sit inline, between search and the action. */}
                    <div className="hidden lg:flex items-center gap-1.5 shrink-0">{filterPills}</div>
                    {addTenantButton}
                  </div>
                  {/* Line 2 — mobile-only search, given the full width so a long
                      tenant name is actually readable while typing. */}
                  <div className="mt-2 sm:hidden">{searchField}</div>
                  {/* Line 3 — filter pills (below desktop). Horizontal scroll
                      keeps them on one line on the narrowest phones. */}
                  <div className="flex lg:hidden items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">{filterPills}</div>
                </div>

                {/* List — flat sequence of compact rows. Sticky toolbar above
                    floats on scroll. forceOpen auto-engages when the filtered
                    list is ≤5 rows; small portfolios then get a fully-readable
                    static layout instead of accordion friction. */}
                {(() => {
                  const AUTO_EXPAND_THRESHOLD = 5;
                  const forceOpen = false;
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
                          {/* Same treatment as the toolbar action so the primary
                              step looks identical wherever the host meets it. */}
                          <button
                            type="button"
                            onClick={() => isPremium ? openBlankLease(getPrefillBuilding()) : setActiveModal('premium_gate')}
                            aria-label={isBn ? 'নতুন ভাড়াটিয়া যোগ করুন' : 'Add a new tenant'}
                            className="group relative overflow-hidden w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-br from-[#ba0036] via-[#d1003d] to-[#ff004c] text-white shadow-[0_8px_24px_rgba(186,0,54,0.3)] hover:shadow-[0_12px_32px_rgba(186,0,54,0.4)] active:scale-[0.97] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ba0036]/40 focus-visible:ring-offset-2"
                          >
                            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <span className="relative inline-flex items-center justify-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                                {isPremium ? <Plus size={15} strokeWidth={3.5}/> : <Crown size={14} strokeWidth={3}/>}
                              </span>
                              <span className="text-xs font-black uppercase tracking-widest">{isBn ? 'ভাড়াটিয়া যোগ করুন' : 'Add Tenant'}</span>
                            </span>
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
                  </div>
                )}
              </main>

              {/* Building Delete Confirmation Modal */}
              {deleteBuildingId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteBuildingId(null)} />
                  <div className="relative bg-white w-full max-w-sm rounded-[1.5rem] shadow-2xl p-6 sm:p-7 overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mb-4 text-rose-600 shrink-0">
                        <Trash2 size={24} strokeWidth={2.5}/>
                      </div>
                      <h3 className="text-[17px] sm:text-lg font-black text-gray-900 leading-tight mb-2">
                        {isBn ? 'এই বিল্ডিংটি ডিলিট করতে চান?' : 'Delete this building?'}
                      </h3>
                      <p className="text-sm font-bold text-gray-500 mb-6 leading-relaxed">
                        {isBn 
                          ? 'বিল্ডিং মুছে ফেললে এটি ড্যাশবোর্ড থেকে সরিয়ে দেওয়া হবে। কিন্তু ভাড়াটিয়াদের লিজ এবং হিস্ট্রি ডিলিট হবে না।'
                          : 'This will remove the building from your dashboard. Note: Any existing tenants and leases linked to this building will not be deleted.'}
                      </p>
                      
                      <div className="flex flex-col-reverse sm:flex-row items-stretch w-full gap-2.5">
                        <button
                          onClick={() => setDeleteBuildingId(null)}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors active:scale-[0.98]"
                        >
                          {isBn ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          onClick={() => {
                            setLandlordProfile({ 
                              ...landlordProfile, 
                              buildings: landlordProfile.buildings.filter(b => b.id !== deleteBuildingId) 
                            });
                            setDeleteBuildingId(null);
                          }}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors active:scale-[0.98] shadow-[0_4px_16px_rgba(225,29,72,0.25)]"
                        >
                          {isBn ? 'ডিলিট করুন' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── AI Ledger Scanner modal ─────────────────────────────────────────
              Renders on top of everything when the host taps "AI Scan". Closed
              by the modal itself via onClose; new bookings are surfaced through
              handleBookingUpdated so the list refreshes without a full reload. */}
          <AiLedgerScannerModal
            isOpen={showAiScanner}
            onClose={() => setShowAiScanner(false)}
            language={language}
            landlordProfile={landlordProfile}
            currentBuildingId={currentBuildingId}
            showToast={showToast}
            onBookingsCreated={(newBookings) => {
              newBookings.forEach(b => handleBookingUpdated(b));
              setShowAiScanner(false);
            }}
          />
          </>
          );
}
