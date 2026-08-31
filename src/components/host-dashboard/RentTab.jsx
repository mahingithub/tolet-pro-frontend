import React, { useState, useEffect, useRef } from 'react';
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
  // `Map` is deliberately NOT imported from lucide-react here: the icon of
  // that name shadows the JavaScript Map built-in for the whole module, and
  // `new Map()` in this file then tries to construct an icon component.
  Bed, Bath, Maximize2, Sofa, Trash, ImagePlus, BedDouble, Home, Utensils, Users, Coffee, Leaf
} from 'lucide-react';
import { CloudOff } from 'lucide-react';
import useHostSyncStore from '../../store/useHostSyncStore';
import { pendingKeys } from '../../store/hostOps';
import { scopeBookings, bookingInBuilding, sortRentUnits } from '../../utils/buildingScope';
import { primaryOccupant, occupantCount } from '../../utils/occupants';
import { buildingTypeLabel, buildingTypeColor, normaliseSubCategory } from '../../utils/buildingTypes';
import VacantUnitsPanel from './VacantUnitsPanel';
import RentRoomCard from './RentRoomCard';
import RentRoomModal from './RentRoomModal';
import OverdueDrawer from './OverdueDrawer';

// Month labels for the 12-month rent matrix cells. Kept local to this file so
// the tab renders standalone — the parent has its own copy for other tabs.
const MONTH_NAMES_EN_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_BN_SHORT = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্ট','অক্টো','নভে','ডিসে'];


export default function RentTab(props) {
  const {
    today, bookings, language, searchQuery, setSearchQuery, rentPriorityFilter, setRentPriorityFilter,
    expandedRentId, setExpandedRentId, activeDropdownId, setActiveDropdownId,
    handleCallUser, resolveTenantUserId, setActiveTab, t, openMarkPaid, markRoomPaid, ledgerYear, setLedgerYear,
    rentUnitsOf, getMonthCollectionSummary, enumerateLeaseMonths, getRentStatus, monthKey,
    monthFullLabel, monthShortLabel, getDueDate, parseMonthKey, formatBDT, formatDate,
    computeBookingStatus, daysUntilNextDue, computeLeaseStage, isOpenEndedLease,
    sendRentReminder, openTenantProfile, openChatPanel, setActiveModal, exportRentCsv, isPremium,
    landlordProfile, setLandlordProfile, currentBuildingId, setCurrentBuildingId
  } = props;

  // Rent written on this phone that hasn't reached the server yet. Collecting
  // on the stairs means half of it is recorded with no signal, so the register
  // says out loud which rows the roommates' — and the tenants' — copies do not
  // know about yet. See store/useHostSyncStore.js.
  const syncQueue = useHostSyncStore((s) => s.queue);
  const flushSync = useHostSyncStore((s) => s.flush);
  const syncError = useHostSyncStore((s) => s.lastError);
  const clearSyncError = useHostSyncStore((s) => s.clearError);
  const pendingKeySet = React.useMemo(() => pendingKeys(syncQueue), [syncQueue]);

  const [showAllBuildings, setShowAllBuildings] = useState(false);
  // On a phone the ledger + reminder rail used to sit ON TOP of the list, so a
  // landlord scrolled past roughly a screenful of summary before reaching the
  // first tenant — with 70–80 rooms that is the wrong thing to make them pay
  // for on every visit. Below lg it becomes a left drawer instead: same
  // content, one element, out of the way until asked for.
  // The reminder drawer, opened from a tab on the LEFT edge — the mirror of
  // the day/night tab on the right. The Shared Ledger and Overdue Tenants
  // sections stay where they are; this is a second, always-reachable way to
  // see who owes money without scrolling back up.
  const [remindersOpen, setRemindersOpen] = useState(false);
  // The room being looked at — { key, focusUnitId }. Rent Collection opens ONE
  // room at a time in a modal instead of expanding accordions in place: with
  // seventy rooms, expanding one buried the rest and the landlord lost their
  // place on the page they were reading.
  const [roomModal, setRoomModal] = useState(null);

  // Everything that used to "expand a tenant" — the Bookings tab's Invoice
  // button, the overdue drawer, a notification deep link — still hands us an
  // id. It now opens that tenant's ROOM, with their seat already unfolded.
  // Rent rows are `bookingId::memberId`; a bare booking id arrives from the
  // screens that don't know about seats.
  useEffect(() => {
    if (!expandedRentId) return;
    const id = String(expandedRentId);
    const [realId] = id.split('::');
    setRoomModal({ key: realId, focusUnitId: id.includes('::') ? id : null });
  }, [expandedRentId]);

  // Leaving the building closes the room. Otherwise the modal for a room in
  // Building A stayed on screen over Building B's list, or reappeared when the
  // landlord came back — the state outlived the thing it was describing.
  //
  // Guarded by a ref rather than firing on mount: this effect runs AFTER the
  // one above, so an unguarded version would clear the room that arriving from
  // the Bookings tab's Invoice button had just opened.
  const buildingRef = useRef(currentBuildingId);
  useEffect(() => {
    if (buildingRef.current === currentBuildingId) return;
    buildingRef.current = currentBuildingId;
    setRoomModal(null);
  }, [currentBuildingId]);

          const todayDate = today;
          const isBn = language === 'বাংলা';
          
          // Scoped by buildingId, in one shared place — see utils/buildingScope.js.
          // The name-equality filters that used to live here (one copy per screen)
          // are why hostel and single-room leases vanished after a successful save.
          const baseBookings = scopeBookings(bookings, landlordProfile?.buildings, currentBuildingId);

          // Rent Collection counts one unit per occupant: expand each booking
          // into its active members (each carrying their split share + own
          // ledger), so the KPI hero + overdue list are per person and match the
          // per-roommate cards below.
          // Ordered the way a landlord walks the building: ground floor up,
          // then 101 · 102 · 110 within each floor, then seat by seat inside a
          // room. Rent Collection used to render in insertion order — whatever
          // sequence the leases happened to be created in — which for a hostel
          // meant a list that matched nothing about the actual building.
          // The building on screen. Vacancies are per-building; on the
          // all-buildings overview there is no single room list to show.
          const activeBuilding = currentBuildingId
            ? (landlordProfile?.buildings || []).find(b => String(b.id) === String(currentBuildingId)) || null
            : (landlordProfile?.buildingMode === 'single' ? (landlordProfile?.buildings?.[0] || null) : null);

          // Rooms, in building order, each holding its seats. A booking is made
          // once but rent is collected every month, so THIS is the screen that
          // has to be organised: a twelve-seat hostel was twelve loose cards
          // with nothing saying which room any of them belonged to.
          const groupByRoom = (units) => {
            const groups = [];
            const byKey = new Map();
            units.forEach((u) => {
              const key = String(u.__realId || u.id);
              if (!byKey.has(key)) { const g = { key, units: [] }; byKey.set(key, g); groups.push(g); }
              byKey.get(key).units.push(u);
            });
            return groups;
          };

          const rentUnits = sortRentUnits(baseBookings.flatMap(rentUnitsOf));
          const sm = getMonthCollectionSummary(rentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
          const collectedPct = sm.expectedTotal > 0 ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100)) : 0;
          const yearMonths = Array.from({ length: 12 }, (_, i) => monthKey(ledgerYear, i + 1));
          // Bucket tenants by their CURRENT-month rent state — drives the
          // priority filter pills + per-row status badge. Aligned with the
          // matrix vocabulary so colours stay consistent across the tab.
          const tenantBucket = (booking) => {
            const months = enumerateLeaseMonths(booking.leaseStart, booking.leaseEnd, todayDate);
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
          // lease term overlaps that year. An ONGOING tenancy has no end, so it
          // belongs to every year from its move-in onward. Bad/missing dates
          // fall back to "included" so a parse error never hides real data.
          const leaseTouchesYear = (b, year) => {
            const sy = new Date(b.leaseStart).getFullYear();
            if (Number.isNaN(sy)) return true;
            if (isOpenEndedLease(b)) return sy <= year;
            const ey = new Date(b.leaseEnd).getFullYear();
            if (Number.isNaN(ey)) return true;
            return sy <= year && year <= ey;
          };
          const viewingPastYear = ledgerYear < today.getFullYear();
          // Base list for the year: overlaps the picked year, not cancelled, and
          // — for the current/future year — not an already-ended (expired) lease.
          // Ended tenants therefore drop off the live Rent Collection view, but
          // For the CSV export, we only want rows relevant to the year being viewed
          const yearBookings = baseBookings.filter(b => {
            if (b.status === 'cancelled') return false;
            if (!leaseTouchesYear(b, ledgerYear)) return false;
            if (!viewingPastYear && computeLeaseStage(b, today) === 'done') return false;
            return true;
          });
          // One unit per occupant (each carrying their divided share + own
          // ledger), in building order: ground floor up, 101 · 102 · 110 within
          // a floor, seat by seat within a room.
          const rentRows = sortRentUnits(yearBookings.flatMap(rentUnitsOf));

          // ── ROOMS, NOT PEOPLE ────────────────────────────────────────────
          // The list is rooms. Room 201 with one occupant paid and one not used
          // to come apart — the payer to the cleared list, the other to arrears —
          // so the room itself, the thing the landlord owns and walks into,
          // appeared on the screen nowhere. A room's status is now the status of
          // the WORST seat in it: one person short and the whole room is short.
          const ROOM_BUCKET_ORDER = ['overdue', 'partial', 'upcoming', 'cleared', 'none'];
          const roomsFrom = (units) => groupByRoom(units).map((g) => {
            const buckets = g.units.map(tenantBucket);
            const bucket = ROOM_BUCKET_ORDER.find(b => buckets.includes(b)) || 'none';
            return { ...g, buckets, bucket };
          });

          // Every room in the year, unfiltered — what the modal looks a room up
          // in, so a deep link still opens it when a filter would have hidden it.
          const allRooms = roomsFrom(rentRows);
          // Search matches a PERSON but keeps their whole room: finding "Mahin"
          // and being shown half of 201 is how the room came apart in the first
          // place.
          const searchedRooms = allRooms.filter(g => g.units.some(matchesQuery));
          const visibleRooms = rentPriorityFilter === 'all'
            ? searchedRooms
            : searchedRooms.filter(g => g.bucket === rentPriorityFilter);
          // The occupant rows behind the visible rooms — what the CSV exports and
          // what "is this list empty" is measured against.
          const filteredBookings = visibleRooms.flatMap(g => g.units);
          const counts = allRooms.reduce((acc, g) => { acc[g.bucket] = (acc[g.bucket] || 0) + 1; return acc; }, {});
          // Auto-pin: overdue + partial rooms when the filter is "all" — the
          // rooms the host actually needs to do something about.
          const attentionRooms = rentPriorityFilter === 'all'
            ? visibleRooms.filter(g => g.bucket === 'overdue' || g.bucket === 'partial')
            : [];
          const otherRooms = rentPriorityFilter === 'all'
            ? visibleRooms.filter(g => g.bucket !== 'overdue' && g.bucket !== 'partial')
            : visibleRooms;

          // The room on screen. Resolved from the year's rooms first, and — if
          // it isn't there — rebuilt from the booking directly.
          //
          // The fallback is not defensive padding: `rentRows` drops leases that
          // have ENDED and leases outside the selected ledger year, but the
          // Bookings tab's Invoice button, the overdue drawer and notification
          // deep links all hand us ids without knowing that. Without this,
          // tapping Invoice on a closed-out lease silently did nothing at all.
          const openRoom = (() => {
            if (!roomModal) return null;
            const inYear = allRooms.find(g => g.key === roomModal.key);
            if (inYear) return inYear;
            const source = baseBookings.filter(b => String(b.id) === String(roomModal.key));
            return roomsFrom(sortRentUnits(source.flatMap(rentUnitsOf)))[0] || null;
          })();
          const closeRoomModal = () => { setRoomModal(null); setExpandedRentId?.(null); };

          // Coloured palette per current-month bucket — re-used across the
          // avatar gradient, status pill, and progress bar.
          const bucketTheme = {
            cleared:  { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'CLEARED', icon: <CheckCircle2 size={10} strokeWidth={3}/>, bar: 'bg-emerald-500', avatar: 'bg-gradient-to-br from-indigo-500 to-purple-600' },
            partial:  { cls: 'bg-amber-50 text-amber-700 border-amber-100',       label: language === 'বাংলা' ? 'আংশিক' : 'PARTIAL',     icon: <Hourglass size={10} strokeWidth={3}/>,    bar: 'bg-amber-500',   avatar: 'bg-gradient-to-br from-indigo-500 to-purple-600' },
            overdue:  { cls: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',          label: language === 'বাংলা' ? 'বকেয়া' : 'OVERDUE',     icon: <AlertCircle size={10} strokeWidth={3}/>,  bar: 'bg-fuchsia-500',    avatar: 'bg-gradient-to-br from-fuchsia-500 to-pink-600' },
            upcoming: { cls: 'bg-orange-50 text-orange-700 border-orange-100',    label: language === 'বাংলা' ? 'আসন্ন' : 'UPCOMING',    icon: <Clock size={10} strokeWidth={3}/>,        bar: 'bg-orange-400',  avatar: 'bg-gradient-to-br from-indigo-500 to-purple-600' },
            none:     { cls: 'bg-gray-100 text-gray-600 border-gray-200',         label: language === 'বাংলা' ? 'লিজের বাইরে' : 'OUTSIDE', icon: <MinusCircle size={10} strokeWidth={3}/>, bar: 'bg-gray-300',    avatar: 'bg-gradient-to-br from-indigo-500 to-purple-600' },
          };

          // ── ONE TENANT'S RENT CARD ─────────────────────────────────────
          // header (avatar + tenant + status) + this-month ledger panel +
          // 12-month matrix + per-month rows + actions.
          //
          // This is no longer a row in the list — the list is rooms. It renders
          // INSIDE RentRoomModal, for the seat the landlord picked, which is why
          // it is passed down as `renderRow` and always called with
          // `forceOpen = true`: there is nothing left to collapse into once a
          // room has been opened and a person chosen. The collapsible branches
          // stay because this same card is what every existing deep link and
          // mark-paid flow already writes to.
          const renderRentRow = (booking, forceOpen = false) => {
            const bucket = tenantBucket(booking);
            const theme = bucketTheme[bucket];
            // Pass the ledger year so an ongoing tenancy keeps producing months
            // when the host steps forward past the current year.
            const leaseMonths = enumerateLeaseMonths(booking.leaseStart, booking.leaseEnd, ledgerYear);
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
            // person on the booking is "Mofizul Islam". Same helper the Bookings
            // tab uses, so one person never reads as two different names on two
            // screens.
            const occupant = primaryOccupant(booking, language);
            const displayTenant = occupant.name;
            const displayAvatar = occupant.avatar;
            const displayInit = occupant.init;
            // An expanded seat IS exactly one person — the room modal's header
            // already says how many seats the room has. Only a whole-unit row
            // (a flat the landlord recorded as housing a family) can stand for
            // several occupants, and `__realId` is what tells the two apart.
            const extraMembers = booking.__realId ? 0 : Math.max(0, occupantCount(booking) - 1);

            // No DOM `id` on the root below, on purpose. The deep-link target
            // `rent-<bookingId>` belongs to the ROOM CARD in the list — the
            // thing that can be scrolled to. This card renders inside the
            // modal, and on a single-tenant booking its id would have been
            // character-for-character the card's, putting two elements with one
            // id in the document and making getElementById a coin toss.
            return (
              <div key={booking.id} className={`bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100/80 overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-[0_8px_30px_rgba(0,0,0,0.08)]' : 'hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)]'}`}>

                {/* ── Compact row — always visible. Click-to-toggle suppressed in forceOpen mode. ── */}
                <button
                  type="button"
                  onClick={forceOpen ? undefined : () => setExpandedRentId(isExpanded ? null : booking.id)}
                  className={`w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-3 py-2 sm:py-2.5 text-left transition-colors ${forceOpen ? 'cursor-default' : 'hover:bg-gray-50/50'}`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white font-black text-[10px] sm:text-[11px] shrink-0 ${theme.avatar} overflow-hidden`}>
                    {displayAvatar ? (
                      <img src={displayAvatar} alt={displayTenant} className="w-full h-full object-cover" />
                    ) : (
                      displayInit
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-xs sm:text-[13px] font-black text-gray-900 truncate">{displayTenant}</h4>
                      {pendingKeySet.has(`booking:${booking.id}`) && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shrink-0 inline-flex items-center gap-0.5"
                          title={language === 'বাংলা' ? 'নেট এলে সার্ভারে চলে যাবে' : 'Goes to the server once you are back online'}
                        >
                          <CloudOff size={9} /> {language === 'বাংলা' ? 'অপেক্ষায়' : 'Pending'}
                        </span>
                      )}
                      {extraMembers > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-gray-100 text-gray-600 border border-gray-200 shrink-0 tabular-nums" title={language === 'বাংলা' ? 'আরও সদস্য' : 'more members'}>+{extraMembers}</span>
                      )}
                      {booking.floorNumber && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0 inline-flex items-center gap-0.5">
                          {language === 'বাংলা' ? 'ফ্লোর' : 'Floor'} {booking.floorNumber}
                        </span>
                      )}
                      {/* Residential / Commercial / Hostel property badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 inline-flex items-center gap-0.5 ${booking.dealType === 'commercial' ? 'bg-violet-50 text-violet-700 border-violet-200' : booking.propertyType === 'hostel' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-indigo-50 text-indigo-700 border-blue-200'}`}>
                        {booking.dealType === 'commercial'
                          ? (<>🏢<span> {language === 'বাংলা' ? 'কমার্শিয়াল' : 'Commercial'}</span></>)
                          : booking.propertyType === 'hostel'
                            ? (<>🛏️<span> {language === 'বাংলা' ? 'হোস্টেল' : 'Hostel'}</span></>)
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
                                ? <span className="text-fuchsia-600 tabular-nums">{formatBDT(expectedThisMonth)} {language === 'বাংলা' ? 'বকেয়া' : 'overdue'}</span>
                                : <span className="text-gray-600 tabular-nums">{formatBDT(expectedThisMonth)} {language === 'বাংলা' ? 'আসন্ন' : 'upcoming'}</span>}
                          {nextDue && (
                            <>
                              <span className="mx-1 text-gray-300">·</span>
                              <span className={`${nextDue.daysFromNow < 0 ? 'text-fuchsia-600' : nextDue.daysFromNow <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
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
                    <div className="shrink-0 p-1 rounded-lg bg-gray-50 text-gray-400">
                      {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    </div>
                  )}
                </button>

                {/* ── Expanded body — ledger panel + 12-month matrix ───── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/40 px-3 sm:px-4 py-3 animate-in slide-in-from-top-2 fade-in duration-300">

                    {/* Every rent card — flat / single-room / hostel — uses the
                        SAME classic ledger layout so Rent Collection looks
                        uniform. Per-seat management stays on the Bookings tab. */}

                    {/* This-month ledger panel — totals + progress + edit */}
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">
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
                          <p className={`text-xs sm:text-sm font-black tabular-nums mt-0.5 ${balanceThisMonth > 0 ? 'text-fuchsia-600' : 'text-gray-400'}`}>{formatBDT(balanceThisMonth)}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
                             style={{ width: expectedThisMonth > 0 ? `${(paidThisMonth / expectedThisMonth) * 100}%` : '0%' }} />
                      </div>
                    </div>

                    {/* Year stepper (inline) — lets the host browse other years */}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex bg-white p-1 rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] items-center gap-0.5">
                        <button onClick={() => setLedgerYear(y => y - 1)} className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50" aria-label="Prev year">
                          <ArrowLeft size={10} />
                        </button>
                        <span className="px-1.5 text-[10px] font-black text-gray-900 tabular-nums">{ledgerYear}</span>
                        <button onClick={() => setLedgerYear(y => y + 1)} className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50" aria-label="Next year">
                          <ArrowRight size={10} />
                        </button>
                      </div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest tabular-nums">{paidThisYear}/{monthsThisYearInLease || 12} {language === 'বাংলা' ? 'মাস' : 'months'}</span>
                    </div>

                    {/* 12-month rent grid — the headline feature */}
                    <div className="mt-1.5 bg-white p-2 rounded-xl border border-gray-100">
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
                            cellStatus === 'paid' ? 'bg-indigo-500 text-white hover:bg-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.35)]' :
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
                              className={`relative aspect-square rounded-md text-[7px] sm:text-[8px] font-black uppercase tracking-tight transition-all flex flex-col items-center justify-center ${colorClass} ${isCurrent ? 'ring-[1.5px] ring-offset-[1px] ring-gray-900' : ''}`}
                            >
                              <span className="leading-none">{(language === 'বাংলা' ? MONTH_NAMES_BN_SHORT : MONTH_NAMES_EN_SHORT)[parseMonthKey(k).month - 1]}</span>
                              {cellStatus === 'paid' && <CheckCheck size={8} className="mt-0.5" strokeWidth={3} />}
                              {cellStatus === 'partial' && <Hourglass size={7} className="mt-0.5" strokeWidth={3} />}
                              {cellStatus === 'due-marked' && <AlertCircle size={7} className="mt-0.5" strokeWidth={3} />}
                            </button>
                          );
                        })}
                      </div>
                      {nextDue && status !== 'completed' && (
                        <div className="mt-2 flex items-center justify-end">
                          <p className={`text-[8px] font-black tracking-wide whitespace-nowrap shrink-0 px-1.5 py-0.5 rounded-md ${nextDue.daysFromNow < 0 ? 'bg-red-50 text-red-600' : nextDue.daysFromNow <= (booking.reminderLeadDays || 3) ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                            <Clock size={8} className="inline -mt-0.5 mr-1" />
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
                    <div className="mt-2.5 flex flex-nowrap items-center justify-between gap-1.5 overflow-x-auto no-scrollbar pb-1 -mb-1">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            const k = nextDue?.key || monthKey(todayDate.getFullYear(), todayDate.getMonth() + 1);
                            openMarkPaid(booking, k);
                          }}
                          className="px-2 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 transition-all rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 flex items-center gap-1 shrink-0"
                        >
                          <CheckCircle2 size={10} className="shrink-0"/> {language === 'বাংলা' ? 'পেইড মার্ক' : 'Mark Paid'}
                        </button>
                        {nextDue && nextDue.daysFromNow <= (booking.reminderLeadDays || 3) && (
                          <button onClick={() => sendRentReminder(booking, nextDue.key)} className="px-2 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 flex items-center gap-1 shrink-0">
                            <BellRing size={10} className="shrink-0"/> {language === 'বাংলা' ? 'রিমাইন্ডার' : 'Remind'}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Profile — opens the tenant's trust card (/tenant/:id). */}
                        <button
                          onClick={() => openTenantProfile(resolveTenantUserId(booking), { name: booking.tenant, avatar: booking.tenantAvatar })}
                          className="px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 flex items-center gap-1 shrink-0"
                          title={language === 'বাংলা' ? 'টেন্যান্ট প্রোফাইল' : 'Tenant profile'}
                        >
                          <UserCircle size={10} className="shrink-0"/> {language === 'বাংলা' ? 'প্রোফাইল' : 'Profile'}
                        </button>
                        <button
                          onClick={() => openChatPanel(booking.chatId || `chat-${booking.id}`, { source: 'host-rent', peerUserId: resolveTenantUserId(booking), peerName: booking.tenant, peerAvatar: booking.tenantAvatar, tenantName: booking.tenant, tenantPhone: booking.tenantPhone, propertyTitle: booking.property })}
                          className="px-2 py-1.5 bg-gray-900 text-white hover:bg-[#ba0036] transition-all rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 shadow-md flex items-center gap-1.5 shrink-0"
                        >
                          <MessageCircle size={10} className="shrink-0"/> {language === 'বাংলা' ? 'মেসেজ' : 'Message'}
                        </button>
                      </div>
                    </div>

                    {/* Per-month ledger detail rows — collapsible secondary view */}
                    <details className="mt-2.5 group">
                      <summary className="cursor-pointer list-none flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100/60 transition-colors">
                        <ChevronDown size={10} className="text-gray-400 group-open:rotate-180 transition-transform"/>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                          {language === 'বাংলা' ? `${ledgerYear} সালের বিবরণ` : `${ledgerYear} Ledger Details`}
                        </span>
                      </summary>
                      <div className="mt-1.5 space-y-1">
                        {yearMonths.filter(k => leaseMonths.includes(k)).map(k => {
                          const cellStatus = getRentStatus(booking, k, todayDate);
                          const entry = booking.ledger?.[k];
                          const due = getDueDate(k, booking.rentDueDay);
                          const dotClass =
                            cellStatus === 'paid' ? 'bg-indigo-500' :
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
                                  <span className="text-indigo-700 inline-flex items-center gap-1"><CheckCheck size={10} strokeWidth={3}/> {formatBDT(entry.amount || booking.monthlyRent)}{entry.method ? ` · ${entry.method}` : ''}</span>
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 lg:h-[calc(100vh-140px)] overflow-visible lg:overflow-hidden">

              {/* ── LEFT RAIL — full Shared Ledger ALWAYS visible (mobile + desktop) ── */}
              <aside className="lg:col-span-4 w-full flex flex-col gap-3 lg:gap-5 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pt-1 lg:pb-4 lg:pr-1">

                {/* Shared Ledger hero — always visible, SLIM on mobile.
                    On a phone this card used to push the tenant rows well below
                    the fold. The month label now rides on the title line, the
                    "Expected" figure shares its row with the collection rate,
                    and padding tightens up. Desktop (lg) keeps the tall hero. */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl lg:rounded-[2rem] p-3.5 lg:p-7 text-white shadow-[0_6px_20px_rgba(0,0,0,0.15)] lg:shadow-[0_15px_40px_rgba(0,0,0,0.2)] relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                  <div className="flex items-center justify-between gap-2 mb-2.5 lg:mb-1 relative z-10">
                    <h3 className="text-[13px] lg:text-2xl font-black truncate">{language === 'বাংলা' ? 'যৌথ হিসাব' : 'Shared Ledger'}</h3>
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
                  <p className="hidden xl:block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-7 relative z-10">
                    {monthFullLabel(sm.key, language)} · {language === 'বাংলা' ? 'এই মাসের আদায়' : "This Month's Collection"}
                  </p>
                  <div className="space-y-2.5 xl:space-y-6 relative z-10">
                    {/* ── Collected here, not yet at the server ────────────
                        Rent taken in a stairwell is saved on this phone and
                        goes out on its own when there is signal. Tapping tries
                        it now, which is what a landlord reaches for the moment
                        they see a bar come back. */}
                    {syncQueue.length > 0 && (
                      <button
                        type="button"
                        onClick={flushSync}
                        className="w-full flex items-center gap-2 rounded-xl bg-amber-400/15 border border-amber-300/30 px-3 py-2 text-left active:scale-[0.99] transition"
                      >
                        <CloudOff size={14} className="text-amber-200 shrink-0" />
                        <span className="text-[11px] font-black text-amber-100 flex-1">
                          {isBn
                            ? `${syncQueue.length}টি হিসাব এখনো সার্ভারে যায়নি — ফোনে সেভ আছে`
                            : `${syncQueue.length} entr${syncQueue.length === 1 ? 'y' : 'ies'} not sent yet — saved on this phone`}
                        </span>
                        <span className="text-[10px] font-black text-amber-200 uppercase tracking-wider shrink-0">
                          {isBn ? 'আবার চেষ্টা' : 'Retry'}
                        </span>
                      </button>
                    )}
                    {/* A write the SERVER refused — the seat filled up, the row
                        was deleted. Retrying for ever would be a lie, so it is
                        said once, with the reason, and dismissed by the host. */}
                    {syncError && (
                      <div className="w-full flex items-start gap-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-300/30 px-3 py-2">
                        <AlertCircle size={14} className="text-fuchsia-200 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-black text-fuchsia-100 flex-1 leading-relaxed">
                          {syncError.subject ? `${syncError.subject} — ` : ''}{syncError.message}
                        </span>
                        <button type="button" onClick={clearSyncError} className="text-fuchsia-200 shrink-0" aria-label={isBn ? 'বন্ধ' : 'Dismiss'}>
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {(landlordProfile?.buildingMode === 'multi' && !currentBuildingId) && (
                      <div className="hidden md:block space-y-3 mb-4">
                        {(landlordProfile.buildings || []).map((bldg, idx) => {
                          const bldgBookings = bookings.filter(b => bookingInBuilding(b, bldg));
                          const bldgRentUnits = bldgBookings.flatMap(rentUnitsOf);
                          const bldgSm = getMonthCollectionSummary(bldgRentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
                          return (
                            <div key={bldg.id} className={`bg-white/5 rounded-xl p-3 ${!showAllBuildings && idx >= 5 ? 'hidden' : ''}`}>
                              <h4 className="text-xs font-black text-white mb-2 flex items-center justify-between">
                                <span>{bldg.name}</span>
                                {bldgSm.overdueCount > 0 && (
                                  <span className="text-[8px] font-black bg-fuchsia-500/20 text-fuchsia-200 px-1.5 py-0.5 rounded uppercase tracking-wider">{bldgSm.overdueCount} {isBn ? 'বকেয়া' : 'Overdue'}</span>
                                )}
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-white/50 text-[8px] font-black uppercase tracking-widest mb-0.5">{isBn ? 'প্রত্যাশিত' : 'Expected'}</p>
                                  <p className="text-sm font-black text-white tabular-nums">{formatBDT(bldgSm.expectedTotal)}</p>
                                </div>
                                <div>
                                  <p className="text-white/50 text-[8px] font-black uppercase tracking-widest mb-0.5">{isBn ? 'আদায়' : 'Collected'}</p>
                                  <p className="text-sm font-black text-emerald-400 tabular-nums">{formatBDT(bldgSm.collectedTotal)}</p>
                                </div>
                              </div>
                              <div className="mt-2.5 flex items-center gap-3 border-t border-white/10 pt-2.5 text-[9px] font-black uppercase tracking-widest">
                                <span className="text-emerald-400">{bldgSm.paidCount} {isBn ? 'ক্লিয়ার' : 'Cleared'}</span>
                                <span className="text-orange-400">{bldgSm.totalDueCount - bldgSm.paidCount} {isBn ? 'বাকি' : 'Due'}</span>
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
                      <div className="flex items-end justify-between gap-3 xl:block">
                        <div className="min-w-0">
                          <p className="text-white/50 text-[8px] xl:text-[9px] font-black uppercase tracking-widest mb-0.5 xl:mb-1 leading-tight">
                            <span className="xl:hidden">{monthFullLabel(sm.key, language)} · </span>{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}
                          </p>
                          <p className="text-2xl xl:text-4xl font-black text-white tracking-tight tabular-nums leading-none break-words">{formatBDT(sm.expectedTotal)}</p>
                        </div>
                        <div className="shrink-0 text-right xl:hidden">
                          <p className="text-white/50 text-[8px] font-black uppercase tracking-widest leading-tight">{language === 'বাংলা' ? 'রেট' : 'Rate'}</p>
                          <p className="text-lg font-black text-white tabular-nums leading-none">{collectedPct}%</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 xl:gap-4 mt-2 xl:mt-4">
                        <div className="bg-white/5 rounded-xl xl:rounded-2xl p-2 xl:p-3 min-w-0">
                          <p className="text-white/50 text-[8px] xl:text-[9px] font-black uppercase tracking-widest mb-0.5 xl:mb-1 leading-tight">{language === 'বাংলা' ? 'আদায় হয়েছে' : 'Collected'}</p>
                          <p className="text-base xl:text-xl font-black text-green-400 tracking-tight tabular-nums leading-none break-words">{formatBDT(sm.collectedTotal)}</p>
                          <p className="text-[8px] xl:text-[9px] text-white/60 font-bold mt-1 leading-tight">{sm.paidCount}/{sm.totalDueCount} {language === 'বাংলা' ? 'ভাড়াটিয়া' : 'tenants'}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl xl:rounded-2xl p-2 xl:p-3 min-w-0">
                          <p className="text-white/50 text-[8px] xl:text-[9px] font-black uppercase tracking-widest mb-0.5 xl:mb-1 leading-tight">{language === 'বাংলা' ? 'বাকি' : 'Outstanding'}</p>
                          <p className="text-base xl:text-xl font-black text-orange-400 tracking-tight tabular-nums leading-none break-words">{formatBDT(sm.outstandingTotal)}</p>
                          <p className="text-[8px] xl:text-[9px] text-white/60 font-bold mt-1 leading-tight">
                            <span className={sm.overdueCount > 0 ? 'text-red-300' : 'text-white/60'}>
                              {sm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'overdue'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 xl:mt-4">
                        <div className="hidden xl:flex items-center justify-between mb-1.5">
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
                </div>

                {/* The Overdue Tenants box used to sit here. It moved into
                    OverdueDrawer — a floating tab, like the theme switcher on
                    the opposite edge. Rendering it in both places put the same
                    list on screen twice. */}

                {/* Legend — desktop only. Hidden on mobile + iPad (below xl,
                    where the rail stacks on top of the list); shown only in the
                    xl sidebar layout so it doesn't crowd the smaller screens. */}
                {!(landlordProfile?.buildingMode === 'multi' && !currentBuildingId) && (
                  <div className="hidden lg:block bg-white rounded-2xl lg:rounded-[2rem] p-4 lg:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-none shrink-0">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">{language === 'বাংলা' ? 'লেজেন্ড' : 'Legend'}</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[10px] font-bold text-gray-600">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-indigo-500 inline-block"></span>{language === 'বাংলা' ? 'পেইড' : 'Paid'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-400 inline-block"></span>{language === 'বাংলা' ? 'আংশিক' : 'Partial'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-red-500 inline-block"></span>{language === 'বাংলা' ? 'বকেয়া' : 'Overdue'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-orange-400 inline-block"></span>{language === 'বাংলা' ? 'শীঘ্রই' : 'Due soon'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-gray-100 inline-block"></span>{language === 'বাংলা' ? 'আসন্ন' : 'Upcoming'}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-gray-50 inline-block border border-dashed border-gray-300"></span>{language === 'বাংলা' ? 'লিজের বাইরে' : 'Outside'}</span>
                  </div>
                </div>
                )}
              </aside>



              {/* ── RIGHT MAIN ── */}
              <main className="lg:col-span-8 w-full lg:h-full lg:overflow-y-auto custom-scrollbar pb-24 lg:pr-3 min-w-0">
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
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(landlordProfile.buildings || []).map(bldg => {
                         const bldgBookings = bookings.filter(b => bookingInBuilding(b, bldg));
                         const bldgRentUnits = bldgBookings.flatMap(rentUnitsOf);
                         const bldgSm = getMonthCollectionSummary(bldgRentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
                         // Same shared classification the Bookings tab uses, so
                         // a Bachelor Flat reads identically on every screen.
                         const typeLabel = buildingTypeLabel(bldg, isBn);
                         const typeColor = buildingTypeColor(bldg);
                         const subCat    = normaliseSubCategory(bldg.subCategory);
                         const iconBg = subCat === 'hostel' ? 'bg-orange-100 text-orange-600'
                           : subCat === 'single_room' ? 'bg-sky-100 text-sky-600'
                           : bldg.category === 'commercial' ? 'bg-violet-100 text-violet-600'
                           : 'bg-emerald-100 text-emerald-600';
                         return (
                           <div key={bldg.id} onClick={() => setCurrentBuildingId(bldg.id)} 
                             className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 cursor-pointer hover:shadow-lg hover:border-gray-200 transition-all group relative overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                             <div className={`absolute top-0 left-0 right-0 h-1 ${subCat === 'hostel' ? 'bg-orange-500' : subCat === 'single_room' ? 'bg-sky-500' : bldg.category === 'commercial' ? 'bg-violet-500' : 'bg-emerald-500'}`}/>
                             <div className="flex items-start justify-between mb-3 pt-1">
                               <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                                 {subCat === 'hostel' ? <Users size={18}/> : subCat === 'single_room' ? <BedDouble size={18}/> : bldg.category === 'commercial' ? <Building2 size={18}/> : <Home size={18}/>}
                               </div>
                               <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${typeColor}`}>{typeLabel}</span>
                             </div>
                             <h4 className="text-sm font-black text-gray-900 group-hover:text-[#ba0036] transition-colors mb-1">{bldg.name}</h4>
                             <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mb-3"><MapPin size={10}/> {bldg.address || bldg.location}</p>
                             
                             <div className="grid grid-cols-2 gap-2 mb-3">
                               <div className="bg-gray-50 rounded-xl p-2.5 min-w-0">
                                 <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{isBn ? 'প্রত্যাশিত' : 'Expected'}</p>
                                 <p className="text-xs font-black text-gray-900 tabular-nums leading-none truncate">{formatBDT(bldgSm.expectedTotal)}</p>
                               </div>
                               <div className="bg-gray-50 rounded-xl p-2.5 min-w-0">
                                 <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{isBn ? 'আদায়' : 'Collected'}</p>
                                 <p className="text-xs font-black text-green-600 tabular-nums leading-none truncate">{formatBDT(bldgSm.collectedTotal)}</p>
                               </div>
                             </div>

                             <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                               <div className="flex items-center gap-2">
                                 <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 tabular-nums">{bldgSm.paidCount} {isBn ? 'ক্লিয়ার' : 'Cleared'}</span>
                                 <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-orange-50 text-orange-600 tabular-nums">{bldgSm.totalDueCount - bldgSm.paidCount} {isBn ? 'বাকি' : 'Due'}</span>
                                 {bldgSm.overdueCount > 0 && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest tabular-nums ml-1">{bldgSm.overdueCount} {isBn ? 'বকেয়া' : 'Overdue'}</span>}
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-gray-500 tabular-nums">{bldgBookings.length} {isBn ? 'ভাড়াটিয়া' : 'Tenants'}</span>
                                 <ArrowRight size={12} className="text-gray-300 group-hover:text-[#ba0036] group-hover:translate-x-1 transition-all"/>
                               </div>
                             </div>
                           </div>
                         );
                      })}
                      {(!landlordProfile.buildings || landlordProfile.buildings.length === 0) && (
                        <div className="text-center py-12 px-5 bg-white rounded-2xl shadow-sm sm:col-span-2">
                          <Building2 className="text-gray-300 mx-auto mb-3" size={32} />
                          <h3 className="text-sm font-black text-gray-900">{isBn ? 'কোনো বিল্ডিং নেই' : 'No buildings yet'}</h3>
                          <p className="text-xs font-bold text-gray-500 mt-1">{isBn ? 'টেন্যান্ট ট্যাবে গিয়ে প্রথম বিল্ডিং যোগ করুন' : 'Go to the Add Tenant tab to add your first building'}</p>
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
                    {landlordProfile?.buildingMode === 'multi' && currentBuildingId && (() => {
                      const bldg = landlordProfile.buildings?.find(b => b.id === currentBuildingId);
                      return (
                        <div className="mb-2 flex items-center gap-2">
                          <button onClick={() => setCurrentBuildingId(null)} className="flex items-center gap-1 text-[10px] font-black text-gray-500 hover:text-[#ba0036] transition-colors uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-lg w-fit">
                            <ChevronLeft size={12}/> {isBn ? 'সব বিল্ডিং' : 'All Buildings'}
                          </button>
                          {bldg && <span className="text-xs font-black text-gray-700">· {bldg.name}</span>}
                        </div>
                      );
                    })()}
                    {landlordProfile?.buildingMode === 'single' && (
                      <div className="mb-2 flex justify-end">
                        <button onClick={() => setLandlordProfile({...landlordProfile, buildingMode: 'multi'})} className="flex items-center gap-1.5 text-[10px] font-black text-[#ba0036] hover:bg-red-50 transition-colors uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg w-fit shadow-sm border border-gray-100">
                          <Plus size={12}/> {isBn ? 'আরও বিল্ডিং যোগ করুন' : 'Add Another Building'}
                        </button>
                      </div>
                    )}
                {/* Sticky toolbar — two rows. Row 1 = controls (title chip, year
                    stepper, search, export); Row 2 = the filter pills, which wrap
                    instead of scrolling sideways on mobile / iPad. */}
                <div className="sticky top-0 z-30 bg-gray-50/85 backdrop-blur-md -mx-3 sm:-mx-4 xl:-mx-3 px-3 sm:px-4 xl:px-6 pt-2 pb-3 mb-2 xl:pt-1">
                  {/* Row 1 — controls: title chip, year stepper, search, export.
                      Filter pills live on their own wrapping row (Row 2) below so
                      nothing needs horizontal scrolling on mobile / iPad. */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Title corner chip — small, gray, with live count. */}
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/70 text-[9px] xl:text-[10px] font-black text-gray-700 uppercase tracking-widest shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <Wallet size={11} className="text-emerald-600"/>
                      <span className="hidden sm:inline">{language === 'বাংলা' ? 'রুম' : 'Rooms'}</span>
                      <span className="text-gray-400 tabular-nums">{visibleRooms.length}</span>
                    </span>
                    {/* Year stepper. */}
                    <div className="shrink-0 flex items-center gap-1 bg-white rounded-xl px-1 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                      <button onClick={() => setLedgerYear(y => y - 1)} className="p-1 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"><ChevronLeft size={12}/></button>
                      <span className="text-[11px] font-black text-gray-900 tabular-nums w-10 text-center">{ledgerYear}</span>
                      <button onClick={() => setLedgerYear(y => y + 1)} className="p-1 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"><ChevronRight size={12}/></button>
                    </div>
                    {/* Search input — grows to fill the rest of the row. Same
                        field treatment as the Add Tenant tab (clear button,
                        brand focus ring) so the two toolbars feel like one. */}
                    <div className="relative flex-1 min-w-0">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={language === 'বাংলা' ? 'ভাড়াটিয়া খুঁজুন...' : 'Search tenants...'}
                        aria-label={language === 'বাংলা' ? 'ভাড়াটিয়া খুঁজুন' : 'Search tenants'}
                        className="w-full pl-8 pr-8 py-2.5 rounded-xl bg-white text-[11px] font-bold text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent focus:border-[#ba0036]/25 focus:shadow-[0_4px_14px_rgba(186,0,54,0.08)] focus:outline-none placeholder:text-gray-400 transition-all"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label={language === 'বাংলা' ? 'সার্চ মুছুন' : 'Clear search'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      )}
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
                  {/* Row 2 — priority filter pills on their own row. They scroll horizontally on small screens. */}
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar pb-1">
                    {[
                      { k: 'all',      label: language === 'বাংলা' ? 'সকল' : 'All',        cls: 'bg-gray-900 text-white' },
                      { k: 'overdue',  label: language === 'বাংলা' ? 'বকেয়া' : 'Overdue',  cls: 'bg-fuchsia-600 text-white' },
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

                {/* List — ONE ROW PER ROOM. Tapping a room opens it in a modal
                    (RentRoomModal) with nothing else on screen; the ledger of a
                    seat inside it is one more tap. Nothing expands in place, so
                    a seventy-room building reads the same on row 1 and row 70. */}
                {(() => {
                  if (visibleRooms.length === 0) {
                    // Nothing to collect. Distinguish "no tenants at all" (send
                    // the host to create a lease — the ledger is built FROM a
                    // lease) from "this filter is empty" (offer All).
                    const noLeasesAtAll = rentRows.length === 0;
                    const isBn = language === 'বাংলা';
                    return (
                      <div className="text-center py-12 sm:py-16 px-5 bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border-none">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                           <Receipt className="text-gray-300" size={26} />
                        </div>
                        <h3 className="text-sm font-black text-gray-900">
                          {noLeasesAtAll
                            ? (isBn ? 'এখনো কোনো ভাড়াটিয়া নেই।' : 'No tenants yet.')
                            : (isBn ? 'এই ফিল্টারে কোনো ভাড়াটিয়া পাওয়া যায়নি।' : 'No tenants match this filter.')}
                        </h3>
                        <p className="text-[11px] font-bold text-gray-500 mt-1.5 max-w-[320px] mx-auto leading-relaxed">
                          {noLeasesAtAll
                            ? (isBn ? 'লিজ তৈরি করলেই এখানে ১২ মাসের রেন্ট লেজার চালু হবে।' : 'Create a lease and a 12-month rent ledger opens up here.')
                            : (isBn ? '"সকল" ফিল্টার দেখুন।' : 'Try the "All" filter.')}
                        </p>
                        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
                          {noLeasesAtAll ? (
                            <button
                              onClick={() => setActiveTab('bookings')}
                              className="w-full sm:w-auto bg-[#ba0036] hover:bg-[#90002a] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_6px_18px_rgba(186,0,54,0.28)] transition-all inline-flex items-center justify-center gap-2 active:scale-95"
                            >
                              <Plus size={15} /> {isBn ? 'নতুন লিজ' : 'New Lease'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setRentPriorityFilter('all')}
                              className="w-full sm:w-auto bg-white border-2 border-gray-200 text-gray-600 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all inline-flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              {isBn ? 'সকল দেখুন' : 'Show all'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const roomCard = (g) => (
                    <RentRoomCard
                      key={g.key}
                      units={g.units}
                      bucket={g.bucket}
                      buckets={g.buckets}
                      language={language}
                      formatBDT={formatBDT}
                      activeMonthKey={sm.key}
                      isOpen={roomModal?.key === g.key}
                      onOpen={() => setRoomModal({ key: g.key, focusUnitId: null })}
                    />
                  );
                  return (
                    <div className="space-y-2">
                      {rentPriorityFilter === 'all' && attentionRooms.length > 0 ? (
                        <>
                          <div className="flex items-center gap-2 mt-1 px-1 pt-1">
                            <AlertCircle size={12} className="text-fuchsia-600 shrink-0"/>
                            <span className="text-[10px] font-black text-fuchsia-700 uppercase tracking-widest">
                              {language === 'বাংলা' ? 'এখনই দরকার' : 'Needs Attention'} · {attentionRooms.length}
                            </span>
                            <div className="flex-1 h-px bg-fuchsia-200/60"/>
                          </div>
                          {attentionRooms.map(roomCard)}
                          {otherRooms.length > 0 && (
                            <div className="flex items-center gap-2 px-1 pt-3 pb-1">
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                {language === 'বাংলা' ? 'অন্যান্য রুম' : 'All Other Rooms'} · {otherRooms.length}
                              </span>
                              <div className="flex-1 h-px bg-gray-200"/>
                            </div>
                          )}
                          {otherRooms.map(roomCard)}
                        </>
                      ) : (
                        visibleRooms.map(roomCard)
                      )}
                    </div>
                  );
                })()}

                {/* Where the money is NOT coming from. Rent Collection only
                    ever listed rows that had a tenant, so an empty room was
                    invisible on the one screen that should account for it. */}
                <VacantUnitsPanel
                  building={activeBuilding}
                  language={language}
                  formatBDT={formatBDT}
                />
                  </div>
                )}
              </main>

              {/* Reminders on the left edge, like the theme tab opposite — and
                  the only place overdue tenants are listed.
                  Only INSIDE a building: `sm` is computed from baseBookings,
                  which scopeBookings() has already narrowed to the building on
                  screen, so the tab always shows that building's arrears and
                  swaps when the landlord switches buildings. On the
                  all-buildings overview there is no single set to chase. */}
              {!(landlordProfile?.buildingMode === 'multi' && !currentBuildingId) && (
              <OverdueDrawer
                open={remindersOpen}
                onOpen={() => setRemindersOpen(true)}
                onClose={() => setRemindersOpen(false)}
                tenants={sm.overdueTenants || []}
                language={language}
                formatBDT={formatBDT}
                onRemind={(u) => sendRentReminder?.(u, monthKey(todayDate.getFullYear(), todayDate.getMonth() + 1))}
                onOpenTenant={(u) => {
                  // Their ROOM, with their seat unfolded — the drawer names a
                  // person, but the thing you settle is the room they're in.
                  const id = String(u.id);
                  setRoomModal({ key: id.split('::')[0], focusUnitId: id.includes('::') ? id : null });
                  setRemindersOpen(false);
                }}
              />
              )}

              {/* ── ONE ROOM, nothing else ────────────────────────────────
                  The room the landlord tapped, on top of everything, with its
                  seats, its outstanding total and a single button that settles
                  the whole room. */}
              {openRoom && (
                <RentRoomModal
                  units={openRoom.units}
                  buckets={openRoom.buckets}
                  language={language}
                  formatBDT={formatBDT}
                  activeMonthKey={sm.key}
                  monthFullLabel={monthFullLabel}
                  renderRow={renderRentRow}
                  markRoomPaid={markRoomPaid}
                  focusUnitId={roomModal?.focusUnitId}
                  onClose={closeRoomModal}
                />
              )}

            </div>
          </div>
  );
}
