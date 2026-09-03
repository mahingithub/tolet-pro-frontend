import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Bed, Bath, Maximize2, Sofa, Trash, ImagePlus, BedDouble, Home, Utensils, Users, Coffee, Map, Leaf, HeartHandshake, BookOpen, ScanLine, Loader2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext.jsx';
import { propertyService, subscribeUserProperties } from '../services/Propertyservice';
import { getDynamicFields } from '../constants/propertyFields';
import { subscriptionService } from '../services/subscriptionService';
import boostService from '../services/boostService';
import { listHostInquiries, updateInquiryStatus, deleteInquiry, replyToInquiry, respondVisit, proposeVisit } from "../services/inquiryService.js";
// Ledger / member / lease writes no longer go straight out from here — they go
// through the offline queue (hostSync below), which owns delivery. Only the
// reads and the create call are still made directly.
import { createBooking as createBookingApi, listHostBookings } from "../services/bookingService.js";
import { getRoomTypes, firstRoomTypeId, roomLabel } from '../constants/roomCategories';
import MembersManager from "./MembersManager.jsx";
import DashboardTab from "./host-dashboard/DashboardTab";
import ProfileTab from "./host-dashboard/ProfileTab";
import PropertiesTab from "./host-dashboard/PropertiesTab";
import DocumentsTab from "./host-dashboard/DocumentsTab";
import InquiriesTab from "./host-dashboard/InquiriesTab";
import BookingsTab from "./host-dashboard/BookingsTab";
import RentTab from "./host-dashboard/RentTab";
import AnalyticsTab from "./host-dashboard/AnalyticsTab";
import PaymentsTab from "./host-dashboard/PaymentsTab";
import SettingsTab from "./host-dashboard/SettingsTab";
import { listMyPaymentMethods } from "../services/paymentMethodService.js";
import { listHostRentPayments } from "../services/rentPaymentService.js";
import PaymentSettings from './payments/PaymentSettings';
import PendingRentPayments from './payments/PendingRentPayments';
import PaymentSettingsPopup, { PAYMENT_PROMO_DISMISS_KEY } from './payments/PaymentSettingsPopup';
import RentPaymentHistory from './payments/RentPaymentHistory';
import { listDocuments as listDocsApi, uploadDocument as uploadDocApi, deleteDocument as deleteDocApi, downloadUrlFor } from "../services/documentService.js";
import tenantService from "../services/tenantService.js";
import callProvider from "../services/callProvider";
import { listNotifications, getUnreadCount, markRead, markAllRead } from "../services/notificationService.js";
import { openConversation, sendMessage, sendMediaMessage } from "../services/chatService.js";
import { uploadAvatar, uploadVerificationDoc } from "../services/authService";
import ProfileSection from './shared/ProfileSection';
import FreeProTrialModal from './FreeProTrialModal';
import VerificationModal from './VerificationModal';
import SharedSettings from './shared/SharedSettings';
import Smartalertspage from './Smartalertspage';
import SmartAlertsPopup from './SmartAlertsPopup';
import { buildRentAlerts, buildLeaseAlerts, buildInquiryAlerts } from '../utils/rentAlerts';
import { loadSeenMap, isInquiryUnread, markInquirySeen } from '../utils/inquiryUnread';
import { INQUIRY_BUCKETS, countInquiryBuckets } from '../utils/inquiryStatus';
import Aiinsightspage from './Aiinsightspage';
import MediaLightbox from './MediaLightbox';
import { jsPDF } from 'jspdf';
import useDeepLinkHighlight, { highlightNotifTarget } from '../hooks/useDeepLinkHighlight';
import useTabHistory from '../hooks/useTabHistory';
import useBackGuard, { useOverlayNavigate } from '../hooks/useBackGuard';
import LandlordHomeChoiceModal from './shared/LandlordHomeChoiceModal';
import TenantInfoForm from './host-dashboard/TenantInfoForm';
import { emptyTenantProfile, validateTenantProfile, toTenantProfile, tenantFieldReport } from '../utils/tenantFields';
import { scanTenantForm } from '../services/aiScanService';
import { scopeBookings, bookingInBuilding, sortByBuildingOrder } from '../utils/buildingScope';
import { paidSoFar, remainingFor, applyPaymentToEntry } from '../utils/rentLedger';
import { primaryOccupant, occupantNames, occupantCount, activeMembers, advanceCollected, ALL_TENANTS } from '../utils/occupants';
import { ADVANCE_PAYMENT_METHODS } from '../utils/tenantRent';
import { PLAY_STORE_URL } from '../hooks/useAppInstall';
import { SITE_URL } from '../seo/siteConfig';
import { directUpload } from '../services/cloudinaryUpload';
import AgreementBrandModal from './host-dashboard/AgreementBrandModal.jsx';
import { submitOnEnter } from '../utils/submitOnEnter';
import { listBuildings } from '../services/buildingService';
import useHostSyncStore from '../store/useHostSyncStore';
import { applyOp } from '../store/hostOps';

// The offline write queue (store/useHostSyncStore.js). Reached through
// getState() rather than a hook so a write from anywhere in this file doesn't
// re-render the whole dashboard; the pending COUNT is subscribed to separately,
// where it is actually displayed.
//
// `enqueue` returns the operation and `applyOp` applies it. They are two steps
// rather than one because React can call a `setState(prev => …)` updater twice
// for a single event (it does in StrictMode) — queueing inside one recorded the
// same rent payment twice. Queue once, out here; apply purely, in there.
const hostSync = {
  enqueue: (action, args) => useHostSyncStore.getState().enqueue(action, args),
  replay: (world) => useHostSyncStore.getState().replay(world),
};

// Queue a write and fold it into the bookings list — the shape every call site
// below uses.
const queueBookingOp = (setBookings, action, args) => {
  const op = hostSync.enqueue(action, args);
  setBookings((prev) => applyOp({ bookings: prev, units: [] }, op).bookings);
  return op;
};

// Every tab the dashboard can render, in sidebar order. This is the single
// list the Back button and any ?tab= deep link are validated against — an id
// missing here silently falls back to HOST_ROOT_TAB, so keep it in sync with
// `menuItems` (plus the sub-views: rent, analytics, profile).
const HOST_TABS = [
  'dashboard', 'documents', 'analytics', 'properties', 'inquiries',
  'bookings', 'rent', 'payments', 'smartAlerts', 'aiInsights',
  'settings', 'profile',
];
// The landlord's home. Back from here leaves the dashboard entirely.
const HOST_ROOT_TAB = 'dashboard';

// `data-tour` anchors for the guided onboarding tour (see context/TourContext).
// Only the tabs the host tour actually walks through are listed; anything else
// resolves to undefined, which React drops from the DOM entirely.
const TOUR_TAB_ANCHORS = {
  dashboard:   'dashboard-tab',
  documents:   'documents-tab',
  inquiries:   'inquiries-tab',
  bookings:    'bookings-tab',
  payments:    'payments-tab',
  smartAlerts: 'smart-alerts-tab',
  aiInsights:  'ai-insights-tab',
};

// Payment channels offered when converting an inquiry into a booking / recording
// an advance. Order matches the most-used mobile-money + bank rails in Bangladesh.
// Shared with SeatTenantModal — see utils/tenantRent.js.
const PAYMENT_METHODS = ADVANCE_PAYMENT_METHODS;

/**
 * How big a KPI figure can be printed without clipping.
 *
 * The money is the loudest thing on these tiles by design, but a half-width
 * tile on a 375px phone only has ~115px of room: "৳ 12,34,567" at 22px needs
 * 132px and was truncating to an ellipsis — the exact number the landlord came
 * to read, replaced by three dots. Stepping down by length keeps the everyday
 * four- and five-figure totals big, and keeps the rare six-figure one WHOLE.
 */
const kpiValueSize = (text) => {
  const len = String(text ?? '').length;
  if (len <= 8) return 'text-[22px] md:text-3xl';
  if (len <= 11) return 'text-[19px] md:text-2xl';
  return 'text-[16px] md:text-xl';
};

/**
 * Same idea, for the narrower per-building tiles. `break-words` was the first
 * attempt and it split "৳ 12,49,967" across three lines mid-digit, which is
 * arguably less readable than the ellipsis it replaced.
 */
const bldgValueSize = (text) => (String(text ?? '').length > 9 ? 'text-[12.5px]' : 'text-[15px]');

/**
 * Adapt a property record returned by propertyService (used by the public
 * listing + details pages, where price is a Number) onto the shape the host
 * dashboard portfolio cards expect (price as a comma-formatted string and
 * an `addedDate` for the "NEW" badge). When the backend ships, the API will
 * return whatever shape it returns and this is the only place we'll need to
 * touch on the host dashboard side.
 */
const toPortfolioCard = (p) => ({
  ...p,
  price: typeof p.price === 'number'
    ? p.price.toLocaleString('en-IN')
    : String(p.price ?? ''),
  addedDate: p.addedDate || (p.createdAt ? String(p.createdAt).slice(0, 10) : ''),
  inquiries: p.inquiries ?? 0,
});

// Room photo categories now come from the shared source of truth
// (src/constants/roomCategories.js). getRoomTypes + firstRoomTypeId are
// imported at the top of this file so the dashboard editor offers the SAME
// per-type categories as the Add Property wizard.

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-MODULE DATA CONTRACT (frontend stub — backend wires it together later)
//
// 1. PropertyListing.jsx + PropertyDetails.jsx render listings sourced from
//    GET /api/properties.
// 2. InquiryModal.jsx (shared) submits inquiries to
//    POST /api/properties/{propertyId}/inquiries with payload:
//        { phone, message, suggestionIds: string[] }
//    The backend stamps userId/init/timeAgo and stores it.
// 3. HostDashboard.jsx (this file) reads inquiries via
//    GET /api/host/inquiries  →  same shape as `initialInquiries` below.
// 4. When the host clicks "Convert to Booking" (a PREMIUM feature) the call is
//    POST /api/host/bookings with payload:
//      { inquiryId, propertyId, tenant, tenantPhone, leaseStart, leaseEnd,
//        monthlyRent, rentDueDay, reminderLeadDays, autoReminder }
//    The new booking is appended to the host's bookings list with an empty
//    `ledger` keyed by 'YYYY-MM'. Each month a green-tick mark calls
//    PATCH /api/host/bookings/{id}/ledger/{monthKey} with
//      { paid: true, paidOn, method, txnId, amount }
// 5. Reminders fire from a server cron that reads
//    `autoReminder + reminderLeadDays + rentDueDay` from each booking. The
//    UI here only previews + lets the host send manually — the cron is the
//    source of truth so this page can be closed without missing a reminder.
//
// All backend touch-points are tagged with `TODO(backend):` comments.
// ─────────────────────────────────────────────────────────────────────────────

// ─── INITIAL DATA — NO DEMO ROWS ──────────────────────────────────────────
// We start every host's dashboard empty. The real list comes from
// `propertyService.listMyProperties()` in the useEffect below (merged via
// the subscription so newly uploaded listings show up live).
const initialPortfolio = [];

// Bookings are loaded from /api/host/bookings (once wired). Until then,
// new hosts start with zero bookings — no fake tenant ledgers.
const initialBookings = [];

// Inquiries arrive via /api/host/inquiries. No demo conversations are
// pre-seeded — the inbox is empty until a real tenant messages.
const initialInquiries = [];

// Maps a raw inquiry from inquiryService.listHostInquiries() into the shape the
// dashboard renders. The backend already stamps most fields (user/init/timeAgo),
// so this normalises defensively with fallbacks. (This mapper had gone missing,
// which threw "toInquiryRow is not defined" and broke the inquiries tab.)
const _inqInitials = (name) =>
  (String(name || '').trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('') || '?').toUpperCase();

const _inqTimeAgo = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value); // already a label like "2h ago"
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`;
  return d.toLocaleDateString();
};

// Properties store floor as an integer where 0 = ground floor (see AddProperty).
// Turn that into a readable label so a converted booking never shows a bare "0".
// Non-zero values pass through unchanged (e.g. "2"); anything already textual is kept.
const floorToLabel = (raw, lang) => {
  if (raw == null || String(raw).trim() === '') return '';
  const n = Number(raw);
  if (Number.isFinite(n) && n === 0) return lang === 'বাংলা' ? 'নিচতলা' : 'Ground Floor';
  return String(raw);
};

const toInquiryRow = (raw = {}) => {
  const user = raw.user || raw.inquirerName || raw.userName || raw.name || raw.guestName || 'Guest';
  return {
    id:             raw.id || raw._id || '',
    inquirerUserId: raw.inquirerUserId || raw.userId || raw.tenantId || null,
    user,
    init:           raw.init || _inqInitials(user),
    // Tenant's profile photo (https/Cloudinary). The backend returns it via
    // listHostInquiries; carry it through so the card shows the real picture
    // instead of only the initials fallback.
    userAvatar:     raw.userAvatar || raw.avatar || '',
    timeAgo:        raw.timeAgo || _inqTimeAgo(raw.createdAt || raw.created_at || raw.date),
    phone:          raw.phone || raw.inquirerPhone || raw.userPhone || '',
    propTitle:      raw.propTitle || raw.propertyTitle || raw.property || '',
    propertyId:     raw.propertyId || raw.property || '',
    msg:            raw.msg || raw.message || raw.text || (Array.isArray(raw.messages) && raw.messages.length > 0 ? (typeof raw.messages[0] === 'string' ? raw.messages[0] : (raw.messages[0].text || raw.messages[0].message || raw.messages[0].content)) : '') || '',
    status:         raw.status || 'new',
    chatId:         raw.chatId || raw.conversationId || raw.threadId || '',
    messages:       Array.isArray(raw.messages) ? raw.messages : [],
    visitSchedule:  raw.visitSchedule || null,
  };
};

// 🟢 ৩ দিনের মধ্যে অ্যাড হয়েছে কিনা তা চেক করার ফাংশন
const isRecent = (dateString) => {
  if(!dateString) return false;
  const added = new Date(dateString);
  const today = new Date(); 
  const diffDays = Math.ceil(Math.abs(today - added) / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
};

// Auto-cleanup countdown for rented listings. A property flips to 'rented'
// when its booking is created; the backend (rentedCleanup.service.js) then
// permanently deletes it RENTED_RETENTION_DAYS later. Keep this constant in
// sync with the backend. Returns whole days remaining (0 = due for removal).
const RENTED_RETENTION_DAYS = 5;
const rentedDaysLeft = (rentedAt) => {
  if (!rentedAt) return RENTED_RETENTION_DAYS;
  const deleteAtMs = new Date(rentedAt).getTime() + RENTED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const msLeft = deleteAtMs - Date.now();
  if (!Number.isFinite(msLeft)) return RENTED_RETENTION_DAYS;
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
};

// ─────────────────────────────────────────────────────────────────────────────
// RENT-LEDGER HELPERS
// Pure date/money utilities used by the rent-tracking grid and the rent-
// collection summary widget. Keeping them top-level (a) makes them trivial to
// unit-test once we add a test suite, and (b) keeps the component body focused
// on rendering — no inline date math.
// ─────────────────────────────────────────────────────────────────────────────

// Build a 'YYYY-MM' key (zero-padded month) from year and 1-indexed month.
const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

// Parse 'YYYY-MM' back to { year, month } — month is 1-indexed.
const parseMonthKey = (key) => {
  const [y, m] = (key || '').split('-').map(Number);
  return { year: y, month: m };
};

const MONTH_NAMES_EN_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_BN_SHORT = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্ট','অক্টো','নভে','ডিসে'];
const MONTH_NAMES_EN_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_NAMES_BN_FULL  = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

const monthShortLabel = (key, lang) => {
  const { year, month } = parseMonthKey(key);
  if (!month) return '';
  const name = (lang === 'বাংলা' ? MONTH_NAMES_BN_SHORT : MONTH_NAMES_EN_SHORT)[month - 1];
  return `${name} ${String(year).slice(-2)}`;
};

const monthFullLabel = (key, lang) => {
  const { year, month } = parseMonthKey(key);
  if (!month) return '';
  const name = (lang === 'বাংলা' ? MONTH_NAMES_BN_FULL : MONTH_NAMES_EN_FULL)[month - 1];
  return `${name} ${year}`;
};

// ─── Open-ended tenancy ──────────────────────────────────────────────────────
// A tenancy here does not expire. Someone moves in, pays every month, and stays
// three years without a single renewal being signed — that IS the normal case in
// Bangladesh, not an edge case. A mandatory end date made the app disagree with
// reality: the lease flipped itself to "Done" on a date nobody agreed to, and the
// only way back was to re-enter the SAME tenant as a brand-new lease. So the end
// date is now optional and blank means ONGOING. A term is only recorded when it
// genuinely is one — a commercial deal with a fixed tenure, or a landlord who
// types an end date on purpose. The tenancy otherwise ends exactly when the
// landlord says it did: by handing the unit to the next tenant, which closes the
// old lease out and stamps the real move-out date.
const isOpenEndedLease = (booking) => !String(booking?.leaseEnd || '').trim();

// How far an open-ended ledger is projected: through December of the year being
// looked at (never earlier than this year), so the rent matrix keeps producing
// months for as long as the tenant stays instead of running out of lease.
// `through` accepts a Date or a bare year (the Rent tab's ledger year).
const openEndedLeaseHorizon = (through = null) => {
  let year = new Date().getFullYear();
  if (through instanceof Date && !Number.isNaN(through.getTime())) {
    year = Math.max(year, through.getFullYear());
  } else if (Number(through) > 1970) {
    year = Math.max(year, Number(through));
  }
  return new Date(year, 11, 31);
};

// Whole months this tenancy has been running — the honest answer to "how long
// has this tenant been here?" when there is no term to show progress against.
const leaseMonthsRunning = (booking, today = new Date()) => {
  const start = new Date(booking?.leaseStart);
  if (Number.isNaN(start.getTime())) return 0;
  const end = isOpenEndedLease(booking) ? today : new Date(booking.leaseEnd);
  const cap = Number.isNaN(end.getTime()) ? today : (end < today ? end : today);
  const months = (cap.getFullYear() - start.getFullYear()) * 12 + (cap.getMonth() - start.getMonth());
  return Math.max(0, months + (cap.getDate() >= start.getDate() ? 1 : 0));
};

// Iterate every month-key from leaseStart through leaseEnd, inclusive. With no
// end date the window rolls forward (see openEndedLeaseHorizon).
const enumerateLeaseMonths = (leaseStart, leaseEnd, through = null) => {
  if (!leaseStart) return [];
  const start = new Date(leaseStart);
  const end = leaseEnd ? new Date(leaseEnd) : openEndedLeaseHorizon(through);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  // Hard cap so a corrupt lease can't loop forever.
  let safety = 0;
  while (cursor <= last && safety < 600) {
    out.push(monthKey(cursor.getFullYear(), cursor.getMonth() + 1));
    cursor.setMonth(cursor.getMonth() + 1);
    safety += 1;
  }
  return out;
};

// The actual due date for `key` given the booking's `rentDueDay`. Clamps to
// the last day of the month so "due day 31" works in February.
const getDueDate = (key, dueDay) => {
  const { year, month } = parseMonthKey(key);
  if (!year || !month) return null;
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(1, dueDay || 1), lastDay);
  return new Date(year, month - 1, day);
};

// One of: 'paid' | 'partial' | 'due-marked' | 'overdue' | 'due-soon' | 'upcoming' | 'before-lease'
//
// Visual contract used across the matrix, ledger rows, and dashboard widget:
//   paid         → blue tick (full payment, balance == 0)
//   partial      → amber half-fill (some money received, balance > 0)
//   due-marked   → red dot (manually marked outstanding, no payment yet)
//   overdue      → red pulse (past due date, never paid)
//   due-soon     → orange (within reminderLeadDays of due date)
//   upcoming     → grey (in the future)
//   before-lease → empty (outside the lease window)
const getRentStatus = (booking, key, today = new Date()) => {
  const entry = booking?.ledger?.[key];
  if (entry?.paid) {
    if (entry.status === 'partial' || (Number(entry.balance) || 0) > 0) return 'partial';
    return 'paid';
  }
  if (entry?.status === 'due') return 'due-marked';
  const due = getDueDate(key, booking?.rentDueDay);
  if (!due) return 'upcoming';
  const reminderStart = new Date(due);
  reminderStart.setDate(reminderStart.getDate() - (booking.reminderLeadDays || 3));
  if (today > due) return 'overdue';
  if (today >= reminderStart) return 'due-soon';
  return 'upcoming';
};

// Days from today until the next unpaid month's due date. Negative = late.
const daysUntilNextDue = (booking, today = new Date()) => {
  const months = enumerateLeaseMonths(booking?.leaseStart, booking?.leaseEnd);
  for (const k of months) {
    if (!booking?.ledger?.[k]?.paid) {
      const due = getDueDate(k, booking.rentDueDay);
      if (!due) continue;
      const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      return { key: k, due, daysFromNow: diff };
    }
  }
  return null;
};

// Aggregate this-month collection for an array of bookings. Used by the
// dashboard widget so the host can answer "who paid May's rent?" at a glance.
//
// Partial payments now contribute to `collectedTotal` (the actual cash banked)
// but count as "partial" not "paid" so the host still sees them on the
// follow-up list. `partialCount` lets the dashboard widget show "X full + Y partial".
//
// Retired tenancies are skipped: a cancelled lease never counted, and a lease the
// host CLOSED OUT ('completed') is one the tenant has moved out of. Without this
// a mid-month tenant change would count the same unit twice for that month (the
// outgoing lease and the incoming one both cover it), inflating "Expected" and
// sending rent reminders to someone who already left.
const getMonthCollectionSummary = (bookings, year, month, today = new Date()) => {
  const key = monthKey(year, month);
  let paidCount = 0, partialCount = 0, dueCount = 0, overdueCount = 0;
  let expectedTotal = 0, collectedTotal = 0;
  const overdueTenants = [];
  const paidTenants = [];
  const partialTenants = [];
  const pendingTenants = [];
  (bookings || []).forEach((b) => {
    if (b?.status === 'cancelled' || b?.status === 'completed') return;
    const months = enumerateLeaseMonths(b.leaseStart, b.leaseEnd);
    if (!months.includes(key)) return;
    dueCount += 1;
    expectedTotal += Number(b.monthlyRent || 0) + Number(b.serviceCharge || 0);
    const entry = b.ledger?.[key];
    if (entry?.paid) {
      collectedTotal += Number(entry.amount || 0);
      const isPartial = entry.status === 'partial' || (Number(entry.balance) || 0) > 0;
      if (isPartial) {
        partialCount += 1;
        partialTenants.push(b);
      } else {
        paidCount += 1;
        paidTenants.push(b);
      }
    } else {
      const due = getDueDate(key, b.rentDueDay);
      const markedDue = entry?.status === 'due';
      if (markedDue || (due && today > due)) { overdueCount += 1; overdueTenants.push(b); }
      else pendingTenants.push(b);
    }
  });
  return {
    key,
    paidCount, partialCount,
    totalDueCount: dueCount,
    expectedTotal, collectedTotal,
    outstandingTotal: Math.max(0, expectedTotal - collectedTotal),
    overdueCount,
    overdueTenants, paidTenants, partialTenants, pendingTenants,
  };
};

// Lease status from dates + today. Independent of payment state.
// No end date ⇒ it can never read 'completed' on its own.
const computeBookingStatus = (booking, today = new Date()) => {
  const start = new Date(booking?.leaseStart);
  if (Number.isNaN(start.getTime())) return 'upcoming';
  if (today < start) return 'upcoming';
  if (isOpenEndedLease(booking)) return 'active';
  const end = new Date(booking.leaseEnd);
  if (Number.isNaN(end.getTime())) return 'active';
  return today > end ? 'completed' : 'active';
};

// Lease completion 0-100 for the term progress bar. Returns null when there is
// no term to be a percentage of — an ongoing tenancy isn't "40% done", and a bar
// frozen at 0% reads as a bug. Callers show months-running instead.
const computeBookingProgress = (booking, today = new Date()) => {
  if (isOpenEndedLease(booking)) return null;
  const start = new Date(booking?.leaseStart).getTime();
  const end = new Date(booking?.leaseEnd).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const t = today.getTime();
  if (t <= start) return 0;
  if (t >= end) return 100;
  return Math.round(((t - start) / (end - start)) * 100);
};

// ─── Lease lifecycle — TWO stages only: active | done ────────────────────────
// Independent of payment state (which lives on the Rent Collection tab).
//   • active — someone is renting this unit right now (or moves in shortly).
//              An ongoing tenancy (no end date) stays here indefinitely.
//   • done   — the tenancy is over because the HOST said so: they handed the
//              unit to the next tenant, or closed it out when this one left
//              (status 'completed'). A typed-in term running out also lands
//              here, but nothing expires on a date the landlord never set.
//
// "Draft" and "Notice" used to be separate stages, but a landlord doesn't think
// that way — a unit is either rented or it isn't. The renewal window still
// surfaces, as an "ends in Xd" chip + the Needs Attention group, instead of a
// stage the host has to remember to filter by.
const NOTICE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// A lease the host explicitly closed out (tenant left) — regardless of the
// term still having months left on paper.
const isLeaseClosed = (booking) => booking?.status === 'completed';

const computeLeaseStage = (booking, today = new Date()) => {
  if (isLeaseClosed(booking)) return 'done';
  // Ongoing tenancy — nothing to expire, so it stays live until the host hands
  // the unit over. Same for an unparseable date: a bad value should never hide
  // a real tenant.
  if (isOpenEndedLease(booking)) return 'active';
  const end = new Date(booking.leaseEnd);
  if (Number.isNaN(end.getTime())) return 'active';
  return today > end ? 'done' : 'active';
};

// Whole days until the lease expires — negative once it's past. null when there
// is no end date (ongoing tenancy) or it's unparseable.
const leaseDaysLeft = (booking, today = new Date()) => {
  if (isOpenEndedLease(booking)) return null;
  const end = new Date(booking.leaseEnd);
  if (Number.isNaN(end.getTime())) return null;
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / DAY_MS);
};

// Renewal window: a live lease whose TYPED term runs out within the next 30
// days. Drives the amber "ends in Xd" chip and the Needs Attention group. An
// ongoing tenancy never shows up here — there is no renewal to chase.
const isLeaseEndingSoon = (booking, today = new Date()) => {
  if (isOpenEndedLease(booking)) return false;
  if (computeLeaseStage(booking, today) !== 'active') return false;
  const left = leaseDaysLeft(booking, today);
  return left != null && left >= 0 && left <= NOTICE_WINDOW_DAYS;
};

// ─── Units — what a lease actually binds to ──────────────────────────────────
// A unit is the rentable space: the listing (or a manually typed property name)
// plus its floor + room label. Two consequences the host cares about:
//   • one building can hold many units (room 301, room 302, …), so each gets
//     its own lease;
//   • the SAME unit can be leased over and over as tenants come and go — only
//     ONE of those leases is live at a time.
// A unit's identity is its `unitId` — a real Unit record. The name-and-number
// key below it is the LEGACY path, for bookings written before the buildings/
// units restructure: it is the same string-matching that made hostel leases
// vanish, kept only so old rows still resolve until the migration runs.
const unitKeyOf = (b) => {
  if (b?.unitId) return `unit:${String(b.unitId)}`;
  return [
    String(b?.propertyId || b?.property || '').trim().toLowerCase(),
    String(b?.floorNumber || '').trim().toLowerCase(),
    String(b?.roomNumber || '').trim().toLowerCase(),
  ].join('|');
};

// The live lease occupying this unit, if any. `excludeId` skips the lease being
// replaced during a tenant change.
const findLiveLeaseForUnit = (bookings, unit, today = new Date(), excludeId = null) => {
  const key = unitKeyOf(unit);
  if (!key.replace(/\|/g, '')) return null;
  return (bookings || []).find((b) => (
    b.status !== 'cancelled'
    && String(b.id) !== String(excludeId)
    && computeLeaseStage(b, today) === 'active'
    && unitKeyOf(b) === key
  )) || null;
};

// Date object for the next unpaid month — used by the lease card's "Next Payment".
const getNextPaymentDate = (booking, today = new Date()) => {
  const next = daysUntilNextDue(booking, today);
  return next ? next.due : null;
};

// Aggregate counters for the Bookings tab's Financial Overview sidebar.
// Service charge is added to the monthly revenue total because the host
// receives both each month — matches the "Total Monthly" column on each lease card.
const getLeaseSummary = (bookings, today = new Date()) => {
  let totalMonthlyRevenue = 0;
  let activeCount = 0, doneCount = 0, endingSoonCount = 0;
  let totalSecurityDeposits = 0;
  (bookings || []).forEach((b) => {
    const stage = computeLeaseStage(b, today);
    if (stage === 'active') {
      activeCount += 1;
      if (isLeaseEndingSoon(b, today)) endingSoonCount += 1;
      totalMonthlyRevenue += Number(b.monthlyRent || 0) + Number(b.serviceCharge || 0);
    } else {
      doneCount += 1;
    }
    // Deposit / advance is collected up front (the card's "Deposit (Advance)" =
    // booking.advancePayment) and held until the tenancy ends — so it counts for
    // every live lease and drops off once done or cancelled.
    // (`securityDeposit` added too for any data that carries it separately.)
    if (b.status !== 'cancelled' && stage !== 'done') {
      totalSecurityDeposits += advanceCollected(b) + Number(b.securityDeposit || 0);
    }
  });
  return { totalMonthlyRevenue, activeCount, doneCount, endingSoonCount, totalSecurityDeposits };
};

// Map a stage back to its label — used in filter pills + status badges.
const stageLabel = (stage, language) => {
  if (language === 'বাংলা') {
    if (stage === 'active') return 'থাকছে';
    if (stage === 'done')   return 'চলে গেছে';
    return 'সকল';
  }
  return { active: 'Active', done: 'Done', all: 'All' }[stage] || stage;
};

// Format BDT amounts with comma grouping (Indian/Bangla grouping).
const formatBDT = (n) => {
  const num = Number(n) || 0;
  return `৳ ${num.toLocaleString('en-IN')}`;
};

// Format an ISO date as "May 03, 2026" / "03 মে 2026".
const formatDate = (iso, lang) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = (lang === 'বাংলা' ? MONTH_NAMES_BN_SHORT : MONTH_NAMES_EN_SHORT)[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  return lang === 'বাংলা' ? `${day} ${m} ${d.getFullYear()}` : `${m} ${day}, ${d.getFullYear()}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS ON A TENANCY FORM — defined once.
//
// Modelled on the Dhaka Metropolitan Police tenant-information form the
// landlord already has to keep. Rows the app holds no data for are marked
// `blank`: the PDF prints them as ruled lines to complete by hand, and the
// Excel export leaves the cell empty. Both outputs read this, so a field added
// here appears in both or in neither.
// ─────────────────────────────────────────────────────────────────────────────
const agreementGroups = ({
  booking, seatMember, occupant, seatRent, names, tp, govtId, job, roomLine, L,
  landlord, formatDate, formatBDT, isOpenEnded,
}) => [
  {
    side: 'left',
    title: L('ভাড়াটিয়ার তথ্য', 'TENANT INFORMATION'),
    rows: [
      { label: L('নাম', 'Name'), value: occupant.name },
      { label: L('পিতার নাম', "Father's name"), value: tp.fatherName, blank: !tp.fatherName },
      { label: L('মাতার নাম', "Mother's name"), value: '', blank: true },
      { label: L('স্বামী / স্ত্রীর নাম', 'Spouse name'), value: '', blank: true },
      { label: L('জন্ম তারিখ', 'Date of birth'), value: tp.dob ? formatDate(tp.dob) : '', blank: !tp.dob },
      { label: L('বৈবাহিক অবস্থা', 'Marital status'), value: tp.maritalStatus, blank: !tp.maritalStatus },
      { label: L('জাতীয় পরিচয়পত্র / পাসপোর্ট', 'NID / Passport'), value: tp.govtIdNumber ? govtId : '', blank: !tp.govtIdNumber },
      { label: L('মোবাইল', 'Mobile'), value: occupant.phone, blank: !occupant.phone },
      { label: L('পেশা', 'Occupation'), value: job, blank: !job },
      { label: L('কর্মস্থলের ঠিকানা', 'Workplace address'), value: '', blank: true },
      { label: L('স্থায়ী ঠিকানা', 'Permanent address'), value: tp.permanentAddress, blank: !tp.permanentAddress },
      { label: L('পূর্ববর্তী বাসার ঠিকানা', 'Previous address'), value: '', blank: true },
    ],
  },
  {
    side: 'left',
    title: L('জরুরি যোগাযোগ', 'EMERGENCY CONTACT'),
    rows: [
      { label: L('নাম', 'Name'), value: tp.emergencyName, blank: !tp.emergencyName },
      { label: L('সম্পর্ক', 'Relation'), value: tp.emergencyRelation, blank: !tp.emergencyRelation },
      { label: L('মোবাইল', 'Mobile'), value: tp.emergencyPhone, blank: !tp.emergencyPhone },
      { label: L('ঠিকানা', 'Address'), value: tp.emergencyAddress, blank: !tp.emergencyAddress },
    ],
  },
  {
    side: 'right',
    title: L('বাসা ও ভাড়ার তথ্য', 'TENANCY DETAILS'),
    rows: [
      { label: L('বাড়ি / প্রতিষ্ঠান', 'Property'), value: booking.property },
      { label: L('ঠিকানা', 'Address'), value: booking.location },
      { label: L('ফ্লোর / রুম / সিট', 'Floor / Room / Seat'), value: roomLine },
      { label: L('ভাড়া শুরুর তারিখ', 'Tenancy start'), value: formatDate(seatMember?.joinDate || booking.leaseStart) },
      { label: L('মেয়াদ', 'Term'), value: isOpenEnded ? L('চলমান — নোটিশ সাপেক্ষে', 'Ongoing — subject to notice') : formatDate(booking.leaseEnd) },
      { label: seatMember ? L('সিটের মাসিক ভাড়া', 'Monthly rent (seat)') : L('মাসিক ভাড়া', 'Monthly rent'),
        value: formatBDT(seatMember ? seatRent : booking.monthlyRent) },
      ...(seatMember ? [] : [{ label: L('সার্ভিস চার্জ', 'Service charge'), value: formatBDT(booking.serviceCharge || 0) }]),
      { label: L('জামানত', 'Security deposit'), value: formatBDT((seatMember ? seatMember.securityDeposit : booking.securityDeposit) || 0) },
      { label: L('ভাড়ার তারিখ', 'Rent due day'), value: L(`প্রতি মাসের ${booking.rentDueDay || 5} তারিখ`, `${booking.rentDueDay || 5} of each month`) },
      { label: L('পেমেন্ট মাধ্যম', 'Payment method'), value: booking.paymentMethod, blank: !booking.paymentMethod },
      ...(names.length
        ? [{ label: seatMember ? L('রুমে আরও আছেন', 'Also in this room') : L('অন্যান্য বাসিন্দা', 'Other occupants'), value: names.join(', ') }]
        : []),
      { label: L('গাড়ির নম্বর', 'Vehicle no.'), value: '', blank: true },
    ],
  },
  {
    side: 'right',
    title: L('বাড়িওয়ালার তথ্য', 'LANDLORD'),
    rows: [
      { label: L('নাম', 'Name'), value: landlord.name },
      { label: L('মোবাইল', 'Mobile'), value: landlord.phone },
      { label: L('ঠিকানা', 'Address'), value: landlord.address, blank: !landlord.address },
    ],
  },
];

// Where a generated document points people. The QR encodes the Play Store
// listing (the app is what a tenant wants on a phone); the printed line names
// the site, which is shorter to read and works on a desktop.
const APP_LINK_URL = PLAY_STORE_URL;
const APP_LINK_LABEL = SITE_URL.replace(/^https?:\/\//, '');

// Human file size for the document vault. Only ever fed a REAL byte count from
// the upload record — the tenant-docs modal used to print invented sizes next
// to buttons that downloaded nothing.
const prettyBytes = (n) => {
  const b = Number(n) || 0;
  if (b <= 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

// Today's ISO date (YYYY-MM-DD) — for default values in the mark-paid form.
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Rent receipts are now created server-side (Receipt model) by the booking
// ledger API and read by the tenant via GET /api/receipts/tenant. The old
// localStorage bridge (pushReceiptToTenant / PAYMENT_RECEIPTS_KEY) was removed —
// it was single-browser only and is fully superseded by the backend receipts.
// ─────────────────────────────────────────────────────────────────────────────

// Multi-member seats apply to HOSTELS only — flat / sublet / single-room
// bookings stay classic single-tenant. Gates the MembersManager UI + the
// new-booking seat section.
const isHostelBooking = (b) => !!(b && b.propertyType === 'hostel');

// Equal room-rent split for one seat — mirrors MembersManager. The room rent
// (booking.monthlyRent) is divided across the active seats: ৳6000 ÷ 4 = ৳1500,
// ÷ 2 = ৳3000. A seat keeps its OWN explicit rent when the host set one, except
// the legacy artifact where a multi-seat seat "inherited" the full room rent
// (that is really un-split, so we divide it).
const seatShare = (booking, member, activeCount) => {
  const roomRent = Number(booking?.monthlyRent) || 0;
  const service = Number(booking?.serviceCharge) || 0;
  const roomTotal = roomRent + service;   // seats split the full obligation (rent + service)
  const explicit = Number(member?.monthlyRent) || 0;
  if (explicit > 0 && !(activeCount > 1 && explicit === roomRent)) return explicit;
  return activeCount > 0 ? Math.round(roomTotal / activeCount) : roomTotal;
};

// Expand a booking into rent UNITS for Rent Collection: ONE unit per active
// member — carrying that member's split share, own ledger, name + avatar — or
// the booking itself when it has no members. So a hostel room with roommates
// shows each occupant as their own uniform card with their divided rent, and
// the KPI totals count per person. Units carry __realId + __memberId so the
// mark-paid flow writes to the correct member ledger.
const rentUnitsOf = (booking) => {
  const mems = Array.isArray(booking?.members) ? booking.members.filter((m) => m && m.status !== 'moved-out') : [];
  if (mems.length === 0) {
    // Single-tenant / no-member: the monthly obligation is rent + service.
    // Fold service INTO monthlyRent and zero serviceCharge so KPI totals
    // (monthlyRent + serviceCharge) don't double-count it.
    const rent = Number(booking?.monthlyRent) || 0;
    const service = Number(booking?.serviceCharge) || 0;
    return service > 0 ? [{ ...booking, monthlyRent: rent + service, serviceCharge: 0 }] : [booking];
  }
  return mems.map((m, i) => ({
    ...booking,
    // Unique row id even before a freshly-added member has a server id (index
    // fallback avoids React key collisions); __memberId stays the real id (or
    // null → routes to the booking ledger) for the mark-paid API.
    id: `${booking.id}::${m.id || i}`,
    __realId: booking.id,
    __memberId: m.id || null,
    // Which seat this person is in. Rent Collection groups by room and then
    // lists seats inside it, so the seat has to survive the expansion — without
    // this a hostel room's four rows were four names with nothing saying which
    // bed each one was paying for.
    __seatLabel: m.seatLabel || '',
    __seatIndex: i + 1,
    members: undefined,
    tenant: m.name || booking.tenant,
    tenantAvatar: m.avatar || booking.tenantAvatar,
    tenantInit: (String(m.name || booking.tenant || '?').trim().charAt(0) || '?').toUpperCase(),
    // THIS SEAT'S PERSON, not the room's.
    //
    // The row inherited `tenantId` and `tenantPhone` from the booking through
    // the spread above, and on a shared room those belong to whoever was
    // entered FIRST. So Profile / Message / Call on Seat 2 opened Seat 1's
    // account — the landlord would have rung the wrong tenant about rent.
    // A member with no linked account resolves to null, which the callers
    // already handle ("this tenant has no linked profile yet").
    tenantId: m.userId || null,
    tenantPhone: m.phone || '',
    monthlyRent: seatShare(booking, m, mems.length),
    serviceCharge: 0,   // service is already folded into the per-seat monthlyRent above
    ledger: m.ledger || {},
  }));
};
// The property formats the New Lease form supports. Hostel is multi-member
// (seats); the rest are classic single-tenant.
const PROPERTY_FORMATS = {
  flat:        { en: 'Flat',        bn: 'ফ্ল্যাট' },
  single_room: { en: 'Single Room', bn: 'সিঙ্গেল রুম' },
  sublet:      { en: 'Sublet',      bn: 'সাবলেট' },
  hostel:      { en: 'Hostel',      bn: 'হোস্টেল' },
};
const formatLabel = (type, isBn) => {
  const f = PROPERTY_FORMATS[type];
  if (f) return isBn ? f.bn : f.en;
  return type || (isBn ? 'অন্যান্য' : 'Other');
};

// New Lease categories. Sublet groups with single room (both single-occupant
// room rentals). Drives which property types the dropdown offers + which
// fields the form shows.
const CATEGORY_TYPES = {
  flat:        ['flat', 'apartment'],
  single_room: ['single_room', 'sublet'],
  hostel:      ['hostel'],
};
const propTypeToCategory = (type) => {
  if (type === 'hostel') return 'hostel';
  if (type === 'single_room' || type === 'sublet') return 'single_room';
  return 'flat';
};

// ─── Reading a building, whichever shape it arrives in ──────────────────────
// A building can reach the lease form as either:
//   • a real Building record  { address, category: residential|commercial,
//                               subCategory: flat|hostel|single_room }
//   • the legacy profile blob { location, type: residential|commercial,
//                               category: flat|hostel }
// Both exist at once during the buildings/units rollout, and the two use the
// SAME word — `category` — for different things: a real record means
// residential-vs-commercial, the blob means flat-vs-hostel. Reading the wrong
// one put 'residential' into the lease's format field, which matches no format,
// so the picker silently came up with nothing selected.
const bldgAddress = (b) => b?.address || b?.location || '';

const bldgIsCommercial = (b) => b?.category === 'commercial' || b?.type === 'commercial';

// The lease form's format (flat | single_room | hostel), from either shape.
// Commercial carries no residential format at all.
const bldgLeaseCategory = (b) => {
  if (!b) return 'flat';
  if (bldgIsCommercial(b)) return '';
  // Real record: subCategory already IS the format.
  if (b.subCategory) return propTypeToCategory(b.subCategory);
  // Legacy blob: `category` held the format, `type` held residential/commercial.
  if (b.category && b.category !== 'residential') return propTypeToCategory(b.category);
  if (b.type && b.type !== 'residential') return propTypeToCategory(b.type);
  return 'flat';
};

const HostDashboard = () => {
  const { t = {}, language = 'English', setLanguage } = useLanguage() || {}; 
  const location = useLocation();
  const navigate = useNavigate();
  // For links that live inside an overlay (drawer entries, the logo popup) —
  // consumes the overlay's back-guard entry instead of pushing past it.
  const overlayNavigate = useOverlayNavigate();
  const { user: authUser, logout: authLogout, updateMe: authUpdateMe, submitVerification: authSubmitVerification, roles: authRoles, setActiveRole: authSetActiveRole, addRole: authAddRole } = useAuth();

  const handleSwitchRole = async () => {
    try {
      const target = 'tenant';
      const owns = Array.isArray(authRoles) && authRoles.includes(target);
      if (!owns) await authAddRole?.(target);
      await authSetActiveRole?.(target);
      setIsProfileDrawerOpen(false);
      navigate('/tenant-dashboard');
    } catch (err) {
      console.error(err);
    }
  };
  
  // 🟢 CORE STATES
  // The active tab lives in the URL (`?tab=`), not in component state, so the
  // Back button walks back through the tabs the landlord actually visited —
  // Rent → Bookings → Dashboard → the page they came from — instead of jumping
  // straight out to the public site. See hooks/useTabHistory.js.
  const [activeTab, setActiveTab] = useTabHistory({
    tabs: HOST_TABS,
    defaultTab: HOST_ROOT_TAB,
  });
  const [lightbox, setLightbox] = useState(null);
  // Logo → "where to?" popup. For a landlord the dashboard IS home, so tapping
  // the TO-LET PRO logo asks whether to visit the public site or stay here
  // (see LandlordHomeChoiceModal at the bottom of the render).
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

  // 🟢 TOUR SUPPORT: Listen for global events to open/close the drawer programmatically
  useEffect(() => {
    const handleOpen = () => setIsProfileDrawerOpen(true);
    const handleClose = () => setIsProfileDrawerOpen(false);
    const openHomeModal = () => setIsLogoModalOpen(true);
    const closeHomeModal = () => setIsLogoModalOpen(false);
    
    window.addEventListener('open-host-drawer', handleOpen);
    window.addEventListener('close-host-drawer', handleClose);
    window.addEventListener('open-home-choice-modal', openHomeModal);
    window.addEventListener('close-home-choice-modal', closeHomeModal);
    
    return () => {
      window.removeEventListener('open-host-drawer', handleOpen);
      window.removeEventListener('close-host-drawer', handleClose);
      window.removeEventListener('open-home-choice-modal', openHomeModal);
      window.removeEventListener('close-home-choice-modal', closeHomeModal);
    };
  }, []);

  // Hide the mobile bottom nav when the user is inside the Bookings or Rent
  // tabs — these are full-screen workspaces with their own back button.
  useEffect(() => {
    const shouldHide = activeTab === 'bookings' || activeTab === 'rent';
    window.dispatchEvent(new Event(shouldHide ? 'hide-bottom-nav' : 'show-bottom-nav'));
    return () => window.dispatchEvent(new Event('show-bottom-nav'));
  }, [activeTab]);

  const [showHomeChoice, setShowHomeChoice] = useState(false);
  // Persisted, not just component state. This was `useState(false)`, so the X
  // worked until the page reloaded and the card returned — the landlord had
  // dismissed it, and it came back anyway.
  //
  // Shares its key with PaymentSettingsPopup: they are two faces of the same
  // reminder, so silencing one silences both.
  const [hidePaymentPromo, setHidePaymentPromo] = useState(() => {
    try { return localStorage.getItem(PAYMENT_PROMO_DISMISS_KEY) === '1'; }
    catch { return false; }
  });
  const dismissPaymentPromo = () => {
    try { localStorage.setItem(PAYMENT_PROMO_DISMISS_KEY, '1'); } catch { /* ignore */ }
    setHidePaymentPromo(true);
  };
  // Scroll to + flash the specific row a notification points at (uses
  // location.state.highlightId set by NotificationPanel). The row ids are
  // stamped on each inquiry/booking/rent card below.
  useDeepLinkHighlight();

  useEffect(() => {
    const socket = callProvider.getSocket();
    if (!socket) return;
    const onInquiryUpdate = (data) => {
      setInquiries(prev => prev.map(i => {
        if (i.id !== data.inquiryId) return i;
        const next = { ...i };
        if (data.status) next.status = data.status;
        if (data.visitSchedule) next.visitSchedule = data.visitSchedule;
        if (data.message) next.messages = [...(i.messages || []), data.message];
        return next;
      }));
    };
    socket.on('inquiry:status_updated', onInquiryUpdate);
    return () => socket.off('inquiry:status_updated', onInquiryUpdate);
  }, []);

  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [currentBuildingId, setCurrentBuildingId] = useState(null);
  // Booking delete confirmation — stores the booking id pending confirmation
  const [confirmDeleteBookingId, setConfirmDeleteBookingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  
  // 🟢 DYNAMIC HOST INSIGHTS STATE
  const [hostInsights, setHostInsights] = useState({
    responseRate: '98%',
    avgResponseTime: '15',
    conversionRate: '24%'
  });

  // 🟢 PROFILE & VERIFICATION STATES
  // Seed the host profile from the signed-in account so the header avatar,
  // greeting, and profile drawer all show the host's real name/phone/email
  // instead of the legacy demo placeholders.
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [userData, setUserData] = useState(() => ({
    fullName: authUser?.name || authUser?.fullName || '',
    phone:    authUser?.phone || '',
    email:    authUser?.email || '',
    address:  authUser?.address || '',
    city:     authUser?.city || '',
    nidNumber: authUser?.nidNumber || '',
    // base64 data: URL of the host's profile picture. Empty means the
    // initials avatar is shown instead. When the backend ships, swap to a
    // signed URL coming back from PATCH /api/host/me { avatarFile }.
    avatar:   authUser?.avatar || '',
  }));
  const [tempUserData, setTempUserData] = useState(userData);

  const landlordProfileKey = (uid) => `tolet_landlord_profile:${uid || 'anon'}`;
  const DEFAULT_LANDLORD_PROFILE = {
    fullName:         userData.fullName || '',
    city:             userData.city || '',
    address:          userData.address || '',
    preferredTenants: [],
    communication:    [],
    serviceCharge:    '',
    houseRules:       [],
    buildingMode:     null,
    buildings:        [],
    // The landlord's own letterhead for generated documents. Only a Cloudinary
    // URL is kept, never the image bytes — this whole object is synced to the
    // profile endpoint, and a base64 logo would bloat every save.
    brand:            { orgName: '', logoUrl: '', phone: '' },
  };

  const [landlordProfile, setLandlordProfile] = useState(() => {
    try {
      const raw = localStorage.getItem(landlordProfileKey(authUser?.id));
      if (raw) return { ...DEFAULT_LANDLORD_PROFILE, ...JSON.parse(raw) };
    } catch { /* ignore parse errors */ }
    return DEFAULT_LANDLORD_PROFILE;
  });

  useEffect(() => {
    setLandlordProfile((prev) => ({
      ...prev,
      fullName: userData.fullName || prev.fullName,
      city:     userData.city     || prev.city,
      address:  userData.address  || prev.address,
    }));
  }, [userData.fullName, userData.city, userData.address]);

  const applyLandlordPatch = (profile, patch) => {
    const next = { ...profile };
    for (const [key, value] of Object.entries(patch || {})) {
      if (!key.includes('.')) { next[key] = value; continue; }
      const parts = key.split('.');
      let cursor = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        cursor[k] = { ...(cursor[k] || {}) };
        cursor = cursor[k];
      }
      cursor[parts[parts.length - 1]] = value;
    }
    return next;
  };

  const persistLandlordProfile = async (next, patch = null) => {
    setLandlordProfile(next);
    try {
      localStorage.setItem(landlordProfileKey(authUser?.id), JSON.stringify(next));
    } catch {}
    
    setUserData((prev) => ({
      ...prev,
      fullName: next.fullName || prev.fullName,
      phone:    next.phone    || prev.phone,
      email:    next.email    || prev.email,
      city:     next.city     || prev.city,
      address:  next.address  || prev.address,
    }));
    
    if (authUpdateMe) {
      if (patch) {
        const topLevel = {};
        const nested   = {};
        
        for (const [path, value] of Object.entries(patch || {})) {
          if (path === 'fullName' || path === 'name') { topLevel.name = value; continue; }
          if (path === 'email')                       { topLevel.email = value; continue; }
          if (path === 'phone')                       { topLevel.phone = value; continue; }
          
          const parts = path.split('.');
          let cursor = nested;
          for (let i = 0; i < parts.length - 1; i++) {
            const k = parts[i];
            if (!cursor[k] || typeof cursor[k] !== 'object') cursor[k] = {};
            cursor = cursor[k];
          }
          cursor[parts[parts.length - 1]] = value;
        }
        
        const payload = { ...topLevel };
        if (Object.keys(nested).length > 0) payload.landlordProfile = nested;
        
        if (Object.keys(payload).length > 0) {
          try {
            await authUpdateMe(payload);
          } catch (err) {
            console.warn('[ProfileSection.onUpdate] backend sync failed:', err);
          }
        }
      } else {
        try {
          await authUpdateMe({ landlordProfile: next });
        } catch (err) {
          console.warn('[persistLandlordProfile] backend sync failed:', err);
        }
      }
    }
  };

  useEffect(() => {
    if (!authUser) return;
    setUserData(prev => ({
      ...prev,
      fullName: authUser.name || authUser.fullName || prev.fullName,
      phone:    authUser.phone   || prev.phone,
      email:    authUser.email   || prev.email,
      address:  authUser.address || prev.address,
      city:     authUser.city    || prev.city,
      nidNumber:authUser.nidNumber || prev.nidNumber,
      avatar:   authUser.avatar  || prev.avatar,
    }));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    const serverLP = authUser.landlordProfile || {};
    
    setLandlordProfile((prev) => {
      const merged = {
        ...prev,
        preferredTenants: serverLP.preferredTenants || prev.preferredTenants || [],
        communication:    serverLP.communication    || prev.communication || [],
        serviceCharge:    serverLP.serviceCharge !== undefined ? serverLP.serviceCharge : prev.serviceCharge,
        houseRules:       serverLP.houseRules       || prev.houseRules || [],
        buildingMode:     serverLP.buildingMode !== undefined ? serverLP.buildingMode : prev.buildingMode,
        buildings:        serverLP.buildings        || prev.buildings || [],
      };
      return merged;
    });
  }, [JSON.stringify(authUser?.landlordProfile || {})]);
  
  const [uploadedDocs, setUploadedDocs] = useState({
    nidFront: false,
    nidBack: false,
    selfie: false,
    utilityBill: false
  });

  const [verificationStatus, setVerificationStatus] = useState(() => {
    const isTenantVerified = authUser?.tenantProfile?.verification?.status === 'verified';
    const isHostVerified = authUser?.landlordProfile?.verification?.status === 'verified';
    const hasNid = !!authUser?.tenantProfile?.verification?.nidFront || !!authUser?.landlordProfile?.verification?.nidFront;
    const hasFace = !!authUser?.tenantProfile?.verification?.photo || !!authUser?.landlordProfile?.verification?.photo;
    const isVerified = isTenantVerified || isHostVerified;

    return {
      profileCompleted: true, 
      nidUploaded: isVerified || hasNid,
      faceVerified: isVerified || hasFace,
      underReview: authUser?.landlordProfile?.verification?.status === 'pending' || authUser?.tenantProfile?.verification?.status === 'pending'
    };
  });

  useEffect(() => {
    if (!authUser) return;
    const isTenantVerified = authUser?.tenantProfile?.verification?.status === 'verified';
    const isHostVerified = authUser?.landlordProfile?.verification?.status === 'verified';
    const hasNid = !!authUser?.tenantProfile?.verification?.nidFront || !!authUser?.landlordProfile?.verification?.nidFront;
    const hasFace = !!authUser?.tenantProfile?.verification?.photo || !!authUser?.landlordProfile?.verification?.photo;
    const isVerified = isTenantVerified || isHostVerified;

    setVerificationStatus(prev => ({
      ...prev,
      nidUploaded: isVerified || hasNid,
      faceVerified: isVerified || hasFace,
      underReview: authUser?.landlordProfile?.verification?.status === 'pending' || authUser?.tenantProfile?.verification?.status === 'pending'
    }));
  }, [authUser]);

  // String status for the shared ProfileSection CTA (it expects
  // 'unverified' | 'pending' | 'verified' — the exact contract the tenant
  // passes). Identity KYC lives on tenantProfile.verification (shared across
  // roles); landlordProfile.verification covers property onboarding. Either
  // being verified/pending is reflected here so the "Start verification" CTA
  // shows/hides correctly now that the floating chip is gone.
  const hostVerificationStatus = (() => {
    const tvs = authUser?.tenantProfile?.verification?.status;
    const lvs = authUser?.landlordProfile?.verification?.status;
    if (tvs === 'verified' || lvs === 'verified') return 'verified';
    if (tvs === 'pending'  || lvs === 'pending')  return 'pending';
    return 'unverified';
  })();

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  landlordTrustScore — mirrors backend utils/trustScore.js →           ║
  // ║  computeLandlordTrust. Keep the weights and the gate in step.         ║
  // ║                                                                       ║
  // ║  It used to read `verificationStatus.faceVerified` / `.nidUploaded`,  ║
  // ║  which are PRESENCE flags (`isVerified || hasNid`). That handed over  ║
  // ║  the full 25 NID points the moment a file was uploaded, while the     ║
  // ║  server withholds them until an admin approves — so the landlord saw  ║
  // ║  an inflated score that silently dropped on the next refresh. The     ║
  // ║  tenant dashboard had the mirror-image bug (a 100% bar over a 30/100  ║
  // ║  ring); see buildVerificationItems() in TenantDashboard.jsx.          ║
  // ║                                                                       ║
  // ║  Same two-flag model as the tenant side:                              ║
  // ║    supplied — the landlord has handed it over                         ║
  // ║    done     — the server has actually credited the points             ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  const landlordTrustScore = (() => {
    const lp = landlordProfile || {};
    const vLandlord = authUser?.landlordProfile?.verification || {};
    const vTenant   = authUser?.tenantProfile?.verification   || {};
    // Identity KYC is shared across roles, so either block can satisfy it.
    const adminApproved = vLandlord.status === 'verified' || vTenant.status === 'verified';
    const rejected      = vLandlord.status === 'rejected' || vTenant.status === 'rejected';
    // Both sides required — a lone front image is not a usable NID.
    const nidSupplied = (!!(vLandlord.nidFront && vLandlord.nidBack)
                      || !!(vTenant.nidFront   && vTenant.nidBack)) && !rejected;

    const items = [
      { key: 'phone',       pts: 20, gated: false, supplied: !!userData?.phone,
        labelEn: 'Phone OTP verified',    labelBn: 'ফোন OTP ভেরিফাইড' },
      { key: 'avatar',      pts: 10, gated: false, supplied: !!userData?.avatar,
        labelEn: 'Profile picture',       labelBn: 'প্রোফাইল ছবি' },
      { key: 'preferences', pts: 5,  gated: false, supplied: (lp.preferredTenants || []).length > 0,
        labelEn: 'Tenant preferences',    labelBn: 'ভাড়াটিয়ার পছন্দ' },
      { key: 'comm',        pts: 5,  gated: false, supplied: (lp.communication || []).length > 0,
        labelEn: 'Communication channels', labelBn: 'যোগাযোগ মাধ্যম' },
      { key: 'charge',      pts: 5,  gated: false, supplied: lp.serviceCharge !== '' && lp.serviceCharge != null,
        labelEn: 'Service charge',        labelBn: 'সার্ভিস চার্জ' },
      { key: 'rules',       pts: 10, gated: false, supplied: (lp.houseRules || []).length > 0,
        labelEn: 'House rules',           labelBn: 'বাড়ির নিয়ম' },
      { key: 'photo',       pts: 20, gated: false, supplied: !!vLandlord.photo || !!vTenant.photo,
        labelEn: 'Selfie verification',   labelBn: 'সেলফি ভেরিফিকেশন' },
      { key: 'nid',         pts: 25, gated: true,  supplied: nidSupplied,
        labelEn: 'NID verified',          labelBn: 'NID ভেরিফাইড' },
    ].map((i) => ({ ...i, done: i.gated ? adminApproved && i.supplied : i.supplied }));

    const score = items.reduce((sum, i) => (i.done ? sum + i.pts : sum), 0);
    let tier = 'bronze';
    if (score >= 90)      tier = 'platinum';
    else if (score >= 70) tier = 'gold';
    else if (score >= 40) tier = 'silver';
    return {
      score,
      tier,
      breakdown: items,
      // Attached but not yet credited — drives the "in review" row + the
      // wizard's pending pill.
      pending: items.reduce((sum, i) => (i.supplied && !i.done ? sum + i.pts : sum), 0),
    };
  })();

  const [verifModalOpen, setVerifModalOpen] = useState(false);

  // Landlord identity verification — intentionally identical to the tenant
  // flow (TenantDashboard.handleWizardSubmit). The landlord now opens the very
  // same VerificationModal (role="tenant"), and this handler does the SAME real
  // backend round-trip the tenant does, instead of the old local-only stub that
  // never reached the admin KYC queue:
  //   1. Upload each touched doc (photo / NID front+back) to the shared
  //      verification block via uploadVerificationDoc.
  //   2. Persist the profession field via updateMe.
  //   3. Flip verification.status → 'pending' via submitVerification so it
  //      shows up for admins.
  //   4. Mirror into local state so the Trust Score + Verification Status
  //      timeline update without waiting for the next authUser refresh.
  const handleHostWizardSubmit = async (payload) => {
    const uploads = [];
    if (payload.photo?.file)    uploads.push(['photo',    payload.photo.file]);
    if (payload.nidFront?.file) uploads.push(['nidFront', payload.nidFront.file]);
    if (payload.nidBack?.file)  uploads.push(['nidBack',  payload.nidBack.file]);

    try {
      for (const [kind, file] of uploads) {
        await uploadVerificationDoc(kind, file);
      }

      if (authUpdateMe && payload.professionType) {
        await authUpdateMe({ tenantProfile: { professionType: payload.professionType } });
      }

      if (authSubmitVerification) {
        // Prefer freshly-hydrated flags from authUser; fall back to the files
        // we just handed off. This is the line that makes "submit" visible to
        // admins (status → 'pending').
        const v = authUser?.tenantProfile?.verification || {};
        await authSubmitVerification({
          photo:    !!v.photo    || !!payload.photo?.file,
          nidFront: !!v.nidFront || !!payload.nidFront?.file,
          nidBack:  !!v.nidBack  || !!payload.nidBack?.file,
        });
      }

      // Local mirror so the timeline card + trust score reflect it instantly.
      setVerificationStatus((prev) => ({
        ...prev,
        profileCompleted: true,
        nidUploaded: !!(payload.nidFront?.file || payload.nidBack?.file) || prev.nidUploaded,
        faceVerified: !!payload.photo?.file || prev.faceVerified,
        underReview: true,
      }));
      setUploadedDocs((prev) => ({
        ...prev,
        nidFront: !!payload.nidFront?.file || prev.nidFront,
        nidBack:  !!payload.nidBack?.file  || prev.nidBack,
        selfie:   !!payload.photo?.file    || prev.selfie,
      }));

      showToast(language === 'বাংলা' ? 'রিভিউয়ের জন্য সাবমিট করা হয়েছে।' : 'Submitted for review.');
      setVerifModalOpen(false);
    } catch (err) {
      console.error('[handleHostWizardSubmit] failed:', err);
      showToast(
        language === 'বাংলা'
          ? `সাবমিট ব্যর্থ: ${err?.message || 'আবার চেষ্টা করুন।'}`
          : `Submit failed: ${err?.message || 'Please retry.'}`,
        { type: 'error' },
      );
      throw err; // let the modal surface its inline error too
    }
  };

  // 🟢 REFS
  const nidFrontRef = useRef(null);
  const nidBackRef = useRef(null);
  const utilityRef = useRef(null);
  const notifRef = useRef(null);
  const langRef = useRef(null);
  const toastTimerRef = useRef(null);

  // 🟢 DATA STATES
  const getCache = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};
  const [properties, setProperties] = useState(() => getCache('host_props_cache', initialPortfolio));
  useEffect(() => { localStorage.setItem('host_props_cache', JSON.stringify(properties)); }, [properties]);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(true);
  const [propertyLoadError, setPropertyLoadError] = useState('');
  const [propertyRefreshTick, setPropertyRefreshTick] = useState(0);
  const [bookings, setBookings] = useState(() => getCache('host_bookings_cache', initialBookings));
  useEffect(() => { localStorage.setItem('host_bookings_cache', JSON.stringify(bookings)); }, [bookings]);
  const [inquiries, setInquiries] = useState(() => getCache('host_inquiries_cache', initialInquiries));
  useEffect(() => { localStorage.setItem('host_inquiries_cache', JSON.stringify(inquiries)); }, [inquiries]);
  // 🟢 V1 manual rent — landlord payment accounts + pending tenant claims.
  const [paymentMethods, setPaymentMethods] = useState(() => getCache('host_payment_methods_cache', []));
  useEffect(() => { localStorage.setItem('host_payment_methods_cache', JSON.stringify(paymentMethods)); }, [paymentMethods]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [pendingRentCount, setPendingRentCount] = useState(0);
  const [inquiryTab, setInquiryTab] = useState('pending'); // 'pending' | 'accepted' | 'rejected' | 'rented'
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [activeModal, setActiveModal] = useState(null); 
  const [modalData, setModalData] = useState(null);
  // ── Quick-action modal state (broadcast / reminders / export report) ────────
  // These three dashboard actions used to be toast-only stubs; they now drive
  // real work, so they need backing form + in-flight state.
  const [broadcastText, setBroadcastText] = useState('');       // message_all textarea
  const [broadcastFile, setBroadcastFile] = useState(null);     // optional image attachment
  const [isBroadcasting, setIsBroadcasting] = useState(false);  // send-in-progress guard
  const [reminderSelected, setReminderSelected] = useState(() => new Set()); // booking ids to remind
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reportType, setReportType] = useState('financial');    // 'financial' | 'payments' | 'leases'
  const [reportRange, setReportRange] = useState('month');      // 'month' | '3months' | 'ytd'
  // Edit modal form state — covers every field the host can change from
  // the dashboard (matches the AddProperty wizard fields one-to-one so the
  // backend's PATCH /api/properties/:id can accept the same shape).
  const EMPTY_EDIT_FORM = {
    title: '', price: '', location: '',
    beds: 1, baths: 1, sqft: 0, floor: 0, furnishing: 'Unfurnished',
    description: '', status: 'active',
    img: '', images: [], roomPhotos: [],
    specificDetails: {},
  };
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [selectedRoomType, setSelectedRoomType] = useState('bedroom');
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Keep the edit-modal's active photo-category tab valid for the property's
  // kind, so editing a commercial listing never tags an upload 'bedroom'
  // (residential). Reseed to the first category when the edited property changes.
  useEffect(() => {
    if (!modalData) return;
    const ids = getRoomTypes(modalData.intent, modalData.type).map((r) => r.id);
    if (!ids.includes(selectedRoomType)) setSelectedRoomType(firstRoomTypeId(modalData.intent, modalData.type));
  }, [modalData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed / reset the quick-action modals when they open. Reminders default to
  // "all overdue + partial tenants checked"; the broadcast composer opens clean.
  useEffect(() => {
    if (activeModal === 'send_reminders') {
      const now = new Date();
      const sm = getMonthCollectionSummary(bookings, now.getFullYear(), now.getMonth() + 1, now);
      // Default-check only tenants we can actually reach (linked account); the
      // rest render as disabled+unchecked so the "Send (N)" count stays honest.
      setReminderSelected(new Set(
        [...sm.overdueTenants, ...sm.partialTenants]
          .filter((b) => !!resolveTenantUserId(b))
          .map((b) => b.id),
      ));
    }
    if (activeModal === 'message_all') {
      setBroadcastText('');
      setBroadcastFile(null);
    }
  }, [activeModal]); // eslint-disable-line react-hooks/exhaustive-deps
  // NOTE: in-dashboard chat panel removed — all message CTAs now route to
  // /messages (the standalone ChatSystem) so there's a single source of
  // truth for conversations across the app.

  // 🟢 DELETE PROPERTY STATES
  const [deleteTarget, setDeleteTarget] = useState(null);     // property object to delete
  const [deleteLoading, setDeleteLoading] = useState(false);   // spinner during API call
  const [undoState, setUndoState] = useState(null);            // { prop, timeoutId } for undo grace

  // 🟢 PREMIUM + RENT-LEDGER STATES
  // Premium access is now DERIVED from the real subscription status (computed
  // just below, after subStatus), not a hardcoded stub. Booking creation
  // (Convert Inquiry → Booking) is gated behind it, so hosts whose trial /
  // subscription has expired get the upgrade prompt.

  // Subscription state — feeds the sidebar lock badges and the
  // "Verify Profile" / "Upgrade to Premium" chips. Live-syncs across tabs
  // through the service's onChange listener. The first read seeds a
  // 3-month free trial via subscriptionService.getStatus().
  // We initialize synchronously so the UI doesn't jump, and then re-fetch
  // from the backend on mount to ensure we have the latest server truth.
  const [subStatus, setSubStatus] = useState(() => subscriptionService.getStatus());
  useEffect(() => {
    subscriptionService.fetchStatus();
    const off = subscriptionService.onChange(() => setSubStatus(subscriptionService.getStatus()));
    return off;
  }, []);
  const lockedFeatureIds = useMemo(
    () => subscriptionService.getLockedFeatures(),
    [subStatus],
  );
  const isFeatureLocked = (featureId) => lockedFeatureIds.includes(featureId);

  // Premium = the subscription / 3-month free trial is still active (not expired).
  // Single source of truth for the booking-conversion gate + premium badges. If
  // subscriptionService later exposes a more specific flag (e.g. paid tier),
  // swap it in here and everything downstream follows.
  const isPremium = ['plus', 'pro'].includes(subStatus?.tier);

  // ─── Free Pro trial (share the app) ────────────────────────────────────
  // A once-per-account reward. The CTA disappears for good once taken — the
  // claim latch lives on the subscription row, so it survives the trial
  // lapsing and doesn't come back as a re-offer the server would reject.
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const canClaimShareTrial = useMemo(
    () => subscriptionService.canClaimShareTrial(),
    [subStatus],
  );

  // ─── Search boost (Plus perk) ──────────────────────────────────────────
  // Plus hosts get one credit a month to pin a listing to the top of search
  // for 24h. Pro is deliberately excluded: Pro listings already outrank
  // everything via the hostTier sort, so a Boost button there would be a
  // no-op that implies otherwise. Free hosts have nothing to spend.
  //
  // The status endpoint is the source of truth for `canBoost` — it also does
  // the lazy monthly refill, so this fetch is what tops a host up when the
  // 1st-of-month cron was missed on a sleeping instance.
  const [boostStatus, setBoostStatus] = useState(null);
  const [boostingId, setBoostingId] = useState(null);
  const showBoostButton = subStatus?.tier === 'plus';

  useEffect(() => {
    if (!showBoostButton) { setBoostStatus(null); return; }
    let cancelled = false;
    boostService.getStatus().then((s) => { if (!cancelled) setBoostStatus(s); });
    return () => { cancelled = true; };
  }, [showBoostButton]);

  const handleBoost = async (prop) => {
    if (boostingId) return; // a boost is already in flight
    setBoostingId(prop.id);
    try {
      const res = await boostService.boost(prop.id);
      setBoostStatus((s) => (s ? { ...s, creditsRemaining: res.creditsRemaining, canBoost: res.creditsRemaining > 0 } : s));
      // Reflect the pin on the card straight away instead of waiting for a refetch.
      setProperties((prev) => prev.map((p) => (
        p.id === prop.id ? { ...p, boosted: true, boostedUntil: res.boostedUntil } : p
      )));
      showToast(
        res.alreadyBoosted
          ? (language === 'বাংলা' ? 'এই প্রপার্টি এখনো বুস্ট করা আছে।' : 'This property is already boosted.')
          : (language === 'বাংলা'
              ? 'বুস্ট হয়েছে! ২৪ ঘণ্টা সার্চের উপরে থাকবে।'
              : 'Boosted! Top of search for 24 hours.'),
      );
    } catch (err) {
      showToast(err.message || (language === 'বাংলা' ? 'বুস্ট করা যায়নি।' : 'Could not boost.'));
    } finally {
      setBoostingId(null);
    }
  };

  // Active tab guarded by subscription. If the host lands on a locked tab
  // (e.g. via a stale link), we bounce them to /subscription with a `from`
  // param so the page can explain why.
  useEffect(() => {
    if (subStatus.isLoading) return;
    if (isFeatureLocked(activeTab)) {
      // `replace` matters: the locked tab must NOT stay in history. If it did,
      // Back from /subscription would land on it and this effect would bounce
      // straight forward again — a trap the user can't Back out of. Replacing
      // means Back skips the gated tab and returns to wherever they came from.
      navigate(`/subscription?from=${activeTab}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lockedFeatureIds, subStatus.isLoading]);

  // Rent Collection tab — current ledger year for the 12-month matrix.
  const [ledgerYear, setLedgerYear] = useState(new Date().getFullYear());

  // Bookings tab — lease-stage pill filter (All / Draft / Active / Notice / Done).
  // Decoupled from rentPriorityFilter so navigating between Bookings and
  // Rent Collection never resets the other tab's filter.
  const [leaseStageFilter, setLeaseStageFilter] = useState('active');

  // Rent Collection tab — priority filter (All / Overdue / Partial-Upcoming / Cleared).
  // Filters the per-tenant ledger cards on the new Shared Ledger page.
  const [rentPriorityFilter, setRentPriorityFilter] = useState('all');

  // Accordion state — only one row open at a time per tab. The compact-list
  // pattern keeps each collapsed row ~64-72px tall (vs ~600px in the older
  // expanded design), so 50+ tenant portfolios fit on screen with minimal
  // scrolling. Tap a row to expand it inline; tapping again (or expanding
  // another) collapses it back.
  //
  // Auto-expand rule: when the filtered list has ≤ AUTO_EXPAND_THRESHOLD
  // rows, every row renders expanded by default and the tap-to-toggle is
  // suppressed (no chevron, no click-collapse). The compact-row pattern
  // is a 50-house density tool — with a handful of tenants it's just
  // friction, so the dashboard reverts to a static, fully-readable layout.
  const [expandedBookingId, setExpandedBookingId] = useState(null);
  const [expandedRentId, setExpandedRentId] = useState(null);

  // Modal/form state for marking a month as paid + creating a lease.
  //
  // The mark-paid modal is now a 2-step flow:
  //   step: 'choose'  → 3 big choice cards (Full / Partial / Mark as Due)
  //   step: 'form'    → form tailored to whichever choice was made
  // `status` is the choice carried across steps; downstream handlers branch on it.
  const [payForm, setPayForm] = useState({
    bookingId: null,
    memberId: null,                // set when marking a specific hostel seat's rent
    monthKey: '',
    step: 'choose',                // 'choose' | 'form'
    status: 'full',                // 'full' | 'partial' | 'due'
    paidOn: todayIso(),
    method: 'bKash',
    txnId: '',
    amount: '',                    // received amount (full → monthlyRent, partial → user input)
    expectedRent: 0,               // booking.monthlyRent at the time the modal opened
    dueNote: '',                   // free-text note for the 'due' branch
    expectedPayBy: '',             // promised pay-by date for the 'due' branch
  });
  const [inquiryReplies, setInquiryReplies] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  // Host inquiries accordion: only one card's full body is open at a time (mobile-friendly, avoids long scroll with 10-15 inquiries)
  const [expandedHostInquiryId, setExpandedHostInquiryId] = useState(null);
  // "Unread until opened" — { [inquiryId]: seenSignature }. A new inquiry or a
  // fresh tenant reply keeps the card highlighted until the host expands it.
  const [inqSeen, setInqSeen] = useState(() => loadSeenMap('host'));

  const sendInquiryReply = async (inquiry) => {
    const id = inquiry.id || inquiry._id;
    const text = (inquiryReplies[id] || '').trim();
    if (!text) return;
    setReplyingId(id);
    try {
      await replyToInquiry(id, text);
      setInquiries(prev => prev.map(i => i.id === id
        ? { ...i, messages: [...(i.messages || []), { sender: 'landlord', text, createdAt: new Date().toISOString() }] } : i));
      setInquiryReplies(prev => ({ ...prev, [id]: '' }));
      showToast(language === 'বাংলা' ? 'রিপ্লাই পাঠানো হয়েছে।' : 'Reply sent.');
    } catch (err) { console.warn('[host] reply failed:', err.message || err); }
    finally { setReplyingId(null); }
  };

  const hostRespondVisit = async (inquiry, action) => {
    const id = inquiry.id || inquiry._id;
    try {
      const updated = await respondVisit(id, action);
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, visitSchedule: updated?.visitSchedule, status: updated?.status || i.status } : i));
      showToast(action === 'accept' ? (language === 'বাংলা' ? 'ভিজিট গ্রহণ ✓' : 'Visit accepted ✓') : (language === 'বাংলা' ? 'ভিজিট বাতিল' : 'Visit rejected'));
    } catch (err) { console.warn('[host] visit respond failed:', err.message || err); }
  };

  const [leaseForm, setLeaseForm] = useState({
    inquiryId: null,
    // Tenant's user id (carried from the inquiry). Persisted onto the booking as
    // `tenantId` so Message / Call / Profile actions can resolve the real user.
    inquirerUserId: null,
    // TENANT CHANGE — id of the lease this new one takes over from. Set when the
    // host re-lets a unit after the previous tenant moved out: on submit the old
    // lease is closed out (status 'completed') and this fresh lease + its own
    // empty rent ledger takes its place on the Rent Collection tab.
    replacesBookingId: null,
    // Set when the host is CORRECTING an existing lease rather than creating
    // one. Editing and re-letting are different acts: a re-let ends a tenancy
    // and starts another, an edit fixes what was typed wrong the first time.
    editingBookingId: null,
    serviceCharge: '',
    propertyId: '',
    property: '',
    // Auto-populated from the selected property's Add-Property location.
    location: '',
    tenant: '',
    tenantPhone: '',
    leaseStart: todayIso(),
    // Everything about the PERSON beyond name / phone / move-in — profession,
    // IDs, address, emergency contact, photo. All optional; see
    // utils/tenantFields.js for the (very short) list of what can block a save.
    tenantProfile: emptyTenantProfile(),
    leaseEnd: '',
    monthlyRent: '',
    // One-time advance / booking money collected up front.
    advancePayment: '',
    // How the advance / rent is collected: bKash | Nagad | Rocket | Bank Transfer | Cash.
    paymentMethod: 'bKash',
    // Number of people who will live in the unit (prefilled from the tenant's
    // family-members count when known).
    occupants: '',
    // New Lease category (flat / single_room / hostel) — drives the dynamic
    // fields. Plus unit location captured per category.
    category: '',
    // ── Commercial deal fields (used only when dealType === 'commercial') ──
    // Commercial leases capture the business identity + a fixed tenure instead
    // of family occupants / hostel seats. Derived from the property's intent.
    dealType: 'residential',
    businessName: '',
    licenseNumber: '',      // trade licence — optional
    leaseTermMonths: '',    // tenure in months → computes leaseEnd
    floorNumber: '',
    roomNumber: '',
    // When true, the host types a property name instead of picking a listing —
    // so a booking isn't limited to one-per-listing.
    manualProperty: false,
    // Hostel seats added up-front in the modal (beyond the main tenant = Seat 1).
    // Each: { name, phone, monthlyRent }. Rent blank ⇒ equal split of the room rent.
    seats: [],
    rentDueDay: 5,
    // Late fee — OPT-IN. Blank / 0 means the landlord charges nothing for late
    // rent, and in that case no reminder, invoice or overdue notice ever mentions
    // a fee. Only a landlord who fills this in gets "৳X late fee" in the message.
    lateFeeAmount: '',
    // Days after the due date before rent counts as late (and the fee applies).
    gracePeriodDays: 5,
    reminderLeadDays: 3,
    autoReminder: true,
    notes: '',
  });
  // Required lease fields that failed validation — drives the red highlight and
  // the scroll-to-first-empty behaviour on "Create Booking".
  const [leaseErrors, setLeaseErrors] = useState([]);
  const leaseErrCls = (f) => (leaseErrors.includes(f) ? '!border-rose-400 ring-2 ring-rose-200' : '');

  // ── New Lease wizard ──────────────────────────────────────────────────────
  // The old form was one long scroll of ~15 inputs, which is why hosts couldn't
  // tell what was required. It's now three short steps:
  //   1 UNIT   — which space is being let (format, property, floor, room)
  //   2 TENANT — who is moving in (name, phone, occupants / business)
  //   3 TERMS  — the money (dates, rent, due day, advance, reminders)
  const [leaseStep, setLeaseStep] = useState(1);
  // Which step owns each required field, so a validation error can jump the host
  // straight to the step holding the empty box.
  const LEASE_FIELD_STEP = {
    property: 1, roomNumber: 1,
    name: 2, phone: 2, moveInDate: 2, businessName: 2,
    // Conditional — only reachable when the host answered "আছে", or chose the
    // "অন্যান্য" profession and owes us the description that replaces it.
    govtIdType: 2, govtIdNumber: 2, professionalIdNumber: 2, tenantTypeOther: 2,
    leaseEnd: 3, leaseTermMonths: 3, monthlyRent: 3,
  };
  // The person, assembled from where the lease already stores them. `tenant`,
  // `tenantPhone` and `leaseStart` stay the canonical fields (the whole app
  // reads them) — this is just the view TenantInfoForm and the shared validator
  // expect, so there is no second copy of a name to drift out of sync.
  const leaseTenantView = (f = leaseForm) => ({
    ...toTenantProfile(f.tenantProfile),
    name: f.tenant || '',
    phone: f.tenantPhone || '',
    moveInDate: f.leaseStart || '',
  });
  // ── Scanning the admission form into the LEASE form ────────────────────────
  // The seat form in the Rooms view has had this since it was written; the
  // lease form — the one a landlord reaches from "ভাড়াটিয়া যোগ করুন" — did
  // not, so the same photo of the same admission slip could be read for a seat
  // and had to be typed out by hand here. Same service, same patch shape; the
  // only difference is that the result is routed through applyTenantPatch,
  // because this form keeps name / phone / move-in on the lease itself.
  const [leaseScanning, setLeaseScanning] = useState(false);
  const [leaseScanned, setLeaseScanned] = useState(null);
  const leaseScanInputRef = useRef(null);

  const handleLeaseScan = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast(language === 'বাংলা' ? 'ছবি ফাইল দিন' : 'Please choose an image file');
      return;
    }
    setLeaseScanning(true);
    try {
      const result = await scanTenantForm(file);
      if (!result || !Object.keys(result.patch || {}).length) {
        showToast(language === 'বাংলা' ? 'ফরম থেকে কিছু পড়া গেল না — হাতে লিখুন' : 'Nothing readable on that page — fill it in by hand');
        return;
      }
      // Blanks on the page never overwrite what is already typed: scanTenantForm
      // only returns keys it actually read a value for.
      applyTenantPatch(result.patch);
      setLeaseScanned(Object.keys(result.patch));
      showToast(language === 'বাংলা'
        ? `${Object.keys(result.patch).length}টি ঘর ভরা হয়েছে — যাচাই করে নিন`
        : `Filled ${Object.keys(result.patch).length} field(s) — please check them`);
    } catch (err) {
      showToast(err.message || (language === 'বাংলা' ? 'স্ক্যান ব্যর্থ' : 'Scan failed'));
    } finally {
      setLeaseScanning(false);
    }
  };

  // Route a patch from TenantInfoForm back to the right home: the three
  // canonical fields to the lease, everything else to tenantProfile.
  const applyTenantPatch = (patch) => setLeaseForm((f) => {
    const next = { ...f, tenantProfile: { ...toTenantProfile(f.tenantProfile) } };
    Object.entries(patch).forEach(([k, val]) => {
      if (k === 'name') next.tenant = val;
      else if (k === 'phone') next.tenantPhone = val;
      else if (k === 'moveInDate') next.leaseStart = val;
      else next.tenantProfile[k] = val;
    });
    return next;
  });
  // Per-step required fields for the New Lease wizard. "Next" won't advance while
  // the current step still has an empty required box, so the host is told what's
  // missing while they're looking at it — not after filling in everything else.
  const leaseStepMissing = (step, f = leaseForm) => {
    const isCommercial = f.dealType === 'commercial';
    const missing = [];
    if (step === 1) {
      if (f.manualProperty ? !String(f.property || '').trim() : !f.propertyId) missing.push('property');
      // Room / flat number is required for EVERY format now, not just rooms and
      // hostels — it is one of the four things that identify a tenancy, and a
      // flat in a building needs its number as much as a hostel seat does.
      if (!isCommercial && !String(f.roomNumber || '').trim()) missing.push('roomNumber');
    }
    if (step === 2) {
      // The whole tenant rulebook lives in one shared validator: three required
      // person fields, plus any ID the host affirmatively said exists.
      missing.push(...validateTenantProfile(leaseTenantView(f)));
      if (isCommercial && !String(f.businessName || '').trim()) missing.push('businessName');
    }
    if (step === 3) {
      // Dates are OPTIONAL. A landlord entering their whole building in one
      // sitting gives every tenant the same start date anyway, so we default it
      // (today + a 12-month term) instead of making them confirm it 20 times.
      // Rent is the only thing we genuinely can't guess.
      if ((Number(f.monthlyRent) || 0) <= 0) missing.push('monthlyRent');
    }
    return missing;
  };

  // Resolve what actually gets saved as the term. Used by both the wizard
  // preview and submit so what's shown is what gets stored.
  //
  // `endIso: ''` means ONGOING — no expiry. That's the default for a residential
  // tenancy, because that's how renting works here: the tenant stays until they
  // leave, and the landlord marks that by handing the unit to the next tenant.
  // We used to auto-fill a 12-month term "to be helpful", which quietly turned
  // every long-staying tenant into an expired lease the host had to re-create.
  const resolveLeaseDates = (f = leaseForm) => {
    const startIso = f.leaseStart || todayIso();
    const sd = new Date(startIso);
    const isCommercial = f.dealType === 'commercial';
    const termMonths = Number(f.leaseTermMonths) || 0;
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Commercial leases genuinely are defined by their tenure, so the term wins.
    if (isCommercial && termMonths > 0) {
      return { startIso, endIso: iso(new Date(sd.getFullYear(), sd.getMonth() + termMonths, sd.getDate())) };
    }
    // A host who typed an end date on purpose gets exactly that.
    if (f.leaseEnd) return { startIso, endIso: f.leaseEnd };
    return { startIso, endIso: '' };
  };

  // Move between wizard steps. Going forward validates every step being stepped
  // over — tapping "Rent" straight from "Unit" can't skip the tenant's name —
  // and stops on the first one that still has an empty box. Going back never
  // blocks; the host may just want to re-check the unit.
  const goLeaseStep = (next) => {
    const target = Math.max(1, Math.min(3, next));
    if (target > leaseStep) {
      for (let s = leaseStep; s < target; s += 1) {
        const missing = leaseStepMissing(s);
        if (missing.length) {
          setLeaseErrors(missing);
          setLeaseStep(s);
          showToast(language === 'বাংলা' ? 'লাল ঘরগুলো পূরণ করুন' : 'Please fill the highlighted fields');
          setTimeout(() => {
            const el = document.getElementById('lease-' + missing[0]);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { el.focus({ preventScroll: true }); } catch { /* focus optional */ } }
          }, 60);
          return;
        }
      }
    }
    setLeaseErrors([]);
    setLeaseStep(target);
  };

  const [inquiryStatusForm, setInquiryStatusForm] = useState({
    status: 'new',
    visitDate: '',
    notes: ''
  });

  // Stable "today" used by all rent-status calculations on this render. We
  // memoise on date-string change so flipping months in the picker doesn't
  // thrash the matrix.
  const today = useMemo(() => new Date(), [todayIso()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Landlord's default active payment method — repeated in every rent reminder
  // and shown on the dashboard card. All of a landlord's bookings share the
  // same default account. Declared BEFORE hostAlerts (which consumes it).
  const defaultPaymentMethod = useMemo(
    () => paymentMethods.find((m) => m.isDefault && m.isActive) || paymentMethods.find((m) => m.isActive) || null,
    [paymentMethods],
  );
  const hasActivePaymentMethod = paymentMethods.some((m) => m.isActive);

  // 🟢 Merged Smart Alerts for the landlord — the SAME computation the
  // Smart Alerts page runs internally (rent + lease + inquiry), lifted here
  // so the once-per-session pop-up can flag URGENT items the moment the
  // dashboard opens. Memoised on the same inputs the page uses.
  const hostAlerts = useMemo(() => {
    // Every booking shares the landlord's default account → append the "where
    // to pay" line to each rent reminder when Payment Settings is configured.
    const paymentMethodsByBooking = {};
    if (defaultPaymentMethod) {
      for (const b of bookings) { if (b?.id) paymentMethodsByBooking[b.id] = defaultPaymentMethod; }
    }
    const opts = { paymentMethodsByBooking };
    const rent = buildRentAlerts(bookings, today, language, opts);
    const lease = buildLeaseAlerts(bookings, today, language);
    const inquiry = buildInquiryAlerts(inquiries, today, language);
    const rank = { urgent: 0, medium: 1, low: 2 };
    return [...rent.alerts, ...lease.alerts, ...inquiry.alerts].sort(
      (a, b) => (rank[a.type] - rank[b.type]) || ((a.daysLeft ?? 999) - (b.daysLeft ?? 999)),
    );
  }, [bookings, inquiries, today, language, defaultPaymentMethod]);

  // Land at the top whenever the tab changes — including when the change came
  // from a Back press, which is what a native screen transition does. Keyed on
  // `activeTab` rather than the whole location so unrelated URL edits (a
  // deep-link param being cleaned up, a back-guard entry) don't yank the page.
  // `location.state.activeTab` is handled by useTabHistory, not here: re-applying
  // it on every location change used to re-select that tab immediately after a
  // Back press, which is why Back appeared to do nothing on some tabs.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Backend contract:
  //   GET /api/host/properties (Bearer)  →  { properties[] }
  //
  // We merge the host's own listings (from propertyService) with the seeded
  // demo portfolio so brand-new listings created via /list-property show up
  // here without a page refresh. The subscription fires whenever AddProperty
  // writes a new record, including from another browser tab.
  //
  // NOTE on mutability: edit/pause/delete actions below mutate the merged
  // `properties` state in-memory only. The subscription rebuilds the list on
  // every new add, which is fine for mock-mode. When the backend lands, each
  // mutation should round-trip through propertyService.update/delete and the
  // subscriber will refresh from the API response.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      setIsPropertiesLoading(true);
      setPropertyLoadError('');
      try {
        const mine = await propertyService.listMyProperties();
        if (cancelled) return;
        setProperties([
          ...mine.map(toPortfolioCard),
          ...initialPortfolio,
        ]);
      } catch (err) {
        if (cancelled) return;
        console.warn('[host] failed to load properties:', err.message || err);
        setPropertyLoadError(err.message || 'Could not load your properties.');
      } finally {
        if (!cancelled) setIsPropertiesLoading(false);
      }
    };

    hydrate();
    const unsubscribe = subscribeUserProperties(hydrate);
    return () => { cancelled = true; unsubscribe?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyRefreshTick]);

  // ── Hydrate the host's bookings from the backend ────────────────────────
  // Every snapshot from the server is put through the write queue before it
  // reaches state. THIS is what stopped rent collected in a dead zone from
  // disappearing: the poll used to overwrite an unsent payment with the
  // server's older copy, thirty seconds after the landlord was told it saved.
  // A failed read changes nothing at all — the cached register stays readable
  // with no connection, which is most of what a landlord needs on the stairs.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const rows = await listHostBookings();
        if (cancelled) return;
        setBookings(hostSync.replay({ bookings: rows, units: [] }).bookings);
      } catch (err) {
        console.warn('[host] failed to load bookings:', err.message || err);
        return;
      }
      // A successful read proves the network is back — send what is waiting.
      useHostSyncStore.getState().flush();
    };
    hydrate();
    const interval = setInterval(hydrate, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── The write queue's window into this screen ───────────────────────────
  // The queue can run from anywhere — a reconnect, a timer, the app booting on
  // another tab — so it cannot read React state directly. It gets a live reader
  // for the current bookings, and a way to hand each server answer back.
  // Registered once; the ref is what keeps it current.
  const bookingsRef = useRef(bookings);
  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);
  useEffect(() => {
    useHostSyncStore.getState().configure({
      getWorld: () => ({ bookings: bookingsRef.current, units: [] }),
      setWorld: (world) => setBookings(world.bookings),
      onServer: (result, op) => {
        // Rooms are owned by the Units screen, which reconciles its own list.
        if (op.action === 'createUnit' || op.action === 'updateUnitFields') return;
        const booking = op.action === 'addTenant' ? result?.booking : result;
        if (!booking || !booking.id) return;
        setBookings((prev) => {
          const exists = prev.some((b) => String(b.id) === String(booking.id));
          const next = exists
            ? prev.map((b) => (String(b.id) === String(booking.id) ? booking : b))
            : [...prev, booking];
          // Whatever is STILL queued goes back on top — the server's copy knows
          // nothing about the payments behind this one in the queue.
          return hostSync.replay({ bookings: next, units: [] }).bookings;
        });
      },
    });
  }, []);

  // ── Real Building records ───────────────────────────────────────────────
  // Buildings are their own collection now, with ObjectIds that bookings
  // actually reference. Until the buildings/units migration has run for a given
  // landlord the API returns nothing, and we leave the old profile blob in
  // place — utils/buildingScope.js falls back to name matching for rows with no
  // buildingId yet, so nothing disappears mid-rollout.
  // Cached like every other host collection on this screen (bookings,
  // properties, inquiries). It was the one that wasn't, and it is the one the
  // Rooms view hangs off: with no connection at boot this stayed null, the
  // building list was empty, and a landlord could not drill into a building to
  // reach the rooms — so the register and the room cache underneath it were
  // both readable and both unreachable. `null` still means "nothing cached
  // either", which keeps the pre-migration fallback in effectiveLandlordProfile
  // working exactly as before.
  const [serverBuildings, setServerBuildings] = useState(() => getCache('host_buildings_cache', null));
  useEffect(() => {
    if (!serverBuildings) return;
    try { localStorage.setItem('host_buildings_cache', JSON.stringify(serverBuildings)); } catch { /* quota — the list still works */ }
  }, [serverBuildings]);
  useEffect(() => {
    let cancelled = false;
    listBuildings()
      // A failed read changes nothing: the cached list stays on screen, the
      // same way a failed booking read leaves the register alone.
      .then((rows) => { if (!cancelled) setServerBuildings(rows); })
      .catch((err) => console.warn('[host] failed to load buildings:', err.message || err));
    return () => { cancelled = true; };
  }, []);

  // Server buildings win once they exist; the profile blob is the pre-migration
  // fallback. Every tab reads buildings through this, so there is one answer to
  // "what buildings does this landlord have".
  // A building was just created by the wizard. Add it optimistically so the
  // tab it was created from can switch straight into it, then re-read from the
  // server so counts are real.
  // "The buildings changed" — created, renamed or archived. A new building is
  // added optimistically so the tab it came from can switch into it; every
  // case then re-reads from the server so the counts are real. Called with no
  // argument (edit / archive) it is just a refresh.
  const handleBuildingCreated = (building) => {
    if (building) setServerBuildings((prev) => [...(prev || []), building]);
    listBuildings()
      .then(setServerBuildings)
      .catch((err) => console.warn('[host] building refresh failed:', err.message || err));
  };

  // Re-read the bookings. The AI scanner needs this: its batch endpoint returns
  // a per-tenant summary rather than whole bookings, so there is nothing to
  // merge into state — the list has to come back from the server or the
  // freshly scanned tenants sit invisible until a reload.
  const refreshBookings = () => {
    listHostBookings()
      .then((rows) => setBookings(hostSync.replay({ bookings: rows, units: [] }).bookings))
      .catch((err) => console.warn('[host] booking refresh failed:', err.message || err));
  };

  const effectiveLandlordProfile = useMemo(() => {
    if (!(serverBuildings && serverBuildings.length)) return landlordProfile;
    return {
      ...landlordProfile,
      buildings: serverBuildings,
      // DERIVED, never stored. `buildingMode` is not a path on
      // LandlordProfileSchema — like `buildings` before it, the strict schema
      // silently discarded it, so it survived only in localStorage.
      //
      // The visible symptom: creating a second building left the mode on
      // 'single', and single mode only ever renders buildings[0]. The building
      // you already had vanished from the list, then "came back" on reload
      // because currentBuildingId reset and buildings[0] was it again.
      //
      // Two buildings IS multi-building mode. Counting them cannot go stale.
      buildingMode: serverBuildings.length > 1
        ? 'multi'
        : (landlordProfile?.buildingMode || 'single'),
    };
  }, [landlordProfile, serverBuildings]);

  // ── Auto-recovery for lost building profiles ────────────────────────────
  // If the user's `landlordProfile.buildings` is empty but they have bookings,
  // it means they fell victim to the localStorage logout bug before it was fixed.
  // We can automatically restore their buildings by extracting the unique 
  // property names from their existing bookings.
  useEffect(() => {
    if (bookings.length > 0 && landlordProfile) {
      if (!landlordProfile.buildings || landlordProfile.buildings.length === 0) {
        const uniqueProperties = [...new Set(bookings.map(b => b.property).filter(Boolean))];
        if (uniqueProperties.length > 0) {
          const recoveredBuildings = uniqueProperties.map((propName, i) => ({
            id: 'bldg_rec_' + Date.now() + '_' + i,
            name: propName,
            location: '', // Empty so they can fill it later if they want
            type: 'residential',
            category: 'flat',
            createdAt: new Date().toISOString()
          }));
          
          const recoveredMode = (landlordProfile.buildingMode === 'multi' || uniqueProperties.length > 1) ? 'multi' : 'single';
          
          persistLandlordProfile({
            ...landlordProfile,
            buildingMode: recoveredMode,
            buildings: recoveredBuildings
          });
          console.log('[host] Auto-recovered buildings from existing bookings:', recoveredBuildings);
        }
      }
    }
  }, [bookings.length, landlordProfile?.buildings?.length]);


  // ── V1 manual rent: load payment methods + pending-verification count ────
  // Payment methods drive the Payment Settings badge, the after-login popup,
  // and the payment instruction appended to rent reminders. Pending count
  // drives the "Pending Rent Payments" badge.
  const refreshPaymentMethods = async () => {
    setPaymentMethodsLoading(true);
    try {
      setPaymentMethods(await listMyPaymentMethods());
    } catch (err) {
      console.warn('[host] failed to load payment methods:', err.message || err);
    } finally {
      setPaymentMethodsLoading(false);
    }
  };
  const refreshPendingRent = async () => {
    try {
      const rows = await listHostRentPayments('pending');
      setPendingRentCount(rows.length);
    } catch (err) {
      console.warn('[host] failed to load pending rent payments:', err.message || err);
    }
  };
  useEffect(() => {
    refreshPaymentMethods();
    refreshPendingRent();
    const rentPoll = setInterval(refreshPendingRent, 60_000);
    return () => clearInterval(rentPoll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hydrate the host's inquiries from the backend ───────────────────────
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const rows = await listHostInquiries();
        if (cancelled) return;
        setInquiries(rows.map(toInquiryRow));
      } catch (err) {
        console.warn('[host] failed to load inquiries:', err.message || err);
      }
    };
    hydrate();
    const interval = setInterval(hydrate, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Hydrate REAL host performance stats (/api/host-stats) ───────────────
  // Response rate, avg response time, conversion rate — all server-computed
  // from live inquiries / bookings / chat threads. Replaces the old hardcoded
  // 98% / 15min / 24% card.
  const [hostStats, setHostStats] = useState(() => getCache('host_stats_cache', { responseRate: 0, avgResponseTime: 0, conversionRate: 0 }));
  useEffect(() => { localStorage.setItem('host_stats_cache', JSON.stringify(hostStats)); }, [hostStats]);
  useEffect(() => {
    let cancelled = false;
    const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const hydrate = async () => {
      try {
        const token = localStorage.getItem('auth:token');
        if (!token) return;
        const res = await fetch(`${API}/host-stats`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setHostStats({
          responseRate:    Number(data.responseRate)    || 0,
          avgResponseTime: Number(data.avgResponseTime) || 0,
          conversionRate:  Number(data.conversionRate)  || 0,
        });
      } catch (err) {
        console.warn('[host] failed to load stats:', err.message || err);
      }
    };
    hydrate();
    const interval = setInterval(hydrate, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const fetchNotifications = async () => {
      if (!authUser) return;
      try {
        const res = await listNotifications({ limit: 50 });
        if (cancelled) return;
        setNotifications(res.items);
        setUnreadCount(res.unread);
      } catch (err) {
        // silent
      }
    };

    fetchNotifications();
    timer = setInterval(fetchNotifications, 15_000); // 15s poll

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [authUser]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setIsNotifOpen(false);
      if (langRef.current && !langRef.current.contains(event.target)) setIsLangMenuOpen(false); 
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = (msg, { undo, duration, type } = {}) => {
    setToastMessage({ text: msg, undo: undo || null, type: type || 'success' });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToastMessage(null),
      undo ? 6000 : (duration || 3000),
    );
  };

  // ── Document Vault (real Cloudinary-backed storage) ────────────────────
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadForm, setUploadForm] = useState({ folder: 'agreements', bookingId: '', docName: '', file: null, error: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // The vault is also read by the per-tenant "Docs" modal, which opens from the
  // Bookings tab — where this effect had never run, so the list was empty and
  // the modal could only ever claim the tenant had no files.
  useEffect(() => {
    if (activeTab !== 'documents' && activeModal !== 'download_user_document') return;
    let alive = true;
    setLoadingDocs(true);
    (async () => {
      try {
        const docs = await listDocsApi();
        if (alive) setDocuments(Array.isArray(docs) ? docs : []);
      } catch (err) {
        console.warn('[host] documents load failed:', err.message || err);
      } finally {
        if (alive) setLoadingDocs(false);
      }
    })();
    return () => { alive = false; };
  }, [activeTab, activeModal]);

  const handleDocUpload = async () => {
    if (!uploadForm.file) {
      showToast(language === 'বাংলা' ? 'একটি ফাইল সিলেক্ট করুন' : 'Choose a file first');
      return;
    }
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('folder', uploadForm.folder);
      // The landlord's own label for the file. Falls back to the upload's
      // filename, which for a phone photo is "IMG_20260830.jpg" — accurate and
      // useless in a list of forty documents.
      fd.append('fileName', String(uploadForm.docName || '').trim() || uploadForm.file.name);
      const b = bookings.find(x => String(x.id) === String(uploadForm.bookingId));
      if (b) {
        // The REAL occupant, not booking.tenant — which is blank on every
        // seat-rented room and stale on a flat once the tenant joins by invite.
        // The snapshot stored here is what names the file after the booking is
        // gone, so it has to be the person, not an empty string.
        const occ = primaryOccupant(b, language);
        // Their own linked account where they have one; the booking's only as a
        // fallback for legacy rows with no members.
        const uid = (activeMembers(b)[0]?.userId) || b.tenantId || '';
        if (uid) fd.append('tenantId', String(uid));
        fd.append('tenantName', occ.name);
        fd.append('tenantPhone', occ.phone || '');
        fd.append('bookingId', b.id);
      }
      const doc = await uploadDocApi(fd);
      setDocuments(prev => [doc, ...prev]);
      setUploadForm({ folder: 'agreements', bookingId: '', docName: '', file: null, error: null });
      setActiveModal(null);
      showToast(language === 'বাংলা' ? 'ডকুমেন্ট আপলোড হয়েছে!' : 'Document uploaded!');
    } catch (err) {
      showToast((language === 'বাংলা' ? 'আপলোড ব্যর্থ: ' : 'Upload failed: ') + (err.message || ''));
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocDownload = async (doc) => {
    if (!doc || !doc.fileUrl) return;
    showToast(language === 'বাংলা' ? 'ডাউনলোড হচ্ছে...' : 'Downloading...');
    try {
      const res = await fetch(doc.fileUrl);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      // Fallback: Cloudinary forced-download URL in a new tab.
      const a = document.createElement('a');
      a.href = downloadUrlFor(doc.fileUrl, doc.fileName);
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const handleDocPreview = async (doc) => {
    if (!doc || !doc.fileUrl) return;
    const name = String(doc.fileName || '').toLowerCase();
    const mime = String(doc.fileType || '');
    const isOffice = /\.(docx?|xlsx?|pptx?)$/.test(name) || mime.includes('word') || mime.includes('officedocument') || mime.includes('msword');
    if (isOffice) {
      // Browsers can't render Office files — use Microsoft's online viewer.
      window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(doc.fileUrl)}`, '_blank', 'noopener');
      return;
    }
    // PDF / images: Cloudinary 'raw' PDFs download instead of previewing when
    // opened directly. Fetch the bytes and re-serve as a typed blob so the
    // browser shows them INLINE. Open the tab synchronously first (within the
    // click gesture) so popup blockers don't kill it after the await.
    const isPdf = name.endsWith('.pdf') || mime.includes('pdf');
    const win = window.open('', '_blank');
    try {
      const res = await fetch(doc.fileUrl);
      if (!res.ok) throw new Error('fetch failed');
      const buf = await res.arrayBuffer();
      const type = isPdf ? 'application/pdf' : (mime || 'application/octet-stream');
      const url = URL.createObjectURL(new Blob([buf], { type }));
      if (win) win.location = url; else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (win) win.location = doc.fileUrl; else window.open(doc.fileUrl, '_blank', 'noopener');
    }
  };

  const handleDocDelete = async (doc) => {
    const docId = doc.id || doc._id;
    if (!window.confirm(language === 'বাংলা' ? 'এই ডকুমেন্ট স্থায়ীভাবে মুছে ফেলবেন?' : 'Permanently delete this document?')) return;
    const snapshot = documents;
    setDocuments(p => p.filter(d => (d.id || d._id) !== docId));
    try {
      await deleteDocApi(docId);
      showToast(language === 'বাংলা' ? 'ডকুমেন্ট মুছে ফেলা হয়েছে' : 'Document deleted');
    } catch (err) {
      setDocuments(snapshot);
      showToast((language === 'বাংলা' ? 'ডিলিট ব্যর্থ: ' : 'Delete failed: ') + (err.message || ''));
    }
  };

  // 🟢 PROFILE LOGIC HANDLERS
  const handleEditToggle = () => {
    if (isEditingProfile) {
      setTempUserData(userData); 
      setIsEditingProfile(false);
    } else {
      setIsEditingProfile(true);
    }
  };

  const handleProfileSave = async () => {
    if(!tempUserData.fullName || !tempUserData.phone) {
      showToast(language === 'বাংলা' ? 'নাম এবং ফোন নম্বর আবশ্যক!' : 'Name and Phone are required!');
      return;
    }
    setUserData(tempUserData);
    setIsEditingProfile(false);
    // Propagate to AuthContext so the Navbar profile chip + cross-tab
    // subscribers see the updated name/phone/email instantly.
    try {
      await authUpdateMe?.({
        name:      tempUserData.fullName,
        fullName:  tempUserData.fullName,
        phone:     tempUserData.phone,
        email:     tempUserData.email,
        address:   tempUserData.address,
        city:      tempUserData.city,
        nidNumber: tempUserData.nidNumber,
        avatar:    tempUserData.avatar,
      });
    } catch { /* keep the local edit even if sync fails */ }
    showToast(language === 'বাংলা' ? 'প্রোফাইল সফলভাবে আপডেট হয়েছে!' : 'Profile updated successfully!');
    if(uploadedDocs.nidFront && uploadedDocs.nidBack && uploadedDocs.selfie) {
      setVerificationStatus(prev => ({ ...prev, underReview: true }));
    }
  };

  const handleFileUpload = (docType) => {
    showToast(language === 'বাংলা' ? 'ডকুমেন্ট আপলোড হচ্ছে...' : 'Uploading document...');
    setTimeout(() => {
      setUploadedDocs(prev => ({ ...prev, [docType]: true }));
      showToast(language === 'বাংলা' ? 'আপলোড সম্পন্ন হয়েছে!' : 'Upload complete!');
      if(docType === 'nidFront' || docType === 'nidBack') {
        const isFrontDone = docType === 'nidFront' ? true : uploadedDocs.nidFront;
        const isBackDone = docType === 'nidBack' ? true : uploadedDocs.nidBack;
        if(isFrontDone && isBackDone) {
           setVerificationStatus(prev => ({ ...prev, nidUploaded: true }));
        }
      }
    }, 1500);
  };

  const handleSelfieCapture = () => {
    showToast(language === 'বাংলা' ? 'ক্যামেরা ওপেন হচ্ছে...' : 'Opening camera...');
    setTimeout(() => {
      showToast(language === 'বাংলা' ? 'ফেস স্ক্যান এবং ম্যাচ করা হচ্ছে...' : 'Scanning and matching face...');
      setTimeout(() => {
        setUploadedDocs(prev => ({ ...prev, selfie: true }));
        setVerificationStatus(prev => ({ ...prev, faceVerified: true }));
        showToast(language === 'বাংলা' ? 'ফেস ভেরিফাইড!' : 'Face Verified Successfully!');
        if (uploadedDocs.nidFront && uploadedDocs.nidBack) {
            setVerificationStatus(prev => ({ ...prev, underReview: true }));
        }
      }, 2000);
    }, 1000);
  };

  // 🟢 ACTION HANDLERS
  const handleCallUser = (peerUserId, peerName, peerAvatar) => {
    setActiveDropdownId(null);
    // A call needs a real user on the platform. Manual bookings (no linked
    // tenant account) can't be called — tell the host instead of silently
    // landing them on an empty Messages page.
    if (!peerUserId) {
      showToast(language === 'বাংলা'
        ? 'এই ভাড়াটিয়া এখনো TO-LET PRO অ্যাকাউন্টে যুক্ত নন — কল করা যাচ্ছে না।'
        : "This tenant isn't linked to a TO-LET PRO account yet, so calling isn't available.");
      return;
    }
    navigate('/messages', {
      state: {
        peerUserId,
        peerName,
        peerAvatar,
        mode: 'call'
      }
    });
  };

  // 🟢 UNIFIED MESSAGE HANDLER
  // Routes every Message CTA in the dashboard to the standalone ChatSystem
  // page (/messages). The in-dashboard chat panel has been retired so there
  // is one single conversation surface for the whole app — ChatSystem will
  // hydrate the right thread from `location.state.chatId` and render any
  // cross-system rent receipts inline.
  // Best-effort resolve of a booking's tenant user id. Prefers the id already
  // on the booking (set at create time / backfilled by the backend), then falls
  // back to the linked inquiry's inquirer — this covers the brief window before
  // the next bookings poll lands the backend-resolved id.
  const resolveTenantUserId = (booking) => {
    if (!booking) return null;
    if (booking.tenantId) return booking.tenantId;
    if (booking.inquiryId) {
      const inq = inquiries.find(i => String(i.id) === String(booking.inquiryId));
      if (inq?.inquirerUserId) return inq.inquirerUserId;
    }
    return null;
  };

  // 🟢 OPEN TENANT PROFILE — routes to /tenant/:id (the public trust card).
  // Guards the "no linked account" case so the host gets a clear message
  // instead of a broken profile page.
  const openTenantProfile = (tenantUserId, opts = {}) => {
    setActiveDropdownId(null);
    if (!tenantUserId) {
      showToast(language === 'বাংলা'
        ? 'এই ভাড়াটিয়ার কোনো লিংকড প্রোফাইল নেই।'
        : 'This tenant has no linked profile yet.');
      return;
    }
    navigate(`/tenant/${tenantUserId}`, {
      state: { peerName: opts.name || '', peerAvatar: opts.avatar || '' },
    });
  };

  const openChatPanel = (chatId, context = {}) => {
    setActiveDropdownId(null);
    // ChatSystem opens a REAL thread only from a peerUserId or an actual
    // conversation id (24-hex Mongo id) / the AI bot. A synthetic `chat-<id>`
    // with no peerUserId is a dead-end (this was the "opens Messages then does
    // nothing" bug). Prefer peerUserId; guard the dead-end case with a toast.
    const hasPeer = !!context.peerUserId;
    const isRealConvo = typeof chatId === 'string' && /^[0-9a-fA-F]{24}$/.test(chatId);
    if (!hasPeer && !isRealConvo && chatId !== 'ai-bot') {
      showToast(language === 'বাংলা'
        ? 'এই ভাড়াটিয়ার সাথে মেসেজ করা যাচ্ছে না — কোনো লিংকড অ্যাকাউন্ট নেই।'
        : "Messaging isn't available for this tenant yet (no linked account).");
      return;
    }
    navigate('/messages', {
      state: {
        chatId,
        source: 'host-bookings',
        ...context,
      },
    });
  };

  // 🟢 CLICKABLE NOTIFICATIONS — deep-link a notification to its target surface.
  // The host inbox mostly sees inquiry_new + message_new; rent_* (if any) land
  // on the rent ledger. 'system' / unknown types just mark-read (no navigation).
  const handleNotifClick = (notif) => {
    const d = notif?.data || {};
    switch (notif?.type) {
      case 'message_new':
      case 'message':
        if (d.conversationId || d.targetId) openChatPanel(d.conversationId || d.targetId, { source: 'notification' });
        break;
      case 'inquiry_new':
      case 'inquiry_status':
      case 'inquiry':
        setActiveTab('inquiries');
        // The row mounts right after the tab switch — highlightNotifTarget
        // polls the DOM for #inquiry-<targetId> and scrolls/flashes it.
        if (d.targetId) highlightNotifTarget(d.targetId);
        break;
      case 'rent_receipt':
      case 'rent_invoice':
      case 'rent_overdue':
      case 'payment':
        setActiveTab('rent');
        if (d.targetId) highlightNotifTarget(d.targetId);
        break;
      default:
        break;
    }
  };

  const handleRemoveBooking = (id) => {
    // Confirmed: actually remove.
    setConfirmDeleteBookingId(null);
    setBookings(bookings.filter(b => b.id !== id));
    showToast(language === 'বাংলা' ? 'বুকিং বাদ দেওয়া হয়েছে।' : 'Booking removed.');
    if (/^[0-9a-fA-F]{24}$/.test(String(id))) {
      // Queued: removing a lease with no signal used to look done and come back
      // on the next poll.
      hostSync.enqueue('cancelBooking', { bookingId: id });
    }
  };

  const handleRemoveInquiry = (id) => {
    setInquiries(inquiries.filter(i => i.id !== id));
    showToast(language === 'বাংলা' ? 'ইনকোয়ারি আর্কাইভ করা হয়েছে।' : 'Inquiry Archived.');
  };

  const togglePropertyStatus = (id) => {
    setProperties(properties.map(p => {
      if (p.id === id && p.status !== 'rented') {
        const newStatus = p.status === 'active' ? 'paused' : 'active';
        showToast(language === 'বাংলা' ? `প্রপার্টি ${newStatus.toUpperCase()} করা হয়েছে` : `Property marked as ${newStatus.toUpperCase()}`);
        // Persist host-owned listings via the service layer so the change
        // survives reloads. Demo seed entries return null from
        // updateProperty() and stay as in-memory-only state.
        propertyService.updateProperty(id, { status: newStatus }).catch(() => {});
        return { ...p, status: newStatus };
      }
      return p;
    }));
  };

  // ─── DELETE PROPERTY (deferred with undo grace period) ────────────────
  // Step 1: User clicks Delete → opens the confirmation modal.
  const handleDeleteProperty = (prop) => {
    setDeleteTarget(prop);
    setActiveModal('confirm_delete');
  };

  // Step 2: User confirms in the modal → card removed from UI immediately,
  // actual API call deferred by 5 seconds. During that window the Undo
  // button in the toast re-inserts the card and cancels the timeout.
  const confirmDeleteProperty = () => {
    const prop = deleteTarget;
    if (!prop) return;
    setActiveModal(null);
    setDeleteTarget(null);

    // Smooth fade-out animation before removing from state
    const cardEl = document.querySelector(`[data-property-id="${prop.id}"]`);
    if (cardEl) {
      cardEl.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out, max-height 0.5s ease-out 0.2s';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.95) translateY(-10px)';
      cardEl.style.overflow = 'hidden';
      setTimeout(() => {
        cardEl.style.maxHeight = '0';
        cardEl.style.padding = '0';
        cardEl.style.margin = '0';
      }, 300);
    }

    // Remove from state after animation finishes
    setTimeout(() => {
      setProperties((prev) => prev.filter((p) => p.id !== prop.id));
    }, cardEl ? 600 : 0);

    // Schedule the real API call
    const tid = setTimeout(async () => {
      setUndoState(null);
      setDeleteLoading(true);
      try {
        await propertyService.deleteProperty(prop.id);
        showToast(
          language === 'বাংলা'
            ? 'প্রপার্টি সফলভাবে মুছে ফেলা হয়েছে'
            : 'Property deleted successfully',
        );
      } catch (err) {
        // Re-add to the list on failure
        setProperties((prev) => [prop, ...prev]);
        showToast(
          language === 'বাংলা'
            ? 'প্রপার্টি মুছতে সমস্যা হয়েছে'
            : (err.message || 'Failed to delete property'),
          { type: 'error' },
        );
      } finally {
        setDeleteLoading(false);
      }
    }, 5000);

    setUndoState({ prop, timeoutId: tid });

    // Show undo toast
    showToast(
      language === 'বাংলা' ? 'প্রপার্টি মুছে ফেলা হবে...' : 'Property will be deleted...',
      {
        undo: () => {
          clearTimeout(tid);
          setUndoState(null);
          setProperties((prev) => [prop, ...prev]);
          showToast(language === 'বাংলা' ? 'আনডু সফল!' : 'Undo successful!');
        },
      },
    );
  };

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoState?.timeoutId) clearTimeout(undoState.timeoutId);
    };
  }, [undoState]);

  const openModal = (type, data = null) => {
    setActiveModal(type);
    setModalData(data);
    setActiveDropdownId(null);
    setIsProfileDrawerOpen(false);
    setConfirmDeleteBookingId(null);
    if (type === 'upload_document') {
      setUploadForm({ folder: activeFolder?.id || 'agreements', bookingId: '', docName: '', file: null, error: null });
    }
    if (type === 'edit' && data) {
      // Seed every editable field. Demo seed entries only carry a subset of
      // the schema; fall back to sensible defaults so the inputs render.
      const gallery = Array.isArray(data.images) ? data.images : [];
      setEditForm({
        title: data.title || '',
        price: typeof data.price === 'number' ? data.price.toLocaleString('en-IN') : (data.price || ''),
        location: data.location || '',
        beds: Number(data.beds) || 1,
        baths: Number(data.baths) || 1,
        sqft: Number(data.sqft) || 0,
        floor: Number(data.floor) || 0,
        furnishing: data.furnishing || 'Unfurnished',
        description: data.description || '',
        status: data.status || 'active',
        img: data.coverPhoto || data.img || gallery[0] || '',
        images: gallery,
        roomPhotos: Array.isArray(data.roomPhotos) ? data.roomPhotos : [],
        specificDetails: (data.specificDetails && typeof data.specificDetails === 'object' && !Array.isArray(data.specificDetails)) ? data.specificDetails : {},
      });
    } else if (type === 'update_inquiry' && data) {
      setInquiryStatusForm({
        status: data.status || 'new',
        visitDate: '',
        notes: ''
      });
    }
  };

  const submitInquiryStatus = async () => {
    if (!modalData) return;
    const id = modalData.id;

    if (!inquiryStatusForm.visitDate) {
      showToast(language === 'বাংলা' ? 'ভিজিটের তারিখ ও সময় দিন' : 'Pick a visit date & time');
      return;
    }

    const [date, time] = String(inquiryStatusForm.visitDate).split('T');
    setActiveModal(null);
    showToast(language === 'বাংলা' ? 'ভিজিট প্রস্তাব পাঠানো হয়েছে!' : 'Visit proposed!');

    // Propose the visit to the tenant (realtime). Location comes from the
    // modal's location field (stored in inquiryStatusForm.notes).
    proposeVisit(id, { date, time: time || '', location: inquiryStatusForm.notes || '' })
      .then(updated => setInquiries(prev => prev.map(i => i.id === id ? { ...i, visitSchedule: updated?.visitSchedule, status: updated?.status || i.status } : i)))
      .catch(err => console.warn('[host] propose visit failed:', err.message || err));
  };

  // Deep-link scrolling and highlight (moved here so inquiries and openModal are initialized)
  // NOTE: 'inquiries' REMOVED from deps — it was causing infinite re-fire
  // (socket update → inquiries change → useEffect → modal open → repeat).
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    if (location.state?.highlightId && location.state?.scrollTo) {
      deepLinkDoneRef.current = true;
      setTimeout(() => {
        const id = location.state.highlightId;
        const el = document.getElementById(`inquiry-${id}`) || document.getElementById(`booking-${id}`) || document.getElementById(`rent-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[#ba0036]', 'ring-offset-2', 'transition-all', 'duration-500');
          setTimeout(() => el.classList.remove('ring-2', 'ring-[#ba0036]', 'ring-offset-2'), 3000);
        }
        
        // Auto-open logic if applicable
        if (location.state.autoOpen) {
          const inq = inquiries.find(i => String(i.id) === String(id));
          if (inq) openModal('update_inquiry', inq);
          
          if (el && (el.id.startsWith('rent-') || el.id.startsWith('booking-'))) {
            setExpandedRentId(id);
          }
        }
      }, 500); // Wait for tab to switch and render
    }
  }, [location.state]);

  // ───────────────────────────────────────────────────────────────────────────
  // RENT-LEDGER + BOOKING HANDLERS
  // These are the only places where ledger data is mutated. Keeping them
  // co-located makes it easy to drop in real API calls later — every handler
  // already has a TODO(backend) comment showing the exact endpoint shape.
  // ───────────────────────────────────────────────────────────────────────────

  // Open the "Rent Action" modal pre-filled for a specific booking + month.
  // Always lands on the choice screen first; if the cell already has a payment
  // recorded, the form step starts pre-filled with that data so the host can
  // edit instead of re-entering everything from scratch.
  const openMarkPaid = (booking, key) => {
    const existing = booking.ledger?.[key];
    const expected = Number(booking.monthlyRent || 0);
    // If the cell was already paid, jump straight to the form step so the
    // host can edit. For fresh cells, show the choice screen.
    const startStep = existing?.paid ? 'form' : 'choose';
    let initialStatus = 'full';
    if (existing?.status === 'partial') initialStatus = 'partial';
    else if (existing?.status === 'due') initialStatus = 'due';
    setPayForm({
      // Rent rows are per-occupant "units" (see rentUnitsOf): __realId is the
      // real booking, __memberId the seat. Fall back to the plain id for
      // single-tenant bookings that render the booking directly.
      bookingId: booking.__realId || booking.id,
      memberId: booking.__memberId || null,
      monthKey: key,
      step: startStep,
      status: initialStatus,
      paidOn: existing?.paidOn || todayIso(),
      method: existing?.method || 'bKash',
      txnId: existing?.txnId || '',
      // What is STILL OWED, not what has already been banked. The field used to
      // pre-fill with the existing entry's total, so re-opening a ৳5,000 partial
      // offered ৳5,000 again — which, now that payments add up, would record
      // ৳10,000 against a ৳6,000 month.
      amount: String(remainingFor(existing, expected) || expected || ''),
      expectedRent: expected,
      dueNote: existing?.dueNote || '',
      expectedPayBy: existing?.expectedPayBy || '',
    });
    setActiveModal('mark_paid');
  };

  // Choose one of the three flows from the choice screen and advance to the form.
  // For "full" we lock the amount to the expected monthly rent so the host
  // doesn't have to retype it.
  const choosePayStatus = (status) => {
    setPayForm(prev => ({
      ...prev,
      status,
      step: 'form',
      // "Full payment" means settling the month — which, once part of it has
      // been collected, is the REMAINING amount, not the whole rent again.
      // `prev.amount` already holds the remaining (set by openMarkPaid).
      amount: status === 'full'
        ? String(prev.amount || prev.expectedRent || '')
        : (status === 'due' ? '0' : prev.amount),
    }));
  };

  // Persist a paid month to the ledger (frontend only; backend wires later).
  // Branches on payForm.status — full / partial / due. Each branch:
  //   1. Builds the ledger entry (paid, balance, status).
  //   2. Updates `bookings` state.
  //   3. Pushes a receipt into the tenant's localStorage so their dashboard
  //      sees an instant Inbox notification (matching the user's request:
  //      "the tenant gets a receipt automatically").
  // TODO(backend): PATCH /api/host/bookings/{bookingId}/ledger/{monthKey}
  //   body: { status, paid, paidOn, method, txnId, amount, balance }
  //   On success the server emits a webhook to /api/tenants/{id}/receipts.
  const submitMarkPaid = () => {
    const { bookingId, memberId, monthKey: key, status, paidOn, method, txnId, amount, dueNote, expectedPayBy } = payForm;
    if (!bookingId || !key) return;
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Marking a hostel seat's rent → target that member (their split share +
    // own ledger). Otherwise it's the whole booking (room / single tenant).
    const activeMems = Array.isArray(booking.members) ? booking.members.filter(m => m && m.status !== 'moved-out') : [];
    const payMember = memberId ? activeMems.find(m => m.id === memberId) : null;
    const payName = payMember?.name || booking.tenant;
    const expected = payMember ? seatShare(booking, payMember, activeMems.length) : (Number(booking.monthlyRent || 0) + Number(booking.serviceCharge || 0));
    const amt = Number(amount) || 0;

    // What is already banked for this month, and what is therefore still owed.
    // A month's entry holds the TOTAL received, so a second payment adds to the
    // first rather than replacing it — collecting the last ৳1,000 of a ৳6,000
    // rent used to wipe out the ৳5,000 recorded earlier.
    const existingEntry = payMember
      ? (payMember.ledger || {})[key]
      : (booking.ledger || {})[key];
    const alreadyPaid = paidSoFar(existingEntry);
    const remainingBefore = remainingFor(existingEntry, expected);

    // ── Branch validation ──────────────────────────────────────────────────
    if (status === 'full') {
      if (amt <= 0) {
        showToast(language === 'বাংলা' ? 'অ্যামাউন্ট ০ এর বেশি দিন' : 'Amount must be greater than 0');
        return;
      }
    } else if (status === 'partial') {
      if (amt <= 0) {
        showToast(language === 'বাংলা' ? 'কত টাকা পেয়েছেন লিখুন' : 'Enter the amount received');
        return;
      }
      // Deliberately NOT refused when the amount settles the month.
      //
      // Re-opening a ৳5,000 partial pre-fills the remaining ৳1,000 and keeps
      // the status on 'partial' (that is what the month currently is) — so
      // rejecting "partial that clears the month" left the landlord in a form
      // that could not be saved in the state it opened in, told to pick a
      // different button to enter the number already in the box.
      //
      // The status is derived from the money on save, so ৳1,000 here simply
      // becomes a full month. There is nothing to correct and nothing to warn
      // about.
    } else if (status === 'due') {
      if (!dueNote.trim()) {
        showToast(language === 'বাংলা' ? 'কারণটি একটু লিখুন' : 'Please add a short note for the due');
        return;
      }
    }

    // ── Build the ledger entry ─────────────────────────────────────────────
    // A payment folds into whatever was already received; `status` then follows
    // from the money rather than from which button was pressed. Marking a month
    // "Full" while ৳5,000 of it is still outstanding only makes the ledger lie.
    const entry = status === 'due'
      ? { paid: false, status: 'due', dueNote: dueNote.trim(), expectedPayBy, amount: 0, balance: expected }
      : applyPaymentToEntry(existingEntry, {
        amount: amt,
        expected,
        meta: { paidOn, method, txnId },
      });
    const balance = entry.balance;

    // ── One write, one path ────────────────────────────────────────────────
    // The queue applies this to the screen AND owns getting it to the server.
    // It used to be two separate things — a local setState plus a fire-and-
    // forget API call whose failure went to console.warn — so collecting rent
    // with no signal showed a receipt toast and then lost the payment on the
    // next poll. Nothing here waits for the network; nothing here forgets it
    // either. Receipts are still created server-side when the write lands.
    queueBookingOp(setBookings, status === 'due' ? 'markDue' : 'payRent',
      {
        bookingId: booking._id || bookingId,
        memberId: payMember ? memberId : null,
        monthKey: key,
        // The INCREMENT, never the running total: replayed on top of a fresh
        // snapshot it has to add to whatever the month holds by then.
        amount: status === 'due' ? 0 : amt,
        expected,
        meta: { paidOn, method, txnId },
        dueNote: dueNote.trim(),
        expectedPayBy,
        monthLabel: monthFullLabel(key, language),
      });

    // ── Toasts (Bn/En) ─────────────────────────────────────────────────────
    const monthLabel = monthFullLabel(key, language);
    if (status === 'full') {
      showToast(language === 'বাংলা'
        ? `${monthLabel} এর সম্পূর্ণ ভাড়া পেইড — ${payName} কে রিসিট পাঠানো হয়েছে`
        : `${monthLabel} fully paid — receipt sent to ${payName}`);
    } else if (status === 'partial') {
      showToast(language === 'বাংলা'
        ? `${monthLabel} এ আংশিক পেমেন্ট সেভ — বাকি ${formatBDT(balance)}`
        : `${monthLabel} partial payment saved — ${formatBDT(balance)} balance remaining`);
    } else {
      showToast(language === 'বাংলা'
        ? `${monthLabel} বকেয়া হিসেবে চিহ্নিত করা হয়েছে`
        : `${monthLabel} marked as due`);
    }

    setActiveModal(null);
  };

  // ── Settle a WHOLE ROOM for one month ──────────────────────────────────────
  // A room with two occupants where one has paid and one hasn't is still ONE
  // room. Collecting the rest of it was four taps per seat through the mark-paid
  // modal, and the room only existed in the landlord's head while they did it.
  // This clears every seat that still owes something for `key` in one action.
  //
  // Seats that are already settled are left alone — this collects what is
  // outstanding, it does not re-charge anyone. Each seat's payment is folded
  // into its own ledger through applyPaymentToEntry, exactly as a single
  // mark-paid would, so the room shortcut and the per-seat flow can never
  // disagree about what a month holds.
  const markRoomPaid = (units, key, meta = {}) => {
    const rows = Array.isArray(units) ? units : [];
    if (rows.length === 0 || !key) return;
    const bookingId = rows[0].__realId || rows[0].id;
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const paidOn = meta.paidOn || todayIso();
    const method = meta.method || 'Cash';
    const activeMems = Array.isArray(booking.members) ? booking.members.filter(m => m && m.status !== 'moved-out') : [];

    // One target per seat that still owes money for this month.
    const targets = [];
    rows.forEach((u) => {
      if (!enumerateLeaseMonths(u.leaseStart, u.leaseEnd, today).includes(key)) return;
      const memberId = u.__memberId || null;
      const mem = memberId ? activeMems.find(m => m.id === memberId) : null;
      const expected = mem
        ? seatShare(booking, mem, activeMems.length)
        : (Number(booking.monthlyRent || 0) + Number(booking.serviceCharge || 0));
      const existing = mem ? (mem.ledger || {})[key] : (booking.ledger || {})[key];
      const remaining = remainingFor(existing, expected);
      if (remaining <= 0) return;
      targets.push({
        memberId,
        expected,
        remaining,
        name: mem?.name || booking.tenant,
        entry: applyPaymentToEntry(existing, { amount: remaining, expected, meta: { paidOn, method, txnId: '' } }),
      });
    });

    if (targets.length === 0) {
      showToast(language === 'বাংলা' ? 'এই মাসের রুমের ভাড়া আগেই ক্লিয়ার' : 'This room is already cleared for the month');
      return;
    }

    const total = targets.reduce((n, t) => n + t.remaining, 0);
    const monthLabel = monthFullLabel(key, language);
    const bookingMongoId = booking._id || bookingId;

    // One queued payment per seat, exactly as a seat-by-seat collection would
    // produce. Settling a room is a shortcut through the same door, so it
    // survives a dead zone the same way — and each seat's money is folded into
    // its own month by the same helper on both sides of the wire.
    const roomOps = targets.map((t) => hostSync.enqueue('payRent', {
      bookingId: bookingMongoId,
      memberId: t.memberId,
      monthKey: key,
      amount: t.remaining,
      expected: t.expected,
      meta: { paidOn, method, txnId: '' },
      monthLabel,
    }));
    setBookings(prev => roomOps.reduce(
      (world, op) => applyOp(world, op),
      { bookings: prev, units: [] },
    ).bookings);

    showToast(language === 'বাংলা'
      ? `${monthLabel} — পুরো রুম ক্লিয়ার · ${formatBDT(total)} · ${targets.length} জন`
      : `${monthLabel} — whole room cleared · ${formatBDT(total)} from ${targets.length} tenant${targets.length > 1 ? 's' : ''}`);
  };

  // Reverse a payment record — used when a payment was logged by mistake.
  // Also pulls the receipt from the tenant's inbox so they don't see a
  // stale "Paid" notification for a payment that never happened.
  // TODO(backend): DELETE /api/host/bookings/{bookingId}/ledger/{monthKey}
  const undoMarkPaid = (bookingId, key, memberId = null) => {
    const booking = bookings.find(b => b.id === bookingId);
    const activeMems = Array.isArray(booking?.members) ? booking.members.filter(m => m && m.status !== 'moved-out') : [];
    const undoMember = memberId ? activeMems.find(m => m.id === memberId) : null;
    if (!booking) return;
    queueBookingOp(setBookings, 'undoRent', {
      bookingId: booking._id || bookingId,
      memberId: undoMember ? memberId : null,
      monthKey: key,
    });
    // The receipt is withdrawn server-side when the undo lands.
    showToast(language === 'বাংলা' ? 'পেমেন্ট রেকর্ড মুছে ফেলা হয়েছে — রিসিটও সরানো হয়েছে' : 'Payment record removed — receipt withdrawn');
    setActiveModal(null);
  };

  // Send a manual rent reminder. The server cron handles the auto-reminders;
  // this endpoint is for "send now" buttons. Both go through the same channel.
  // TODO(backend): POST /api/host/bookings/{bookingId}/remind  body: { monthKey, channel }
  const sendRentReminder = (booking, key) => {
    const monthLabel = monthFullLabel(key, language);
    showToast(language === 'বাংলা'
      ? `${booking.tenant} কে ${monthLabel} এর রিমাইন্ডার পাঠানো হয়েছে`
      : `Reminder sent to ${booking.tenant} for ${monthLabel}`);
  };

  // Replace a booking in local state after a member action (add / mark paid /
  // move out) returns the updated booking from the server, so the Bookings and
  // Rent tabs (same `bookings` state) both reflect it immediately.
  const handleBookingUpdated = (updated) => {
    if (!updated || (!updated.id && !updated._id)) return;
    setBookings(prev => {
      const checkId = updated.id || updated._id;
      const exists = prev.some(b => b.id === checkId || b._id === checkId);
      if (exists) return prev.map(b => ((b.id === checkId || b._id === checkId) ? { ...updated, id: checkId } : b));
      // Map _id to id for consistency
      const newBooking = { ...updated, id: checkId };
      return [newBooking, ...prev];
    });
  };

  // Toggle auto-reminder on/off for a booking. The server cron reads this flag,
  // so we persist it (real 24-hex booking ids only) instead of just flipping
  // local state — otherwise the toggle "worked" visually but reset on reload.
  const toggleAutoReminder = (bookingId) => {
    let nextVal = null;
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b;
      nextVal = !b.autoReminder;
      return { ...b, autoReminder: nextVal };
    }));
    if (nextVal !== null && /^[0-9a-fA-F]{24}$/.test(String(bookingId))) {
      hostSync.enqueue('updateBookingFields', { bookingId, patch: { autoReminder: nextVal } });
    }
    if (nextVal !== null) {
      showToast(nextVal
        ? (language === 'বাংলা' ? 'অটো রিমাইন্ডার চালু' : 'Auto reminder ON')
        : (language === 'বাংলা' ? 'অটো রিমাইন্ডার বন্ধ' : 'Auto reminder OFF'));
    }
  };

  // Generate + download a real lease-agreement PDF for a booking.
  //
  // WHY THIS IS RENDERED THROUGH THE BROWSER AND NOT WRITTEN WITH doc.text()
  // It used to be drawn straight into jsPDF with the built-in `helvetica`
  // font. Those core fonts are WinAnsi-encoded: they carry no Bangla glyphs and
  // no ৳ sign. So every Bangla value — the tenant's name, the generated date,
  // the month names — came out as a row of accented Latin rubble, and the rent
  // figures printed "ó 6,000". The landlord got a 8 KB PDF that looked empty
  // where it mattered most: who the agreement is between.
  //
  // Embedding a Bangla TTF does not fix it either. jsPDF places glyphs in the
  // order the code points arrive; Bangla needs shaping — ি reorders before its
  // consonant, conjuncts fuse — so the words would still come out wrong, just
  // in Bangla letters.
  //
  // The browser already does that shaping perfectly. So the agreement is built
  // as HTML, rasterised with html2canvas (already a dependency), and placed
  // into the PDF as an image. The trade is selectable text for a document that
  // is actually readable in the language it was written in.
  const generateAgreementPdf = async (booking, brand = null, member = null) => {
    if (!booking) return;
    const isBnDoc = language === 'বাংলা';

    // Values are interpolated into markup, so they are escaped — a tenant
    // named with an angle bracket must not become a tag.
    const esc = (v) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // ONE SEAT IS ONE AGREEMENT.
    //
    // Two people sharing a room are two separate tenancies that happen to have
    // the same address: different names, different phones, different rent,
    // different move-in dates. The agreement used to be generated for the
    // BOOKING, which meant it always described members[0] — so the landlord
    // could download a paper for the first occupant and had no way at all to
    // produce one for the second. `member` narrows the whole document to that
    // person; without it, this stays the whole-unit agreement it always was.
    //
    // `member === 'all'` is the room's whole file: every occupant, one page
    // each, in ONE download. Asking for "the room's forms" is a single errand —
    // four separate downloads means four trips to the Downloads folder, and a
    // browser that blocks the second one before the landlord notices.
    const mems = activeMembers(booking);
    const everyone = member === ALL_TENANTS;
    const subjects = everyone ? (mems.length ? mems : [null]) : [member || null];
    const L = (bn, en) => (isBnDoc ? bn : en);

    // Four faces to fetch and four sheets to rasterise takes a few seconds, so
    // the wait says how much work it is rather than leaving the screen still.
    showToast(subjects.length > 1
      ? L(`${subjects.length} জনের ফরম তৈরি হচ্ছে…`, `Generating ${subjects.length} forms…`)
      : L('অ্যাগ্রিমেন্ট তৈরি হচ্ছে…', 'Generating agreement…'));

    const row = (k, v) => `
      <tr>
        <td style="padding:7px 0;width:210px;vertical-align:top;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.04em;">${esc(k)}</td>
        <td style="padding:7px 0;vertical-align:top;font-size:13px;font-weight:600;color:#111827;">${esc(v || '—')}</td>
      </tr>`;

    const section = (title, rowsHtml) => `
      <h2 style="margin:26px 0 6px;font-size:14px;font-weight:800;color:#111827;">${esc(title)}</h2>
      <div style="height:1px;background:#e5e7eb;margin-bottom:4px;"></div>
      <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>`;

    const terms = isBnDoc ? [
      'ভাড়াটিয়া প্রতি মাসের নির্ধারিত তারিখ বা তার আগে ভাড়া পরিশোধ করবেন।',
      'জামানত (ডিপোজিট) ফেরতযোগ্য — হস্তান্তরের সময় সম্পত্তির অবস্থার উপর নির্ভর করে।',
      'ভাড়াটিয়া সম্পত্তি ভালো অবস্থায় রাখবেন এবং কোনো ক্ষতি হলে দ্রুত জানাবেন।',
      'উভয় পক্ষ প্রচলিত আইন অনুযায়ী আগাম লিখিত নোটিশ দিয়ে এই চুক্তি বাতিল করতে পারবেন।',
      'এই ডকুমেন্টটি TO-LET PRO থেকে রেকর্ড রাখার জন্য তৈরি একটি সারসংক্ষেপ।',
    ] : [
      'The tenant agrees to pay the monthly rent on or before the due date each month.',
      'The security deposit is refundable subject to the condition of the property at handover.',
      'The tenant shall maintain the property in good condition and report damage promptly.',
      'Either party may terminate this agreement with prior written notice as per local law.',
      'This document is a summary generated by TO-LET PRO for record-keeping purposes.',
    ];

    // ── Letterhead ──────────────────────────────────────────────────────────
    // Whose document is this? If the landlord has set a business name or logo,
    // theirs is the name at the top and TO-LET PRO shrinks to a corner mark.
    // With nothing set, the header is exactly what it was before.
    const orgName = String(brand?.orgName || '').trim();
    const orgPhone = String(brand?.phone || '').trim();
    const branded = !!(orgName || brand?.logoUrl);

    // Remote images are inlined as data URLs before rendering. html2canvas draws
    // them through the canvas, and a cross-origin one taints it — toDataURL()
    // then throws and the whole download fails. An image that can't be fetched
    // is dropped; it must never take the agreement down with it.
    //
    // One helper for the logo and the photos: printing four tenants fetches
    // four faces and one letterhead, and two copies of this were already one
    // copy too many.
    const asDataUrl = async (url, what) => {
      if (!url) return '';
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return '';
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result || ''));
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn(`[host] agreement ${what} skipped:`, err?.message || err);
        return '';
      }
    };

    const logoData = await asDataUrl(brand?.logoUrl, 'logo');

    // Footer QR — where a tenant holding the paper can find the app.
    let qrData = '';
    try {
      const QR = await import('qrcode');
      qrData = await QR.toDataURL(APP_LINK_URL, { margin: 0, width: 160, errorCorrectionLevel: 'M' });
    } catch (err) {
      console.warn('[host] footer QR skipped:', err?.message || err);
    }

    const headerLeft = branded
      ? `<div style="display:flex;align-items:center;gap:14px;min-width:0;">
           ${logoData ? `<img src="${logoData}" alt="" style="width:56px;height:56px;object-fit:contain;flex:0 0 auto;" />` : ''}
           <div style="min-width:0;">
             <div style="font-size:22px;font-weight:900;color:#111827;letter-spacing:-.01em;line-height:1.2;">${esc(orgName || booking.property)}</div>
             ${orgPhone ? `<div style="font-size:11px;font-weight:700;color:#6b7280;margin-top:3px;">${esc(orgPhone)}</div>` : ''}
           </div>
         </div>`
      : `<div style="font-size:24px;font-weight:900;color:#ba0036;letter-spacing:-.01em;">TO-LET PRO</div>`;

    // Only shown when the landlord's own name has taken the headline, so the
    // page never says TO-LET PRO twice.
    const headerRight = branded
      ? `<div style="text-align:right;flex:0 0 auto;padding-left:16px;">
           <div style="font-size:11px;font-weight:900;color:#ba0036;letter-spacing:.02em;">TO-LET PRO</div>
           <div style="font-size:8px;font-weight:700;color:#9ca3af;margin-top:2px;">${esc(APP_LINK_LABEL)}</div>
         </div>`
      : '';

    // ── The document ────────────────────────────────────────────────────────
    // A one-page, two-column intake form modelled on the Dhaka Metropolitan
    // Police tenant-information form a landlord already has to keep. The
    // previous layout was a single long column of rows; with a letterhead on
    // top it ran past A4 and split across two pages, which is not a form any
    // office will accept.
    //
    // Fields the app does not hold (mother's name, previous address, vehicle)
    // are printed as ruled blanks rather than omitted — a form is expected to
    // be completed by hand where the record is thin.
    const F = (label, value, blank = false) => `
      <tr>
        <td style="padding:3.2px 6px 3.2px 0;width:112px;vertical-align:top;font-size:8.2px;font-weight:700;color:#4b5563;line-height:1.35;">${esc(label)}</td>
        <td style="padding:3.2px 0;vertical-align:bottom;font-size:9px;font-weight:700;color:#111827;line-height:1.35;
                   border-bottom:1px ${blank ? 'dashed #cbd5e1' : 'solid #e5e7eb'};">${esc(value || '')}&nbsp;</td>
      </tr>`;

    // The black section bar. Bangla needs real vertical room: matras sit above
    // the letter and ো / ৃ / ্য hang below it, so a box sized to Latin metrics
    // cropped the bottom of every heading — the words sat half outside their
    // own bar. An explicit line-height plus even padding gives the glyphs the
    // full band they occupy.
    const BLOCK = (title, rows) => `
      <div style="margin-bottom:7px;">
        <div style="background:#111827;color:#fff;font-size:8.4px;font-weight:800;letter-spacing:.03em;
                    line-height:1.9;padding:2px 8px;border-radius:3px;">${esc(title)}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:3px;">${rows}</table>
      </div>`;

    // ── ONE SUBJECT, ONE SHEET ──────────────────────────────────────────────
    // Called once per person when the whole room is being printed, so every
    // fact that differs between two occupants of the same room — their photo,
    // their share of the rent, their NID, the people they are listed beside —
    // is resolved in HERE and not once for the whole file.
    const renderSheet = async (seatMember) => {
      const occupant = seatMember
        ? {
            name: String(seatMember.name || '').trim() || (isBnDoc ? 'ভাড়াটিয়া' : 'Tenant'),
            phone: seatMember.phone || '',
          }
        : primaryOccupant(booking, language);
      // A seat's rent is its share of the room, resolved the same way every other
      // screen resolves it — never the whole room's rent on one person's paper.
      const seatRent = seatMember ? seatShare(booking, seatMember, mems.length || 1) : null;
      // Co-occupants are named on a seat agreement as a fact about the room, not
      // as parties to this person's tenancy.
      // Everyone in the room EXCEPT the person this form is about. Without the
      // exclusion a whole-unit form listed its own subject under "other
      // occupants" — the paper told রফিক আহমেদ that রফিক আহমেদ also lives there.
      const subjectName = String((seatMember?.name) || primaryOccupant(booking, language).name || '').trim();
      const names = mems
        .map(m => String(m.name || '').trim())
        .filter(n => n && n !== subjectName);

      // This person's photo for the form's photo box. Missing or unreadable just
      // leaves an empty box to paste a printed photo into, which is what these
      // forms expect anyway.
      const photoData = await asDataUrl(
        (seatMember?.tenantProfile?.photoUrl)
          || (seatMember ? seatMember.avatar : (booking.tenantProfile?.photoUrl || booking.tenantAvatar))
          || '',
        'photo',
      );

      const tp = (seatMember?.tenantProfile) || booking.tenantProfile || {};
      const govtId = [tp.govtIdType === 'passport' ? L('পাসপোর্ট', 'Passport') : L('এনআইডি', 'NID'), tp.govtIdNumber]
        .filter(Boolean).join(' — ');
      const job = [tp.tenantType, tp.organization, tp.department].filter(Boolean).join(', ');
      const roomLine = [
        booking.floorNumber ? `${L('ফ্লোর', 'Floor')} ${booking.floorNumber}` : '',
        booking.roomNumber ? `${L('রুম', 'Room')} ${booking.roomNumber}` : '',
        seatMember?.seatLabel || '',
      ].filter(Boolean).join(' · ');

      // The field list lives in ONE place. The PDF renders it into black-barred
      // blocks; the Excel export writes the same rows as CSV. Two hand-kept
      // copies of "what is on a tenancy form" would drift the first time a field
      // was added to only one of them.
      const groups = agreementGroups({
        booking, seatMember, occupant, seatRent, names, tp, govtId, job, roomLine, L,
        landlord: {
          name: orgName || userData?.fullName || authUser?.name || authUser?.fullName || '',
          phone: orgPhone || userData?.phone || authUser?.phone || '',
          address: landlordProfile?.address || booking.location || '',
        },
        formatDate: (d) => formatDate(d, language),
        formatBDT,
        isOpenEnded: isOpenEndedLease(booking),
      });

      const renderGroup = (g) => BLOCK(g.title, g.rows.map(r => F(r.label, r.value, r.blank)).join(''));
      const leftCol = groups.filter(g => g.side === 'left').map(renderGroup).join('');
      const rightCol = groups.filter(g => g.side === 'right').map(renderGroup).join('');

      // 794px = A4 width at 96dpi, so the capture maps 1:1 onto the page.
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;z-index:-1;';
      host.innerHTML = `
        <div id="agreement-sheet" style="width:794px;box-sizing:border-box;padding:26px 30px;background:#fff;color:#111827;
                    font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Bengali','Hind Siliguri',sans-serif;">

          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            ${headerLeft}
            ${headerRight}
          </div>

          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:10px;
                      border-top:2px solid #111827;border-bottom:1px solid #111827;padding:6px 0;">
            <div>
              <div style="font-size:13px;font-weight:900;letter-spacing:.01em;">${esc(L('ভাড়াটিয়া তথ্য ফরম', 'TENANT INFORMATION FORM'))}</div>
              <div style="font-size:8px;font-weight:700;color:#6b7280;margin-top:1px;">
                ${esc(L('বাড়ি ভাড়া চুক্তি ও তথ্য নিবন্ধন', 'Tenancy agreement & information record'))}
              </div>
            </div>
            <div style="text-align:right;font-size:8px;font-weight:700;color:#6b7280;">
              ${esc(L('তৈরি', 'Issued'))}: ${esc(formatDate(todayIso(), language))}
              ${booking.roomNumber ? `<div style="font-size:11px;font-weight:900;color:#111827;margin-top:1px;">${esc(L('রুম', 'Room'))} ${esc(booking.roomNumber)}${seatMember?.seatLabel ? ` · ${esc(seatMember.seatLabel)}` : ''}</div>` : ''}
            </div>
            <div style="width:74px;height:88px;border:1px solid #9ca3af;border-radius:2px;flex:0 0 auto;
                        display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f9fafb;">
              ${photoData
                ? `<img src="${photoData}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
                : `<span style="font-size:7.5px;font-weight:700;color:#9ca3af;text-align:center;line-height:1.3;">${esc(L('ছবি', 'PHOTO'))}</span>`}
            </div>
          </div>

          <!-- Two columns, the way an office form is read: the person on the
               left, the tenancy on the right. -->
          <div style="display:flex;gap:16px;margin-top:9px;align-items:flex-start;">
            <div style="flex:1 1 0;min-width:0;">${leftCol}</div>
            <div style="flex:1 1 0;min-width:0;">${rightCol}</div>
          </div>

          <div style="margin-top:2px;border:1px solid #e5e7eb;border-radius:3px;padding:6px 8px;">
            <div style="font-size:8.2px;font-weight:800;color:#374151;margin-bottom:2px;">${esc(L('ঘোষণা ও শর্তাবলি', 'DECLARATION & TERMS'))}</div>
            <ol style="margin:0;padding-left:12px;font-size:7.6px;line-height:1.5;color:#4b5563;font-weight:600;">
              ${terms.map(tx => `<li>${esc(tx)}</li>`).join('')}
              <li>${esc(L('উপরের তথ্য সঠিক বলে ভাড়াটিয়া ঘোষণা করছেন; তথ্য পরিবর্তিত হলে বাড়িওয়ালাকে জানাবেন।', 'The tenant declares the above information is correct and will report any change to the landlord.'))}</li>
            </ol>
          </div>

          <div style="display:flex;justify-content:space-between;gap:20px;margin-top:30px;">
            <div style="flex:1 1 0;"><div style="height:1px;background:#9ca3af;"></div>
              <div style="font-size:8px;font-weight:700;color:#6b7280;margin-top:4px;">${esc(L('বাড়িওয়ালার স্বাক্ষর ও তারিখ', 'Landlord signature & date'))}</div></div>
            <div style="flex:1 1 0;"><div style="height:1px;background:#9ca3af;"></div>
              <div style="font-size:8px;font-weight:700;color:#6b7280;margin-top:4px;">${esc(L('ভাড়াটিয়ার স্বাক্ষর ও তারিখ', 'Tenant signature & date'))}</div></div>
          </div>

          <div style="margin-top:14px;padding-top:6px;border-top:1px solid #e5e7eb;
                      display:flex;align-items:center;justify-content:space-between;gap:14px;">
            <div style="min-width:0;">
              <div style="font-size:7.5px;font-weight:700;color:#9ca3af;">${esc(L('তৈরি হয়েছে TO-LET PRO দিয়ে', 'Generated with TO-LET PRO'))}</div>
              <div style="font-size:7.5px;font-weight:700;color:#9ca3af;margin-top:1px;">${esc(APP_LINK_LABEL)}</div>
            </div>
            ${qrData ? `<img src="${qrData}" alt="" style="width:42px;height:42px;flex:0 0 auto;" />` : ''}
          </div>
        </div>`;
      return { host, occupant };
    };

    const slugify = (v) => String(v || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

    try {
      const { default: html2canvas } = await import('html2canvas');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      // The first subject's name is what the file is called; on a whole-room
      // download the room takes over (see below).
      let firstOccupant = null;

      for (const [i, subject] of subjects.entries()) {
        const { host, occupant } = await renderSheet(subject);
        document.body.appendChild(host);
        try {
          const canvas = await html2canvas(host.firstElementChild, {
            scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          });

          // ONE PAGE PER PERSON, ALWAYS.
          //
          // This used to paginate: anything past A4 was sliced onto a second
          // sheet, and with a letterhead on top the form did exactly that — a
          // two-page "form", cut mid-field, which no office will take. A form is
          // one page by definition, so overflow is fitted by scaling the sheet
          // down (and centred) rather than cut in half. The layout is sized to
          // fit at 100%; this only ever engages for an unusually long address or
          // a big logo. A room's file is several such pages, never a split one.
          const fitScale = Math.min(pageW / canvas.width, pageH / canvas.height);
          const drawW = canvas.width * fitScale;
          const drawH = canvas.height * fitScale;

          if (i > 0) doc.addPage();
          // JPEG, not PNG. The same sheet was 12.6 MB as PNG — unusable to email
          // or to keep one per tenant. A form is flat colour and text; at
          // quality 0.92 it is visually identical and roughly twenty times
          // smaller.
          doc.addImage(
            canvas.toDataURL('image/jpeg', 0.92), 'JPEG',
            (pageW - drawW) / 2, (pageH - drawH) / 2,
            drawW, drawH,
          );
          if (!firstOccupant) firstOccupant = occupant;
        } finally {
          // Removed as each page is captured, so printing a full room never
          // leaves several A4 sheets parked off-screen in the DOM.
          host.remove();
        }
      }

      if (everyone) {
        // Named for the ROOM, because that is what the file is: one document
        // holding every tenancy in it.
        doc.save(`tenant-forms-${slugify(booking.roomNumber) || slugify(booking.property) || 'room'}.pdf`);
        showToast(isBnDoc
          ? `${subjects.length}টি ফরম একসাথে ডাউনলোড হয়েছে ✓`
          : `${subjects.length} forms downloaded together ✓`);
      } else {
        // The name on the file is the name on the agreement. Non-Latin names
        // have no safe filename form, so those fall back to the room or a plain
        // label rather than to a string of dashes.
        const seatMember = subjects[0];
        // Two seats in one room with Bangla names both fall through to the room
        // number, so the second download would silently overwrite the first in
        // the Downloads folder. The seat keeps them apart.
        const seatSlug = seatMember
          ? slugify(seatMember.seatLabel || `seat-${mems.indexOf(seatMember) + 1}`)
          : '';
        const base = slugify(firstOccupant?.name) || slugify(booking.roomNumber) || 'tenant';
        const slug = [base, seatSlug].filter(Boolean).join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        doc.save(`lease-agreement-${slug}.pdf`);
        showToast(isBnDoc ? 'অ্যাগ্রিমেন্ট ডাউনলোড হয়েছে ✓' : 'Agreement downloaded ✓');
      }
    } catch (err) {
      console.warn('[host] agreement generation failed:', err?.message || err);
      showToast(isBnDoc ? 'অ্যাগ্রিমেন্ট তৈরি ব্যর্থ' : 'Could not generate agreement');
    }
  };

  // The booking waiting on the branding step, or null.
  const [agreementFor, setAgreementFor] = useState(null);

  // Upload a brand logo. Cloudinary, like avatars and vault documents — only
  // the URL is ever stored, so the profile blob stays small enough to sync.
  const uploadBrandLogo = async (file) => {
    const { secureUrl } = await directUpload(file, {
      folder: `tolet-pro/brand/${authUser?.id || 'host'}`,
      publicId: 'logo',
    });
    return secureUrl;
  };

  // What every "Download Agreement" button calls. The branding step comes
  // first — the landlord asked to decide whose name is on the page at the
  // moment they produce it, not once buried in a settings screen.
  // `member` narrows the agreement to ONE occupant of a shared room. Called
  // without it from the whole-unit surfaces, which is the old behaviour.
  const downloadAgreement = (booking, member = null) => {
    if (!booking) return;
    setAgreementFor({ booking, member });
  };

  // The same form as a spreadsheet. Built from agreementGroups(), so it holds
  // exactly the fields the PDF does — a landlord who needs the data in Excel
  // (to file, sort or hand to an office) gets the record, not a screenshot.
  const generateAgreementCsv = (booking, brand = null, member = null) => {
    const isBnDoc = language === 'বাংলা';
    const L = (bn, en) => (isBnDoc ? bn : en);
    const mems = activeMembers(booking);
    // Same rule as the PDF: 'all' is the whole room in one file. A spreadsheet
    // is the one place that is genuinely better together — four tenants in four
    // CSVs cannot be sorted, filtered or handed to an office as one list.
    const everyone = member === ALL_TENANTS;
    const subjects = everyone ? (mems.length ? mems : [null]) : [member || null];

    const rowsFor = (seatMember) => {
      const occ = seatMember
        ? { name: String(seatMember.name || '').trim(), phone: seatMember.phone || '' }
        : primaryOccupant(booking, language);
      const tp = (seatMember?.tenantProfile) || booking.tenantProfile || {};
      const subjectName = String(occ.name || '').trim();

      const groups = agreementGroups({
        booking, seatMember, occupant: occ,
        seatRent: seatMember ? seatShare(booking, seatMember, mems.length || 1) : null,
        names: mems.map(m => String(m.name || '').trim()).filter(n => n && n !== subjectName),
        tp,
        govtId: [tp.govtIdType === 'passport' ? L('পাসপোর্ট', 'Passport') : L('এনআইডি', 'NID'), tp.govtIdNumber].filter(Boolean).join(' — '),
        job: [tp.tenantType, tp.organization, tp.department].filter(Boolean).join(', '),
        roomLine: [
          booking.floorNumber ? `${L('ফ্লোর', 'Floor')} ${booking.floorNumber}` : '',
          booking.roomNumber ? `${L('রুম', 'Room')} ${booking.roomNumber}` : '',
          seatMember?.seatLabel || '',
        ].filter(Boolean).join(' · '),
        L,
        landlord: {
          name: String(brand?.orgName || '').trim() || userData?.fullName || authUser?.name || authUser?.fullName || '',
          phone: String(brand?.phone || '').trim() || userData?.phone || authUser?.phone || '',
          address: landlordProfile?.address || booking.location || '',
        },
        formatDate: (d) => formatDate(d, language),
        formatBDT: (n) => Number(n) || 0,   // a spreadsheet wants a number, not "৳6,000"
        isOpenEnded: isOpenEndedLease(booking),
      });
      return { occ, groups };
    };

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    // The tenant's name leads every row when the file holds more than one of
    // them — a column, not a heading between blocks, so the sheet still sorts
    // and filters as a single table.
    const header = [
      ...(everyone ? [L('ভাড়াটিয়া', 'Tenant')] : []),
      L('বিভাগ', 'Section'), L('ক্ষেত্র', 'Field'), L('তথ্য', 'Value'),
    ];
    const lines = [header.map(esc).join(',')];
    let firstName = '';
    subjects.forEach((seatMember) => {
      const { occ, groups } = rowsFor(seatMember);
      if (!firstName) firstName = String(occ.name || '');
      groups.forEach(g => g.rows.forEach(r => {
        lines.push([
          ...(everyone ? [occ.name || L('নামহীন', 'Unnamed')] : []),
          g.title, r.label, r.blank ? '' : r.value,
        ].map(esc).join(','));
      }));
    });

    const slugify = (v) => String(v || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    // BOM first, or Excel opens Bangla as mojibake.
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const roomSlug = slugify(booking.roomNumber);
    const seatSlug = (!everyone && subjects[0]) ? slugify(subjects[0].seatLabel) : '';
    const base = everyone
      ? (roomSlug || slugify(booking.property) || 'room')
      : (slugify(firstName) || roomSlug || 'tenant');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${[base, seatSlug].filter(Boolean).join('-').replace(/-+/g, '-')}-tenant-form${everyone ? 's' : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(everyone
      ? L(`${subjects.length} জনের তথ্য একসাথে ডাউনলোড হয়েছে ✓`, `${subjects.length} tenants exported together ✓`)
      : L('এক্সেল ফাইল ডাউনলোড হয়েছে ✓', 'Excel file downloaded ✓'));
  };

  // Chosen in the modal: who, what format, and the letterhead.
  const confirmAgreementDownload = (brand, { member = null, format = 'pdf' } = {}) => {
    const target = agreementFor;
    setAgreementFor(null);
    if (!target?.booking) return;
    persistLandlordProfile({ ...landlordProfile, brand });
    // `member` from the modal's picker wins; a caller that already knew the
    // seat (a member row) passed it in and the picker never appeared.
    const who = member || target.member || null;
    if (format === 'excel') generateAgreementCsv(target.booking, brand, who);
    else generateAgreementPdf(target.booking, brand, who);
  };

  // Export the Rent Collection view (for the selected year) to a CSV file.
  // Replaces the old toast-only stub. One row per tenant/booking with a column
  // per month (paid amount, "P:<amt>" for partial, "DUE" for marked-due).
  const exportRentCsv = (rows, year) => {
    if (!rows || rows.length === 0) {
      showToast(language === 'বাংলা' ? 'এক্সপোর্ট করার মতো কিছু নেই' : 'Nothing to export for this year');
      return;
    }
    const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'Tenant', 'Property', 'Location', 'Phone', 'Occupants', 'Monthly Rent', 'Advance', 'Payment Method',
      ...MO, 'Year Collected', 'Lease Start', 'Lease End', 'Status',
    ];
    const lines = [header.map(esc).join(',')];
    rows.forEach((b) => {
      const ledger = b.ledger || {};
      let yearTotal = 0;
      const monthCells = months.map((m) => {
        const e = ledger[m];
        if (e && e.paid) { const amt = Number(e.amount) || 0; yearTotal += amt; return String(amt); }
        if (e && e.status === 'partial') { const amt = Number(e.amount) || 0; yearTotal += amt; return `P:${amt}`; }
        if (e && e.status === 'due') return 'DUE';
        return '';
      });
      lines.push([
        // Who is actually in the unit, read off members[] — b.tenant is blank
        // for every seat-rented room, so the export used to have empty name
        // columns for exactly the rooms with the most people in them.
        occupantNames(b).join(' | ') || b.tenant || '',
        b.property || '', b.location || '', primaryOccupant(b, language).phone || '', occupantCount(b),
        Number(b.monthlyRent) || 0, Number(b.advancePayment) || 0, b.paymentMethod || '',
        ...monthCells, yearTotal, b.leaseStart || '', b.leaseEnd || 'Ongoing', computeLeaseStage(b, today),
      ].map(esc).join(','));
    });
    // Prefix a BOM so Excel opens the UTF-8 (Bangla-safe) file correctly.
    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rent-collection-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(language === 'বাংলা' ? 'CSV এক্সপোর্ট হয়েছে ✓' : 'CSV exported ✓');
  };

  // ───────────────────────────────────────────────────────────────────────
  // DASHBOARD QUICK ACTIONS — broadcast message, payment reminders, export.
  // Previously these three were toast-only stubs (and send_reminders actually
  // threw once any booking existed). They now perform the real action against
  // live data + the existing chat / PDF infrastructure.
  // ───────────────────────────────────────────────────────────────────────

  // Live (non-cancelled) bookings that are linked to a real tenant account —
  // the addressable audience for in-app broadcasts / reminders. Manual bookings
  // with no linked user are excluded because we can't open a conversation with
  // them. De-dupes by tenant user id so a tenant with two units is messaged once.
  const getMessagableBookings = () => {
    const seen = new Set();
    const out = [];
    bookings
      .filter((b) => b.status !== 'cancelled')
      .forEach((b) => {
        const userId = resolveTenantUserId(b);
        if (!userId || seen.has(String(userId))) return;
        seen.add(String(userId));
        out.push({ booking: b, userId });
      });
    return out;
  };

  // Broadcast the typed announcement to every messagable tenant. Sends the text
  // (or, for an image attachment, the image with the text as caption) into each
  // tenant's in-app conversation. Best-effort per recipient: one failure doesn't
  // abort the rest, and we report the real success count.
  const handleBroadcast = async () => {
    const text = broadcastText.trim();
    if (!text) {
      showToast(language === 'বাংলা' ? 'একটি মেসেজ লিখুন' : 'Write a message first');
      return;
    }
    const recipients = getMessagableBookings();
    if (recipients.length === 0) {
      showToast(language === 'বাংলা'
        ? 'কোনো লিংকড ভাড়াটিয়া নেই — মেসেজ পাঠানো যাচ্ছে না।'
        : 'No linked tenants to message yet.');
      return;
    }
    setIsBroadcasting(true);
    const asImage = !!broadcastFile && String(broadcastFile.type || '').startsWith('image/');
    let sent = 0;
    for (const { booking, userId } of recipients) {
      try {
        const convo = await openConversation({ peerUserId: userId, propertyId: booking.propertyId });
        const convoId = convo?.id || convo?._id;
        if (!convoId) continue;
        if (asImage) await sendMediaMessage(convoId, broadcastFile, { kind: 'image', caption: text });
        else await sendMessage(convoId, text);
        sent += 1;
      } catch (err) {
        console.warn('[broadcast] failed for tenant', userId, err?.message || err);
      }
    }
    setIsBroadcasting(false);
    setActiveModal(null);
    setBroadcastText('');
    setBroadcastFile(null);
    showToast(sent > 0
      ? (language === 'বাংলা' ? `${sent} জন ভাড়াটিয়াকে মেসেজ পাঠানো হয়েছে ✓` : `Message sent to ${sent} tenant(s) ✓`)
      : (language === 'বাংলা' ? 'মেসেজ পাঠানো যায়নি।' : 'Could not send the message.'));
  };

  // Overdue + partial tenants for the CURRENT month — the reminder audience,
  // each with the amount still outstanding. Overdue = nothing paid past the due
  // date; partial = paid but a balance remains. (Pending-but-not-yet-due leases
  // are intentionally excluded — no reminder before the rent is actually due.)
  const buildReminderRows = () => {
    const now = new Date();
    const sm = getMonthCollectionSummary(bookings, now.getFullYear(), now.getMonth() + 1, now);
    const key = sm.key;
    const dueOf = (b) => {
      const expected = Number(b.monthlyRent || 0) + Number(b.serviceCharge || 0);
      const entry = b.ledger?.[key];
      if (entry?.paid) {
        const bal = Number(entry.balance);
        return Number.isFinite(bal) && bal > 0 ? bal : Math.max(0, expected - Number(entry.amount || 0));
      }
      return expected;
    };
    return {
      monthLabel: monthFullLabel(key, language),
      monthLabelEn: monthFullLabel(key, 'English'),
      rows: [...sm.overdueTenants, ...sm.partialTenants].map((b) => ({ booking: b, due: dueOf(b) })),
    };
  };

  const toggleReminder = (id) => {
    setReminderSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Send a payment reminder to each SELECTED tenant that has a linked account,
  // delivered as an in-app chat message stating the outstanding amount. Tenants
  // without a linked account are counted as "skipped" and reported to the host.
  const handleSendReminders = async () => {
    const { rows, monthLabel } = buildReminderRows();
    const chosen = rows.filter((r) => reminderSelected.has(r.booking.id));
    if (chosen.length === 0) {
      showToast(language === 'বাংলা' ? 'অন্তত একজনকে নির্বাচন করুন' : 'Select at least one tenant');
      return;
    }
    setIsSendingReminders(true);
    const landlord = userData?.fullName || authUser?.name || authUser?.fullName || (language === 'বাংলা' ? 'বাড়িওয়ালা' : 'Your landlord');
    let sent = 0, skipped = 0;
    for (const { booking, due } of chosen) {
      const userId = resolveTenantUserId(booking);
      if (!userId) { skipped += 1; continue; }
      const msg = language === 'বাংলা'
        ? `আসসালামু আলাইকুম ${booking.tenant || 'ভাড়াটিয়া'}, ${monthLabel} মাসের ভাড়া বাবদ ${formatBDT(due)} বকেয়া রয়েছে। অনুগ্রহ করে সুবিধামতো পরিশোধ করুন। ধন্যবাদ। — ${landlord}`
        : `Hello ${booking.tenant || 'there'}, this is a friendly reminder that ${formatBDT(due)} of rent for ${monthLabel} is still outstanding. Please clear it at your earliest convenience. Thank you. — ${landlord}`;
      try {
        const convo = await openConversation({ peerUserId: userId, propertyId: booking.propertyId });
        const convoId = convo?.id || convo?._id;
        if (!convoId) { skipped += 1; continue; }
        await sendMessage(convoId, msg);
        sent += 1;
      } catch (err) {
        console.warn('[reminders] failed for tenant', userId, err?.message || err);
        skipped += 1;
      }
    }
    setIsSendingReminders(false);
    setActiveModal(null);
    if (sent > 0) {
      const head = language === 'বাংলা' ? `${sent} জনকে রিমাইন্ডার পাঠানো হয়েছে ✓` : `Reminder sent to ${sent} tenant(s) ✓`;
      const tail = skipped > 0
        ? (language === 'বাংলা' ? ` (${skipped} জন লিংকড অ্যাকাউন্ট ছাড়া বাদ পড়েছে)` : ` (${skipped} skipped — no linked account)`)
        : '';
      showToast(head + tail);
    } else {
      showToast(language === 'বাংলা'
        ? 'রিমাইন্ডার পাঠানো যায়নি — ভাড়াটিয়াদের লিংকড অ্যাকাউন্ট নেই।'
        : 'Could not send reminders — the selected tenants have no linked account.');
    }
  };

  // ── Export report (dashboard Quick Action) ─────────────────────────────────
  // Builds a report from LIVE data for the chosen type + range, then offers a
  // real CSV (Blob) or PDF (jsPDF) download. Report CONTENT is kept English so
  // the jsPDF core (helvetica) fonts render it — they don't carry Bangla glyphs.
  const reportRangeKeys = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1; // 1-indexed
    if (reportRange === '3months') {
      return [2, 1, 0].map((back) => {
        const d = new Date(y, m - 1 - back, 1);
        return monthKey(d.getFullYear(), d.getMonth() + 1);
      });
    }
    if (reportRange === 'ytd') {
      const keys = [];
      for (let mm = 1; mm <= m; mm += 1) keys.push(monthKey(y, mm));
      return keys;
    }
    return [monthKey(y, m)]; // 'month'
  };

  const reportRangeLabel = () => (
    reportRange === '3months' ? 'Last 3 Months'
      : reportRange === 'ytd' ? 'This Year (YTD)'
        : 'This Month'
  );

  // → { title, columns: string[], rows: string[][], totals: string[]|null }
  // Amounts are plain integers (no symbol/commas) so a single representation
  // works for both CSV columns and the PDF table.
  const buildReportData = () => {
    const now = new Date();
    if (reportType === 'payments') {
      const columns = ['Tenant', 'Property', 'Phone', 'Paid Months', 'Expected Months', 'On-time %'];
      const rows = bookings.filter((b) => b.status !== 'cancelled').map((b) => {
        const expected = Array.isArray(b.ledgerKeys) && b.ledgerKeys.length
          ? b.ledgerKeys.length
          : enumerateLeaseMonths(b.leaseStart, b.leaseEnd).length;
        const paid = b.ledger ? Object.values(b.ledger).filter((e) => e?.paid && e?.status !== 'due').length : 0;
        const pct = expected > 0 ? Math.round((paid / expected) * 100) : 0;
        return [b.tenant || b.tenantName || '—', b.property || '—', b.tenantPhone || '—', String(paid), String(expected), `${pct}%`];
      });
      return { title: 'Tenant Payment History', columns, rows, totals: null };
    }
    if (reportType === 'leases') {
      const columns = ['Tenant', 'Property', 'Location', 'Monthly Rent', 'Service', 'Lease Start', 'Lease End', 'Stage', 'Deposit'];
      const rows = bookings
        .filter((b) => b.status !== 'cancelled' && computeLeaseStage(b, now) !== 'done')
        .map((b) => [
          b.tenant || b.tenantName || '—', b.property || '—', b.location || '—',
          String(Number(b.monthlyRent) || 0), String(Number(b.serviceCharge) || 0),
          b.leaseStart || '—', b.leaseEnd || 'Ongoing',
          stageLabel(computeLeaseStage(b, now), 'English'),
          String((Number(b.advancePayment) || 0) + (Number(b.securityDeposit) || 0)),
        ]);
      return { title: 'Active Lease List', columns, rows, totals: null };
    }
    // financial (default) — one row per month in the selected range.
    const columns = ['Month', 'Expected', 'Collected', 'Outstanding', 'Collection %'];
    let te = 0, tc = 0, to = 0;
    const rows = reportRangeKeys().map((k) => {
      const { year, month } = parseMonthKey(k);
      const sm = getMonthCollectionSummary(bookings, year, month, now);
      te += sm.expectedTotal; tc += sm.collectedTotal; to += sm.outstandingTotal;
      const pct = sm.expectedTotal > 0 ? Math.round((sm.collectedTotal / sm.expectedTotal) * 100) : 0;
      return [monthFullLabel(k, 'English'), String(sm.expectedTotal), String(sm.collectedTotal), String(sm.outstandingTotal), `${pct}%`];
    });
    const totalPct = te > 0 ? Math.round((tc / te) * 100) : 0;
    return { title: 'Financial Overview', columns, rows, totals: ['Total', String(te), String(tc), String(to), `${totalPct}%`] };
  };

  const reportFileBase = () => {
    const kind = reportType === 'payments' ? 'payment-history' : reportType === 'leases' ? 'active-leases' : 'financial-overview';
    return `tolet-${kind}-${todayIso()}`;
  };

  const downloadTextFile = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportReportCSV = () => {
    const { columns, rows, totals } = buildReportData();
    if (rows.length === 0) {
      showToast(language === 'বাংলা' ? 'এক্সপোর্ট করার মতো ডেটা নেই' : 'No data to export yet');
      return;
    }
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const all = [columns, ...rows, ...(totals ? [totals] : [])];
    const csv = all.map((r) => r.map(esc).join(',')).join('\n');
    // BOM so Excel opens UTF-8 correctly.
    downloadTextFile(`\ufeff${csv}`, `${reportFileBase()}.csv`, 'text/csv;charset=utf-8;');
    setActiveModal(null);
    showToast(language === 'বাংলা' ? 'CSV এক্সপোর্ট হয়েছে ✓' : 'CSV exported ✓');
  };

  const exportReportPDF = () => {
    const { title, columns, rows, totals } = buildReportData();
    if (rows.length === 0) {
      showToast(language === 'বাংলা' ? 'এক্সপোর্ট করার মতো ডেটা নেই' : 'No data to export yet');
      return;
    }
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(186, 0, 54);
      doc.text('TO-LET PRO', margin, y); y += 20;
      doc.setFontSize(13); doc.setTextColor(30, 30, 30);
      doc.text(title, margin, y); y += 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text(`${reportRangeLabel()}  ·  Generated: ${formatDate(todayIso(), 'English')}`, margin, y); y += 18;
      doc.setDrawColor(214); doc.line(margin, y, pageW - margin, y); y += 16;

      const usableW = pageW - margin * 2;
      const colW = usableW / columns.length;
      const drawRow = (cells, { bold = false, color = [40, 40, 40] } = {}) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(9);
        doc.setTextColor(color[0], color[1], color[2]);
        let maxLines = 1;
        const wrapped = cells.map((c) => {
          const w = doc.splitTextToSize(String(c ?? ''), colW - 6);
          maxLines = Math.max(maxLines, w.length);
          return w;
        });
        wrapped.forEach((w, i) => doc.text(w, margin + i * colW, y));
        y += maxLines * 12 + 6;
      };

      drawRow(columns, { bold: true, color: [90, 90, 90] });
      doc.setDrawColor(230); doc.line(margin, y - 6, pageW - margin, y - 6);
      rows.forEach((r) => {
        if (y > pageH - margin) { doc.addPage(); y = margin; drawRow(columns, { bold: true, color: [90, 90, 90] }); }
        drawRow(r);
      });
      if (totals) {
        doc.setDrawColor(214); doc.line(margin, y - 4, pageW - margin, y - 4);
        drawRow(totals, { bold: true, color: [20, 20, 20] });
      }

      doc.save(`${reportFileBase()}.pdf`);
      setActiveModal(null);
      showToast(language === 'বাংলা' ? 'PDF ডাউনলোড হয়েছে ✓' : 'PDF downloaded ✓');
    } catch (err) {
      console.warn('[host] report PDF failed:', err?.message || err);
      showToast(language === 'বাংলা' ? 'PDF তৈরি ব্যর্থ' : 'Could not generate PDF');
    }
  };

  // Convert an inquiry into a booking. PREMIUM-GATED — non-premium hosts get
  // an upgrade prompt instead. Pre-fills the lease form from the inquiry so
  // the host doesn't retype the tenant name / phone / property.
  const openConvertInquiry = (inquiry) => {
    if (!isPremium) {
      setModalData(inquiry);
      setActiveModal('premium_gate');
      setConfirmDeleteBookingId(null);
      return;
    }
    // Hassle-free: no "mark Accepted first" step — Accept goes straight to the
    // pre-filled lease modal; confirming it creates the booking and the server
    // marks the inquiry 'converted'.
    // Pre-fill from inquiry; host adjusts dates + rent before confirming.
    const matchingProp = properties.find(p => p.id === inquiry.propertyId) || null;
    // Commercial when the inquiry (denormalised) or the property says so.
    const inqCommercial = inquiry.dealType === 'commercial' || matchingProp?.intent === 'commercial';
    const start = todayIso();
    // Residential tenancies are ONGOING — no end date. Commercial deals carry a
    // real tenure instead (leaseTermMonths below), which derives the end date.
    setLeaseForm({
      inquiryId: inquiry.id,
      inquirerUserId: inquiry.inquirerUserId || null,
      replacesBookingId: null,
      editingBookingId: null,
      propertyId: inquiry.propertyId || (matchingProp?.id ?? ''),
      property: inquiry.propTitle || matchingProp?.title || '',
      location: matchingProp?.location || inquiry.location || '',
      tenant: inquiry.user || '',
      tenantPhone: inquiry.phone || '',
      leaseStart: start,
      leaseEnd: '',
      monthlyRent: String(matchingProp?.price || '').replace(/[^\d]/g, '') || '',
      advancePayment: '',
      paymentMethod: 'bKash',
      occupants: '',
      dealType: inqCommercial ? 'commercial' : 'residential',
      businessName: '',
      licenseNumber: '',
      leaseTermMonths: inqCommercial ? '24' : '',
      // Commercial deals don't use the residential flat/room/hostel category.
      category: inqCommercial ? '' : propTypeToCategory(matchingProp?.type),
      // Auto-fill floor from the property; room number stays empty (host provides).
      // Floor 0 is the ground floor — carry it as a readable label, never a bare "0".
      floorNumber: floorToLabel(matchingProp?.floorNumber ?? matchingProp?.floor, language),
      roomNumber: '',
      // Fresh person: nothing carried over, nothing pre-required.
      tenantProfile: emptyTenantProfile(),
      buildingId: null,
      unitId: null,
      manualProperty: false,
      seats: [],
      serviceCharge: String(landlordProfile?.serviceCharge ?? authUser?.landlordProfile?.serviceCharge ?? ''),
      lateFeeAmount: '',
      gracePeriodDays: 5,
      rentDueDay: 5,
      reminderLeadDays: 3,
      autoReminder: true,
      notes: inquiry.msg ? `From inquiry: ${inquiry.msg.slice(0, 140)}${inquiry.msg.length > 140 ? '…' : ''}` : '',
    });
    setConfirmDeleteBookingId(null);
    setLeaseErrors([]);
    setLeaseStep(1);
    setActiveModal('create_lease');

    // Prefill "Number of Occupants" from the tenant's family-members count when
    // we can see it (host has an inquiry link → the profile unlocks familySize).
    // Fired in the background so the modal opens instantly.
    if (inquiry.inquirerUserId) {
      tenantService.getTenant(inquiry.inquirerUserId)
        .then((t) => {
          const fam = Number(t?.familySize);
          if (Number.isFinite(fam) && fam > 0) {
            setLeaseForm((prev) => (prev.occupants ? prev : { ...prev, occupants: String(fam) }));
          }
        })
        .catch(() => {});
    }
  };

  // Reject an inquiry
  const rejectInquiry = (inquiry) => {
    setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, status: 'rejected' } : i));
    updateInquiryStatus(inquiry.id, 'rejected').catch(err => {
      console.warn('[host] inquiry reject sync failed:', err.message || err);
    });
    showToast(language === 'বাংলা' ? 'ইনকোয়ারি রিজেক্ট করা হয়েছে।' : 'Inquiry rejected.');
  };


  const acceptInquiry = (inquiry) => {
    setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, status: 'accepted' } : i));
    updateInquiryStatus(inquiry.id, 'accepted').catch(err => {
      console.warn('[host] inquiry accept sync failed:', err.message || err);
    });
    // Follow the card: the inquiry just left "Pending", so switch the host to the
    // "Accepted" tab (and open the card there) instead of leaving them staring at
    // the now-empty Pending list.
    setInquiryTab('accepted');
    setExpandedHostInquiryId(inquiry.id);
    showToast(language === 'বাংলা' ? 'ইনকোয়ারি একসেপ্ট করা হয়েছে।' : 'Inquiry accepted.');
  };

  const cutInquiry = (inquiryId) => {
    setInquiries(prev => prev.filter(i => i.id !== inquiryId));
    deleteInquiry(inquiryId).catch(err => {
      console.warn('[host] inquiry delete failed:', err.message || err);
    });
    showToast(language === 'বাংলা' ? 'ইনকোয়ারি ডিলিট করা হয়েছে।' : 'Inquiry permanently deleted.');
  };

  // Open create_lease standalone (no inquiry pre-fill).
  const openBlankLease = (prefillBuilding = null) => {
    // Starts today, runs ONGOING — the tenancy has no expiry until the host
    // either types a term or hands the unit to the next tenant. Only the tenant
    // and the rent are left to fill in.
    const startIso = todayIso();
    setLeaseForm({
      inquiryId: null,
      inquirerUserId: null,
      replacesBookingId: null,
      editingBookingId: null,
      propertyId: prefillBuilding ? prefillBuilding.id : (properties[0]?.id || ''),
      property: prefillBuilding ? prefillBuilding.name : (properties[0]?.title || ''),
      // `address` is what a real Building record carries; `location` is the old
      // profile-blob spelling. Both are read because a landlord can be on
      // either side of the buildings/units migration.
      location: prefillBuilding ? bldgAddress(prefillBuilding) : (properties[0]?.location || ''),
      tenant: '',
      tenantPhone: '',
      leaseStart: startIso,
      leaseEnd: '',
      monthlyRent: '',
      advancePayment: '',
      paymentMethod: 'bKash',
      occupants: '',
      // Blank "New Lease" always opens on the RESIDENTIAL form first; the host
      // taps "Commercial Area / Lease" to switch. (Converting a commercial
      // inquiry still opens commercial — that path is context-driven.)
      dealType: prefillBuilding ? (bldgIsCommercial(prefillBuilding) ? 'commercial' : 'residential') : 'residential',
      businessName: '',
      licenseNumber: '',
      leaseTermMonths: prefillBuilding ? (bldgIsCommercial(prefillBuilding) ? '24' : '') : (properties[0]?.intent === 'commercial' ? '24' : ''),
      category: prefillBuilding
        ? bldgLeaseCategory(prefillBuilding)
        : (properties[0]?.intent === 'commercial' ? '' : propTypeToCategory(properties[0]?.type)),
      floorNumber: '',
      roomNumber: '',
      // Fresh person: nothing carried over, nothing pre-required.
      tenantProfile: emptyTenantProfile(),
      buildingId: null,
      unitId: null,
      manualProperty: !!prefillBuilding,
      seats: [],
      serviceCharge: String(landlordProfile?.serviceCharge ?? authUser?.landlordProfile?.serviceCharge ?? ''),
      lateFeeAmount: '',
      gracePeriodDays: 5,
      rentDueDay: 5,
      reminderLeadDays: 3,
      autoReminder: true,
      notes: '',
    });
    setConfirmDeleteBookingId(null);
    setLeaseErrors([]);
    setLeaseStep(1);
    setActiveModal('create_lease');
  };

  // ── TENANT CHANGE — re-let the SAME unit to the next tenant ────────────────
  // The landlord sets a unit up once. When that tenant moves out, this carries
  // the whole lease over — property, floor, room, rent, service charge, due day,
  // reminders — and clears only the person: name, phone, occupants, advance.
  // The host edits those, saves, and the new tenancy starts with a fresh rent
  // ledger while the outgoing lease is closed out (nothing is deleted, so last
  // year's payment history stays intact).
  const openTenantChangeLease = (booking) => {
    if (!booking) return;
    if (!isPremium) { setModalData(booking); setActiveModal('premium_gate'); return; }
    // New tenancy starts today. An ongoing lease has no end date to wait for; a
    // typed term still in the future means the outgoing tenant holds the unit
    // until then, so the next one starts the day after.
    const oldEnd = isOpenEndedLease(booking) ? null : new Date(booking.leaseEnd);
    const todayDate = new Date(todayIso());
    const startDate = (oldEnd && !Number.isNaN(oldEnd.getTime()) && oldEnd > todayDate)
      ? new Date(oldEnd.getFullYear(), oldEnd.getMonth(), oldEnd.getDate() + 1)
      : todayDate;
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const termMonths = Number(booking.commercialTerms?.leaseTermMonths) || 0;
    setLeaseForm({
      inquiryId: null,
      inquirerUserId: null,
      replacesBookingId: booking.id,
      // MUST be cleared. This form is shared with the edit flow, and a stale
      // editingBookingId here would send the hand-over down the edit branch —
      // silently rewriting the outgoing tenant's lease instead of closing it
      // out and starting a new one.
      editingBookingId: null,
      // ── Carried over: the unit + its money terms ──
      propertyId: booking.propertyId ? String(booking.propertyId) : '',
      property: booking.property || '',
      location: booking.location || '',
      category: booking.dealType === 'commercial' ? '' : propTypeToCategory(booking.propertyType),
      dealType: booking.dealType === 'commercial' ? 'commercial' : 'residential',
      floorNumber: booking.floorNumber || '',
      roomNumber: booking.roomNumber || '',
      manualProperty: !booking.propertyId,
      monthlyRent: String(booking.monthlyRent ?? ''),
      serviceCharge: String(booking.serviceCharge ?? ''),
      lateFeeAmount: Number(booking.lateFeeAmount) > 0 ? String(booking.lateFeeAmount) : '',
      gracePeriodDays: Number(booking.gracePeriodDays) ?? 5,
      rentDueDay: Number(booking.rentDueDay) || 5,
      reminderLeadDays: Number(booking.reminderLeadDays) || 3,
      autoReminder: booking.autoReminder !== false,
      leaseTermMonths: termMonths > 0 ? String(termMonths) : '',
      licenseNumber: '',
      // ── Cleared: everything tied to the person who just left ──
      tenant: '',
      tenantPhone: '',
      // The unit carries over; the person does not. Their profession, IDs,
      // address, emergency contact and photo all go with them.
      tenantProfile: emptyTenantProfile(),
      buildingId: null,
      unitId: null,
      occupants: '',
      businessName: '',
      advancePayment: '',
      paymentMethod: booking.paymentMethod || 'bKash',
      // THE ROOM KEEPS ITS SEATS.
      //
      // This was `[]`, so handing over a two-seat room produced a ONE-seat
      // lease and the rent stopped being split — the form opened saying
      // "৳6,000 ÷ 1 = ৳6,000/seat" for a room that has always been two seats at
      // ৳3,000. Seat 1 is the tenant typed at the top, so the carried-over rows
      // are the seats after it.
      seats: Array.from(
        { length: Math.max(0, activeMembers(booking).length - 1) },
        () => ({ name: '', phone: '', monthlyRent: '' }),
      ),
      notes: '',
      leaseStart: iso(startDate),
      // Ongoing, like the lease it replaces.
      leaseEnd: '',
    });
    setConfirmDeleteBookingId(null);
    setActiveDropdownId(null);
    setLeaseErrors([]);
    // Jump straight to the TENANT step — the unit is already set up, so the only
    // thing the host actually has to type is the new tenant's name + number.
    setLeaseStep(2);
    setActiveModal('create_lease');
  };

  // ── EDIT AN EXISTING LEASE ────────────────────────────────────────────────
  // The only thing a saved lease offered was "New Tenant · New Lease", which
  // ENDS the tenancy and starts a fresh one with an empty ledger. That is the
  // right tool for a tenant moving out and completely the wrong one for a
  // mistyped rent or a name spelled wrong in a hurry — using it to fix a typo
  // would retire the real tenancy and throw away the rent history attached to
  // it. So correcting is now its own action: same form, same fields, saved
  // back onto the SAME booking, ledger untouched.
  const openEditLease = (booking) => {
    if (!booking) return;
    // NOT premium-gated, unlike creating or re-letting.
    //
    // Creating a lease is the paid capability. Correcting a mistake in a lease
    // the landlord has ALREADY made is not a feature — it is the difference
    // between their records being right and being permanently wrong. A rent
    // typed as 6,000 instead of 16,000 during Eid would otherwise be frozen
    // into every future month with no way back except ending the tenancy and
    // losing its rent history.
    const termMonths = Number(booking.commercialTerms?.leaseTermMonths) || 0;
    // Whoever is really in the unit — a member who joined by invite outranks
    // the name typed at creation (see utils/occupants.js).
    const occ = primaryOccupant(booking, language);
    setLeaseForm((f) => ({
      ...f,
      inquiryId: booking.inquiryId || null,
      inquirerUserId: null,
      replacesBookingId: null,
      editingBookingId: booking.id,
      propertyId: booking.propertyId ? String(booking.propertyId) : '',
      property: booking.property || '',
      location: booking.location || '',
      category: booking.dealType === 'commercial' ? '' : propTypeToCategory(booking.propertyType),
      dealType: booking.dealType === 'commercial' ? 'commercial' : 'residential',
      floorNumber: booking.floorNumber || '',
      roomNumber: booking.roomNumber || '',
      manualProperty: !booking.propertyId,
      buildingId: booking.buildingId || null,
      unitId: booking.unitId || null,
      monthlyRent: String(booking.monthlyRent ?? ''),
      serviceCharge: String(booking.serviceCharge ?? ''),
      advancePayment: String(booking.advancePayment ?? ''),
      paymentMethod: booking.paymentMethod || 'bKash',
      lateFeeAmount: Number(booking.lateFeeAmount) > 0 ? String(booking.lateFeeAmount) : '',
      gracePeriodDays: Number(booking.gracePeriodDays) ?? 5,
      rentDueDay: Number(booking.rentDueDay) || 5,
      reminderLeadDays: Number(booking.reminderLeadDays) || 3,
      autoReminder: booking.autoReminder !== false,
      leaseTermMonths: termMonths > 0 ? String(termMonths) : '',
      businessName: booking.commercialTerms?.businessName || '',
      licenseNumber: booking.commercialTerms?.licenseNumber || '',
      tenant: occ.name,
      tenantPhone: occ.phone || '',
      tenantProfile: booking.tenantProfile || emptyTenantProfile(),
      occupants: String(occupantCount(booking) || ''),
      // Seats are owned by the members panel, not this form — editing a lease
      // must never silently rewrite who is sitting in which bed.
      seats: [],
      notes: booking.notes || '',
      leaseStart: booking.leaseStart ? String(booking.leaseStart).slice(0, 10) : '',
      leaseEnd: booking.leaseEnd ? String(booking.leaseEnd).slice(0, 10) : '',
    }));
    setConfirmDeleteBookingId(null);
    setActiveDropdownId(null);
    setLeaseErrors([]);
    setLeaseStep(1);
    setActiveModal('create_lease');
  };

  // Save the corrections back onto the same booking. Deliberately narrow: it
  // writes the fields the form owns and nothing else. `ledger`, `members`,
  // `inviteCode` and `status` are never touched, so a correction cannot cost
  // the landlord a month of rent history.
  const submitEditLease = (bookingId, values) => {
    const booking = bookings.find(b => String(b.id) === String(bookingId));
    if (!booking) return;

    const patch = {
      tenant: values.tenant,
      tenantPhone: values.tenantPhone,
      // The whole person, not just the name — NID, profession, address,
      // emergency contact, photo. These are the "many things about the tenant"
      // the form let a landlord type and then gave them no way to correct.
      tenantProfile: values.tenantProfile,
      tenantsCount: values.occupants,
      property: values.property,
      location: values.location,
      floorNumber: values.floorNumber,
      roomNumber: values.roomNumber,
      monthlyRent: values.monthlyRent,
      serviceCharge: values.serviceCharge,
      advancePayment: values.advancePayment,
      paymentMethod: values.paymentMethod,
      lateFeeAmount: values.lateFeeAmount,
      gracePeriodDays: values.gracePeriodDays,
      rentDueDay: values.rentDueDay,
      reminderLeadDays: values.reminderLeadDays,
      autoReminder: values.autoReminder,
      notes: values.notes,
      leaseStart: values.leaseStart,
      leaseEnd: values.leaseEnd || null,
      ...(values.dealType === 'commercial'
        ? { commercialTerms: { businessName: values.businessName, licenseNumber: values.licenseNumber, leaseTermMonths: values.leaseTermMonths } }
        : {}),
    };

    // THE NAME ON THE CARD IS members[0].name, not booking.tenant (see
    // utils/occupants.js). So renaming the tenant here has to reach that row as
    // well, or the landlord fixes a misspelling, saves, and the card still
    // shows the old spelling — the exact "it won't let me correct it" they hit
    // in the first place. Only the FIRST occupant is touched: that is the
    // person this form is about; the rest are the members panel's business.
    const activeMems = Array.isArray(booking.members)
      ? booking.members.filter(m => m && m.status !== 'moved-out')
      : [];
    const primaryMem = activeMems[0] || null;
    const renamePrimary = !!primaryMem
      && (String(primaryMem.name || '') !== patch.tenant || String(primaryMem.phone || '') !== patch.tenantPhone);

    // A hostel room's rent is split across its seats, and each seat's share is
    // derived from booking.monthlyRent at display time — so changing the room
    // rent re-splits it automatically and no member row needs rewriting here.
    setBookings(prev => prev.map(b => (String(b.id) === String(bookingId)
      ? {
          ...b,
          ...patch,
          leaseEnd: patch.leaseEnd || '',
          tenantInit: (String(patch.tenant || '?').trim().charAt(0) || '?').toUpperCase(),
          ...(renamePrimary
            ? { members: (b.members || []).map(m => (m.id === primaryMem.id
                ? { ...m, name: patch.tenant, phone: patch.tenantPhone }
                : m)) }
            : {}),
          ...(values.dealType === 'commercial'
            ? { commercialTerms: { ...(b.commercialTerms || {}), businessName: values.businessName, licenseNumber: values.licenseNumber, leaseTermMonths: values.leaseTermMonths } }
            : {}),
        }
      : b)));

    setActiveModal(null);
    setLeaseErrors([]);
    showToast(language === 'বাংলা' ? 'লিজ আপডেট হয়েছে ✓' : 'Lease updated ✓');

    // Queued rather than fired and forgotten. A rent rate changed in a cellar
    // with no bars is the landlord's decision either way; the queue carries it
    // out when there is signal instead of losing it on the next poll.
    const mongoId = booking._id || bookingId;
    if (/^[0-9a-fA-F]{24}$/.test(String(mongoId))) {
      hostSync.enqueue('updateBookingFields', { bookingId: mongoId, patch });
      if (renamePrimary && primaryMem.id) {
        hostSync.enqueue('updateMemberFields', {
          bookingId: mongoId,
          memberId: primaryMem.id,
          patch: { name: patch.tenant, phone: patch.tenantPhone },
        });
      }
    }
  };

  // Close out a lease: the tenancy is over as of `endIso`. We never delete —
  // receipts and past-year ledgers hang off this row — we mark it 'completed'
  // and pull the end date back so it stops counting as live revenue and drops
  // off the Rent Collection tab.
  const closeOutLease = (bookingId, endIso) => {
    if (!bookingId) return;
    const target = bookings.find(b => String(b.id) === String(bookingId));
    if (!target) return;
    // A lease can't end before it began — if the unit turns over on (or before)
    // its own start date, close it out on the start date itself.
    let effEnd = endIso || null;
    if (effEnd) {
      const start = new Date(target.leaseStart);
      if (!Number.isNaN(start.getTime()) && new Date(effEnd) < start) {
        effEnd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      }
    }
    setBookings(prev => prev.map(b => (
      String(b.id) === String(bookingId)
        ? { ...b, status: 'completed', leaseEnd: effEnd || b.leaseEnd }
        : b
    )));
    if (/^[0-9a-fA-F]{24}$/.test(String(bookingId))) {
      hostSync.enqueue('updateBookingFields', {
        bookingId,
        patch: { status: 'completed', ...(effEnd ? { leaseEnd: effEnd } : {}) },
      });
    }
  };

  // Persist a new booking + initialise an empty ledger.
  // TODO(backend): POST /api/host/bookings  body: { ...leaseForm }
  //   On success the inquiry should be marked converted server-side.
  const submitCreateLease = (keepOpen = false) => {
    // Saving a CORRECTION is never gated — see openEditLease. Gating it here
    // would have let the form open and then refused at the save button, which
    // is worse than not offering it at all.
    if (!isPremium && !leaseForm.editingBookingId) { setActiveModal('premium_gate'); return; }
    const { tenant, tenantPhone, propertyId, leaseStart, leaseEnd, monthlyRent, manualProperty } = leaseForm;
    // Collect EVERY empty required box so they all turn red, then jump to the
    // WIZARD STEP holding the first one and focus it. Without the step hop the
    // host would see a toast about a red box sitting on a step they can't see.
    const scrollToLeaseField = (field) => {
      const step = LEASE_FIELD_STEP[field];
      if (step) setLeaseStep(step);
      setTimeout(() => {
        const el = document.getElementById('lease-' + field);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { el.focus({ preventScroll: true }); } catch { /* focus optional */ } }
      }, 80);
    };
    const isCommercial = leaseForm.dealType === 'commercial';
    // Dates are optional. Blank start ⇒ today; blank end ⇒ ONGOING (no expiry).
    // A commercial tenure derives the end date.
    const { startIso: effLeaseStart, endIso: effLeaseEnd } = resolveLeaseDates(leaseForm);
    const termMonths = Number(leaseForm.leaseTermMonths) || 0;
    const missing = [];
    // Same rulebook the wizard steps use — name, mobile, move-in, plus any ID
    // the host said this tenant HAS. Nothing else about the person blocks.
    missing.push(...validateTenantProfile(leaseTenantView(leaseForm)));
    if (manualProperty ? !String(leaseForm.property || '').trim() : !propertyId) missing.push('property');
    if (isCommercial) {
      if (!String(leaseForm.businessName || '').trim()) missing.push('businessName');
    } else if (!String(leaseForm.roomNumber || '').trim()) {
      missing.push('roomNumber');
    }
    const rent = Number(monthlyRent) || 0;
    if (rent <= 0) missing.push('monthlyRent');
    if (missing.length) {
      setLeaseErrors(missing);
      showToast(language === 'বাংলা' ? 'লাল ঘরগুলো পূরণ করুন' : 'Please fill the highlighted fields');
      scrollToLeaseField(missing[0]);
      return;
    }
    // Only reachable when the host typed an end date and inverted it. An ongoing
    // tenancy has no end date to be out of order.
    if (effLeaseEnd && new Date(effLeaseEnd) <= new Date(effLeaseStart)) {
      setLeaseErrors(['leaseEnd']);
      showToast(language === 'বাংলা' ? 'শেষ তারিখ শুরুর তারিখের পরে হতে হবে' : 'End date must be after start date');
      scrollToLeaseField('leaseEnd');
      return;
    }
    setLeaseErrors([]);

    // ── Occupancy guard — ONE LIVE lease per unit, re-lettable forever ──────
    // Previously any second booking for a property was rejected outright, which
    // meant that once a tenant moved out the host could never lease that flat
    // again. Now the rule is about the unit being OCCUPIED, not about it having
    // ever been leased: a finished tenancy (expired or closed out) never blocks
    // the next one, so the same flat / room / shop can be re-let as many times
    // as tenants come and go. Different rooms in one building are different
    // units, so a hostel or a multi-room house still takes many leases at once.
    const pidStr = String(propertyId);
    const replacesId = leaseForm.replacesBookingId || null;
    const editingId = leaseForm.editingBookingId || null;

    // ── EDITING: correct this lease and stop ────────────────────────────────
    // Everything past this point creates a NEW booking — the inquiry-duplicate
    // check, the occupancy guard, the close-out of a replaced lease. None of it
    // applies to fixing the lease that is already there, and the occupancy
    // guard would refuse the edit outright: the unit is occupied by the very
    // booking being edited.
    if (editingId) {
      submitEditLease(editingId, {
        tenant: tenant.trim(),
        tenantPhone: tenantPhone.trim(),
        tenantProfile: toTenantProfile(leaseTenantView(leaseForm)),
        occupants: Math.max(1, Number(leaseForm.occupants) || 1),
        property: leaseForm.property,
        location: leaseForm.location || '',
        floorNumber: leaseForm.floorNumber || '',
        roomNumber: leaseForm.roomNumber || '',
        monthlyRent: rent,
        serviceCharge: Number(leaseForm.serviceCharge) || 0,
        advancePayment: Number(leaseForm.advancePayment) || 0,
        paymentMethod: leaseForm.paymentMethod || 'Cash',
        lateFeeAmount: Math.max(0, Number(leaseForm.lateFeeAmount) || 0),
        gracePeriodDays: Math.max(0, Number(leaseForm.gracePeriodDays) || 0),
        rentDueDay: Number(leaseForm.rentDueDay) || 5,
        reminderLeadDays: Number(leaseForm.reminderLeadDays) || 3,
        autoReminder: !!leaseForm.autoReminder,
        notes: leaseForm.notes || '',
        leaseStart: effLeaseStart,
        leaseEnd: effLeaseEnd,
        dealType: leaseForm.dealType,
        businessName: String(leaseForm.businessName || '').trim(),
        licenseNumber: String(leaseForm.licenseNumber || '').trim(),
        leaseTermMonths: termMonths,
      });
      return;
    }

    // One active booking per inquiry — converting the same inquiry twice is a
    // double-entry, not a re-let.
    const inquiryDupe = leaseForm.inquiryId
      ? bookings.find(b => b.status !== 'cancelled' && b.inquiryId === leaseForm.inquiryId)
      : null;
    if (inquiryDupe) {
      showToast(language === 'বাংলা' ? 'এই ইনকোয়ারির লিজ আগে থেকেই আছে।' : 'This inquiry already has a lease.');
      setActiveModal(null); setActiveTab('bookings'); return;
    }

    const occupied = findLiveLeaseForUnit(
      bookings,
      { propertyId: pidStr, property: leaseForm.property, floorNumber: leaseForm.floorNumber, roomNumber: leaseForm.roomNumber },
      today,
      replacesId,
    );
    if (occupied) {
      // Not a dead end: step 1 renders this running lease with a one-tap "that
      // tenant left" hand-over, which closes it out and lets this lease through.
      setLeaseStep(1);
      showToast(language === 'বাংলা'
        ? 'এই ইউনিটে একটি লিজ চলছে — পুরোনো ভাড়াটিয়া চলে গেছে কি?'
        : 'This unit already has a running lease — did that tenant leave?');
      return;
    }

    const matchingProp = properties.find(p => String(p.id) === pidStr) || null;
    const initials = tenant.trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'NT';
    const occupants = Math.max(1, Number(leaseForm.occupants) || 1);
    const advancePayment = Number(leaseForm.advancePayment) || 0;
    const paymentMethod = leaseForm.paymentMethod || 'Cash';
    // Carry the tenant's user id from the inquiry so Message / Call / Profile
    // can resolve the real user. Must be a Mongo ObjectId for the backend to
    // store it; anything else stays null (manual, un-linked bookings).
    const tenantUserId = /^[0-9a-fA-F]{24}$/.test(String(leaseForm.inquirerUserId || ''))
      ? leaseForm.inquirerUserId
      : null;
    // ── Hostel seats ─────────────────────────────────────────────────────
    // Seat 1 = the main tenant (name/phone above); any seats the host added in
    // the modal follow as Seat 2, 3 … and inherit this room's floor + room. A
    // seat only carries an explicit monthlyRent when the host typed a custom
    // amount — otherwise the room rent is split equally across the seats
    // (handled in MembersManager). We deliberately DON'T stamp Seat 1 with the
    // full room rent, or the ÷seats split would skip it.
    // The person as entered on the tenant step — profession, IDs, address,
    // emergency contact, photo. Only ever as complete as the host chose to make
    // it; blank fields are stored blank rather than blocking the save.
    const tenantProfile = toTenantProfile(leaseTenantView(leaseForm));
    const hostelMembers = (leaseForm.category === 'hostel')
      ? [
          // Seat 1 is this tenant, so it carries their full profile. Seats 2+
          // are added with just a name/phone here and can be filled in later
          // from the members panel.
          { name: tenant.trim(), phone: tenantPhone.trim(), rentType: 'seat', floor: leaseForm.floorNumber || '', roomLabel: leaseForm.roomNumber || '', seatLabel: language === 'বাংলা' ? 'সিট ১' : 'Seat 1', tenantProfile, avatar: tenantProfile.photoUrl || '' },
          ...(Array.isArray(leaseForm.seats) ? leaseForm.seats : [])
            .filter(s => (s.name || '').trim() || (s.phone || '').trim() || Number(s.monthlyRent) > 0)
            .map((s, i) => ({
              name: (s.name || '').trim(),
              phone: (s.phone || '').trim(),
              rentType: 'seat',
              floor: leaseForm.floorNumber || '',
              roomLabel: leaseForm.roomNumber || '',
              seatLabel: `${language === 'বাংলা' ? 'সিট' : 'Seat'} ${i + 2}`,
              ...(Number(s.monthlyRent) > 0 ? { monthlyRent: Number(s.monthlyRent) } : {}),
            })),
        ]
      : undefined;
    // A real Building/Unit id when we have one — that, not the property name,
    // is what ties this lease to a building from now on. The server re-reads
    // both and refuses ids the landlord doesn't own.
    const isMongoId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));
    const scopedBuilding = (leaseForm.buildingId && isMongoId(leaseForm.buildingId))
      ? leaseForm.buildingId
      : (isMongoId(currentBuildingId) ? currentBuildingId : null);

    const newBooking = {
      id: `BKG-${String(Date.now()).slice(-6)}`,
      inquiryId: leaseForm.inquiryId,
      tenantId: tenantUserId,
      buildingId: scopedBuilding,
      unitId: leaseForm.unitId || null,
      propertyId: pidStr,
      property: matchingProp?.title || leaseForm.property,
      propertyType: matchingProp?.type || leaseForm.category || '',
      location: leaseForm.location || matchingProp?.location || '',
      floorNumber: leaseForm.floorNumber || '',
      roomNumber: leaseForm.roomNumber || '',
      tenant: tenant.trim(),
      tenantInit: initials,
      tenantPhone: tenantPhone.trim(),
      tenantEmail: '',
      tenantProfile,
      // Landlord's own snapshot. Cleared server-side the moment the tenant
      // joins with the invite code — their profile picture wins from then on.
      tenantAvatar: tenantProfile.photoUrl || '',
      tenantsCount: occupants,
      // Empty leaseEnd = ongoing tenancy, no expiry.
      leaseStart: effLeaseStart, leaseEnd: effLeaseEnd,
      dealType: isCommercial ? 'commercial' : 'residential',
      ...(isCommercial ? { commercialTerms: { businessName: String(leaseForm.businessName || '').trim(), licenseNumber: String(leaseForm.licenseNumber || '').trim(), leaseTermMonths: termMonths } } : {}),
      monthlyRent: rent,
      advancePayment,
      paymentMethod,
      serviceCharge: Number(leaseForm.serviceCharge) || 0,
      lateFeeAmount: Math.max(0, Number(leaseForm.lateFeeAmount) || 0),
      gracePeriodDays: Math.max(0, Number(leaseForm.gracePeriodDays) || 0),
      rentDueDay: Number(leaseForm.rentDueDay) || 5,
      reminderLeadDays: Number(leaseForm.reminderLeadDays) || 3,
      autoReminder: !!leaseForm.autoReminder,
      chatId: leaseForm.inquiryId || Date.now(),
      notes: leaseForm.notes || '',
      status: 'active',
      ledger: {},
      ...(hostelMembers ? { members: hostelMembers } : {}),
    };
    setBookings(prev => [newBooking, ...prev]);

    // Tenant change — hand the unit over. The outgoing lease is closed out the
    // day before this one starts, so the Bookings tab shows it as Done, the
    // Financial Overview stops counting its rent, and Rent Collection swaps in
    // the new tenant with a clean ledger.
    if (replacesId) {
      const sd = new Date(effLeaseStart);
      const prevEnd = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate() - 1);
      closeOutLease(replacesId, `${prevEnd.getFullYear()}-${String(prevEnd.getMonth() + 1).padStart(2, '0')}-${String(prevEnd.getDate()).padStart(2, '0')}`);
    }

    createBookingApi({
      ...(scopedBuilding ? { buildingId: scopedBuilding } : {}),
      ...(isMongoId(leaseForm.unitId) ? { unitId: leaseForm.unitId } : {}),
      propertyId: matchingProp ? (matchingProp._id || matchingProp.id) : propertyId,
      propertyType: matchingProp?.type || leaseForm.category || '',
      tenantId: tenantUserId,
      property: matchingProp?.title || leaseForm.property,
      location: leaseForm.location || matchingProp?.location || '',
      serviceCharge: Number(leaseForm.serviceCharge) || 0,
      inquiryId: leaseForm.inquiryId,
      // null ⇒ the server stores an ongoing tenancy with no expiry.
      leaseStart: effLeaseStart, leaseEnd: effLeaseEnd || null,
      dealType: isCommercial ? 'commercial' : 'residential',
      ...(isCommercial ? { commercialTerms: { businessName: String(leaseForm.businessName || '').trim(), licenseNumber: String(leaseForm.licenseNumber || '').trim(), leaseTermMonths: termMonths } } : {}),
      lateFeeAmount: Math.max(0, Number(leaseForm.lateFeeAmount) || 0),
      gracePeriodDays: Math.max(0, Number(leaseForm.gracePeriodDays) || 0),
      rentDueDay: Number(leaseForm.rentDueDay) || 5,
      reminderLeadDays: Number(leaseForm.reminderLeadDays) || 3,
      autoReminder: !!leaseForm.autoReminder,
      notes: leaseForm.notes || '',
      tenant: tenant.trim(),
      tenantPhone: tenantPhone.trim(),
      tenantProfile,
      tenantsCount: occupants,
      advancePayment,
      paymentMethod,
      monthlyRent: rent,
      floorNumber: leaseForm.floorNumber || '',
      roomNumber: leaseForm.roomNumber || '',
      // Hostels: Seat 1 = the entered tenant + any seats added in the modal.
      // Seats split the room rent equally unless the host set a custom per-seat
      // amount (see MembersManager / hostelMembers above).
      members: hostelMembers,
    }).then(saved => {
      setBookings(prev => prev.map(b => b.id === newBooking.id ? { ...b, ...saved } : b));
      // Surface the tenant connection code so the host can share it right away.
      if (saved?.inviteCode) {
        showToast(language === 'বাংলা'
          ? `কানেকশন কোড: ${saved.inviteCode} — ভাড়াটিয়াকে দিন`
          : `Connection code: ${saved.inviteCode} — share it with the tenant`);
      }
    }).catch(err => {
      console.warn('[host] booking create sync failed:', err.message || err);
      // Save fail হলে fake-id card মুছে দাও — নাহলে এটা পরে delete করা যায় না।
      setBookings(prev => prev.filter(b => b.id !== newBooking.id));
      showToast(language === 'বাংলা' ? 'বুকিং সেভ ব্যর্থ — আবার চেষ্টা করুন' : 'Booking save failed — please retry');
    });

    if (matchingProp) {
      setProperties(prev => prev.map(p => p.id === matchingProp.id ? { ...p, status: 'rented' } : p));
    }
    if (leaseForm.inquiryId) {
      // Convert হলে canonical status = 'final_booking' (tenant timeline এটাই চেনে)।
      // Inquiry card সরাই না — Rented tab-এ ঝুলে থাকে।
      setInquiries(prev => prev.map(i => i.id === leaseForm.inquiryId ? { ...i, status: 'final_booking' } : i));
      // Backend-এও sync (createBooking-ও এটাই mark করে — idempotent, কোনো race নেই)।
      updateInquiryStatus(leaseForm.inquiryId, 'final_booking').catch(err => console.warn('[host] inquiry convert sync failed:', err.message || err));
    }
    if (keepOpen) {
      // Rapid multi-entry: keep the common fields (property, category, floor,
      // dates, rent, due day, reminder, payment) and clear only the per-booking
      // ones so the host can add the next room/tenant immediately — the way to
      // set 20+ bookings without re-typing everything.
      setLeaseForm(f => ({ ...f, tenant: '', tenantPhone: '', tenantProfile: emptyTenantProfile(), roomNumber: '', occupants: '', businessName: '', licenseNumber: '', seats: [], inquiryId: null, inquirerUserId: null, replacesBookingId: null, editingBookingId: null }));
      setLeaseStep(1);
      showToast(language === 'বাংলা' ? 'লিজ তৈরি হয়েছে — পরের রুম/ভাড়াটিয়া যোগ করুন' : 'Lease created — add the next room / tenant');
    } else {
      showToast(replacesId
        ? (language === 'বাংলা' ? 'নতুন লিজ চালু — রেন্ট কালেকশনে নতুন ভাড়াটিয়া যোগ হয়েছে।' : 'New lease started — Rent Collection now tracks the new tenant.')
        : (language === 'বাংলা' ? 'লিজ তৈরি হয়েছে! রেন্ট লেজার চালু হয়েছে।' : 'Lease created — rent ledger is live.'));
      setActiveModal(null);
      setLeaseStep(1);
      setActiveTab('bookings');
    }
  };

  // 🟢 100% FIXED: Moved logic inside the component to prevent White Screen Error!
  const retryLoadProperties = () => setPropertyRefreshTick((tick) => tick + 1);
  const filteredProperties = properties.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.location.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPropertiesByStatus = filteredProperties.filter(p => propertyFilter === 'all' || p.status === propertyFilter);

  const recentProps = filteredProperties.filter(p => isRecent(p.addedDate));
  const dashboardProperties = recentProps.length > 0 ? recentProps : filteredProperties.slice(0, 3);
  const dashboardPropTitle = recentProps.length > 0 
      ? (language === 'বাংলা' ? 'সাম্প্রতিক লিস্টিং' : 'Recent Listings') 
      : (language === 'বাংলা' ? 'আপনার প্রপার্টিসমূহ' : 'Your Properties');

  // NOTE: inquiry tab filtering lives in InquiriesTab.jsx and routes through the
  // shared bucket map in utils/inquiryStatus.js. A second, unused copy of that
  // filter used to sit here; keeping two rulebooks is exactly how the dashboard
  // KPI ended up counting 4 inquiries while the tabs could only render 3.
  // Counts for the landlord's queue — same rulebook the Inquiries tab uses, so
  // the sidebar badge and the Pending tab can never show different numbers.
  const inquiryCounts = countInquiryBuckets(inquiries);

  // ── BACK BUTTON → close the top overlay, don't leave the page ─────────────
  // Each open overlay owns one history entry, so hardware Back (Android),
  // the edge-swipe (iOS) and the browser's Back arrow all dismiss it exactly
  // like the X does. Without this, Back on an open modal tore the landlord out
  // of the dashboard entirely. Layered outermost → innermost: a modal opened
  // over the drawer closes first, the next Back closes the drawer.
  useBackGuard(isProfileDrawerOpen, () => setIsProfileDrawerOpen(false));
  useBackGuard(isNotifOpen, () => setIsNotifOpen(false));
  useBackGuard(isLangMenuOpen, () => setIsLangMenuOpen(false));
  useBackGuard(showHomeChoice, () => setShowHomeChoice(false));
  useBackGuard(trialModalOpen, () => setTrialModalOpen(false));
  useBackGuard(verifModalOpen, () => setVerifModalOpen(false));
  useBackGuard(!!confirmDeleteBookingId, () => setConfirmDeleteBookingId(null));
  useBackGuard(!!activeModal, () => { setActiveModal(null); setModalData(null); });

  // The two Smart Features used to live as big CTA cards on the Dashboard tab
  // but they didn't visually fit, so we moved them into the sidebar as proper
  // tabs. They open the existing /smart-alerts and /ai-insights pages — no
  // route changes, so any old in-app links still work.
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t?.dashboard || (language === 'বাংলা' ? 'ড্যাশবোর্ড' : "Dashboard") },
    { id: 'documents', icon: Folder, label: language === 'বাংলা' ? 'ডকুমেন্ট ও অ্যানালিটিক্স' : "Documents & Analytics" },
    { id: 'properties', icon: Building, label: t?.myProperties || (language === 'বাংলা' ? 'আমার বাসাসমূহ' : "My Properties") },
    { id: 'inquiries', icon: Zap, label: t?.inquiries || (language === 'বাংলা' ? 'যোগাযোগ সমূহ' : "Inquiries") },
    { id: 'messages', icon: MessageCircle, label: t?.messages || (language === 'বাংলা' ? 'মেসেজ' : "Messages"), isLink: true, path: '/messages' },
    { id: 'bookings', icon: Calendar, label: language === 'বাংলা' ? 'ভাড়াটিয়া ও রেন্ট' : "Tenants & Rent" },
    { id: 'payments', icon: CreditCard, label: language === 'বাংলা' ? 'পেমেন্ট সেটিংস' : 'Payment Settings' },
    { id: 'smartAlerts', icon: BellRing, label: language === 'বাংলা' ? 'স্মার্ট অ্যালার্টস' : 'Smart Alerts' },
    { id: 'aiInsights',  icon: Sparkles, label: language === 'বাংলা' ? 'এআই ইনসাইটস'   : 'AI Insights' },
    { id: 'settings', icon: Settings, label: language === 'বাংলা' ? 'সেটিংস' : 'Settings' },
    { id: 'support', icon: HelpCircle, label: language === 'বাংলা' ? 'হেল্প ও সাপোর্ট' : 'Support', isLink: true, path: '/support' },
    { id: 'how-it-works', icon: BookOpen, label: language === 'বাংলা' ? 'কীভাবে কাজ করে' : 'How it Works', isLink: true, path: '/how-it-works' },
    { id: 'trust', icon: HeartHandshake, label: language === 'বাংলা' ? 'বিশ্বাস ও নিরাপত্তা' : 'Trust & Safety', isLink: true, path: '/trust-safety' },
    { id: 'privacy', icon: ShieldCheck, label: language === 'বাংলা' ? 'প্রাইভেসি পলিসি' : 'Privacy Policy', isLink: true, path: '/privacy-policy' },
    { id: 'terms', icon: FileText, label: language === 'বাংলা' ? 'শর্তাবলী' : 'Terms & Policies', isLink: true, path: '/terms' },
    { id: 'refund', icon: CreditCard, label: language === 'বাংলা' ? 'রিফান্ড পলিসি' : 'Refund Policy', isLink: true, path: '/refund' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#eaeff5] font-sans relative overflow-hidden text-gray-900 selection:bg-[#ba0036] selection:text-white">

      {/* 🚨 SMART ALERTS POP-UP — proactively surfaces URGENT alerts (e.g.
          overdue rent, expired leases) once per login session. "View all"
          jumps to the Smart Alerts tab. */}
      <SmartAlertsPopup
        alerts={hostAlerts}
        language={language}
        role="landlord"
        onViewAll={() => setActiveTab('smartAlerts')}
      />

      {/* 💳 PAYMENT SETTINGS REMINDER — once a tenant is connected to one of
          their properties, nudge the landlord to complete Payment Settings if
          they still have no payment method. Gated on bookings for the same
          reason as the inline promo card: before a tenant exists there is no
          rent to collect, so a brand-new landlord shouldn't be stopped by it. */}
      <PaymentSettingsPopup
        hasPaymentMethod={hasActivePaymentMethod}
        hasBookings={bookings.length > 0}
        loading={paymentMethodsLoading}
        onAddMethod={() => setActiveTab('payments')}
      />

      {/* 🎁 FREE PRO TRIAL MODAL — share the app, unlock 2 months Pro. */}
      <FreeProTrialModal
        open={trialModalOpen}
        reason="manual"
        onSkip={() => setTrialModalOpen(false)}
        onUnlocked={() => showToast(language === 'বাংলা' ? '২ মাস প্রো আনলক হয়েছে!' : '2 months of Pro unlocked!')}
      />

      {/* 🏠 LOGO "WHERE TO?" POPUP — the dashboard is the landlord's home, so the
          logo asks where to go rather than silently leaving for the public site. */}
      <LandlordHomeChoiceModal
        open={showHomeChoice || isLogoModalOpen}
        onClose={() => { setShowHomeChoice(false); setIsLogoModalOpen(false); }}
        onGoHome={() => { setShowHomeChoice(false); setIsLogoModalOpen(false); overlayNavigate('/'); }}
        onGoDashboard={() => { setShowHomeChoice(false); setIsLogoModalOpen(false); }}
        onDashboardPage
        isBn={language === 'বাংলা'}
      />

      {/* ✨ GLOWING ORBS ✨ */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-gradient-to-tl from-blue-600/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* TOAST NOTIFICATION (supports undo + error/success types) */}
      {(() => {
        const toastText = typeof toastMessage === 'string' ? toastMessage : toastMessage?.text;
        const toastUndo = typeof toastMessage === 'object' ? toastMessage?.undo : null;
        const toastType = typeof toastMessage === 'object' ? (toastMessage?.type || 'success') : 'success';
        const isError = toastType === 'error';
        return (
          <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[10000] transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${toastMessage ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
            <div className="bg-gray-900/90 backdrop-blur-2xl text-white px-5 py-3 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/10 flex items-center gap-3">
              <div className={`w-5 h-5 ${isError ? 'bg-red-500/20' : 'bg-green-500/20'} rounded-full flex items-center justify-center`}>
                {isError
                  ? <AlertCircle size={12} className="text-red-400" />
                  : <CheckCircle2 size={12} className="text-green-400" />}
              </div>
              <span className="text-xs font-bold tracking-wide">{toastText}</span>
              {toastUndo && (
                <button
                  onClick={() => { toastUndo(); setToastMessage(null); clearTimeout(toastTimerRef.current); }}
                  className="ml-1 px-3 py-1 bg-white/15 hover:bg-white/25 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  {language === 'বাংলা' ? 'আনডু' : 'Undo'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* --- TOP HEADER --- */}
      <div className="w-full max-w-[1600px] mx-auto z-40 relative">
        {/* Hidden below lg on the two LIST tabs — Add Tenant and Rent
            Collection. On a phone this bar plus its margins costs roughly a
            fifth of the screen, and these are the tabs a landlord scrolls
            through with 70–80 rooms in them; that space is worth more as
            tenant rows.
            Nothing is stranded: the Add Tenant / Rent Collection strip is a
            separate element below, and MobileBottomNav (App.jsx) keeps Home,
            Messages and Profile reachable. It returns on every other tab and
            on desktop, where the space is not scarce. */}
        <header className={`mx-4 md:mx-8 mt-4 bg-white/60 backdrop-blur-3xl border border-white/80 rounded-[2rem] px-4 md:px-8 py-3.5 items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${(activeTab === 'rent' || activeTab === 'bookings') ? 'hidden lg:flex' : 'flex'}`}>
          {/* Logo → opens the "where to?" popup instead of jumping straight to
              the public homepage, because the dashboard is the landlord's home. */}
          <button
            type="button"
            data-tour="host-logo"
            onClick={() => setShowHomeChoice(true)}
            className="flex items-center gap-3 z-10 group shrink-0"
            aria-label={language === 'বাংলা' ? 'নেভিগেশন মেনু' : 'Navigation menu'}
          >
            <div className="bg-gradient-to-br from-[#ba0036] to-[#ff004c] p-2.5 rounded-xl shadow-[0_4px_15px_rgba(186,0,54,0.3)] group-hover:scale-105 transition-transform">
              <Building2 className="text-white w-4 h-4 md:w-[18px] md:h-[18px]" />
            </div>
            {/* whitespace-nowrap keeps "TO-LET PRO" on ONE line — it was
                wrapping to two lines when the header got tight on iPad. */}
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter hidden sm:block whitespace-nowrap">
              TO-LET <span className="text-[#ba0036]">PRO</span>
            </h1>
            {/* Beta badge (Phase 7) — signals the app is in beta testing.
                Hidden until lg so it doesn't crowd the header on iPad / tablet. */}
            <span className="ml-1 px-1.5 py-0.5 text-[9px] md:text-[10px] font-black uppercase tracking-wider text-[#ba0036] bg-red-50 border border-[#ba0036]/30 rounded-md leading-none self-center hidden lg:block">
              Beta
            </span>
          </button>
          
          {/* Header trimmed to match the public homepage navbar: logo +
              notification bell + profile. The search bar and the language
              toggle were removed at the host's request — language can still
              be switched from the global Navbar on every other route. */}

          <div className="flex items-center gap-3 md:gap-4 z-10 ml-auto">
            <div className="relative cursor-pointer" ref={notifRef}>
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 bg-white/60 rounded-xl hover:bg-white transition-all border border-white/80 shadow-sm relative group">
                <Bell size={18} className="text-gray-500 group-hover:text-blue-600 transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba0036] opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba0036] border-2 border-white"></span></span>
                )}
              </button>
              {isNotifOpen && (
                // Mobile: full-width fixed panel anchored to the top of the
                // viewport so it never spills off-screen. The bell sits next
                // to the profile button (not at the screen edge), so a plain
                // `absolute right-0` would push the 18rem panel past the left
                // edge on narrow viewports.
                // sm+:  revert to the original absolute placement under the bell.
                <div className="fixed sm:absolute top-[5.25rem] sm:top-full inset-x-3 sm:inset-auto sm:right-0 sm:mt-3 w-auto sm:w-72 max-h-[calc(100vh-6rem)] sm:max-h-none overflow-y-auto sm:overflow-visible bg-white/95 backdrop-blur-3xl border border-white shadow-[0_30px_60px_rgba(0,0,0,0.12)] rounded-[1.5rem] p-2 z-[100] animate-in fade-in zoom-in-95 origin-top-right">
                  <div className="p-3 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="text-[13px] font-black text-gray-900 tracking-tight">{t?.notifications || (language === 'বাংলা' ? 'স্মার্ট অ্যালার্ট' : 'Smart Alerts')}</h3>
                    {unreadCount > 0 && (
                      <span className="bg-[#ba0036]/10 text-[#ba0036] px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">{unreadCount} {t?.new || (language === 'বাংলা' ? 'নতুন' : 'New')}</span>
                    )}
                  </div>
                  <div className="p-1.5 space-y-1.5 max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No notifications</p>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} onClick={async () => { 
                            try { 
                              await markRead(notif.id); 
                              setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                              setUnreadCount(prev => Math.max(0, prev - 1));
                            } catch (err) {} 
                            setIsNotifOpen(false); 
                            handleNotifClick(notif);
                          }} 
                          className={`p-3 rounded-2xl border cursor-pointer hover:bg-white hover:shadow-sm transition-all group ${!notif.read ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}
                        >
                          <p className={`text-xs font-bold leading-tight mb-1.5 transition-colors ${!notif.read ? 'text-blue-900 group-hover:text-blue-600' : 'text-gray-800 group-hover:text-[#ba0036]'}`}>{notif.title || notif.body}</p>
                          {notif.title && notif.body && <p className="text-[11px] text-gray-500 mb-2 truncate">{notif.body}</p>}
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            {!notif.read && <span className="w-1 h-1 bg-blue-500 rounded-full"></span>}
                            {new Date(notif.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* List Property CTA — jumps straight to the listing wizard. */}
            <button
              data-tour="host-header-add-property"
              onClick={() => navigate('/list-property')}
              className="hidden sm:inline-flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-xl border border-[#ba0036]/30 text-[#ba0036] bg-white/60 hover:bg-[#ba0036]/[0.06] hover:border-[#ba0036]/50 transition-all shadow-sm active:scale-95"
            >
              <PlusCircle size={16} strokeWidth={2.5} />
              <span className="text-[12px] font-black">{language === 'বাংলা' ? 'ভাড়া দিন' : 'List Property'}</span>
              <span className="hidden lg:inline text-[8px] font-black uppercase tracking-wider bg-[#ba0036]/10 px-1.5 py-0.5 rounded-md">{language === 'বাংলা' ? 'ফ্রি' : 'Free'}</span>
            </button>

            {/* Language switcher — English ⇄ বাংলা (persisted via LanguageContext).
                Visible on mobile too: the global marketing navbar (which carries
                the language pill elsewhere) is hidden on the dashboard, so this
                is the landlord's only in-dashboard language toggle on phones. */}
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(v => !v)}
                aria-label={language === 'বাংলা' ? 'ভাষা' : 'Language'}
                className="flex items-center gap-1.5 p-2 lg:px-3 lg:py-2 rounded-xl bg-white/60 border border-white/80 shadow-sm hover:bg-white transition-all active:scale-95"
              >
                <Globe size={16} className="text-gray-500" />
                {/* Globe-only through tablet (like the bell beside it); the label
                    + chevron appear from lg up so iPad's header stays uncluttered. */}
                <span className="hidden lg:block text-[12px] font-black text-gray-700">{language === 'বাংলা' ? 'বাংলা' : 'English'}</span>
                <ChevronDown size={14} className={`hidden lg:block text-gray-400 transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setIsLangMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-36 bg-white/95 backdrop-blur-3xl border border-white shadow-[0_30px_60px_rgba(0,0,0,0.12)] rounded-2xl p-1.5 z-[100] animate-in fade-in zoom-in-95 origin-top-right">
                    {['English', 'বাংলা'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => { setLanguage(lang); setIsLangMenuOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-black transition-colors ${language === lang ? 'bg-[#ba0036]/10 text-[#ba0036]' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        {lang}
                        {language === lang && <Check size={14} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button data-tour="host-profile-menu" onClick={() => setIsProfileDrawerOpen(true)} className="flex items-center gap-2 p-1 pr-3 bg-white/60 rounded-xl border border-white/80 shadow-sm hover:shadow-md hover:bg-white transition-all active:scale-95">
              <div className="relative">
                {userData.avatar ? (
                  <img src={userData.avatar} alt={userData.fullName} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#ba0036] text-white flex items-center justify-center font-bold text-sm">{userData.fullName.charAt(0)}{userData.fullName.split(' ')[1]?.charAt(0)}</div>
                )}
                {(verificationStatus.nidUploaded && verificationStatus.faceVerified) && <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full border-2 border-white text-white p-[1px] shadow-sm"><BadgeCheck size={12} /></div>}
              </div>
              <div className="hidden md:block text-left ml-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-gray-800 leading-none truncate max-w-[80px]">{userData.fullName.split(' ')[0]}</p>
                  {subStatus.isPaid && subStatus.tier === 'pro' && <span className="bg-[#ba0036] text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm leading-none flex items-center">Pro</span>}
                  {subStatus.isPaid && subStatus.tier === 'plus' && <span className="bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm leading-none flex items-center">Plus</span>}
                </div>
                <p className="text-[9px] font-bold text-[#ba0036] uppercase tracking-widest mt-1">{t?.hostPortal || (language === 'বাংলা' ? 'বাড়িওয়ালা' : 'Host Portal')}</p>
              </div>
            </button>
          </div>
        </header>
      </div>

      {/* 🔴 HOST DASHBOARD SLIDE BAR (Right Drawer) */}
      {isProfileDrawerOpen && <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setIsProfileDrawerOpen(false)}></div>}
      
      <div className={`fixed top-0 right-0 h-full w-full max-w-[280px] bg-[#fdfdfd] shadow-2xl z-[70] transform transition-transform duration-500 ease-in-out flex flex-col border-l border-gray-100 ${isProfileDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        
        <div className="p-5 pt-6 pb-3 flex flex-col gap-4 relative">
          <div onClick={() => { setActiveTab('profile'); setIsProfileDrawerOpen(false); }} className="flex items-center gap-3 bg-gray-50 hover:bg-[#ba0036]/5 p-3 rounded-2xl border border-gray-100 cursor-pointer transition-all group">
            <div className="relative shrink-0">
              {userData.avatar ? (
                <img src={userData.avatar} alt={userData.fullName} className="w-10 h-10 rounded-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#ba0036] text-white flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">{userData.fullName.charAt(0)}{userData.fullName.split(' ')[1]?.charAt(0)}</div>
              )}
              {(verificationStatus.nidUploaded && verificationStatus.faceVerified) && <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full border-2 border-white text-white p-[1px] shadow-sm"><BadgeCheck size={12} /></div>}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-black text-gray-900 leading-tight group-hover:text-[#ba0036] transition-colors truncate max-w-[120px]">{userData.fullName}</p>
                {subStatus.isPaid && subStatus.tier === 'pro' && <span className="bg-[#ba0036] text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm leading-none flex items-center">Pro</span>}
                {subStatus.isPaid && subStatus.tier === 'plus' && <span className="bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm leading-none flex items-center">Plus</span>}
              </div>
              <p className="text-[9px] font-bold text-[#ba0036] uppercase tracking-widest mt-1">{t?.managingUrbanLiving || (language === 'বাংলা' ? 'বাড়িওয়ালা' : 'MANAGING URBAN LIVING')}</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-2">
          {Array.isArray(authRoles) && authRoles.includes('tenant') ? (
            <button onClick={handleSwitchRole} className="w-full relative group overflow-hidden bg-gray-900 text-white py-3 rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-2 hover:shadow-[0_10px_20px_rgba(186,0,54,0.3)] hover:bg-[#ba0036] transition-all duration-500">
              <RefreshCw size={16} className="relative z-10" /> <span className="relative z-10">{language === 'বাংলা' ? 'ভাড়াটিয়া হিসেবে ব্যবহার করুন' : 'Switch to Tenant'}</span>
            </button>
          ) : (
            <Link to="/list-property" data-tour="add-property-button" className="w-full relative group overflow-hidden bg-gray-900 text-white py-3 rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-2 hover:shadow-[0_10px_20px_rgba(186,0,54,0.3)] hover:bg-[#ba0036] transition-all duration-500">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
              <Plus size={16} className="relative z-10" /> <span className="relative z-10">{t?.newListing || (language === 'বাংলা' ? 'নতুন লিস্টিং যোগ করুন' : '+ New Listing')}</span>
            </Link>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {menuItems.map((item) => {
             // Merged entries stay active for their sub-views too:
             // 'bookings' ⊃ Rent Collection, 'documents' ⊃ Analytics.
             const isActive = !item.isLink && (
               activeTab === item.id ||
               (item.id === 'bookings' && activeTab === 'rent') ||
               (item.id === 'documents' && activeTab === 'analytics')
             );
             // Premium feature locked after trial expires → click sends
             // the host to /subscription with a `from` param so the page
             // can highlight exactly which feature triggered the gate.
             const locked = isFeatureLocked(item.id);
             // Routing out of the drawer uses overlayNavigate so the drawer's
             // back-guard entry is consumed instead of stranded — one Back
             // press from /messages returns to the dashboard, not two.
             const handleClick = () => {
               setIsProfileDrawerOpen(false);
               if (locked) { overlayNavigate(`/subscription?from=${item.id}`); return; }
               if (item.isLink) overlayNavigate(item.path);
               else setActiveTab(item.id);
             };
             return (
              <button
                key={item.id}
                onClick={handleClick}
                data-tour={TOUR_TAB_ANCHORS[item.id]}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer font-bold text-xs text-left transition-all duration-300 ${isActive ? 'bg-red-50 text-[#ba0036]' : locked ? 'text-gray-400 hover:bg-amber-50/40' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                title={locked ? (language === 'বাংলা' ? 'প্রিমিয়াম ফিচার — সাবস্ক্রাইব করুন' : 'Premium feature — subscribe to unlock') : undefined}
              >
                <item.icon size={16} className={isActive ? 'text-[#ba0036]' : locked ? 'text-amber-500' : 'text-gray-400'} />
                <span className="flex-1 tracking-wide flex justify-between items-center">
                   {item.label}
                   {/* Badge = the landlord's action queue (the Pending tab's count).
                       It counted only 'sent' before, so an inquiry that had merely
                       been opened ('viewed') silently dropped off the badge while
                       still awaiting a decision. */}
                   {item.id === 'inquiries' && inquiryCounts.pending > 0 && (
                     <span className="bg-[#ba0036] text-white text-[9px] px-1.5 py-0.5 rounded-full font-black tabular-nums">
                       {inquiryCounts.pending}
                     </span>
                   )}
                   {item.id === 'payments' && (pendingRentCount > 0 || (!hasActivePaymentMethod && !paymentMethodsLoading)) && (
                     <span className={`text-white text-[9px] px-1.5 py-0.5 rounded-full font-black ${pendingRentCount > 0 ? 'bg-[#ba0036]' : 'bg-amber-500'}`}>
                       {pendingRentCount > 0 ? pendingRentCount : '!'}
                     </span>
                   )}
                </span>
                {locked && <Lock size={12} className="text-amber-500" />}
              </button>
             )
          })}
          

        </nav>

        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3 mt-auto">
          {/* Plan status pill. Three states, because with no automatic trial a
              free host may never have HAD one — labelling that "Trial ended"
              (red) would read as a broken account rather than a starting point. */}
          {!subStatus.isPaid && (
            subStatus.isTrial ? (
              <div className="px-3 py-2 rounded-xl border bg-blue-50 border-blue-100 text-blue-700 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Clock size={12} />
                {language === 'বাংলা' ? `ট্রায়াল: ${subStatus.daysRemaining} দিন বাকি` : `Trial · ${subStatus.daysRemaining}d left`}
              </div>
            ) : subStatus.isExpired ? (
              <div className="px-3 py-2 rounded-xl border bg-red-50 border-red-100 text-red-700 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Clock size={12} />
                {language === 'বাংলা' ? 'ট্রায়াল শেষ' : 'Trial ended'}
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl border bg-gray-50 border-gray-200 text-gray-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Clock size={12} />
                {language === 'বাংলা' ? 'ফ্রি প্ল্যান' : 'Free plan'}
              </div>
            )
          )}
          {subStatus.isPaid ? (
            <button
              onClick={() => { setIsProfileDrawerOpen(false); navigate('/subscription'); }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all active:scale-95 text-[11px] tracking-wide uppercase flex items-center justify-center gap-2"
            >
              <Crown size={14}/> {language === 'বাংলা' ? 'প্রো অ্যাক্টিভ' : 'Pro Active'}
            </button>
          ) : (
            <button
              onClick={() => { setIsProfileDrawerOpen(false); navigate('/subscription'); }}
              className="w-full bg-[#ba0036] hover:bg-[#90002a] text-white py-3 rounded-xl font-bold shadow-[0_8px_20px_rgba(186,0,54,0.25)] transition-all active:scale-95 text-[11px] tracking-wide uppercase flex items-center justify-center gap-2"
            >
              <Sparkles size={14}/> {language === 'বাংলা' ? 'প্রো-তে আপগ্রেড' : 'Upgrade to Pro'}
            </button>
          )}
          <button
            onClick={async () => {
              showToast(language === 'বাংলা' ? 'লগআউট হচ্ছে...' : 'Logging out...');
              // `replace` so Back can't walk back into the signed-out dashboard.
              // authLogout() redirects on its own — no navigate() here, or the
              // two compete and the loser flashes a route on the way out.
              try { await authLogout(); } finally { setIsProfileDrawerOpen(false); }
            }}
            className="flex items-center justify-center gap-2 text-[#3b2a2a] hover:text-[#ba0036] font-bold transition-colors w-full py-1.5 group"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="tracking-wider text-[11px] uppercase">Logout</span>
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-8 lg:px-12 pt-3 md:pt-4 relative z-10 custom-scrollbar overflow-y-auto pb-24">
        
        {activeDropdownId && <div className="fixed inset-0 z-20" onClick={() => setActiveDropdownId(null)}></div>}

        {/* 🔴 PROFILE & VERIFICATION TAB */}
        {activeTab === 'profile' && (
          <div className="w-full mb-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">

              {/* === LEFT (2 cols on xl): Header + Personal Info + Verification Center === */}
              <div className="xl:col-span-2 space-y-6 md:space-y-8">
                <ProfileSection
                  role="landlord"
                  user={userData}
                  profile={landlordProfile}
                  trustScore={landlordTrustScore}
                  verificationStatus={hostVerificationStatus}
                  language={language}
                  onUpdate={async (patch) => {
                    const next = applyLandlordPatch(landlordProfile, patch);
                    await persistLandlordProfile(next, patch);
                    showToast(language === 'বাংলা' ? 'প্রোফাইল আপডেট হয়েছে' : 'Profile updated');
                  }}
                  onAvatarUpload={async (file, _source, onProgress) => {
                    try {
                      const res = await uploadAvatar(file, { onProgress });
                      setUserData(prev => ({ ...prev, avatar: res?.user?.avatar || res?.avatar || prev.avatar }));
                      showToast(language === 'বাংলা' ? 'প্রোফাইল ছবি আপডেট হয়েছে!' : 'Profile photo updated!');
                    } catch (err) {
                      console.error('[AvatarUpload] failed:', err?.message || err);
                      showToast(language === 'বাংলা' ? 'ছবি আপলোড ব্যর্থ হয়েছে' : 'Photo upload failed');
                      throw err;
                    }
                  }}
                  onOpenVerification={() => setVerifModalOpen(true)}
                />
              </div>

              {/* === RIGHT (1 col on xl): Trust Score + Timeline + Quick Wins === */}
              <div className="xl:col-span-1 space-y-6 md:space-y-8">

                <TrustGauge
                  score={landlordTrustScore.score}
                  tier={landlordTrustScore.tier}
                  breakdown={landlordTrustScore.breakdown}
                  language={language}
                />

                <QuickWinsCard
                  breakdown={landlordTrustScore.breakdown}
                  language={language}
                  onJump={() => {
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />

                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <CheckCheck className="text-green-600" size={18} />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-black text-gray-900">
                        {language === 'বাংলা' ? 'ভেরিফিকেশন স্ট্যাটাস' : 'Verification Status'}
                      </h3>
                      <p className="text-xs font-bold text-gray-500">
                        {language === 'বাংলা' ? 'কোন ধাপে আছেন এক নজরে দেখুন।' : 'Track your verification progress at a glance.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <TimelineRow
                      done
                      icon={UserCircle}
                      textEn="Account created"
                      textBn="অ্যাকাউন্ট তৈরি"
                      language={language}
                    />
                    <TimelineRow
                      done={!!userData.phone}
                      icon={Phone}
                      textEn="Phone OTP verified"
                      textBn="ফোন OTP ভেরিফাইড"
                      language={language}
                    />
                    <TimelineRow
                      done={!!userData.avatar}
                      icon={Camera}
                      textEn="Profile photo uploaded"
                      textBn="প্রোফাইল ছবি আপলোড"
                      language={language}
                    />
                    <TimelineRow
                      done={verificationStatus.nidUploaded}
                      icon={ScanFace}
                      textEn="National ID uploaded"
                      textBn="NID আপলোড"
                      language={language}
                    />
                    <TimelineRow
                      done={verificationStatus.underReview || (verificationStatus.faceVerified && verificationStatus.nidUploaded)}
                      icon={Hourglass}
                      textEn="Submitted for admin review"
                      textBn="অ্যাডমিন রিভিউয়ের জন্য সাবমিট"
                      language={language}
                    />
                    <TimelineRow
                      done={verificationStatus.faceVerified && verificationStatus.nidUploaded && !verificationStatus.underReview}
                      icon={BadgeCheck}
                      textEn="Verified by To-Let Pro"
                      textBn="To-Let Pro দ্বারা ভেরিফাইড"
                      language={language}
                      isFinal
                    />
                  </div>
                </div>

              </div>
            </div>
            
            {/* Identity verification — the SAME pop-up the tenant uses
                (role="tenant"), wired the same way (open prop + real backend
                submit). The old landlord-specific variant was removed. */}
            <VerificationModal
              role="tenant"
              open={verifModalOpen}
              onClose={() => setVerifModalOpen(false)}
              onSubmit={handleHostWizardSubmit}
              language={language}
              initialData={{
                professionType: authUser?.tenantProfile?.professionType || '',
                // nidVerified means APPROVED — points credited. It previously
                // also returned true for a bare `nidFront` upload, which both
                // skipped the step and credited points the server hadn't given.
                nidVerified: authUser?.tenantProfile?.verification?.status === 'verified',
                // Uploaded and queued: skip the step, but count it as pending.
                nidPending: authUser?.tenantProfile?.verification?.status !== 'verified'
                  && !!(authUser?.tenantProfile?.verification?.nidFront
                     && authUser?.tenantProfile?.verification?.nidBack)
                  && authUser?.tenantProfile?.verification?.status !== 'rejected',
              }}
              baseScore={landlordTrustScore.breakdown.reduce(
                (sum, i) => (i.done && !['photo', 'nid'].includes(i.key) ? sum + i.pts : sum),
                0
              )}
            />
          </div>
        )}

        {/* 🔴 OPTIMIZED MOBILE-FIRST DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-5">

            {/* ০. প্রমো কার্ড — পেমেন্ট সেটিংস + ট্রায়াল/আপগ্রেড। ইমেজের মতো ফুল-উইডথ (১ রো ১ প্রমো)। যদি দুটি থাকে তবে পাশাপাশি (md:flex-row) বসবে। */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full">

              {/* ০.১ পেমেন্ট সেটিংস */}
              {!paymentMethodsLoading && (
                !hasActivePaymentMethod ? (
                  bookings.length > 0 && !hidePaymentPromo && (
                    <div
                      onClick={() => setActiveTab('payments')}
                      className="relative group cursor-pointer bg-gradient-to-br from-emerald-50 to-green-50/60 dark:from-emerald-950/30 dark:to-green-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(16,185,129,0.12)] hover:shadow-[0_12px_35px_rgba(16,185,129,0.20)] hover:-translate-y-0.5 transition-all flex flex-col flex-1 w-full min-w-0"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissPaymentPromo();
                        }}
                        className="absolute top-2 right-2 md:top-1/2 md:-translate-y-1/2 md:right-4 p-1.5 rounded-full bg-emerald-100/50 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 transition-colors z-10"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 h-full pt-2 md:pt-0">
                        <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 flex-1 min-w-0 pr-8 md:pr-0">
                          <div className="relative w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <CreditCard size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#ba0036] text-white text-[9px] md:text-[10px] font-black flex items-center justify-center animate-pulse">!</span>
                          </div>
                          <div className="flex flex-col gap-1 md:gap-0.5 flex-1 min-w-0">
                            <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight truncate">
                              {language === 'বাংলা' ? 'পেমেন্ট সেটিংস সম্পূর্ণ করুন' : 'Complete Payment Settings'}
                            </h3>
                            <p className="text-[11px] md:text-xs font-bold text-emerald-700 dark:text-emerald-300/90 leading-relaxed md:truncate">
                              {language === 'বাংলা'
                                ? 'পেমেন্ট অ্যাকাউন্ট যোগ করুন যাতে ভাড়াটিয়া সরাসরি ভাড়া পাঠাতে পারে।'
                                : 'Add your account so tenants can send rent directly to you.'}
                            </p>
                          </div>
                        </div>
                        <div className="hidden md:flex shrink-0 md:pr-10">
                          <div className="px-4 py-2.5 rounded-xl bg-[#ba0036] text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 group-hover:scale-105 transition-transform shadow-lg shadow-red-500/20">
                            {language === 'বাংলা' ? 'সেটআপ করুন' : 'SETUP NOW'} <ArrowUpRight size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div
                    onClick={() => setActiveTab('payments')}
                    className="group cursor-pointer bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_35px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 transition-all flex flex-col flex-1 w-full min-w-0"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 h-full">
                      <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 flex-1 min-w-0">
                        <div className="relative w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <CreditCard size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                          {pendingRentCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 md:min-w-5 md:h-5 px-1 md:px-1.5 rounded-full bg-[#ba0036] text-white text-[9px] md:text-[10px] font-black flex items-center justify-center">{pendingRentCount}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 md:gap-0.5 flex-1 min-w-0">
                          <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight truncate">
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
                      <div className="mt-1 md:hidden shrink-0">
                        <div className={`w-fit px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${pendingRentCount > 0 ? 'bg-[#ba0036] text-white shadow-lg shadow-red-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
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
                  className="group cursor-pointer bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(245,158,11,0.12)] hover:shadow-[0_12px_35px_rgba(245,158,11,0.20)] hover:-translate-y-0.5 transition-all flex flex-col flex-1 w-full min-w-0"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 h-full">
                    <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(245,158,11,0.7)]">
                        <Crown size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                      </div>
                      <div className="flex flex-col gap-1 md:gap-0.5 flex-1 min-w-0">
                        <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight truncate">
                          {language === 'বাংলা' ? '২ মাসের ফ্রি প্রো ট্রায়াল নিন' : 'Get 2 Months of Pro — Free'}
                        </h3>
                        <p className="text-[11px] md:text-xs font-bold text-amber-700 dark:text-amber-300/90 leading-relaxed md:truncate">
                          {language === 'বাংলা'
                            ? 'অ্যাপের লিংক শেয়ার করলেই ৫০টি ছবি, ভিডিও ট্যুর আর সার্চে শীর্ষ অবস্থান আনলক।'
                            : 'Share the app link to unlock 50 photos, video tours and top search position.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1 md:hidden shrink-0">
                      <div className="w-fit px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-orange-500/20">
                        {language === 'বাংলা' ? 'ফ্রি নিন' : 'CLAIM FREE'} <ArrowUpRight size={14} />
                      </div>
                    </div>
                    <div className="hidden md:flex shrink-0">
                      <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 group-hover:scale-105 transition-transform shadow-lg shadow-orange-500/20">
                        {language === 'বাংলা' ? 'ফ্রি নিন' : 'CLAIM FREE'} <ArrowUpRight size={16} />
                      </div>
                    </div>
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
                    className="group cursor-pointer bg-gradient-to-br from-violet-50 to-indigo-50/60 dark:from-violet-950/30 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800/50 rounded-2xl md:rounded-[1.5rem] p-3.5 md:p-4 shadow-[0_4px_25px_rgba(99,102,241,0.12)] hover:shadow-[0_12px_35px_rgba(99,102,241,0.20)] hover:-translate-y-0.5 transition-all flex flex-col flex-1 w-full min-w-0"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 h-full">
                      <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(99,102,241,0.7)]">
                          <Crown size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.2} />
                        </div>
                        <div className="flex flex-col gap-1 md:gap-0.5 flex-1 min-w-0">
                          <h3 className="text-[13px] md:text-base font-black text-gray-900 dark:text-white leading-tight truncate">{title}</h3>
                          <p className="text-[11px] md:text-xs font-bold text-violet-700 dark:text-violet-300/90 leading-relaxed md:truncate">{blurb}</p>
                        </div>
                      </div>
                      <div className="mt-1 md:hidden shrink-0">
                        <div className="w-fit px-3 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-indigo-500/20">
                          {cta} <ArrowUpRight size={14} />
                        </div>
                      </div>
                      <div className="hidden md:flex shrink-0">
                        <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 group-hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">
                          {cta} <ArrowUpRight size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })() : null}
            </div>
            {(isPropertiesLoading || properties.length > 0) ? (
              <>

            {/* ১. Stats Bento Grid */}
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
                {language === 'বাংলা' ? 'জরুরী কাজ' : 'Quick Actions'}
              </h3>
              <div className="grid grid-cols-4 gap-[clamp(0.375rem,2vw,1rem)] items-stretch">
                {[
                  { id: 'add_tenant', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">ভাড়াটিয়া<br />যোগ করুন</span><span className="hidden md:block">ভাড়াটিয়া যোগ করুন</span></> : <><span className="md:hidden block leading-tight">Add<br />Tenant</span><span className="hidden md:block">Add Tenant</span></>,       Icon: Calendar,      iconColor: 'text-gray-500 dark:text-gray-400',     onClick: () => setActiveTab('bookings'), showOn: 'all' },
                  { id: 'rent_collection', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">ভাড়া<br />কালেকশন</span><span className="hidden md:block">ভাড়া কালেকশন</span></> : <><span className="md:hidden block leading-tight">Rent<br />Collection</span><span className="hidden md:block">Rent Collection</span></>, Icon: Wallet,        iconColor: 'text-gray-500 dark:text-gray-400', onClick: () => setActiveTab('rent'), showOn: 'all' },
                  { id: 'messages', label: language === 'বাংলা' ? 'মেসেজ' : 'Messages',     Icon: MessageCircle, iconColor: 'text-gray-500 dark:text-gray-400', onClick: () => navigate('/messages'), showOn: 'desktop' },
                  { id: 'payment_settings', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">পেমেন্ট<br />সেটিংস</span><span className="hidden md:block">পেমেন্ট সেটিংস</span></> : <><span className="md:hidden block leading-tight">Payment<br />Settings</span><span className="hidden md:block">Payment Settings</span></>, Icon: CreditCard, iconColor: 'text-gray-500 dark:text-gray-400', onClick: () => setActiveTab('payments'), showOn: 'mobile' },
                  { id: 'smart_alerts', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">স্মার্ট<br />অ্যালার্ট</span><span className="hidden md:block">স্মার্ট অ্যালার্ট</span></> : <><span className="md:hidden block leading-tight">Smart<br />Alerts</span><span className="hidden md:block">Smart Alerts</span></>, Icon: BellRing,      iconColor: 'text-gray-500 dark:text-gray-400',   onClick: () => setActiveTab('smartAlerts'), showOn: 'all' },
                ].map(({ id, label, Icon, iconColor, onClick, showOn }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={onClick}
                    className={`group min-w-0 w-full overflow-hidden flex-col items-center justify-start gap-[clamp(0.375rem,2vw,0.75rem)] px-[clamp(0.25rem,1.5vw,1.25rem)] py-[clamp(0.625rem,2.5vw,1.25rem)] rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-transparent dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 active:scale-95 transition-all duration-300 ${showOn === 'mobile' ? 'flex md:hidden' : showOn === 'desktop' ? 'hidden md:flex' : 'flex'}`}
                  >
                    <Icon strokeWidth={2.2} className={`shrink-0 w-[clamp(20px,5.5vw,26px)] h-[clamp(20px,5.5vw,26px)] ${iconColor} group-hover:scale-110 transition-transform duration-300`} />
                    <span className="w-full block text-[clamp(9px,2.6vw,0.875rem)] font-bold text-gray-700 dark:text-gray-300 text-center leading-snug break-words hyphens-auto">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>



            {/* ১.৫ Shared Ledger Overview */}
            {(() => {
              const todayDate = today;
              
              // Scoped by buildingId, in one shared place — see utils/buildingScope.js.
              // The name-equality filters that used to live here (one copy per screen)
              // are why hostel and single-room leases vanished after a successful save.
              const baseBookings = scopeBookings(bookings, effectiveLandlordProfile?.buildings, currentBuildingId);

              const rentUnits = baseBookings.flatMap(rentUnitsOf);
              const sm = getMonthCollectionSummary(rentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
              const collectedPct = sm.expectedTotal > 0 ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100)) : 0;
              
              return (
                <div
                  data-tour="host-shared-ledger"
                  onClick={() => setActiveTab('rent')}
                  className="group relative w-full cursor-pointer bg-white rounded-[1.5rem] p-5 md:p-7 border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                        <Wallet size={18} className="text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base md:text-xl font-black text-gray-900 dark:text-white leading-tight">
                          {language === 'বাংলা' ? 'ভাড়া লেজার ওভারভিউ' : 'Shared Ledger Overview'}
                        </h3>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                          {monthFullLabel(sm.key, language)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] md:text-[11px] font-black text-[#ba0036] dark:text-rose-400 uppercase tracking-widest group-hover:translate-x-0.5 transition-transform">
                      {language === 'বাংলা' ? 'লেজার দেখুন' : 'Open Ledger'}
                      <ArrowUpRight size={14} />
                    </div>
                  </div>

                  {/* Collection rate progress bar (Always Show) */}
                  <div className="mt-5 md:mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {language === 'বাংলা' ? 'কালেকশন রেট' : 'Collection Rate'}
                      </span>
                      <span className="text-xs md:text-sm font-black text-[#ba0036] dark:text-rose-400 tabular-nums">{collectedPct}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700" style={{ width: `${collectedPct}%` }} />
                    </div>
                  </div>

                  {/* 4-KPI strip (Always Show)
                      These four numbers are the reason a landlord opens the app,
                      and they used to be set in 8px labels on a transparent card
                      — the money was the quietest thing on the screen. Now the
                      figure leads at 22px on a tinted block, and the label and
                      footnote are readable Bangla rather than a grey hairline.
                      `truncate` keeps a six-figure total from breaking the grid
                      on a narrow phone. */}
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                      <p className={`${kpiValueSize(formatBDT(sm.collectedTotal))} font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1.5 leading-none truncate`}>{formatBDT(sm.collectedTotal)}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-emerald-700/80 dark:text-emerald-400/70 mt-2 inline-flex items-center gap-1">
                        <CheckCircle2 size={12} strokeWidth={3}/> {sm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'cleared'}
                      </p>
                    </div>
                    <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">{language === 'বাংলা' ? 'বকেয়া' : 'Outstanding'}</p>
                      <p className={`${kpiValueSize(formatBDT(sm.outstandingTotal))} font-black text-rose-700 dark:text-rose-400 tabular-nums mt-1.5 leading-none truncate`}>{formatBDT(sm.outstandingTotal)}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-rose-700/80 dark:text-rose-400/70 mt-2 inline-flex items-center gap-1">
                        <AlertCircle size={12} strokeWidth={3}/> {sm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'unpaid'}
                      </p>
                    </div>
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">{language === 'বাংলা' ? 'আংশিক' : 'Partial'}</p>
                      <p className={`${kpiValueSize(sm.partialCount)} font-black text-amber-700 dark:text-amber-400 tabular-nums mt-1.5 leading-none truncate`}>{sm.partialCount}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-amber-700/80 dark:text-amber-400/70 mt-2 inline-flex items-center gap-1">
                        <Hourglass size={12} strokeWidth={3}/> {language === 'বাংলা' ? 'আংশিক পেমেন্ট' : 'partially paid'}
                      </p>
                    </div>
                    <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                      <p className={`${kpiValueSize(formatBDT(sm.expectedTotal))} font-black text-blue-700 dark:text-blue-400 tabular-nums mt-1.5 leading-none truncate`}>{formatBDT(sm.expectedTotal)}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-blue-700/80 dark:text-blue-400/70 mt-2 inline-flex items-center gap-1">
                        <Calendar size={12} strokeWidth={3}/> {sm.totalDueCount} {language === 'বাংলা' ? 'ভাড়াটিয়া' : 'tenants'}
                      </p>
                    </div>
                  </div>

                  {/* Portfolio Breakdown (Multi mode only) */}
                  {effectiveLandlordProfile?.buildingMode === 'multi' && !currentBuildingId && (
                    <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
                      <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                        {language === 'বাংলা' ? 'বিল্ডিং অনুযায়ী কালেকশন' : 'Collection by Building'}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                        {(effectiveLandlordProfile.buildings || []).map(bldg => {
                          const bldgBookings = bookings.filter(b => bookingInBuilding(b, bldg));
                          const bldgRentUnits = bldgBookings.flatMap(rentUnitsOf);
                          const bldgSm = getMonthCollectionSummary(bldgRentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
                          const bldgPct = bldgSm.expectedTotal > 0 ? Math.min(100, Math.round((bldgSm.collectedTotal / bldgSm.expectedTotal) * 100)) : 0;
                          
                          return (
                            <div key={bldg.id} className="bg-gray-50/80 dark:bg-gray-800/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:border-[#ba0036]/30 hover:shadow-md transition-all">
                              <h4 className="text-sm font-black text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                                <span className="truncate pr-2">{bldg.name}</span>
                                {bldgSm.overdueCount > 0 && (
                                  <span className="text-[9px] font-black bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                    {bldgSm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'Overdue'}
                                  </span>
                                )}
                              </h4>
                              
                              {/* Two rows, not "collected / expected" on one
                                  line: these cards sit two-up on a phone, and at
                                  a readable size a six-figure pair does not fit
                                  across one. It was truncating the expected
                                  figure to an ellipsis — the number the landlord
                                  is measuring against, gone. */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 space-y-1">
                                  <div>
                                    <p className="text-[10px] font-black text-emerald-700/80 dark:text-emerald-400/80 uppercase tracking-wider leading-none">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                                    <p className={`${bldgValueSize(formatBDT(bldgSm.collectedTotal))} font-black text-gray-900 dark:text-gray-100 tabular-nums leading-tight whitespace-nowrap`}>{formatBDT(bldgSm.collectedTotal)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider leading-none">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                                    <p className={`${bldgValueSize(formatBDT(bldgSm.expectedTotal))} font-black text-gray-500 dark:text-gray-400 tabular-nums leading-tight whitespace-nowrap`}>{formatBDT(bldgSm.expectedTotal)}</p>
                                  </div>
                                </div>
                                <span className="text-lg font-black text-[#ba0036] dark:text-rose-400 tabular-nums shrink-0">{bldgPct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                                <div className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700" style={{ width: `${bldgPct}%` }} />
                              </div>

                              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded">{bldgSm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার' : 'Cleared'}</span>
                                <span className="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded">{bldgSm.totalDueCount - bldgSm.paidCount} {language === 'বাংলা' ? 'বাকি' : 'Due'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

              </>
            ) : (
              <>


            {/* ১.৫ Shared Ledger Overview */}
            {(() => {
              const todayDate = today;
              
              // Scoped by buildingId, in one shared place — see utils/buildingScope.js.
              // The name-equality filters that used to live here (one copy per screen)
              // are why hostel and single-room leases vanished after a successful save.
              const baseBookings = scopeBookings(bookings, effectiveLandlordProfile?.buildings, currentBuildingId);

              const rentUnits = baseBookings.flatMap(rentUnitsOf);
              const sm = getMonthCollectionSummary(rentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
              const collectedPct = sm.expectedTotal > 0 ? Math.min(100, Math.round((sm.collectedTotal / sm.expectedTotal) * 100)) : 0;
              
              return (
                <div
                  data-tour="host-shared-ledger"
                  onClick={() => setActiveTab('rent')}
                  className="group relative w-full cursor-pointer bg-white rounded-[1.5rem] p-5 md:p-7 border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                        <Wallet size={18} className="text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base md:text-xl font-black text-gray-900 dark:text-white leading-tight">
                          {language === 'বাংলা' ? 'ভাড়া লেজার ওভারভিউ' : 'Shared Ledger Overview'}
                        </h3>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                          {monthFullLabel(sm.key, language)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] md:text-[11px] font-black text-[#ba0036] dark:text-rose-400 uppercase tracking-widest group-hover:translate-x-0.5 transition-transform">
                      {language === 'বাংলা' ? 'লেজার দেখুন' : 'Open Ledger'}
                      <ArrowUpRight size={14} />
                    </div>
                  </div>

                  {/* Collection rate progress bar (Always Show) */}
                  <div className="mt-5 md:mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {language === 'বাংলা' ? 'কালেকশন রেট' : 'Collection Rate'}
                      </span>
                      <span className="text-xs md:text-sm font-black text-[#ba0036] dark:text-rose-400 tabular-nums">{collectedPct}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700" style={{ width: `${collectedPct}%` }} />
                    </div>
                  </div>

                  {/* 4-KPI strip (Always Show)
                      These four numbers are the reason a landlord opens the app,
                      and they used to be set in 8px labels on a transparent card
                      — the money was the quietest thing on the screen. Now the
                      figure leads at 22px on a tinted block, and the label and
                      footnote are readable Bangla rather than a grey hairline.
                      `truncate` keeps a six-figure total from breaking the grid
                      on a narrow phone. */}
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                      <p className={`${kpiValueSize(formatBDT(sm.collectedTotal))} font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1.5 leading-none truncate`}>{formatBDT(sm.collectedTotal)}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-emerald-700/80 dark:text-emerald-400/70 mt-2 inline-flex items-center gap-1">
                        <CheckCircle2 size={12} strokeWidth={3}/> {sm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার্ড' : 'cleared'}
                      </p>
                    </div>
                    <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">{language === 'বাংলা' ? 'বকেয়া' : 'Outstanding'}</p>
                      <p className={`${kpiValueSize(formatBDT(sm.outstandingTotal))} font-black text-rose-700 dark:text-rose-400 tabular-nums mt-1.5 leading-none truncate`}>{formatBDT(sm.outstandingTotal)}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-rose-700/80 dark:text-rose-400/70 mt-2 inline-flex items-center gap-1">
                        <AlertCircle size={12} strokeWidth={3}/> {sm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'unpaid'}
                      </p>
                    </div>
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">{language === 'বাংলা' ? 'আংশিক' : 'Partial'}</p>
                      <p className={`${kpiValueSize(sm.partialCount)} font-black text-amber-700 dark:text-amber-400 tabular-nums mt-1.5 leading-none truncate`}>{sm.partialCount}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-amber-700/80 dark:text-amber-400/70 mt-2 inline-flex items-center gap-1">
                        <Hourglass size={12} strokeWidth={3}/> {language === 'বাংলা' ? 'আংশিক পেমেন্ট' : 'partially paid'}
                      </p>
                    </div>
                    <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-3.5 md:p-4">
                      <p className="text-[10px] md:text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                      <p className={`${kpiValueSize(formatBDT(sm.expectedTotal))} font-black text-blue-700 dark:text-blue-400 tabular-nums mt-1.5 leading-none truncate`}>{formatBDT(sm.expectedTotal)}</p>
                      <p className="text-[10px] md:text-[11px] font-bold text-blue-700/80 dark:text-blue-400/70 mt-2 inline-flex items-center gap-1">
                        <Calendar size={12} strokeWidth={3}/> {sm.totalDueCount} {language === 'বাংলা' ? 'ভাড়াটিয়া' : 'tenants'}
                      </p>
                    </div>
                  </div>

                  {/* Portfolio Breakdown (Multi mode only) */}
                  {effectiveLandlordProfile?.buildingMode === 'multi' && !currentBuildingId && (
                    <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
                      <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                        {language === 'বাংলা' ? 'বিল্ডিং অনুযায়ী কালেকশন' : 'Collection by Building'}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                        {(effectiveLandlordProfile.buildings || []).map(bldg => {
                          const bldgBookings = bookings.filter(b => bookingInBuilding(b, bldg));
                          const bldgRentUnits = bldgBookings.flatMap(rentUnitsOf);
                          const bldgSm = getMonthCollectionSummary(bldgRentUnits, todayDate.getFullYear(), todayDate.getMonth() + 1, todayDate);
                          const bldgPct = bldgSm.expectedTotal > 0 ? Math.min(100, Math.round((bldgSm.collectedTotal / bldgSm.expectedTotal) * 100)) : 0;
                          
                          return (
                            <div key={bldg.id} className="bg-gray-50/80 dark:bg-gray-800/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:border-[#ba0036]/30 hover:shadow-md transition-all">
                              <h4 className="text-sm font-black text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                                <span className="truncate pr-2">{bldg.name}</span>
                                {bldgSm.overdueCount > 0 && (
                                  <span className="text-[9px] font-black bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                    {bldgSm.overdueCount} {language === 'বাংলা' ? 'বকেয়া' : 'Overdue'}
                                  </span>
                                )}
                              </h4>
                              
                              {/* Two rows, not "collected / expected" on one
                                  line: these cards sit two-up on a phone, and at
                                  a readable size a six-figure pair does not fit
                                  across one. It was truncating the expected
                                  figure to an ellipsis — the number the landlord
                                  is measuring against, gone. */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 space-y-1">
                                  <div>
                                    <p className="text-[10px] font-black text-emerald-700/80 dark:text-emerald-400/80 uppercase tracking-wider leading-none">{language === 'বাংলা' ? 'আদায়' : 'Collected'}</p>
                                    <p className={`${bldgValueSize(formatBDT(bldgSm.collectedTotal))} font-black text-gray-900 dark:text-gray-100 tabular-nums leading-tight whitespace-nowrap`}>{formatBDT(bldgSm.collectedTotal)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider leading-none">{language === 'বাংলা' ? 'প্রত্যাশিত' : 'Expected'}</p>
                                    <p className={`${bldgValueSize(formatBDT(bldgSm.expectedTotal))} font-black text-gray-500 dark:text-gray-400 tabular-nums leading-tight whitespace-nowrap`}>{formatBDT(bldgSm.expectedTotal)}</p>
                                  </div>
                                </div>
                                <span className="text-lg font-black text-[#ba0036] dark:text-rose-400 tabular-nums shrink-0">{bldgPct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                                <div className="h-full rounded-full bg-gradient-to-r from-[#ba0036] to-[#ff004c] dark:from-rose-500 dark:to-rose-400 transition-all duration-700" style={{ width: `${bldgPct}%` }} />
                              </div>

                              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded">{bldgSm.paidCount} {language === 'বাংলা' ? 'ক্লিয়ার' : 'Cleared'}</span>
                                <span className="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded">{bldgSm.totalDueCount - bldgSm.paidCount} {language === 'বাংলা' ? 'বাকি' : 'Due'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}



            {/* ১.২ দ্রুত অ্যাকশন — ৪ টাইল, সহজ ও কেন্দ্রস্থ। */}
            <div data-tour="host-quick-actions" className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800/60 rounded-2xl md:rounded-[1.5rem] p-4 md:p-5 shadow-[0_4px_25px_rgba(0,0,0,0.02)] dark:shadow-none">
              <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-4">
                {language === 'বাংলা' ? 'জরুরী কাজ' : 'Quick Actions'}
              </h3>
              <div className="grid grid-cols-4 gap-[clamp(0.375rem,2vw,1rem)] items-stretch">
                {[
                  { id: 'add_tenant', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">ভাড়াটিয়া<br />যোগ করুন</span><span className="hidden md:block">ভাড়াটিয়া যোগ করুন</span></> : <><span className="md:hidden block leading-tight">Add<br />Tenant</span><span className="hidden md:block">Add Tenant</span></>,       Icon: Calendar,      iconColor: 'text-gray-500 dark:text-gray-400',     onClick: () => setActiveTab('bookings'), showOn: 'all' },
                  { id: 'rent_collection', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">ভাড়া<br />কালেকশন</span><span className="hidden md:block">ভাড়া কালেকশন</span></> : <><span className="md:hidden block leading-tight">Rent<br />Collection</span><span className="hidden md:block">Rent Collection</span></>, Icon: Wallet,        iconColor: 'text-gray-500 dark:text-gray-400', onClick: () => setActiveTab('rent'), showOn: 'all' },
                  { id: 'messages', label: language === 'বাংলা' ? 'মেসেজ' : 'Messages',     Icon: MessageCircle, iconColor: 'text-gray-500 dark:text-gray-400', onClick: () => navigate('/messages'), showOn: 'desktop' },
                  { id: 'payment_settings', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">পেমেন্ট<br />সেটিংস</span><span className="hidden md:block">পেমেন্ট সেটিংস</span></> : <><span className="md:hidden block leading-tight">Payment<br />Settings</span><span className="hidden md:block">Payment Settings</span></>, Icon: CreditCard, iconColor: 'text-gray-500 dark:text-gray-400', onClick: () => setActiveTab('payments'), showOn: 'mobile' },
                  { id: 'smart_alerts', label: language === 'বাংলা' ? <><span className="md:hidden block leading-tight">স্মার্ট<br />অ্যালার্ট</span><span className="hidden md:block">স্মার্ট অ্যালার্ট</span></> : <><span className="md:hidden block leading-tight">Smart<br />Alerts</span><span className="hidden md:block">Smart Alerts</span></>, Icon: BellRing,      iconColor: 'text-gray-500 dark:text-gray-400',   onClick: () => setActiveTab('smartAlerts'), showOn: 'all' },
                ].map(({ id, label, Icon, iconColor, onClick, showOn }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={onClick}
                    className={`group min-w-0 w-full overflow-hidden flex-col items-center justify-start gap-[clamp(0.375rem,2vw,0.75rem)] px-[clamp(0.25rem,1.5vw,1.25rem)] py-[clamp(0.625rem,2.5vw,1.25rem)] rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-transparent dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 active:scale-95 transition-all duration-300 ${showOn === 'mobile' ? 'flex md:hidden' : showOn === 'desktop' ? 'hidden md:flex' : 'flex'}`}
                  >
                    <Icon strokeWidth={2.2} className={`shrink-0 w-[clamp(20px,5.5vw,26px)] h-[clamp(20px,5.5vw,26px)] ${iconColor} group-hover:scale-110 transition-transform duration-300`} />
                    <span className="w-full block text-[clamp(9px,2.6vw,0.875rem)] font-bold text-gray-700 dark:text-gray-300 text-center leading-snug break-words hyphens-auto">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

              </>
            )}
            {/* ২. আরও অ্যাকশন — কোলাপসিবল। আগে এখানে ৪টি বাটনের আলাদা সেকশন ছিল,
                যা উপরের দ্রুত অ্যাকশন সারির সাথে মিলে ডুপ্লিকেট মনে হতো। সব
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

          </div>
        )}

        {/* Combined section toggle — Documents ⇄ Analytics under one sidebar
            entry, mirroring the Booking ⇄ Rent Collection switch. */}
        {(activeTab === 'documents' || activeTab === 'analytics') && (
          <div className="w-full mb-4 md:mb-5 animate-in fade-in duration-300">
            <div className="flex items-stretch gap-1.5 p-1.5 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-gray-100">
              {[
                { id: 'documents', label: language === 'বাংলা' ? 'ডকুমেন্ট' : 'Documents' },
                { id: 'analytics', label: language === 'বাংলা' ? 'অ্যানালিটিক্স' : 'Analytics' },
              ].map(({ id, label }) => {
                const on = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex items-center justify-center py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-black tracking-tight transition-all duration-300 ${on ? 'bg-gradient-to-r from-[#ba0036] to-[#ff004c] text-white shadow-[0_8px_22px_rgba(186,0,54,0.35)]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 🔴 DOCUMENT VAULT TAB */}
        {activeTab === 'documents' && (
          <DocumentsTab
            activeTab={activeTab} t={t} language={language} today={today} bookings={bookings}
            properties={properties} documents={documents} leaseStageFilter={leaseStageFilter}
            setLeaseStageFilter={setLeaseStageFilter} activeFolder={activeFolder} setActiveFolder={setActiveFolder}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery} openModal={openModal}
            handleDocDownload={handleDocDownload} handleDocPreview={handleDocPreview} handleDocDelete={handleDocDelete}
            formatDate={formatDate} computeLeaseStage={computeLeaseStage} uploadedDocs={uploadedDocs}
          />
        )}

        {/* 🔴 NEW: ANALYTICS OVERVIEW TAB */}
        {/* 🔴 ANALYTICS OVERVIEW — futuristic, ledger-driven */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            today={today}
            ledgerYear={ledgerYear}
            setLedgerYear={setLedgerYear}
            bookings={bookings}
            properties={properties}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            rentPriorityFilter={rentPriorityFilter}
            setRentPriorityFilter={setRentPriorityFilter}
            language={language}
            handleCallUser={handleCallUser}
            openChatPanel={openChatPanel}
            enumerateLeaseMonths={enumerateLeaseMonths}
            getDueDate={getDueDate}
            computeLeaseStage={computeLeaseStage}
            isLeaseEndingSoon={isLeaseEndingSoon}
            formatBDT={formatBDT}
            monthShortLabel={monthShortLabel}
          />
        )}

        {/* 🔴 INQUIRIES TAB */}
        {activeTab === 'inquiries' && (
          <InquiriesTab
            activeTab={activeTab} t={t} language={language} inquiries={inquiries} setInquiries={setInquiries}
            inquiryTab={inquiryTab} setInquiryTab={setInquiryTab} hostStats={hostStats} isPremium={isPremium}
            expandedHostInquiryId={expandedHostInquiryId} setExpandedHostInquiryId={setExpandedHostInquiryId}
            inquiryReplies={inquiryReplies} setInquiryReplies={setInquiryReplies} replyingId={replyingId}
            sendInquiryReply={sendInquiryReply} acceptInquiry={acceptInquiry} rejectInquiry={rejectInquiry}
            cutInquiry={cutInquiry} openConvertInquiry={openConvertInquiry} hostRespondVisit={hostRespondVisit}
            markInquirySeen={markInquirySeen} inqSeen={inqSeen} setInqSeen={setInqSeen} openChatPanel={openChatPanel}
            handleCallUser={handleCallUser} openTenantProfile={openTenantProfile} showToast={showToast}
            isInquiryUnread={isInquiryUnread} openModal={openModal}
          />
        )}
        
        {/* ─────────────────────────────────────────────────────────────────
            🔴 BOOKINGS TAB — Lease Management (agreement metadata only)
            ─────────────────────────────────────────────────────────────────
            The Bookings tab is now exclusively about the *contract* between
            host and tenant: term length, move-in / expiry dates, deposits,
            service charge, next payment date, and auto-reminder cadence.
            Month-by-month rent collection (12-month matrix, mark-paid modal,
            collection summaries, overdue list) lives on the new
            `rent` tab — they share the same `bookings` state + helpers, so
            both tabs always reflect the same source of truth. */}
        {/* Combined section toggle — Booking ⇄ Rent Collection. Both views use
            the same `bookings` state, so they share one sidebar entry with this
            segmented switch pinned on top. */}
        {(activeTab === 'bookings' || activeTab === 'rent') && (
          <div className="w-full mb-3 md:mb-5 animate-in fade-in duration-300">
            {/* Mobile back button — replaces bottom nav which is hidden on these tabs */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="lg:hidden flex items-center gap-1.5 mb-3 px-1 py-1 text-xs font-black text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>{language === 'বাংলা' ? 'ড্যাশবোর্ডে ফিরুন' : 'Back to Dashboard'}</span>
            </button>
            {/* Slim on mobile: this switch used to eat ~74px above the fold on a
                phone. Tighter padding + a smaller label keeps a comfortable tap
                target while handing those pixels back to the list below.
                Desktop (sm+) keeps the roomy original. */}
            <div className="flex items-stretch gap-1 p-1 sm:gap-1.5 sm:p-1.5 rounded-xl sm:rounded-2xl bg-white dark:bg-gray-900/40 shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-none border border-gray-100 dark:border-gray-800/60">
              {[
                { id: 'bookings', label: language === 'বাংলা' ? 'ভাড়াটিয়া যোগ করুন' : 'Add Tenant', Icon: Calendar },
                { id: 'rent', label: language === 'বাংলা' ? 'ভাড়া কালেকশন' : 'Rent Collection', Icon: Wallet },
              ].map(({ id, label, Icon }) => {
                const on = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 sm:py-4 rounded-lg sm:rounded-xl text-xs sm:text-base font-black tracking-tight transition-all duration-300 ${on ? 'bg-gray-900 text-white dark:bg-gray-700 dark:text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'}`}
                  >
                    <Icon size={14} className="shrink-0 sm:hidden" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <BookingsTab
            today={today}
            bookings={bookings}
            language={language}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            leaseStageFilter={leaseStageFilter}
            setLeaseStageFilter={setLeaseStageFilter}
            expandedBookingId={expandedBookingId}
            setExpandedBookingId={setExpandedBookingId}
            activeDropdownId={activeDropdownId}
            setActiveDropdownId={setActiveDropdownId}
            confirmDeleteBookingId={confirmDeleteBookingId}
            setConfirmDeleteBookingId={setConfirmDeleteBookingId}
            handleCallUser={handleCallUser}
            resolveTenantUserId={resolveTenantUserId}
            setActiveTab={setActiveTab}
            setExpandedRentId={setExpandedRentId}
            downloadAgreement={downloadAgreement}
            t={t}
            showToast={showToast}
            toggleAutoReminder={toggleAutoReminder}
            openTenantProfile={openTenantProfile}
            openChatPanel={openChatPanel}
            openModal={openModal}
            isPremium={isPremium}
            openBlankLease={openBlankLease}
            setActiveModal={setActiveModal}
            handleBookingUpdated={handleBookingUpdated}
            getLeaseSummary={getLeaseSummary}
            computeLeaseStage={computeLeaseStage}
            isLeaseEndingSoon={isLeaseEndingSoon}
            leaseDaysLeft={leaseDaysLeft}
            isOpenEndedLease={isOpenEndedLease}
            leaseMonthsRunning={leaseMonthsRunning}
            openTenantChangeLease={openTenantChangeLease}
            openEditLease={openEditLease}
            formatBDT={formatBDT}
            daysUntilNextDue={daysUntilNextDue}
            computeBookingProgress={computeBookingProgress}
            isHostelBooking={isHostelBooking}
            formatDate={formatDate}
            stageLabel={stageLabel}
            landlordProfile={effectiveLandlordProfile}
            onBuildingCreated={handleBuildingCreated}
            refreshBookings={refreshBookings}
            setLandlordProfile={persistLandlordProfile}
            currentBuildingId={currentBuildingId}
            setCurrentBuildingId={setCurrentBuildingId}
          />
        )}
        {/* ─────────────────────────────────────────────────────────────────
            🔴 RENT COLLECTION TAB — Shared Ledger (rent payment tracking)
            ─────────────────────────────────────────────────────────────────
            Replaces the host's rent-tracking spreadsheet. Compact accordion
            rows surface the 12-month matrix on tap, so a 50-tenant portfolio
            fits on one screen at a glance. KPI hero collapses to a 1-line
            banner on mobile. Sticky toolbar keeps search + priority filters
            pinned while scrolling. "Needs Attention" group auto-pins overdue
            and partial tenants to the top — the answer to "who hasn't paid"
            without scrolling.

            All payment logic — rent ledger updates, cross-system receipts to
            TenantDashboard, auto-reminder cron, the 2-step Mark-Paid modal —
            is inherited from the original rent flow and remains untouched.
            Only the rendering layer is compact-mode. */}
        {activeTab === 'rent' && (
          <RentTab
            today={today}
            bookings={bookings}
            language={language}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            rentPriorityFilter={rentPriorityFilter}
            setRentPriorityFilter={setRentPriorityFilter}
            expandedRentId={expandedRentId}
            setExpandedRentId={setExpandedRentId}
            activeDropdownId={activeDropdownId}
            setActiveDropdownId={setActiveDropdownId}
            handleCallUser={handleCallUser}
            resolveTenantUserId={resolveTenantUserId}
            setActiveTab={setActiveTab}
            t={t}
            openMarkPaid={openMarkPaid}
            markRoomPaid={markRoomPaid}
            ledgerYear={ledgerYear}
            setLedgerYear={setLedgerYear}
            rentUnitsOf={rentUnitsOf}
            getMonthCollectionSummary={getMonthCollectionSummary}
            enumerateLeaseMonths={enumerateLeaseMonths}
            getRentStatus={getRentStatus}
            monthKey={monthKey}
            monthFullLabel={monthFullLabel}
            monthShortLabel={monthShortLabel}
            getDueDate={getDueDate}
            parseMonthKey={parseMonthKey}
            formatBDT={formatBDT}
            formatDate={formatDate}
            computeBookingStatus={computeBookingStatus}
            daysUntilNextDue={daysUntilNextDue}
            computeLeaseStage={computeLeaseStage}
            isOpenEndedLease={isOpenEndedLease}
            sendRentReminder={sendRentReminder}
            openTenantProfile={openTenantProfile}
            openChatPanel={openChatPanel}
            setActiveModal={setActiveModal}
            exportRentCsv={exportRentCsv}
            isPremium={isPremium}
            landlordProfile={effectiveLandlordProfile}
            onBuildingCreated={handleBuildingCreated}
            refreshBookings={refreshBookings}
            setLandlordProfile={persistLandlordProfile}
            currentBuildingId={currentBuildingId}
            setCurrentBuildingId={setCurrentBuildingId}
          />
        )}
        {/* 🔴 PROPERTIES GRID (Only for 'properties' tab) */}
        {activeTab === 'properties' && (
          <PropertiesTab
             activeTab={activeTab} t={t} language={language} properties={properties}
             isPropertiesLoading={isPropertiesLoading} propertyLoadError={propertyLoadError}
             retryLoadProperties={retryLoadProperties} filteredPropertiesByStatus={filteredPropertiesByStatus}
             propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} showToast={showToast}
             handleBoost={handleBoost} togglePropertyStatus={togglePropertyStatus}
             handleDeleteProperty={handleDeleteProperty} openModal={openModal}
             setActiveTab={setActiveTab} navigate={navigate} isRecent={isRecent}
             rentedDaysLeft={rentedDaysLeft} getRoomTypes={getRoomTypes} firstRoomTypeId={firstRoomTypeId}
             formatBDT={formatBDT} formatDate={formatDate} roomLabel={roomLabel} userData={userData}
             showBoostButton={showBoostButton} boostStatus={boostStatus} boostingId={boostingId}
          />
        )}

        {/* ─────────────────────────────────────────────────────────────────
            🔴 NEW TABS (Smart Alerts, AI Insights, Settings)
            Help & Support links out to the shared /support page.
            ───────────────────────────────────────────────────────────────── */}
        {/* 🟢 PAYMENT SETTINGS TAB — V1 manual rent: pending verification + payout accounts */}
        {activeTab === 'payments' && (
          <PaymentsTab
            refreshPendingRent={refreshPendingRent}
            setPaymentMethods={setPaymentMethods}
          />
        )}

        {activeTab === 'smartAlerts' && (
          <div className="w-full h-[calc(100vh-120px)] animate-in fade-in zoom-in-95 duration-500 overflow-y-auto">
             <Smartalertspage
               bookings={bookings}
               inquiries={inquiries}
               today={today}
               onMessageTenant={(alert) => {
                 let chatId = `chat-${alert.bookingId || alert.inquiryId || Date.now()}`;
                 let peerUserId = null;
                 if (alert.category === 'inquiry' && alert.inquiryId) {
                   const inq = inquiries.find(i => i.id === alert.inquiryId);
                   if (inq) { chatId = inq.chatId || chatId; peerUserId = inq.inquirerUserId; }
                 } else if (alert.bookingId) {
                   const b = bookings.find(b => b.id === alert.bookingId);
                   if (b) { chatId = b.chatId || chatId; peerUserId = b.tenantId; }
                 }
                 openChatPanel(chatId, {
                   source: 'smart-alerts',
                   tenantName: alert.tenant,
                   tenantPhone: alert.phone,
                   peerUserId
                 });
               }}
             />
          </div>
        )}

        {activeTab === 'aiInsights' && (
          <div className="w-full h-[calc(100vh-120px)] animate-in fade-in zoom-in-95 duration-500 overflow-y-auto">
             <Aiinsightspage />
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsTab />
        )}

      </main>

      {/* MEDIA LIGHTBOX */}
      <MediaLightbox open={!!lightbox} media={lightbox} onClose={() => setLightbox(null)} />

      {/* Whose letterhead goes on this document — asked at download time. */}
      {agreementFor && (
        <AgreementBrandModal
          booking={agreementFor.booking}
          member={agreementFor.member}
          people={activeMembers(agreementFor.booking)}
          brand={landlordProfile?.brand}
          language={language}
          onClose={() => setAgreementFor(null)}
          onDownload={confirmAgreementDownload}
          uploadLogo={uploadBrandLogo}
          showToast={showToast}
        />
      )}


      {/* 🔴 DYNAMIC MODALS
          z-140, not z-100. These are SECOND modals: mark-paid is opened from
          inside the Rent tab's room modal (z-110), and at z-100 it rendered
          underneath it — the landlord tapped "Mark Paid", the form opened
          behind the room they were looking at, and nothing appeared to happen.
          A modal summoned by another modal has to stack above it. Still below
          the delete confirmation (z-200) and the AI scanner (z-9999), which are
          themselves opened from here. */}
      {activeModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-[0_30px_60px_rgba(0,0,0,0.15)] overflow-hidden relative animate-in zoom-in-95 duration-300">
            
            <div className="px-6 py-5 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black text-gray-900 capitalize">
                {activeModal === 'select_year' && (language === 'বাংলা' ? 'বছর নির্বাচন করুন' : 'Select Year')}
                {activeModal === 'full_report' && (language === 'বাংলা' ? 'পূর্ণাঙ্গ রিপোর্ট' : 'Full Report')}
                {activeModal === 'update_inquiry' && (language === 'বাংলা' ? 'ভিজিট যোগ করুন' : 'Add Visit')}
                {activeModal === 'create_lease' && (leaseForm.editingBookingId
                  ? (language === 'বাংলা' ? 'লিজ এডিট করুন' : 'Edit Lease')
                  : leaseForm.replacesBookingId
                    ? (language === 'বাংলা' ? 'নতুন ভাড়াটিয়া · নতুন লিজ' : 'New Tenant · New Lease')
                    : (language === 'বাংলা' ? 'নতুন লিজ তৈরি করুন' : 'Create New Lease'))}
                {activeModal === 'edit' && (t?.editPropertyTitle || (language === 'বাংলা' ? 'প্রপার্টি এডিট করুন' : 'Edit Property'))}
                {activeModal === 'lease' && (t?.leaseAgreementTitle || (language === 'বাংলা' ? 'লিজ এগ্রিমেন্ট' : 'Lease Agreement'))}
                {activeModal === 'settings' && (t?.accountSettingsTitle || (language === 'বাংলা' ? 'অ্যাকাউন্ট সেটিংস' : 'Account Settings'))}
                {activeModal === 'support' && (t?.helpSupportTitle || (language === 'বাংলা' ? 'হেল্প এবং সাপোর্ট' : 'Help & Support'))}
                {activeModal === 'upload_document' && (language === 'বাংলা' ? 'ডকুমেন্ট আপলোড' : 'Upload Document')}
                {activeModal === 'message_all' && (language === 'বাংলা' ? 'ব্রডকাস্ট মেসেজ' : 'Broadcast Message')}
                {activeModal === 'export_report' && (language === 'বাংলা' ? 'রিপোর্ট এক্সপোর্ট' : 'Export Report')}
                {activeModal === 'send_reminders' && (language === 'বাংলা' ? 'পেমেন্ট রিমাইন্ডার' : 'Payment Reminders')}
                {activeModal === 'download_user_document' && (language === 'বাংলা' ? 'ভাড়াটিয়ার ডকুমেন্ট' : 'Tenant Documents')}
                {activeModal === 'confirm_delete' && (language === 'বাংলা' ? 'প্রপার্টি মুছুন' : 'Delete Property')}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 bg-white hover:bg-red-50 hover:text-red-500 rounded-full transition-all shadow-sm"><X size={18} /></button>
            </div>

            {activeModal === 'confirm_delete' && deleteTarget && (
              <div className="p-6 space-y-5" role="alertdialog" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-desc">
                {/* Property preview */}
                <div className="flex items-center gap-4 p-4 bg-red-50/60 border border-red-100 rounded-2xl">
                  {(deleteTarget.img || deleteTarget.coverPhoto) ? (
                    <img
                      src={deleteTarget.img || deleteTarget.coverPhoto}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                      <Building2 size={24} className="text-red-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p id="delete-confirm-title" className="text-sm font-black text-gray-900 truncate">{deleteTarget.title}</p>
                    <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={10} className="text-[#ba0036]" /> {deleteTarget.location}</p>
                  </div>
                </div>

                {/* Warning */}
                <div id="delete-confirm-desc" className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-amber-800">
                        {language === 'বাংলা' ? 'এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না' : 'This action cannot be undone'}
                      </p>
                      <p className="text-[10px] font-bold text-amber-700 mt-1 leading-relaxed">
                        {language === 'বাংলা'
                          ? 'এই প্রপার্টির সাথে সম্পর্কিত সকল ইনকোয়ারি, বুকিং (চলমান লিজ সহ) এবং রসিদ সম্পূর্ণভাবে মুছে যাবে।'
                          : 'All related inquiries, bookings (including active leases), and receipts will be permanently removed.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setActiveModal(null); setDeleteTarget(null); }}
                    className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    {language === 'বাংলা' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmDeleteProperty}
                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_6px_15px_rgba(220,38,38,0.3)] flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
                    {language === 'বাংলা' ? 'মুছে ফেলুন' : 'Delete Permanently'}
                  </button>
                </div>
              </div>
            )}

            {activeModal === 'upload_document' && (
                <div className="space-y-5 p-6">
                  {activeFolder ? (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ফোল্ডার' : 'Folder'}</label>
                      <div className="w-full mt-1.5 p-4 bg-gray-100 rounded-xl text-sm font-bold text-gray-900 flex items-center gap-2">
                        <activeFolder.icon size={16} className="text-gray-600" />
                        {language === 'বাংলা' ? activeFolder.bn : activeFolder.en}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ফোল্ডার নির্বাচন করুন' : 'Select Folder'}</label>
                      <select value={uploadForm.folder} onChange={e => setUploadForm(f => ({ ...f, folder: e.target.value }))} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-transparent focus:border-[#ba0036]/20 transition-all cursor-pointer appearance-none">
                        <option value="agreements">{language === 'বাংলা' ? 'রেন্টাল এগ্রিমেন্ট' : 'Rental Agreements'}</option>
                        <option value="nids">{language === 'বাংলা' ? 'ভাড়াটিয়া NID / আইডি' : 'Tenant NID / IDs'}</option>
                        <option value="payments">{language === 'বাংলা' ? 'পেমেন্ট রেকর্ড' : 'Payment Records'}</option>
                        <option value="legal">{language === 'বাংলা' ? 'লিগ্যাল ডকুমেন্টস' : 'Legal Documents'}</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'কোন ভাড়াটিয়া? (ঐচ্ছিক)' : 'Which tenant? (optional)'}</label>
                    <select value={uploadForm.bookingId} onChange={e => setUploadForm(f => ({ ...f, bookingId: e.target.value }))} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-transparent focus:border-[#ba0036]/20 transition-all cursor-pointer appearance-none">
                      <option value="">{language === 'বাংলা' ? '— কোনো ভাড়াটিয়া নয় —' : '— No tenant —'}</option>
                      {/* Named by the people actually in the unit, and by the
                          ROOM. Reading booking.tenant here printed a bare
                          "ভাড়াটিয়া — White-house" for every seat-rented room,
                          so a hostel with ten rooms offered ten identical
                          options and picking the right one was guesswork. */}
                      {sortByBuildingOrder(bookings.filter(b => b.status !== 'cancelled')).map(b => {
                        const who = occupantNames(b);
                        const label = who.length
                          ? who.slice(0, 2).join(', ') + (who.length > 2 ? ` +${who.length - 2}` : '')
                          : (String(b.tenant || '').trim() || (language === 'বাংলা' ? 'ভাড়াটিয়া নেই' : 'No tenant'));
                        const where = [
                          b.roomNumber ? `${language === 'বাংলা' ? 'রুম' : 'Room'} ${b.roomNumber}` : '',
                          b.property || '',
                        ].filter(Boolean).join(' · ');
                        return <option key={b.id} value={b.id}>{label}{where ? ` — ${where}` : ''}</option>;
                      })}
                    </select>
                    {bookings.filter(b => b.status !== 'cancelled').length === 0 && (
                      <p className="text-[10px] font-bold text-gray-400 mt-1.5">{language === 'বাংলা' ? 'এখনো কোনো সক্রিয় ভাড়াটিয়া নেই — চাইলে ভাড়াটিয়া ছাড়াই আপলোড করুন।' : 'No active tenants yet — you can still upload without one.'}</p>
                    )}
                  </div>

                  {/* The name the landlord will look for later. Prefilled from
                      the file when one is picked, but editable — "মামুনুর NID"
                      is findable, "IMG_20260830.jpg" is not. */}
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ডকুমেন্টের নাম' : 'Document name'}</label>
                    <input
                      type="text"
                      value={uploadForm.docName}
                      maxLength={120}
                      onChange={e => setUploadForm(f => ({ ...f, docName: e.target.value }))}
                      placeholder={language === 'বাংলা' ? 'যেমন: মামুনুরের NID কপি' : 'e.g. Mamunur — NID copy'}
                      className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-transparent focus:border-[#ba0036]/20 transition-all placeholder:text-gray-400 placeholder:font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{language === 'বাংলা' ? 'ফাইল সিলেক্ট করুন' : 'Choose File'}</label>
                    <label className={`border-2 border-dashed ${uploadForm.error ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-[#ba0036] hover:bg-red-50/30'} rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group`}>
                       <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={e => {
                         const file = e.target.files && e.target.files[0];
                         if (!file) {
                           setUploadForm(f => ({ ...f, file: null, error: null }));
                           return;
                         }
                         const ok = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(file.type || '') || /\.(pdf|docx?|jpe?g|png|webp|gif)$/i.test(file.name);
                         if (!ok) {
                           setUploadForm(f => ({ ...f, file: null, error: language === 'বাংলা' ? 'ভুল ফরম্যাট! শুধু PDF, DOCX বা ছবি (JPG/PNG) আপলোড করুন।' : 'Invalid format! Please upload a PDF, DOCX, or Image (JPG, PNG).' }));
                           e.target.value = null;
                           return;
                         }
                         // Seed the name from the file, but never overwrite a
                         // name the landlord has already typed.
                         setUploadForm(f => ({
                           ...f,
                           file,
                           error: null,
                           docName: f.docName || file.name.replace(/\.[^.]+$/, ''),
                         }));
                       }} />
                       <UploadCloud size={32} className={`${uploadForm.error ? 'text-red-400' : 'text-gray-400 group-hover:text-[#ba0036]'} mb-3 transition-colors`} />
                       {uploadForm.error ? (
                         <p className="text-sm font-black text-red-600 mb-1 px-2">{uploadForm.error}</p>
                       ) : (
                         <p className="text-sm font-black text-gray-900 mb-1 break-all px-2">{uploadForm.file ? uploadForm.file.name : (language === 'বাংলা' ? 'পিডিএফ, DOCX বা ছবি আপলোড করুন' : 'Upload PDF, DOCX or Image')}</p>
                       )}
                       <p className="text-[10px] text-gray-500 font-bold">{uploadForm.file ? `${(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB` : (language === 'বাংলা' ? 'সর্বোচ্চ সাইজ: 10MB' : 'Max size: 10MB')}</p>
                    </label>
                  </div>

                  <button onClick={handleDocUpload} disabled={uploadingDoc} className="w-full mt-2 bg-gray-900 text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(0,0,0,0.1)] hover:bg-[#ba0036] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {uploadingDoc
                      ? (language === 'বাংলা' ? 'আপলোড হচ্ছে...' : 'Uploading...')
                      : (<><Check size={18} /> {language === 'বাংলা' ? 'আপলোড কমপ্লিট করুন' : 'Complete Upload'}</>)}
                  </button>
                </div>
              )}
            
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {activeModal === 'select_year' && (
                <div className="grid grid-cols-2 gap-3">
                  {['2023', '2024', '2025', '2026', '2027', '2028'].map(year => (
                     <button key={year} onClick={() => { showToast(language === 'বাংলা' ? `${year} সিলেক্ট করা হয়েছে` : `${year} Selected`); setActiveModal(null); }} className="py-4 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-lg font-black text-gray-700 transition-all border border-gray-100 hover:border-blue-200">
                       {year}
                     </button>
                  ))}
                </div>
              )}

              {activeModal === 'send_reminders' && (() => {
                // Overdue + partial tenants for the CURRENT month, derived from
                // the live rent ledger (buildReminderRows). Until a lease is
                // actually in arrears the host sees a clean "all caught up" panel.
                const { rows } = buildReminderRows();
                const selectedRows = rows.filter((r) => reminderSelected.has(r.booking.id));
                const totalDue = selectedRows.reduce((acc, r) => acc + r.due, 0);

                if (rows.length === 0) {
                  return (
                    <div className="space-y-4">
                      <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center">
                        <CheckCheck size={28} className="text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-black text-green-700">
                          {language === 'বাংলা' ? 'সকল ভাড়া পরিশোধিত!' : 'All rents are up to date.'}
                        </p>
                        <p className="text-[10px] font-bold text-green-600 mt-1">
                          {language === 'বাংলা' ? 'এই মুহূর্তে রিমাইন্ডার পাঠানোর প্রয়োজন নেই।' : 'No reminders need to be sent right now.'}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveModal(null)}
                        className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                      >
                        {language === 'বাংলা' ? 'বন্ধ করুন' : 'Close'}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
                      <BellRing size={20} className="text-[#ba0036] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-black text-[#ba0036]">
                          {language === 'বাংলা'
                            ? `${rows.length} জন ভাড়াটিয়ার পেমেন্ট বকেয়া আছে`
                            : `${rows.length} tenant(s) have pending dues`}
                        </p>
                        <p className="text-[10px] font-bold text-red-700 mt-0.5">
                          {language === 'বাংলা' ? 'নির্বাচিত বকেয়ার পরিমাণ: ' : 'Selected due amount: '}{formatBDT(totalDue)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        {language === 'বাংলা' ? 'যাদের রিমাইন্ডার পাঠানো হবে' : 'Recipients'}
                      </label>
                      {rows.map(({ booking, due }) => {
                        const linked = !!resolveTenantUserId(booking);
                        return (
                          <label key={booking.id} className={`flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 ${linked ? 'cursor-pointer' : 'opacity-70'}`}>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={reminderSelected.has(booking.id)}
                                onChange={() => toggleReminder(booking.id)}
                                disabled={!linked}
                                className="w-4 h-4 rounded text-[#ba0036] focus:ring-[#ba0036] cursor-pointer disabled:cursor-not-allowed"
                              />
                              <div>
                                <p className="text-xs font-black text-gray-900">{booking.tenant || booking.tenantName || '—'}</p>
                                <p className="text-[9px] font-bold text-gray-500">
                                  {language === 'বাংলা' ? 'বকেয়া: ' : 'Due: '}{formatBDT(due)}
                                  {!linked && (language === 'বাংলা' ? ' · লিংকড অ্যাকাউন্ট নেই' : ' · no linked account')}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-1 rounded">
                              {language === 'বাংলা' ? 'বকেয়া' : 'Pending'}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <p className="text-[10px] font-bold text-gray-400 text-center">
                      {language === 'বাংলা'
                        ? 'রিমাইন্ডার ভাড়াটিয়ার ইন-অ্যাপ চ্যাটে পাঠানো হবে।'
                        : 'Reminders are delivered to each tenant\u2019s in-app chat.'}
                    </p>

                    <button
                      onClick={handleSendReminders}
                      disabled={isSendingReminders || selectedRows.length === 0}
                      className="w-full mt-1 bg-gray-900 text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(0,0,0,0.1)] hover:bg-[#ba0036] hover:-translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900 disabled:hover:translate-y-0"
                    >
                      {isSendingReminders ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          {language === 'বাংলা' ? 'পাঠানো হচ্ছে…' : 'Sending…'}
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          {language === 'বাংলা' ? `রিমাইন্ডার পাঠান (${selectedRows.length})` : `Send Reminder (${selectedRows.length})`}
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              {activeModal === 'export_report' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'রিপোর্টের ধরন' : 'Report Type'}</label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(249,115,22,0.08)] border border-transparent focus:border-orange-500/20 transition-all cursor-pointer appearance-none"
                    >
                      <option value="financial">{language === 'বাংলা' ? 'ফাইন্যান্সিয়াল ওভারভিউ (আয়-ব্যয়)' : 'Financial Overview (Income/Expense)'}</option>
                      <option value="payments">{language === 'বাংলা' ? 'ভাড়াটিয়া পেমেন্ট হিস্ট্রি' : 'Tenant Payment History'}</option>
                      <option value="leases">{language === 'বাংলা' ? 'অ্যাক্টিভ লিজ তালিকা' : 'Active Lease List'}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'সময়কাল' : 'Date Range'}</label>
                    <select
                      value={reportRange}
                      onChange={(e) => setReportRange(e.target.value)}
                      disabled={reportType !== 'financial'}
                      className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(249,115,22,0.08)] border border-transparent focus:border-orange-500/20 transition-all cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="month">{language === 'বাংলা' ? 'চলতি মাস' : 'This Month'}</option>
                      <option value="3months">{language === 'বাংলা' ? 'গত ৩ মাস' : 'Last 3 Months'}</option>
                      <option value="ytd">{language === 'বাংলা' ? 'এই বছর (YTD)' : 'This Year (YTD)'}</option>
                    </select>
                    {reportType !== 'financial' && (
                      <p className="text-[10px] font-bold text-gray-400 mt-1.5">
                        {language === 'বাংলা'
                          ? 'সময়কাল শুধু ফাইন্যান্সিয়াল রিপোর্টে প্রযোজ্য; বাকি রিপোর্টে সব সক্রিয় রেকর্ড থাকে।'
                          : 'Date range applies to the financial report only; the others cover all active records.'}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{language === 'বাংলা' ? 'ফরম্যাট সিলেক্ট করে ডাউনলোড করুন' : 'Select Format to Download'}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={exportReportPDF} className="py-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black transition-all border border-red-100 hover:border-red-200 flex flex-col items-center justify-center gap-1 active:scale-95">
                        <FileText size={20} />
                        <span>PDF Format</span>
                      </button>
                      <button onClick={exportReportCSV} className="py-4 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-black transition-all border border-green-100 hover:border-green-200 flex flex-col items-center justify-center gap-1 active:scale-95">
                        <FileSpreadsheet size={20} />
                        <span>Excel / CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

             {activeModal === 'message_all' && (() => {
                // Real audience = live bookings linked to a tenant account.
                const recipients = getMessagableBookings();
                const count = recipients.length;
                const isImage = !!broadcastFile && String(broadcastFile.type || '').startsWith('image/');
                return (
                <div className="space-y-4">
                  <div className="bg-green-50/80 p-4 rounded-2xl border border-green-100 flex items-start gap-3">
                    <Megaphone size={20} className="text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-green-900">{language === 'বাংলা' ? 'অ্যাক্টিভ ভাড়াটিয়াদের পাঠানো হবে' : 'Sending to your active tenants'}</p>
                      <p className="text-[10px] font-bold text-green-700 mt-0.5">
                        {count > 0
                          ? (language === 'বাংলা' ? `${count} জন ভাড়াটিয়া এই মেসেজ পাবেন।` : `${count} tenant(s) will receive this message.`)
                          : (language === 'বাংলা' ? 'কোনো লিংকড ভাড়াটিয়া নেই — মেসেজ পাঠানো যাবে না।' : 'No linked tenants yet — nothing to send to.')}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{language === 'বাংলা' ? 'আপনার মেসেজ লিখুন' : 'Write your announcement'}</label>
                    <textarea 
                      rows="4" 
                      value={broadcastText}
                      onChange={(e) => setBroadcastText(e.target.value)}
                      placeholder={language === 'বাংলা' ? 'যেমন: আগামীকাল সকাল ১০টা থেকে দুপুর ১২টা পর্যন্ত পানি সরবরাহ বন্ধ থাকবে...' : 'e.g. Water supply will be interrupted tomorrow from 10 AM to 12 PM...'} 
                      className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(22,163,74,0.1)] border border-transparent focus:border-green-500/20 transition-all resize-none custom-scrollbar" 
                    />
                  </div>

                  <div>
                    <input 
                      type="file" 
                      id="broadcast-attachment" 
                      className="hidden" 
                      accept="image/*,.pdf" 
                      onChange={(e) => setBroadcastFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} 
                    />
                    <label 
                      htmlFor="broadcast-attachment" 
                      className="inline-flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 border-dashed rounded-xl text-[11px] font-black text-gray-600 hover:text-green-600 hover:bg-green-50 hover:border-green-300 transition-all cursor-pointer group w-full active:scale-95"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 group-hover:text-green-500 transition-colors">
                        <UploadCloud size={16} />
                      </div>
                      <span className="flex-1 text-left truncate">
                        {broadcastFile
                          ? broadcastFile.name
                          : (language === 'বাংলা' ? 'ছবি আপলোড করুন (ঐচ্ছিক)' : 'Upload Image (Optional)')}
                      </span>
                      {broadcastFile && (
                        <X
                          size={15}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                          onClick={(e) => { e.preventDefault(); setBroadcastFile(null); }}
                        />
                      )}
                    </label>
                    {broadcastFile && !isImage && (
                      <p className="text-[10px] font-bold text-amber-600 mt-1.5">
                        {language === 'বাংলা'
                          ? 'শুধু ছবি চ্যাটে পাঠানো যায় — এই ফাইলটি সংযুক্ত হবে না, শুধু টেক্সট যাবে।'
                          : 'Only images can be delivered in chat — this file won\u2019t be attached; text will still send.'}
                      </p>
                    )}
                  </div>

                  <button 
                    onClick={handleBroadcast}
                    disabled={isBroadcasting || !broadcastText.trim() || count === 0}
                    className="w-full mt-2 bg-green-600 text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(22,163,74,0.2)] hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-[0_12px_20px_rgba(22,163,74,0.3)] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600 disabled:hover:translate-y-0"
                  >
                    {isBroadcasting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        {language === 'বাংলা' ? 'পাঠানো হচ্ছে…' : 'Sending…'}
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        {language === 'বাংলা' ? 'সবার কাছে পাঠান' : 'Send to Everyone'}
                      </>
                    )}
                  </button>
                </div>
                );
              })()}

              {activeModal === 'download_user_document' && (() => {
                // WHAT THIS USED TO BE
                // Four hardcoded cards — "Lease Agreement PDF • 2.4 MB", "NID
                // Copy JPG • 1.1 MB", a payment record, an inspection report —
                // whose only action was a toast saying "Downloading…". Nothing
                // existed behind any of them: the sizes were invented, no
                // inspection-report feature exists at all, and the landlord was
                // left waiting for a file that was never going to arrive.
                //
                // It now shows exactly two truthful things: the agreement, which
                // this app really can generate, and whatever the landlord has
                // actually uploaded to the Document Vault for this tenant.
                const bk = modalData || null;
                const occ = bk ? primaryOccupant(bk, language) : null;
                // Name EVERYONE in the room. Showing only the first occupant
                // read as "these are that person's documents", when the vault
                // for a shared room holds papers for all of them — and the
                // landlord had no way to tell it was showing them a room.
                const roomPeople = bk ? occupantNames(bk) : [];
                const tenantName = roomPeople.length > 1
                  ? roomPeople.join(', ')
                  : (occ?.name || (language === 'বাংলা' ? 'ভাড়াটিয়া' : 'Tenant'));
                const propTitle = bk?.property || (language === 'বাংলা' ? 'প্রপার্টি' : 'Property');
                const roomLine = bk?.roomNumber
                  ? `${language === 'বাংলা' ? 'রুম' : 'Room'} ${bk.roomNumber}${bk.floorNumber ? ` · ${language === 'বাংলা' ? 'ফ্লোর' : 'Floor'} ${bk.floorNumber}` : ''}`
                  : '';
                const initials = (tenantName.trim().charAt(0) || '?').toUpperCase();

                // This tenant's files. Matched on bookingId where the upload
                // recorded one, and on the occupant-name snapshot otherwise —
                // the vault keeps that so a file survives its booking.
                const bkId = String(bk?._id || bk?.id || '');
                const lowerNames = occupantNames(bk).map(n => n.toLowerCase());
                const mine = (documents || []).filter(d => {
                  if (bkId && d.bookingId && String(d.bookingId) === bkId) return true;
                  const dn = String(d.tenantName || '').trim().toLowerCase();
                  return !!dn && lowerNames.includes(dn);
                });

                const FOLDER_LABEL = {
                  agreements: language === 'বাংলা' ? 'এগ্রিমেন্ট' : 'Agreement',
                  nids:       language === 'বাংলা' ? 'এনআইডি' : 'NID',
                  payments:   language === 'বাংলা' ? 'পেমেন্ট' : 'Payment',
                  legal:      language === 'বাংলা' ? 'লিগ্যাল' : 'Legal',
                };
                const typeLabel = (m) => (String(m || '').startsWith('image/') ? 'Image' : (String(m || '').includes('pdf') ? 'PDF' : 'File'));

                return (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-inner overflow-hidden shrink-0">
                        {occ?.avatar ? <img src={occ.avatar} alt={tenantName} className="w-full h-full object-cover" /> : initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">{tenantName}</p>
                        <p className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">
                          {propTitle}{roomLine ? ` · ${roomLine}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Generated on demand — the one document this app builds itself. */}
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                        {language === 'বাংলা' ? 'এখনই তৈরি করুন' : 'Generate now'}
                      </label>
                      <button
                        type="button"
                        disabled={!bk}
                        onClick={() => { setActiveModal(null); downloadAgreement(bk); }}
                        className="w-full p-4 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl text-left transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                      >
                        <FileText size={20} className="text-blue-500 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-black text-gray-900">{language === 'বাংলা' ? 'লিজ এগ্রিমেন্ট' : 'Lease Agreement'}</span>
                          <span className="block text-[9px] font-bold text-gray-500 mt-0.5">
                            {language === 'বাংলা' ? 'লিজের তথ্য থেকে PDF তৈরি হবে' : 'Built as a PDF from this lease'}
                          </span>
                        </span>
                        <Download size={16} className="text-gray-400 shrink-0" />
                      </button>
                    </div>

                    {/* Uploaded to the vault — real files, real sizes. */}
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                        {language === 'বাংলা' ? 'আপলোড করা ফাইল' : 'Uploaded files'}
                        {mine.length > 0 && <span className="ml-1 text-gray-300 tabular-nums">{mine.length}</span>}
                      </label>

                      {loadingDocs ? (
                        <div className="py-8 flex items-center justify-center gap-2 text-gray-400">
                          <RefreshCw size={14} className="animate-spin" />
                          <span className="text-[11px] font-bold">{language === 'বাংলা' ? 'লোড হচ্ছে…' : 'Loading…'}</span>
                        </div>
                      ) : mine.length === 0 ? (
                        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
                          <Folder className="text-gray-300 mx-auto mb-2" size={26} />
                          <p className="text-xs font-black text-gray-600">
                            {language === 'বাংলা' ? 'এই ভাড়াটিয়ার কোনো ফাইল আপলোড করা নেই।' : 'No files uploaded for this tenant.'}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 mt-1 leading-relaxed">
                            {language === 'বাংলা'
                              ? 'এনআইডি, চুক্তির স্ক্যান বা অন্য কাগজ ডকুমেন্ট ভল্টে আপলোড করলে এখানে দেখাবে।'
                              : 'Upload an NID, a signed copy or any other paper to the Document Vault and it will appear here.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => { setActiveModal(null); setActiveTab('documents'); }}
                            className="mt-4 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#ba0036] transition-colors inline-flex items-center gap-1.5 active:scale-95"
                          >
                            <UploadCloud size={13} /> {language === 'বাংলা' ? 'ডকুমেন্ট ভল্টে যান' : 'Open Document Vault'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-0.5">
                          {mine.map(d => (
                            <button
                              key={d.id || d._id}
                              type="button"
                              onClick={() => handleDocDownload(d)}
                              className="w-full p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl text-left transition-all active:scale-[0.99] flex items-center gap-3"
                            >
                              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                                {String(d.fileType || '').startsWith('image/')
                                  ? <ImageIcon size={16} className="text-green-500" />
                                  : <FileText size={16} className="text-blue-500" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-gray-900 truncate">{d.fileName}</p>
                                <p className="text-[9px] font-bold text-gray-500 mt-0.5 tabular-nums">
                                  {FOLDER_LABEL[d.folder] || d.folder} · {typeLabel(d.fileType)}
                                  {d.fileSize > 0 && ` · ${prettyBytes(d.fileSize)}`}
                                </p>
                              </div>
                              <Download size={15} className="text-gray-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={() => setActiveModal(null)} className="w-full bg-gray-100 text-gray-600 hover:bg-gray-200 py-3.5 rounded-xl font-black transition-all text-xs uppercase tracking-widest">
                      {language === 'বাংলা' ? 'বন্ধ করুন' : 'Close'}
                    </button>
                  </div>
                );
              })()}

              {activeModal === 'full_report' && (() => {
                // Derive tenant payment history from real bookings — no
                // hardcoded names. New hosts see an empty-state card.
                const rows = bookings.map(b => {
                  const expectedMonths = Array.isArray(b.ledgerKeys) ? b.ledgerKeys.length : 0;
                  const paidMonths = b.ledger
                    ? Object.values(b.ledger).filter(e => e?.paid && e?.status !== 'due').length
                    : 0;
                  const score = expectedMonths > 0 ? Math.round((paidMonths / expectedMonths) * 100) : 0;
                  let label, color;
                  if (score >= 90)      { label = language === 'বাংলা' ? `সঠিক সময়ে পেইড (${paidMonths}/${expectedMonths})` : `Paid on time (${paidMonths}/${expectedMonths})`; color = 'text-green-500'; }
                  else if (score >= 70) { label = language === 'বাংলা' ? `বিলম্বিত পেমেন্ট (${paidMonths}/${expectedMonths})` : `Late payments (${paidMonths}/${expectedMonths})`; color = 'text-orange-500'; }
                  else                  { label = language === 'বাংলা' ? `পেমেন্ট মিস (${paidMonths}/${expectedMonths})` : `Missed payments (${paidMonths}/${expectedMonths})`; color = 'text-red-500'; }
                  return { n: b.tenant || b.tenantName || '—', s: label, score, c: color };
                });
                return (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <h4 className="text-sm font-black text-blue-800 mb-1">{language === 'বাংলা' ? 'ভাড়াটিয়া পেমেন্ট হিস্ট্রি' : 'Tenant Payment History'}</h4>
                      <p className="text-[10px] font-bold text-blue-600">{language === 'বাংলা' ? 'গত ১২ মাসের বিস্তারিত রিপোর্ট' : 'Detailed report for the last 12 months'}</p>
                    </div>
                    {rows.length === 0 ? (
                      <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                        <p className="text-xs font-black text-gray-600">
                          {language === 'বাংলা' ? 'এখনও কোনো ভাড়াটিয়া যোগ হয়নি।' : 'No tenants yet.'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                          {language === 'বাংলা' ? 'একটি লিজ তৈরি করলে পেমেন্ট হিস্ট্রি এখানে দেখাবে।' : 'Create a lease to see payment history here.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rows.map((row, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                              <p className="text-xs font-black text-gray-900">{row.n}</p>
                              <p className="text-[9px] font-bold text-gray-500 mt-0.5">{row.s}</p>
                            </div>
                            <span className={`text-sm font-black ${row.c}`}>{row.score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { showToast(language === 'বাংলা' ? 'রিপোর্ট ডাউনলোড হচ্ছে...' : 'Downloading Report...'); setActiveModal(null); }} className="w-full mt-4 bg-gray-900 text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(0,0,0,0.1)] hover:bg-[#ba0036] transition-all text-sm flex items-center justify-center gap-2">
                      <Download size={18} /> {language === 'বাংলা' ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
                    </button>
                  </div>
                );
              })()}
              
              {activeModal === 'update_inquiry' && modalData && (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                     <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center text-blue-600 shrink-0 font-black">{modalData.init}</div>
                     <div>
                       <p className="text-sm font-black text-gray-900">{modalData.user}</p>
                       <p className="text-[11px] font-black text-gray-700 mt-0.5">{modalData.phone || (language === 'বাংলা' ? 'ফোন নেই' : 'No phone')}</p>
                       <p className="text-[10px] font-bold text-gray-500 mt-0.5">{modalData.propTitle}</p>
                     </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ভিজিটের তারিখ ও সময়' : 'Visit Date & Time'}</label>
                    <input type="datetime-local" value={inquiryStatusForm.visitDate} onChange={e => setInquiryStatusForm(f => ({ ...f, visitDate: e.target.value }))} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all" />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'লোকেশন / ঠিকানা' : 'Location / Address'}</label>
                    <input type="text" value={inquiryStatusForm.notes} onChange={e => setInquiryStatusForm(f => ({ ...f, notes: e.target.value }))} placeholder={language === 'বাংলা' ? 'যেমন: প্রপার্টির ঠিকানা' : 'e.g. Property address'} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all" />
                  </div>

                  <div className="pt-2">
                    <button onClick={submitInquiryStatus} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(37,99,235,0.2)] hover:-translate-y-0.5 hover:shadow-[0_12px_20px_rgba(37,99,235,0.3)] transition-all text-sm flex items-center justify-center gap-2">
                      <Calendar size={16} /> {language === 'বাংলা' ? 'আপডেট' : 'Update'}
                    </button>
                  </div>
                </div>
              )}

              {/* ─ New Lease — 3-STEP WIZARD ────────────────────────────────
                  The lease form used to be one long scroll of ~15 inputs, so
                  hosts couldn't tell what was required or where they were. It's
                  now three short, named steps:
                    1 UNIT   — which space is being let
                    2 TENANT — who is moving in
                    3 TERMS  — the money
                  Same fields, same payload; only the pacing changed. Step 1 also
                  spots a unit that's still occupied and offers a one-tap
                  hand-over, which is how a landlord re-lets the same flat when
                  one tenant leaves and the next arrives. */}
              {activeModal === 'create_lease' && (() => {
                const isBn = language === 'বাংলা';
                const isCommercial = leaseForm.dealType === 'commercial';
                const isRelet = !!leaseForm.replacesBookingId;
                const isEditing = !!leaseForm.editingBookingId;
                const previousLease = isRelet
                  ? bookings.find(b => String(b.id) === String(leaseForm.replacesBookingId))
                  : null;
                // The live lease sitting on the unit the host is filling in. Null
                // once they've accepted the hand-over (replacesBookingId set),
                // and null while EDITING — the lease occupying the unit is the
                // one being corrected, and telling the landlord "this unit
                // already has a running lease" while they fix its rent would be
                // the form arguing with itself.
                const occupiedBy = isEditing ? null : findLiveLeaseForUnit(
                  bookings,
                  {
                    propertyId: leaseForm.propertyId,
                    property: leaseForm.property,
                    floorNumber: leaseForm.floorNumber,
                    roomNumber: leaseForm.roomNumber,
                  },
                  today,
                  leaseForm.replacesBookingId,
                );
                const steps = [
                  { n: 1, label: isBn ? 'ইউনিট'      : 'Unit',   Icon: Building2 },
                  { n: 2, label: isBn ? 'ভাড়াটিয়া'   : 'Tenant', Icon: User },
                  { n: 3, label: isBn ? 'ভাড়া ও শর্ত' : 'Rent',   Icon: Wallet },
                ];
                const labelCls = 'text-[10px] font-black text-gray-400 uppercase tracking-widest';
                const inputCls = 'w-full mt-1.5 p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-transparent focus:border-[#ba0036]/20 transition-all';
                const stepDone = (n) => leaseStepMissing(n).length === 0;

                return (
                <div
                  className="space-y-4"
                  onKeyDown={submitOnEnter(() => (leaseStep < 3 ? goLeaseStep(leaseStep + 1) : submitCreateLease(false)))}
                >

                  {/* ── Stepper — where am I, what's left ── */}
                  <div className="flex items-center gap-1">
                    {steps.map(({ n, label, Icon }, i) => {
                      const on = leaseStep === n;
                      const ok = !on && stepDone(n);
                      return (
                        <React.Fragment key={n}>
                          <button
                            type="button"
                            onClick={() => goLeaseStep(n)}
                            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all ${on ? 'bg-[#ba0036] text-white shadow-[0_4px_12px_rgba(186,0,54,0.25)]' : ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
                          >
                            {ok ? <Check size={13} className="shrink-0" strokeWidth={3.5} /> : <Icon size={13} className="shrink-0" />}
                            <span className="truncate">{label}</span>
                          </button>
                          {i < steps.length - 1 && <span className="w-2 h-px bg-gray-200 shrink-0" />}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Tenant-change banner — visible on every step so the host
                      never loses track of which lease they're replacing. */}
                  {isRelet && (() => {
                    // WHO IS ACTUALLY LEAVING. This read previousLease.tenant,
                    // which a seat-rented room leaves empty — so a landlord
                    // handing over a shared room was shown "পুরোনো ভাড়াটিয়া"
                    // and no way to tell whose tenancies they were about to
                    // close. Every outgoing occupant is named, with their seat.
                    const outgoing = activeMembers(previousLease || {});
                    const soloName = String(previousLease?.tenant || '').trim();
                    return (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <RefreshCw size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">
                            {outgoing.length > 1
                              ? (isBn ? `পুরো রুম হ্যান্ডওভার · ${outgoing.length} জন` : `Whole-room handover · ${outgoing.length} people`)
                              : (isBn ? 'ভাড়াটিয়া পরিবর্তন' : 'Tenant Change')}
                          </p>
                          <p className="text-[11px] font-bold text-gray-700 leading-relaxed">
                            {isBn
                              ? 'ইউনিটের সব তথ্য আগের লিজ থেকে নেওয়া হয়েছে। শুধু নতুন ভাড়াটিয়ার নাম ও নম্বর দিন — সেভ করলে পুরোনো লিজ বন্ধ হবে এবং নতুন রেন্ট লেজার চালু হবে।'
                              : "The unit is carried over from the previous lease. Just set the new tenant's name + number — on save the old lease closes and a fresh rent ledger starts."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLeaseForm(f => ({ ...f, replacesBookingId: null }))}
                          className="shrink-0 text-[10px] font-black text-emerald-700 hover:underline underline-offset-2 whitespace-nowrap"
                        >
                          {isBn ? 'বাতিল' : 'Undo'}
                        </button>
                      </div>

                      {/* The tenancies this save will close, by seat. */}
                      <div className="mt-2.5 rounded-xl bg-white/70 border border-emerald-100 p-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/70 mb-1.5">
                          {isBn ? 'যাঁদের লিজ বন্ধ হবে' : 'Tenancies being closed'}
                        </p>
                        {outgoing.length > 0 ? (
                          <div className="space-y-1">
                            {outgoing.map((m, i) => (
                              <div key={m.id || i} className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                                <span className="text-[11px] font-black text-gray-900 truncate">{m.name || (isBn ? 'নামহীন' : 'Unnamed')}</span>
                                <span className="text-[10px] font-bold text-gray-500 truncate">
                                  {[m.seatLabel, m.phone].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] font-black text-gray-900">{soloName || (isBn ? 'পুরোনো ভাড়াটিয়া' : 'Previous tenant')}</p>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  {/* ══════════════ STEP 1 — UNIT ══════════════ */}
                  {leaseStep === 1 && (
                    <div className="space-y-3.5 animate-in fade-in slide-in-from-right-2 duration-300">
                      <p className="text-[11px] font-bold text-gray-500 leading-relaxed">
                        {isBn
                          ? 'কোন জায়গাটি ভাড়া দিচ্ছেন? একবার সেট করলেই হবে — পরে ভাড়াটিয়া বদলালে এই তথ্য আর লিখতে হবে না।'
                          : 'Which space are you letting? Set this up once — when the tenant changes later you won\u2019t have to type it again.'}
                      </p>

                      {isCommercial ? (
                        <div className="rounded-2xl p-3.5 flex items-start gap-2.5 border bg-violet-50 border-violet-100">
                          <span className="text-lg leading-none shrink-0" aria-hidden="true">🏢</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-700 mb-1">{isBn ? 'কমার্শিয়াল লিজ' : 'Commercial Lease'}</p>
                            <p className="text-[11px] font-bold text-gray-700 leading-relaxed">
                              {isBn
                                ? 'ব্যবসায়িক ভাড়া — ব্যবসার নাম, লিজ মেয়াদ ও অ্যাডভান্স নিন (ফ্যামিলি/সিট নয়)।'
                                : 'Business tenancy — captures the business name, lease term and advance (no family occupants / seats).'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLeaseForm(f => ({ ...f, dealType: 'residential', leaseTermMonths: '', businessName: '', licenseNumber: '' }))}
                            className="shrink-0 text-[10px] font-black text-violet-700 hover:underline underline-offset-2 whitespace-nowrap"
                            title={isBn ? 'আবাসিক লিজে ফিরে যান' : 'Switch back to residential'}
                          >
                            {isBn ? '← আবাসিক' : '← Residential'}
                          </button>
                        </div>
                      ) : (
                        /* Format — drives the dynamic fields below and filters the
                           property list to matching listings. */
                        <div>
                          <label className={labelCls}>{isBn ? 'ফরম্যাট' : 'Format'}</label>
                          <div className="grid grid-cols-3 gap-2 mt-1.5">
                            {[
                              { id: 'flat', en: 'Flat', bn: 'ফ্ল্যাট', Icon: Home },
                              { id: 'single_room', en: 'Single Room', bn: 'সিঙ্গেল রুম', Icon: BedDouble },
                              { id: 'hostel', en: 'Hostel', bn: 'হোস্টেল', Icon: Users },
                            ].map(({ id, en, bn, Icon }) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setLeaseForm(f => ({ ...f, category: id, propertyId: '', property: '', location: '' }))}
                                className={`px-2 py-3 rounded-xl text-[10px] sm:text-[11px] font-black border transition-all flex flex-col items-center gap-1.5 ${leaseForm.category === id ? 'bg-[#ba0036] text-white border-[#ba0036] shadow-[0_4px_12px_rgba(186,0,54,0.25)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                              >
                                <Icon size={15} className="shrink-0" />
                                <span className="text-center leading-tight">{isBn ? bn : en}</span>
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setLeaseForm(f => ({ ...f, dealType: 'commercial', category: '', propertyId: '', property: '', location: '', leaseTermMonths: f.leaseTermMonths || '24' }))}
                            className="mt-2 w-full px-2 py-2.5 rounded-xl text-[11px] font-black border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all flex items-center justify-center gap-1.5"
                          >
                            🏢 {isBn ? 'কমার্শিয়াল এরিয়া / লিজ' : 'Commercial Area / Lease'}
                          </button>
                        </div>
                      )}

                      {/* Property — pick a listing OR type a name. */}
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label className={labelCls}>{isBn ? 'প্রপার্টি' : 'Property'}</label>
                          <button
                            type="button"
                            onClick={() => setLeaseForm(f => ({ ...f, manualProperty: !f.manualProperty, propertyId: '', property: '', location: '' }))}
                            className="text-[10px] font-black text-[#ba0036] hover:underline underline-offset-2"
                          >
                            {leaseForm.manualProperty
                              ? (isBn ? 'লিস্ট থেকে বাছুন' : 'Pick from list')
                              : (isBn ? '✎ ম্যানুয়ালি লিখুন' : '✎ Enter manually')}
                          </button>
                        </div>
                        {leaseForm.manualProperty ? (
                          <input
                            id="lease-property"
                            type="text"
                            value={leaseForm.property}
                            onChange={e => setLeaseForm(f => ({ ...f, property: e.target.value }))}
                            placeholder={isBn ? 'প্রপার্টির নাম লিখুন' : 'Type the property name'}
                            className={`${inputCls} ${leaseErrCls('property')}`}
                          />
                        ) : (
                          <select value={leaseForm.propertyId} onChange={e => {
                            const val = e.target.value;
                            // Match on String() so this works for both numeric demo ids and
                            // Mongo ObjectId strings, and auto-fill the property's location.
                            const prop = properties.find(p => String(p.id) === String(val));
                            const commercial = prop?.intent === 'commercial';
                            setLeaseForm(f => ({
                              ...f,
                              propertyId: val,
                              property: prop?.title || '',
                              location: prop?.location || '',
                              dealType: commercial ? 'commercial' : 'residential',
                              category: commercial ? '' : (f.category || propTypeToCategory(prop?.type)),
                              leaseTermMonths: commercial ? (f.leaseTermMonths || '24') : f.leaseTermMonths,
                            }));
                          }} id="lease-property" className={`${inputCls} ${leaseErrCls('property')}`}>
                            <option value="">{isBn ? 'প্রপার্টি সিলেক্ট করুন' : 'Select a property'}</option>
                            {properties
                              .filter(p => !leaseForm.category || (CATEGORY_TYPES[leaseForm.category] || []).includes(p.type))
                              .map(p => (<option key={p.id} value={p.id}>{p.title} · {formatLabel(p.type, isBn)} · {p.location}</option>))}
                          </select>
                        )}
                        {leaseForm.manualProperty && (
                          <p className="text-[9px] font-bold text-gray-400 mt-1">{isBn ? 'লিস্টিং ছাড়া লিজ — এক প্রপার্টিতে একাধিক ইউনিট রাখা যায়।' : 'Lease without a listing — lets you hold several units under one property.'}</p>
                        )}
                      </div>

                      {/* Floor + room — the two labels that make a unit unique
                          inside a building, so one house can hold many leases. */}
                      {(leaseForm.category || isCommercial) && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>{isBn ? 'ফ্লোর নম্বর' : 'Floor Number'}</label>
                            <input type="text" value={leaseForm.floorNumber} onChange={e => setLeaseForm(f => ({ ...f, floorNumber: e.target.value }))} placeholder={isBn ? 'যেমন ৩য়' : 'e.g. 3rd'} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>
                              {isBn ? 'রুম নম্বর' : 'Room Number'}
                              {!(leaseForm.category === 'single_room' || leaseForm.category === 'hostel') && (
                                <span className="ml-1 normal-case tracking-normal text-gray-300">{isBn ? '(ঐচ্ছিক)' : '(optional)'}</span>
                              )}
                            </label>
                            <input id="lease-roomNumber" type="text" value={leaseForm.roomNumber} onChange={e => setLeaseForm(f => ({ ...f, roomNumber: e.target.value }))} placeholder={isBn ? 'যেমন ৩০১' : 'e.g. 301'} className={`${inputCls} ${leaseErrCls('roomNumber')}`} />
                          </div>
                        </div>
                      )}

                      {/* Location — auto-filled from the listing so the lease
                          address always matches the property record. */}
                      <div>
                        <label className={`${labelCls} flex items-center gap-1`}>
                          <MapPin size={11} className="text-[#ba0036]" /> {isBn ? 'লোকেশন' : 'Location'}
                        </label>
                        {leaseForm.manualProperty ? (
                          <input
                            type="text"
                            value={leaseForm.location}
                            onChange={e => setLeaseForm(f => ({ ...f, location: e.target.value }))}
                            placeholder={isBn ? 'ঠিকানা লিখুন' : 'Type the address'}
                            className={inputCls}
                          />
                        ) : (
                          <div className="w-full mt-1.5 p-3.5 bg-gray-100/70 rounded-xl text-sm font-bold text-gray-700 border border-transparent flex items-center gap-2 min-h-[48px]">
                            <span className="truncate">
                              {leaseForm.location || (isBn ? 'প্রপার্টি সিলেক্ট করলে অটো-ফিল হবে' : 'Auto-fills when you pick a property')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ── Occupancy hand-over ──────────────────────────────
                          The unit already has a running lease. Rather than
                          refusing the save (which is what used to happen, and
                          left the host unable to ever re-let the flat), we show
                          who's in it and let them hand the unit over in one tap:
                          the old lease is closed out on save, this one takes over,
                          and Rent Collection follows the new tenant. */}
                      {occupiedBy && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">{isBn ? 'এই ইউনিটে লিজ চলছে' : 'Unit is currently leased'}</p>
                              <p className="text-[11px] font-bold text-gray-700 leading-relaxed">
                                {(() => {
                                  // An ongoing tenancy has no "through <date>" to
                                  // quote — it runs until this very hand-over.
                                  const since = formatDate(occupiedBy.leaseStart, language);
                                  const until = formatDate(occupiedBy.leaseEnd, language);
                                  const who = occupiedBy.tenant || (isBn ? 'একজন ভাড়াটিয়া' : 'A tenant');
                                  const window = isOpenEndedLease(occupiedBy)
                                    ? (isBn ? `${since} থেকে` : `since ${since}`)
                                    : (isBn ? `${until} পর্যন্ত` : `through ${until}`);
                                  return isBn
                                    ? `${who} এখনও এই ইউনিটে আছেন (${window})। পুরোনো ভাড়াটিয়া চলে গেলে নিচে ট্যাপ করুন — পুরোনো লিজ বন্ধ হবে, নতুনটি চালু হবে।`
                                    : `${who} still holds this unit (${window}). If they have moved out, hand the unit over — the old lease closes and this new one takes its place.`;
                                })()}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setLeaseForm(f => ({ ...f, replacesBookingId: occupiedBy.id, editingBookingId: null }));
                                  showToast(isBn ? 'পুরোনো লিজ বন্ধ হবে — নতুন ভাড়াটিয়ার তথ্য দিন' : 'Old lease will be closed — fill in the new tenant');
                                }}
                                className="mt-2.5 px-3 py-2 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 active:scale-95 transition-all inline-flex items-center justify-center gap-1.5"
                              >
                                <RefreshCw size={13} /> {isBn ? 'পুরোনো ভাড়াটিয়া চলে গেছে' : 'Old tenant left — hand over'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ══════════════ STEP 2 — TENANT ══════════════ */}
                  {leaseStep === 2 && (
                    <div className="space-y-3.5 animate-in fade-in slide-in-from-right-2 duration-300">
                      <p className="text-[11px] font-bold text-gray-500 leading-relaxed">
                        {isBn ? 'কে থাকতে আসছেন? নাম ও ফোন নম্বরই যথেষ্ট।' : 'Who is moving in? A name and phone number is all it takes.'}
                      </p>

                      {/* Unit recap — so the host can see what they're leasing
                          without stepping back. */}
                      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-[#ba0036] shrink-0">
                          <Building2 size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-gray-900 truncate">{leaseForm.property || (isBn ? 'প্রপার্টি বাছুন' : 'Pick a property')}</p>
                          <p className="text-[10px] font-bold text-gray-500 truncate">
                            {[
                              leaseForm.floorNumber && `${isBn ? 'ফ্লোর' : 'Floor'} ${leaseForm.floorNumber}`,
                              leaseForm.roomNumber && `${isBn ? 'রুম' : 'Room'} ${leaseForm.roomNumber}`,
                              leaseForm.location,
                            ].filter(Boolean).join(' · ') || (isBn ? 'ইউনিটের তথ্য নেই' : 'No unit details yet')}
                          </p>
                        </div>
                        <button type="button" onClick={() => goLeaseStep(1)} className="shrink-0 text-[10px] font-black text-[#ba0036] hover:underline underline-offset-2">
                          {isBn ? 'এডিট' : 'Edit'}
                        </button>
                      </div>

                      {/* Scan the admission form instead of typing it — the same
                          affordance the Rooms seat form has. It only prefills
                          the boxes below; the landlord still corrects whatever
                          the page did not say clearly. */}
                      <div>
                        <button
                          type="button"
                          disabled={leaseScanning}
                          onClick={() => leaseScanInputRef.current?.click()}
                          className="w-full px-3 py-3 rounded-2xl border-2 border-dashed border-[#ba0036]/30 bg-[#ba0036]/[0.03] text-[#ba0036] hover:bg-[#ba0036]/[0.06] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {leaseScanning
                            ? <><Loader2 size={15} className="animate-spin" /> <span className="text-[11px] font-black uppercase tracking-wider">{isBn ? 'পড়া হচ্ছে…' : 'Reading…'}</span></>
                            : <>
                                <ScanLine size={15} strokeWidth={2.5} />
                                <span className="text-[11px] font-black uppercase tracking-wider">
                                  {isBn ? 'ভর্তি ফরম স্ক্যান করুন' : 'Scan the admission form'}
                                </span>
                              </>}
                        </button>
                        <input
                          ref={leaseScanInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => { handleLeaseScan(e.target.files?.[0]); e.target.value = ''; }}
                        />

                        {/* What the scan got and what it missed. A bare count
                            leaves the landlord to work out which boxes are
                            still empty by opening the section and reading it. */}
                        {leaseScanned && (() => {
                          const { filled, missing } = tenantFieldReport(leaseTenantView(leaseForm), isBn);
                          return (
                            <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                              <div className="px-2.5 py-2 bg-emerald-50 border-b border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-800 inline-flex items-center gap-1">
                                  <Sparkles size={10} className="shrink-0" />
                                  {isBn ? `ফরম থেকে পাওয়া গেছে — ${filled.length}টি` : `Read from the form — ${filled.length}`}
                                </p>
                                <p className="text-[10px] font-bold text-emerald-700/80 leading-relaxed mt-0.5">
                                  {filled.map((f) => f.label).join(' · ')}
                                </p>
                              </div>
                              {missing.length > 0 && (
                                <div className="px-2.5 py-2 bg-amber-50">
                                  <p className="text-[10px] font-black text-amber-800 inline-flex items-center gap-1">
                                    <AlertCircle size={10} className="shrink-0" />
                                    {isBn ? `পাওয়া যায়নি — ${missing.length}টি` : `Not found — ${missing.length}`}
                                  </p>
                                  <p className="text-[10px] font-bold text-amber-700/90 leading-relaxed mt-0.5">
                                    {missing.map((f) => f.label).join(' · ')}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Name + mobile + move-in, then everything else folded
                          away under "অতিরিক্ত তথ্য". Three boxes and the host can
                          move on — nothing in the optional section can block a
                          save, and an ID is only ever required because the host
                          answered "আছে" for it. */}
                      <TenantInfoForm
                        value={leaseTenantView(leaseForm)}
                        onChange={applyTenantPatch}
                        language={language}
                        errors={leaseErrors}
                        showToast={showToast}
                      />

                      {/* Commercial — business identity instead of family size. */}
                      {isCommercial && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>{isBn ? 'ব্যবসার নাম' : 'Business / Trade Name'}</label>
                            <input id="lease-businessName" type="text" value={leaseForm.businessName} onChange={e => setLeaseForm(f => ({ ...f, businessName: e.target.value }))} placeholder={isBn ? 'যেমন: আশরাফ আলম এন্টারপ্রাইজ' : 'e.g. Asraf Alom Enterprise'} className={`${inputCls} ${leaseErrCls('businessName')}`} />
                          </div>
                          <div>
                            <label className={labelCls}>{isBn ? 'ট্রেড লাইসেন্স নম্বর (ঐচ্ছিক)' : 'Trade License No. (optional)'}</label>
                            <input type="text" value={leaseForm.licenseNumber} onChange={e => setLeaseForm(f => ({ ...f, licenseNumber: e.target.value }))} placeholder={isBn ? 'যেমন: TRAD/DNCC/123456' : 'e.g. TRAD/DNCC/123456'} className={inputCls} />
                          </div>
                        </div>
                      )}

                      {/* Occupants — FLAT only (family size). A single room is one
                          tenant; a hostel uses seats below. */}
                      {leaseForm.category === 'flat' && (
                        <div>
                          <label className={`${labelCls} flex items-center gap-1`}>
                            <Users size={11} className="text-[#ba0036]" /> {isBn ? 'অকুপ্যান্ট সংখ্যা' : 'Number of Occupants'}
                          </label>
                          <input type="number" min="1" max="50" value={leaseForm.occupants} onChange={e => setLeaseForm(f => ({ ...f, occupants: e.target.value }))} placeholder={isBn ? 'যেমন ৩' : 'e.g. 3'} className={inputCls} />
                          <p className="text-[9px] font-bold text-gray-400 mt-1">{isBn ? 'ভাড়াটিয়ার ফ্যামিলি মেম্বার থেকে অটো-ফিল' : "Auto-filled from tenant's family members"}</p>
                        </div>
                      )}

                      {/* Seats — HOSTEL only. Seat 1 is the tenant above; the room
                          rent (step 3) splits equally unless a seat overrides it. */}
                      {leaseForm.category === 'hostel' && (() => {
                        const roomRent = Number(leaseForm.monthlyRent) || 0;
                        const totalSeats = 1 + (leaseForm.seats?.length || 0);
                        const share = totalSeats > 0 ? Math.round(roomRent / totalSeats) : roomRent;
                        const fmt = (n) => `৳${(Number(n) || 0).toLocaleString('en-IN')}`;
                        const setSeat = (idx, patch) => setLeaseForm(f => ({ ...f, seats: (f.seats || []).map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
                        const addSeat = () => setLeaseForm(f => ({ ...f, seats: [...(f.seats || []), { name: '', phone: '', monthlyRent: '' }] }));
                        const removeSeat = (idx) => setLeaseForm(f => ({ ...f, seats: (f.seats || []).filter((_, i) => i !== idx) }));
                        return (
                          <div className="rounded-2xl border border-[#ba0036]/15 bg-[#ba0036]/5 p-3.5">
                            <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <Users size={14} className="text-[#ba0036]" />
                                <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">{isBn ? 'সিট / ভাড়াটিয়া' : 'Seats / Tenants'}</span>
                                <span className="px-1.5 py-0.5 rounded bg-white text-[9px] font-black text-gray-600 tabular-nums border border-gray-200">{totalSeats}</span>
                              </div>
                              {roomRent > 0 && (
                                <span className="text-[10px] font-bold text-gray-700 tabular-nums">
                                  {fmt(roomRent)} ÷ {totalSeats} = <span className="font-black text-[#ba0036]">{fmt(share)}</span>{isBn ? '/সিট' : ' each'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white border border-gray-100 mb-2">
                              <span className="w-6 h-6 rounded-lg bg-[#ba0036] text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                              <span className="text-xs font-bold text-gray-900 truncate flex-1">{leaseForm.tenant?.trim() || (isBn ? 'সিট ১ — উপরে ভাড়াটিয়ার নাম দিন' : 'Seat 1 — enter the tenant name above')}</span>
                              <span className="text-[10px] font-black text-gray-500 tabular-nums shrink-0">{roomRent > 0 ? fmt(share) : '—'}</span>
                            </div>

                            {(leaseForm.seats || []).length > 0 && (
                              <div className="space-y-2">
                                {(leaseForm.seats || []).map((s, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <span className="w-6 h-6 rounded-lg bg-gray-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 2}</span>
                                    <input value={s.name} onChange={e => setSeat(idx, { name: e.target.value })} placeholder={isBn ? 'নাম' : 'Name'} className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-900 outline-none focus:border-[#ba0036] bg-white" />
                                    <input value={s.monthlyRent} onChange={e => setSeat(idx, { monthlyRent: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder={roomRent > 0 ? fmt(share) : (isBn ? 'ভাড়া' : 'Rent')} title={isBn ? 'খালি রাখলে সমান ভাগ' : 'Blank = equal split'} className="w-20 shrink-0 px-2 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-900 outline-none focus:border-[#ba0036] bg-white tabular-nums" />
                                    <button type="button" onClick={() => removeSeat(idx)} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200 shrink-0" title={isBn ? 'সরান' : 'Remove seat'}><X size={13} /></button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button type="button" onClick={addSeat} className="mt-2 w-full py-2 rounded-xl border-2 border-dashed border-[#ba0036]/30 text-[#ba0036] text-[11px] font-black uppercase tracking-widest hover:bg-white/60 transition-colors flex items-center justify-center gap-1.5">
                              <Plus size={14} /> {isBn ? 'সিট যোগ করুন' : 'Add Seat'}
                            </button>
                            <p className="text-[9px] font-bold text-gray-400 mt-2 leading-relaxed">
                              {isBn
                                ? 'রুমের ভাড়া পরের ধাপে একবারই লিখুন — সিটগুলোতে সমানভাবে ভাগ হবে। কোনো সিটে আলাদা ভাড়া দিলে সেটি প্রাধান্য পাবে।'
                                : 'Enter the room rent once on the next step — it splits equally across the seats. A custom per-seat rent overrides that seat.'}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ══════════════ STEP 3 — RENT & TERMS ══════════════ */}
                  {leaseStep === 3 && (
                    <div className="space-y-3.5 animate-in fade-in slide-in-from-right-2 duration-300">
                      <p className="text-[11px] font-bold text-gray-500 leading-relaxed">
                        {isBn
                          ? 'ভাড়ার হিসাব। সেভ করলেই এই তথ্য দিয়ে রেন্ট কালেকশনের লেজার তৈরি হবে।'
                          : 'The money. On save these numbers build the Rent Collection ledger.'}
                      </p>

                      {/* Tenant recap. */}
                      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-[#ba0036] shrink-0 font-black text-[11px]">
                          {(leaseForm.tenant || '?').trim()[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-gray-900 truncate">{leaseForm.tenant || (isBn ? 'ভাড়াটিয়ার নাম দিন' : 'Add the tenant name')}</p>
                          <p className="text-[10px] font-bold text-gray-500 truncate">
                            {[leaseForm.tenantPhone, leaseForm.property].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                        <button type="button" onClick={() => goLeaseStep(2)} className="shrink-0 text-[10px] font-black text-[#ba0036] hover:underline underline-offset-2">
                          {isBn ? 'এডিট' : 'Edit'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>{leaseForm.category === 'hostel' ? (isBn ? 'রুম ভাড়া (৳) — সিটে ভাগ হবে' : 'Room Rent (৳) — split across seats') : (isBn ? 'মাসিক ভাড়া (৳)' : 'Monthly Rent (৳)')}</label>
                          <input id="lease-monthlyRent" type="number" min="0" value={leaseForm.monthlyRent} onChange={e => setLeaseForm(f => ({ ...f, monthlyRent: e.target.value }))} placeholder="85000" className={`${inputCls} ${leaseErrCls('monthlyRent')}`} />
                        </div>
                        <div>
                          <label className={labelCls}>{isBn ? 'প্রতি মাসের কত তারিখে?' : 'Rent Due Day'}</label>
                          <input type="number" min="1" max="31" value={leaseForm.rentDueDay} onChange={e => setLeaseForm(f => ({ ...f, rentDueDay: e.target.value }))} className={inputCls} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>{isBn ? 'সার্ভিস চার্জ (৳)' : 'Service Charge (৳)'}</label>
                          <input type="number" min="0" value={leaseForm.serviceCharge} onChange={e => setLeaseForm(f => ({ ...f, serviceCharge: e.target.value }))} placeholder="0" className={inputCls} />
                          <p className="text-[9px] font-bold text-gray-400 mt-1">{isBn ? 'প্রোফাইল থেকে অটো-ফিল · এডিটযোগ্য' : 'Auto-filled from profile · editable'}</p>
                        </div>
                      </div>

                      {/* ── Late fee — OPT-IN ─────────────────────────────────
                          Nothing is charged unless the landlord puts a number
                          here. Left blank, no reminder or overdue notice ever
                          mentions a fee — we don't invent a charge on the
                          landlord's behalf. Fill it in and the tenant is told the
                          amount up front, in every reminder. */}
                      {(() => {
                        const fee = Math.max(0, Number(leaseForm.lateFeeAmount) || 0);
                        const grace = Math.max(0, Number(leaseForm.gracePeriodDays) || 0);
                        const dueDay = Number(leaseForm.rentDueDay) || 5;
                        const on = fee > 0;
                        return (
                          <div className={`rounded-2xl border p-3 transition-colors ${on ? 'border-amber-200 bg-amber-50/70' : 'border-gray-100 bg-gray-50/60'}`}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
                                <AlertCircle size={13} className={on ? 'text-amber-600' : 'text-gray-400'} /> {isBn ? 'লেট ফি' : 'Late Fee'}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${on ? 'text-amber-700' : 'text-gray-400'}`}>
                                {on ? (isBn ? 'চালু' : 'On') : (isBn ? 'ঐচ্ছিক · বন্ধ' : 'Optional · off')}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={labelCls}>{isBn ? 'লেট ফি (৳)' : 'Late Fee (৳)'}</label>
                                <input
                                  type="number" min="0" max="100000" inputMode="numeric"
                                  value={leaseForm.lateFeeAmount}
                                  onChange={e => setLeaseForm(f => ({ ...f, lateFeeAmount: e.target.value.replace(/[^0-9]/g, '') }))}
                                  placeholder={isBn ? 'নেই' : 'None'}
                                  className="w-full mt-1.5 p-3.5 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none focus:shadow-[0_4px_15px_rgba(245,158,11,0.15)] border border-gray-100 focus:border-amber-300 transition-all tabular-nums"
                                />
                              </div>
                              <div>
                                <label className={labelCls}>{isBn ? 'গ্রেস (দিন)' : 'Grace (days)'}</label>
                                <input
                                  type="number" min="0" max="28" inputMode="numeric"
                                  value={leaseForm.gracePeriodDays}
                                  onChange={e => setLeaseForm(f => ({ ...f, gracePeriodDays: e.target.value.replace(/[^0-9]/g, '') }))}
                                  placeholder="5"
                                  className="w-full mt-1.5 p-3.5 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none focus:shadow-[0_4px_15px_rgba(245,158,11,0.15)] border border-gray-100 focus:border-amber-300 transition-all tabular-nums"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] font-bold text-gray-500 mt-2 leading-relaxed">
                              {on
                                ? (isBn
                                    ? `${dueDay} তারিখের পর ${grace} দিন পেরোলে ৳${fee.toLocaleString('en-IN')} লেট ফি যোগ হবে — রিমাইন্ডারে ভাড়াটিয়াকে এটা জানিয়ে দেওয়া হবে।`
                                    : `৳${fee.toLocaleString('en-IN')} is added once ${grace} day${grace === 1 ? '' : 's'} pass after the ${dueDay}th — and every reminder tells the tenant so.`)
                                : (isBn
                                    ? 'খালি রাখলে কোনো লেট ফি নেই — রিমাইন্ডারেও লেট ফির কথা থাকবে না।'
                                    : 'Leave it blank for no late fee — reminders then never mention one.')}
                            </p>
                          </div>
                        );
                      })()}

                      {/* ── Move-in date + tenancy type ───────────────────────
                          Renting here is open-ended. A tenant moves in and stays
                          — often for years — and nobody signs a renewal. So the
                          default is ONGOING: one date (move-in) and no expiry.
                          The tenancy ends when the host says it did, by handing
                          the unit to the next tenant.

                          A fixed term is still available for the cases where it's
                          real (a company let, a written contract), and commercial
                          deals always carry their tenure in months. */}
                      {(() => {
                        const fixedTerm = isCommercial || !!leaseForm.leaseEnd;
                        return (
                          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
                                <CalendarRange size={13} className="text-[#ba0036]" /> {isBn ? 'ভাড়ার মেয়াদ' : 'Tenancy'}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${fixedTerm ? 'text-gray-500' : 'text-emerald-600'}`}>
                                {isCommercial
                                  ? (isBn ? 'নির্দিষ্ট মেয়াদ' : 'Fixed tenure')
                                  : fixedTerm ? (isBn ? 'নির্দিষ্ট তারিখ' : 'Fixed end date') : (isBn ? 'চলমান · মেয়াদ নেই' : 'Ongoing · no expiry')}
                              </span>
                            </div>

                            {/* Move-in now lives on the TENANT step, with the
                                other three fields that actually identify a
                                tenancy. It is shown here read-only so the term
                                below still reads as a whole. */}
                            <div className={`grid grid-cols-1 gap-3 ${(isCommercial || fixedTerm) ? "sm:grid-cols-2" : ""}`}>
                              <div>
                                <label className={labelCls}>{isBn ? 'মুভ-ইন তারিখ' : 'Move-In Date'}</label>
                                <button
                                  type="button"
                                  onClick={() => goLeaseStep(2)}
                                  className="w-full mt-1.5 p-3.5 bg-white rounded-xl text-sm font-bold text-gray-900 border border-gray-100 flex items-center gap-2 text-left hover:border-[#ba0036]/30 transition-all"
                                >
                                  <span className="flex-1 truncate">{formatDate(leaseForm.leaseStart, language)}</span>
                                  <span className="shrink-0 text-[10px] font-black text-[#ba0036] uppercase tracking-widest">{isBn ? 'এডিট' : 'Edit'}</span>
                                </button>
                              </div>
                              {isCommercial ? (
                                <div>
                                  <label className={labelCls}>{isBn ? 'লিজ মেয়াদ (মাস)' : 'Lease Term (months)'}</label>
                                  <input id="lease-leaseTermMonths" type="number" min="1" max="600" value={leaseForm.leaseTermMonths} onChange={e => setLeaseForm(f => ({ ...f, leaseTermMonths: e.target.value }))} placeholder="24" className="w-full mt-1.5 p-3.5 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-gray-100 focus:border-[#ba0036]/30 transition-all" />
                                </div>
                              ) : fixedTerm ? (
                                <div>
                                  <label className={labelCls}>{isBn ? 'শেষ তারিখ' : 'End Date'}</label>
                                  <input id="lease-leaseEnd" type="date" value={leaseForm.leaseEnd} onChange={e => setLeaseForm(f => ({ ...f, leaseEnd: e.target.value }))} className="w-full mt-1.5 p-3.5 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-gray-100 focus:border-[#ba0036]/30 transition-all" />
                                </div>
                              ) : null}
                            </div>

                            {/* Ongoing ⇄ fixed toggle — residential only. Turning
                                the term off clears the date, so nothing expires by
                                accident later. */}
                            {!isCommercial && (
                              <button
                                type="button"
                                onClick={() => setLeaseForm(f => {
                                  if (f.leaseEnd) return { ...f, leaseEnd: '' };
                                  const sd = new Date(f.leaseStart || todayIso());
                                  const ed = new Date(sd.getFullYear() + 1, sd.getMonth(), sd.getDate() - 1);
                                  return { ...f, leaseEnd: `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}` };
                                })}
                                className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-all active:scale-95"
                              >
                                {fixedTerm
                                  ? <><RefreshCw size={11} /> {isBn ? 'মেয়াদ সরিয়ে চলমান করুন' : 'Make it ongoing'}</>
                                  : <><CalendarRange size={11} /> {isBn ? 'নির্দিষ্ট মেয়াদ যোগ করুন' : 'Add a fixed term'}</>}
                              </button>
                            )}

                            {/* What actually gets saved, resolved live. */}
                            {(() => {
                              const { startIso, endIso } = resolveLeaseDates(leaseForm);
                              return (
                                <p className="text-[10px] font-bold text-gray-500 mt-2 leading-relaxed">
                                  {endIso ? (
                                    <>
                                      {isBn ? 'মেয়াদ: ' : 'Term: '}
                                      <span className="font-black text-gray-800 tabular-nums">{formatDate(startIso, language)} → {formatDate(endIso, language)}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-black text-gray-800 tabular-nums">{formatDate(startIso, language)}</span>
                                      {isBn
                                        ? ' থেকে চলমান — কোনো শেষ তারিখ নেই। ভাড়াটিয়া চলে গেলে "নতুন ভাড়াটিয়া" দিলেই এই লিজ বন্ধ হবে।'
                                        : ' onward, ongoing — no end date. It closes the day you hand the unit to the next tenant.'}
                                    </>
                                  )}
                                </p>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Advance + method — the up-front money and the channel it
                          came through. */}
                      <div className="bg-gradient-to-br from-emerald-50/70 to-white p-3.5 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Banknote size={14} className="text-emerald-600" />
                          <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">{isBn ? 'অ্যাডভান্স পেমেন্ট' : 'Advance Payment'}</span>
                        </div>
                        <div>
                          <label className={labelCls}>{isBn ? 'অ্যাডভান্স (৳)' : 'Advance Amount (৳)'}</label>
                          <input type="number" min="0" value={leaseForm.advancePayment} onChange={e => setLeaseForm(f => ({ ...f, advancePayment: e.target.value }))} placeholder="0" className="w-full mt-1.5 p-3.5 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none focus:shadow-[0_4px_15px_rgba(16,185,129,0.12)] border border-gray-100 focus:border-emerald-300 transition-all" />
                        </div>
                        <label className={`${labelCls} block mt-3`}>{isBn ? 'পেমেন্ট মেথড' : 'Payment Method'}</label>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {PAYMENT_METHODS.map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setLeaseForm(f => ({ ...f, paymentMethod: m }))}
                              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${leaseForm.paymentMethod === m ? 'bg-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]' : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-100'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <BellRing size={14} className="text-[#ba0036]" />
                            <span className="text-[11px] font-black text-gray-900">{isBn ? 'অটো রিমাইন্ডার' : 'Auto Reminder'}</span>
                          </div>
                          <button type="button" onClick={() => setLeaseForm(f => ({ ...f, autoReminder: !f.autoReminder }))} className={`w-11 h-6 rounded-full relative transition-colors ${leaseForm.autoReminder ? 'bg-[#ba0036]' : 'bg-gray-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all ${leaseForm.autoReminder ? 'right-1' : 'left-1'}`}></div>
                          </button>
                        </div>
                        <label className={labelCls}>{isBn ? 'কত দিন আগে রিমাইন্ডার?' : 'Remind X days before due'}</label>
                        <input type="number" min="0" max="14" value={leaseForm.reminderLeadDays} onChange={e => setLeaseForm(f => ({ ...f, reminderLeadDays: e.target.value }))} className="w-full mt-1.5 p-3 bg-white rounded-xl text-sm font-bold text-gray-900 outline-none focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-transparent focus:border-[#ba0036]/20 transition-all" />
                        {/* The cap is a promise to the tenant, so it's stated
                            plainly to the landlord too: three messages a month,
                            not a daily drip. */}
                        {leaseForm.autoReminder && (
                          <p className="text-[10px] font-bold text-gray-500 mt-2 leading-relaxed">
                            {isBn
                              ? `মাসে সর্বোচ্চ ৩টি রিমাইন্ডার: (১) ${Number(leaseForm.reminderLeadDays) || 3} দিন আগে, (২) ভাড়ার তারিখে, (৩) সময় পেরোলে। এর বেশি মেসেজ যাবে না।`
                              : `Max 3 reminders a month: ${Number(leaseForm.reminderLeadDays) || 3} days before, on the due date, and once it's overdue. Never more than that.`}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelCls}>{isBn ? 'নোটস (ঐচ্ছিক)' : 'Notes (optional)'}</label>
                        <textarea rows="2" value={leaseForm.notes} onChange={e => setLeaseForm(f => ({ ...f, notes: e.target.value }))} placeholder={isBn ? 'যেমন: ডিপোজিট পেইড, bKash এ পেমেন্ট...' : 'e.g. Deposit cleared, prefers bKash...'} className={`${inputCls} resize-none`} />
                      </div>

                      <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-100">
                        <p className="text-[11px] font-bold text-blue-800 flex items-start gap-2 leading-relaxed">
                          <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                          {/* The landlord's actual worry when they hit save on a
                              lease that already has months of rent behind it.
                              Say plainly that nothing is lost. */}
                          {isEditing
                            ? (isBn
                                ? 'শুধু এই তথ্যগুলো আপডেট হবে। রেন্ট লেজার, পেমেন্ট হিস্ট্রি, সিট ও ইনভাইট কোড অপরিবর্তিত থাকবে।'
                                : 'Only these details change. The rent ledger, payment history, seats and invite code stay exactly as they are.')
                            : isRelet
                              ? (isBn
                                  ? 'সেভ করলে পুরোনো লিজ "সম্পন্ন" হবে এবং নতুন ভাড়াটিয়ার জন্য পরিষ্কার রেন্ট লেজার চালু হবে।'
                                  : 'On save the old lease is marked Done and a clean rent ledger starts for the new tenant.')
                              : (isBn
                                  ? 'লিজ তৈরি হলে প্রপার্টিটি "Rented" মার্ক হবে এবং রেন্ট লেজার চালু হবে।'
                                  : 'On create, the property is marked "Rented" and a fresh rent ledger is initialised.')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Wizard nav ── */}
                  <div className="pt-1 flex items-center gap-2">
                    {leaseStep > 1 ? (
                      <button
                        onClick={() => goLeaseStep(leaseStep - 1)}
                        className="shrink-0 px-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        <ArrowLeft size={15} /> {isBn ? 'পিছনে' : 'Back'}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                        {isBn ? `ধাপ ${leaseStep}/3` : `Step ${leaseStep} of 3`}
                      </span>
                    )}

                    {leaseStep < 3 ? (
                      <button
                        onClick={() => goLeaseStep(leaseStep + 1)}
                        className="flex-1 bg-gray-900 text-white py-3.5 rounded-xl font-black shadow-[0_8px_15px_rgba(0,0,0,0.15)] hover:bg-black active:scale-[0.99] transition-all text-sm flex items-center justify-center gap-2"
                      >
                        {isBn ? 'পরবর্তী' : 'Next'} <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => submitCreateLease(false)}
                        className="flex-1 bg-green-600 text-white py-3.5 rounded-xl font-black shadow-[0_8px_15px_rgba(22,163,74,0.2)] hover:-translate-y-0.5 hover:shadow-[0_12px_20px_rgba(22,163,74,0.3)] transition-all text-sm flex items-center justify-center gap-2"
                      >
                        <Check size={18} /> {isEditing
                          ? (isBn ? 'পরিবর্তন সেভ করুন' : 'Save Changes')
                          : isRelet
                            ? (isBn ? 'নতুন লিজ চালু করুন' : 'Start New Lease')
                            : (isBn ? 'লিজ তৈরি করুন' : 'Create Lease')}
                      </button>
                    )}
                  </div>

                  {/* Rapid multi-entry — only on the last step, and never during a
                      tenant change (a one-off hand-over) or an edit (there is
                      one lease being corrected, not a queue to add). */}
                  {leaseStep === 3 && !isRelet && !isEditing && (
                    <>
                      <button onClick={() => submitCreateLease(true)} className="w-full bg-white border-2 border-green-600 text-green-700 py-3 rounded-xl font-black hover:bg-green-50 active:scale-[0.99] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                        <Plus size={16} /> {isBn ? 'সেভ করে আরেকটি' : 'Save & Add Another'}
                      </button>
                      <p className="text-[10px] font-bold text-gray-400 text-center">
                        {isBn
                          ? 'কমন তথ্য (প্রপার্টি, ফরম্যাট, তারিখ, ভাড়া) রেখে দ্রুত ২০+ লিজ যোগ করুন — শুধু রুম + ভাড়াটিয়া বদলান।'
                          : 'Keeps the common fields (property, format, dates, rent) so you can add 20+ leases fast — just change the room + tenant.'}
                      </p>
                    </>
                  )}
                </div>
                );
              })()}

              {/* ─ Rent Action modal — 2-step futuristic flow ───────────────
                  Step 1 (choose): three big choice cards — Full Payment,
                                   Partial / Due, or Mark as Due.
                  Step 2 (form):   tailored form for whichever choice was made.
                  Pushes a receipt into the tenant's localStorage on submit so
                  the tenant dashboard shows it instantly. */}
              {activeModal === 'mark_paid' && (() => {
                const booking = bookings.find(b => b.id === payForm.bookingId);
                if (!booking) return null;
                // Real occupant (a member who joined via invite) over the stale
                // typed tenant — keeps this modal consistent with the rent card.
                // Per-seat when marking a hostel member's rent: show that
                // member's name + their split share + their own ledger entry.
                const mpActive = Array.isArray(booking.members) ? booking.members.filter(m => m && m.status !== 'moved-out') : [];
                const mpMember = payForm.memberId ? mpActive.find(m => m.id === payForm.memberId) : null;
                const mpTenant = String(mpMember?.name || booking.tenant || (language === 'বাংলা' ? 'ভাড়াটিয়া' : 'Tenant')).trim();
                const mpInit = (mpTenant[0] || '?').toUpperCase();
                const due = getDueDate(payForm.monthKey, booking.rentDueDay);
                const expected = mpMember ? seatShare(booking, mpMember, mpActive.length) : (Number(booking.monthlyRent || 0) + Number(booking.serviceCharge || 0));
                const amt = Number(payForm.amount) || 0;
                const existing = mpMember ? (mpMember.ledger?.[payForm.monthKey]) : (booking.ledger?.[payForm.monthKey]);
                // Money already banked for this month. The amount typed here is
                // what is being received NOW, so the balance has to be measured
                // against the two together — showing ৳6,000 − ৳1,000 = ৳5,000
                // still owing, after ৳5,000 had already come in, is what made
                // the second payment look like it had not worked.
                const alreadyBanked = paidSoFar(existing);
                const stillOwed = remainingFor(existing, expected);
                const balance = payForm.status === 'due'
                  ? expected
                  : Math.max(0, expected - (alreadyBanked + amt));
                const isEditing = !!existing?.paid || existing?.status === 'due';

                // Per-status visual theme (drives the gradient header + pill colour).
                const theme = payForm.status === 'full'
                  ? { from: 'from-blue-500', to: 'to-indigo-600', soft: 'bg-blue-50 text-blue-700', accent: 'text-blue-600', ring: 'focus:border-blue-500/30 focus:shadow-[0_4px_15px_rgba(59,130,246,0.10)]' }
                  : payForm.status === 'partial'
                    ? { from: 'from-amber-500', to: 'to-orange-600', soft: 'bg-amber-50 text-amber-700', accent: 'text-amber-600', ring: 'focus:border-amber-500/30 focus:shadow-[0_4px_15px_rgba(251,191,36,0.10)]' }
                    : { from: 'from-rose-500', to: 'to-red-600', soft: 'bg-rose-50 text-rose-700', accent: 'text-rose-600', ring: 'focus:border-rose-500/30 focus:shadow-[0_4px_15px_rgba(244,63,94,0.10)]' };

                return (
                  <div
                    className="space-y-4 animate-in fade-in zoom-in-95 duration-200"
                    onKeyDown={submitOnEnter(submitMarkPaid, { enabled: payForm.step === 'form' })}
                  >
                    {/* ── Header — same on both steps so the host always sees who/what/when ── */}
                    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${theme.from} ${theme.to} text-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)]`}>
                      <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="relative z-10 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                          <span className="text-sm font-black tracking-tight">{mpInit}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">{language === 'বাংলা' ? 'রেন্ট অ্যাকশন' : 'Rent Action'}</p>
                          <p className="text-base font-black truncate">{mpTenant} · {booking.property}</p>
                          <p className="text-[10px] font-bold text-white/80 mt-0.5">
                            {monthFullLabel(payForm.monthKey, language)}
                            {' · '}{language === 'বাংলা' ? 'ডিউ' : 'Due'} {formatDate(due?.toISOString(), language)}
                            {' · '}{language === 'বাংলা' ? 'এক্সপেক্টেড' : 'Expected'} {formatBDT(expected)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Money already banked for this month. Without this the
                        landlord has no way to know what to type: the form asked
                        for "the amount" with nothing saying ৳5,000 was already
                        in, so the natural entry was the whole ৳6,000 again. */}
                    {alreadyBanked > 0 && payForm.status !== 'due' && (
                      <div className="mx-4 mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-black text-emerald-800">
                          {language === 'বাংলা'
                            ? `আগে পাওয়া গেছে ${formatBDT(alreadyBanked)}`
                            : `${formatBDT(alreadyBanked)} already received`}
                        </span>
                        <span className="text-emerald-300">·</span>
                        <span className="text-[11px] font-black text-gray-700">
                          {language === 'বাংলা'
                            ? `বাকি ${formatBDT(stillOwed)}`
                            : `${formatBDT(stillOwed)} still owed`}
                        </span>
                        <span className="w-full text-[10px] font-bold text-emerald-700/80 leading-relaxed">
                          {language === 'বাংলা'
                            ? 'নিচে এইবার যত টাকা পেলেন সেটাই লিখুন — আগেরটার সাথে যোগ হবে।'
                            : 'Enter only what you received this time — it adds to what is already recorded.'}
                        </span>
                      </div>
                    )}

                    {/* ─────────────── STEP 1 — CHOICE SCREEN ─────────────── */}
                    {payForm.step === 'choose' && (
                      <>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-center pt-1">
                          {language === 'বাংলা' ? 'এই মাসের জন্য কী রেকর্ড করবেন?' : 'What do you want to record for this month?'}
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                          {/* Full Payment */}
                          <button
                            type="button"
                            onClick={() => choosePayStatus('full')}
                            className="group relative text-left bg-gradient-to-br from-blue-50 to-indigo-50/40 hover:from-blue-100 hover:to-indigo-100/50 border border-blue-100 hover:border-blue-300 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(59,130,246,0.18)] active:scale-[0.99] overflow-hidden"
                          >
                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-200/30 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-300/40 transition-colors"></div>
                            <div className="relative flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(59,130,246,0.35)]">
                                <CheckCheck size={26} strokeWidth={3} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[15px] font-black text-gray-900">{language === 'বাংলা' ? 'সম্পূর্ণ পেমেন্ট' : 'Full Payment'}</p>
                                  <span className="text-[8px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md uppercase tracking-widest">{language === 'বাংলা' ? 'নীল টিক' : 'Blue Tick'}</span>
                                </div>
                                <p className="text-[11px] font-bold text-gray-500 mt-0.5 leading-snug">
                                  {language === 'বাংলা' ? `সম্পূর্ণ ${formatBDT(expected)} পেয়েছেন — ভাড়াটিয়াকে রিসিট চলে যাবে` : `Rent of ${formatBDT(expected)} received in full — receipt sent to tenant`}
                                </p>
                              </div>
                              <ArrowRight size={20} className="text-blue-500 shrink-0 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>

                          {/* Partial / Due */}
                          <button
                            type="button"
                            onClick={() => choosePayStatus('partial')}
                            className="group relative text-left bg-gradient-to-br from-amber-50 to-orange-50/40 hover:from-amber-100 hover:to-orange-100/50 border border-amber-100 hover:border-amber-300 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(251,191,36,0.20)] active:scale-[0.99] overflow-hidden"
                          >
                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-200/40 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-300/50 transition-colors"></div>
                            <div className="relative flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(251,146,60,0.35)]">
                                <Hourglass size={24} strokeWidth={2.5} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[15px] font-black text-gray-900">{language === 'বাংলা' ? 'আংশিক পেমেন্ট' : 'Partial / Due'}</p>
                                  <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md uppercase tracking-widest">{language === 'বাংলা' ? 'আংশিক' : 'Partial'}</span>
                                </div>
                                <p className="text-[11px] font-bold text-gray-500 mt-0.5 leading-snug">
                                  {language === 'বাংলা' ? 'কিছু টাকা পেয়েছেন — বাকিটা ব্যালান্স হিসেবে ট্র্যাক হবে' : 'Some amount received — balance auto-tracked & shown to tenant'}
                                </p>
                              </div>
                              <ArrowRight size={20} className="text-amber-500 shrink-0 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>

                          {/* Mark as Due (no money received) */}
                          <button
                            type="button"
                            onClick={() => choosePayStatus('due')}
                            className="group relative text-left bg-gradient-to-br from-rose-50 to-red-50/40 hover:from-rose-100 hover:to-red-100/50 border border-rose-100 hover:border-rose-300 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(244,63,94,0.18)] active:scale-[0.99] overflow-hidden"
                          >
                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-200/30 rounded-full blur-3xl pointer-events-none group-hover:bg-rose-300/40 transition-colors"></div>
                            <div className="relative flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(244,63,94,0.35)]">
                                <AlertCircle size={26} strokeWidth={2.5} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[15px] font-black text-gray-900">{language === 'বাংলা' ? 'বকেয়া হিসেবে চিহ্নিত' : 'Mark as Due'}</p>
                                  <span className="text-[8px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-md uppercase tracking-widest">{language === 'বাংলা' ? 'নোট' : 'Note'}</span>
                                </div>
                                <p className="text-[11px] font-bold text-gray-500 mt-0.5 leading-snug">
                                  {language === 'বাংলা' ? 'কোনো টাকা আসেনি — শুধু বকেয়া হিসেবে নোট রাখুন' : 'No money received yet — log it as outstanding (no receipt sent)'}
                                </p>
                              </div>
                              <ArrowRight size={20} className="text-rose-500 shrink-0 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>
                        </div>

                        {isEditing && (
                          <button
                            onClick={() => undoMarkPaid(booking.id, payForm.monthKey, payForm.memberId)}
                            className="w-full bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest border border-gray-100 transition-all flex items-center justify-center gap-2"
                          >
                            <XCircle size={14}/> {language === 'বাংলা' ? 'এই মাসের রেকর্ড মুছুন' : 'Remove this month\u2019s record'}
                          </button>
                        )}
                      </>
                    )}

                    {/* ─────────────── STEP 2 — FORM ─────────────── */}
                    {payForm.step === 'form' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPayForm(f => ({ ...f, step: 'choose' }))}
                          className="text-[10px] font-black text-gray-400 hover:text-gray-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowLeft size={12}/> {language === 'বাংলা' ? 'অপশন পরিবর্তন' : 'Change option'}
                        </button>

                        {/* Pill telling the host which mode they're in */}
                        <div className={`inline-flex items-center gap-1.5 ${theme.soft} px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest`}>
                          {payForm.status === 'full' && <><CheckCheck size={11} strokeWidth={3}/> {language === 'বাংলা' ? 'সম্পূর্ণ পেমেন্ট' : 'Full Payment'}</>}
                          {payForm.status === 'partial' && <><Hourglass size={11} strokeWidth={3}/> {language === 'বাংলা' ? 'আংশিক পেমেন্ট' : 'Partial Payment'}</>}
                          {payForm.status === 'due' && <><AlertCircle size={11} strokeWidth={3}/> {language === 'বাংলা' ? 'বকেয়া নোট' : 'Due Note'}</>}
                        </div>

                        {/* ── DUE NOTE form ───────────────────────────────── */}
                        {payForm.status === 'due' ? (
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বকেয়ার নোট (ভাড়াটিয়াকে দেখানো হবে না)' : 'Due note (visible to you only)'}</label>
                              <textarea
                                rows="3"
                                value={payForm.dueNote}
                                onChange={e => setPayForm(f => ({ ...f, dueNote: e.target.value }))}
                                placeholder={language === 'বাংলা' ? 'যেমন: ভাড়াটিয়া পরের সপ্তাহে দেবে বলেছে' : 'e.g. Tenant promised to pay next Friday'}
                                className={`w-full mt-1.5 p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent ${theme.ring} transition-all resize-none`}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ভাড়াটিয়া কবে দেবে বলেছে? (অপশনাল)' : 'Promised pay-by date (optional)'}</label>
                              <input
                                type="date"
                                value={payForm.expectedPayBy}
                                onChange={e => setPayForm(f => ({ ...f, expectedPayBy: e.target.value }))}
                                className={`w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent ${theme.ring} transition-all`}
                              />
                            </div>
                          </div>
                        ) : (
                          /* ── FULL / PARTIAL form ─────────────────────────── */
                          <div className="space-y-4">
                            {/* Amount + balance preview — the headline of the form */}
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'যত টাকা পেয়েছেন' : 'Amount received (BDT)'}</label>
                              <div className="mt-2 relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black ${theme.accent}`}>৳</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={payForm.amount}
                                  readOnly={payForm.status === 'full'}
                                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                                  className={`w-full pl-10 pr-4 py-4 bg-white rounded-xl text-2xl font-black text-gray-900 outline-none border ${payForm.status === 'full' ? 'border-blue-200 cursor-not-allowed' : 'border-amber-200'} ${theme.ring} tabular-nums tracking-tight transition-all`}
                                />
                              </div>
                              {/* Live balance / status hint */}
                              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div className="bg-white rounded-lg py-2 border border-gray-100">
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'এক্সপেক্টেড' : 'Expected'}</p>
                                  <p className="text-[12px] font-black text-gray-900 mt-0.5 tabular-nums">{formatBDT(expected)}</p>
                                </div>
                                <div className={`rounded-lg py-2 border ${balance <= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                                  <p className={`text-[8px] font-black uppercase tracking-widest ${theme.accent}`}>{language === 'বাংলা' ? 'পেইড' : 'Paid'}</p>
                                  {/* The month's TOTAL after this payment, not just this one.
                                      Showing ৳1,200 next to an Expected of ৳6,200 read as if the
                                      ৳5,000 already banked had been forgotten. */}
                                  <p className="text-[12px] font-black text-gray-900 mt-0.5 tabular-nums">{formatBDT(alreadyBanked + amt)}</p>
                                  {alreadyBanked > 0 && (
                                    <p className="text-[8px] font-bold text-gray-500 tabular-nums leading-tight">
                                      {formatBDT(alreadyBanked)} + {formatBDT(amt)}
                                    </p>
                                  )}
                                </div>
                                <div className={`rounded-lg py-2 border ${balance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-green-50 border-green-200'}`}>
                                  <p className={`text-[8px] font-black uppercase tracking-widest ${balance > 0 ? 'text-rose-600' : 'text-green-600'}`}>{language === 'বাংলা' ? 'বাকি' : 'Balance'}</p>
                                  <p className="text-[12px] font-black text-gray-900 mt-0.5 tabular-nums">{balance > 0 ? formatBDT(balance) : (language === 'বাংলা' ? 'ক্লিয়ার' : 'Cleared')}</p>
                                </div>
                              </div>
                              {payForm.status === 'full' && (
                                <p className="text-[10px] font-bold text-blue-600 mt-2 flex items-center gap-1.5">
                                  <Lock size={10}/>
                                  {/* Once part of the month is banked, "full" means
                                      the REMAINING amount — saying "locked to the
                                      monthly rent" would have the landlord expecting
                                      ৳6,200 in a box showing ৳1,200. */}
                                  {alreadyBanked > 0
                                    ? (language === 'বাংলা'
                                        ? `বাকি ${formatBDT(stillOwed)} — মাস মিটে যাবে`
                                        : `The remaining ${formatBDT(stillOwed)} — settles the month`)
                                    : (language === 'বাংলা'
                                        ? 'সম্পূর্ণ পেমেন্ট মোড — অ্যামাউন্ট লক করা'
                                        : 'Full Payment mode — amount locked to the month’s rent')}
                                </p>
                              )}
                            </div>

                            {/* Method, txn, date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'পেমেন্টের তারিখ' : 'Paid On'}</label>
                                <input type="date" value={payForm.paidOn} onChange={e => setPayForm(f => ({ ...f, paidOn: e.target.value }))} className={`w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent ${theme.ring} transition-all`} />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'পেমেন্ট মেথড' : 'Method'}</label>
                                <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} className={`w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent ${theme.ring} transition-all`}>
                                  <option>bKash</option>
                                  <option>Nagad</option>
                                  <option>Rocket</option>
                                  <option>Bank Transfer</option>
                                  <option>Cash</option>
                                  <option>Cheque</option>
                                  <option>Other</option>
                                </select>
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ট্রানজ্যাকশন আইডি' : 'Txn ID (optional)'}</label>
                                <input type="text" value={payForm.txnId} onChange={e => setPayForm(f => ({ ...f, txnId: e.target.value }))} placeholder="BK1A2B3C" className={`w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent ${theme.ring} transition-all`} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Submit row */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button
                            onClick={submitMarkPaid}
                            className={`flex-[2] bg-gradient-to-br ${theme.from} ${theme.to} text-white py-4 rounded-xl font-black hover:-translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,0,0,0.15)]`}
                          >
                            {/* The button says what will ACTUALLY be saved. With the
                                remaining ৳1,200 typed into a form still marked
                                "partial", a button reading "Save Partial" was
                                describing the button, not the outcome — the month
                                settles either way, because the status follows the
                                money. */}
                            {payForm.status !== 'due' && (balance <= 0
                              ? <><CheckCheck size={18} strokeWidth={3}/> {language === 'বাংলা' ? 'পূর্ণ পেইড সেভ ও রিসিট পাঠান' : 'Save Full Payment & Send Receipt'}</>
                              : <><Hourglass size={18} strokeWidth={3}/> {language === 'বাংলা' ? 'আংশিক সেভ ও রিসিট পাঠান' : 'Save Partial & Send Receipt'}</>)}
                            {payForm.status === 'due' && <><AlertCircle size={18} strokeWidth={3}/> {language === 'বাংলা' ? 'বকেয়া হিসেবে সেভ' : 'Save as Due'}</>}
                          </button>
                          {isEditing && (
                            <button onClick={() => undoMarkPaid(booking.id, payForm.monthKey, payForm.memberId)} className="flex-1 bg-red-50 text-red-600 py-4 rounded-xl font-black hover:bg-red-100 transition-all text-xs flex items-center justify-center gap-1.5 border border-red-100">
                              <XCircle size={14} /> {language === 'বাংলা' ? 'রেকর্ড মুছুন' : 'Remove'}
                            </button>
                          )}
                        </div>

                        {/* Tenant-receipt reassurance line — explains the cross-system bridge to the host */}
                        {payForm.status !== 'due' && (
                          <p className="text-center text-[10px] font-bold text-gray-400 leading-snug">
                            <Sparkles size={10} className="inline -mt-0.5 mr-1 text-amber-500" />
                            {language === 'বাংলা'
                              ? `সেভ করার সাথে সাথে ${booking.tenant} এর পেমেন্ট ইনবক্সে ${payForm.status === 'full' ? 'নীল টিক' : 'অ্যাম্বার'} রিসিট চলে যাবে।`
                              : `On save, ${booking.tenant}\u2019s tenant inbox gets a ${payForm.status === 'full' ? 'blue-tick' : 'partial'} receipt instantly.`}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ─ Premium Gate — non-premium hosts trying to convert/create ─ */}
              {activeModal === 'premium_gate' && (
                <div className="text-center space-y-5">
                  <div className="w-20 h-20 mx-auto rounded-[1.4rem] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_12px_30px_rgba(251,146,60,0.35)]">
                    <Crown size={36} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-gray-900 leading-tight">{language === 'বাংলা' ? 'প্রিমিয়াম ফিচার' : 'Premium Feature'}</h4>
                    <p className="text-gray-500 font-bold mt-2 text-sm leading-relaxed">
                      {language === 'বাংলা'
                        ? 'বুকিং কনভার্সন, রেন্ট লেজার ও অটো রিমাইন্ডার প্রিমিয়াম সাবস্ক্রিপশনে চালু থাকে।'
                        : 'Booking conversion, the rent ledger, and auto-reminders are part of the premium plan.'}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-2xl border border-gray-100 text-left space-y-2.5">
                    {[
                      language === 'বাংলা' ? 'মাসিক ভাড়ার অটো ট্র্যাকিং' : 'Per-tenant monthly rent tracking',
                      language === 'বাংলা' ? 'ডিউ ডেটের আগে অটো SMS / ইমেইল' : 'Auto SMS / email before due date',
                      language === 'বাংলা' ? 'বকেয়া অ্যালার্ট ও পেমেন্ট লগ' : 'Overdue alerts & payment log',
                      language === 'বাংলা' ? 'ইনকোয়ারি থেকে বুকিং কনভার্সন' : 'Convert inquiries into bookings',
                    ].map((line, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                        <span className="text-[12px] font-bold text-gray-700 leading-snug">{line}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2.5 pt-2">
                    <button
                      onClick={() => {
                        // TODO(backend): redirect to /pricing or open Stripe checkout.
                        navigate('/pricing');
                        setActiveModal(null);
                      }}
                      className="w-full bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-4 rounded-xl font-black shadow-[0_8px_20px_rgba(251,146,60,0.3)] hover:-translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <Sparkles size={16} /> {language === 'বাংলা' ? 'প্রিমিয়াম আপগ্রেড করুন' : 'Upgrade to Premium'}
                    </button>
                  </div>
                </div>
              )}

              {activeModal === 'edit' && modalData && (() => {
                // Convert a File input to a base64 data: URL so the preview
                // survives a reload (localStorage can't hold blob: URLs).
                // Replaced by a multipart POST /api/uploads call when the
                // backend ships.
                const readFileAsDataUrl = (file) =>
                  new Promise((resolve, reject) => {
                    if (!file) return resolve('');
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(reader.error || new Error('File read failed'));
                    reader.readAsDataURL(file);
                  });
                const onCoverChange = async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await readFileAsDataUrl(file);
                  setEditForm(f => ({ ...f, img: url, images: [url, ...(f.images || []).slice(1)] }));
                };
                const onGalleryAdd = async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  const urls = await Promise.all(files.map(readFileAsDataUrl));
                  setEditForm(f => ({ ...f, images: [...(f.images || []), ...urls.filter(Boolean)] }));
                  e.target.value = '';
                };
                const removeGalleryAt = (idx) => {
                  setEditForm(f => {
                    const next = (f.images || []).filter((_, i) => i !== idx);
                    // If the removed image was the cover, fall back to the
                    // next available picture so the card never goes blank.
                    const img = f.img === f.images?.[idx] ? (next[0] || '') : f.img;
                    return { ...f, images: next, img };
                  });
                };
                const makeCover = (idx) => {
                  setEditForm(f => {
                    const url = f.images?.[idx];
                    if (!url) return f;
                    const rest = f.images.filter((_, i) => i !== idx);
                    return { ...f, img: url, images: [url, ...rest] };
                  });
                };
                const statusOptions = [
                  { id: 'active', label: language === 'বাংলা' ? 'অ্যাক্টিভ' : 'Active', tone: 'bg-green-50 text-green-700 border-green-200' },
                  { id: 'paused', label: language === 'বাংলা' ? 'পজড' : 'Paused', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
                  { id: 'rented', label: language === 'বাংলা' ? 'ভাড়া হয়েছে' : 'Rented', tone: 'bg-gray-100 text-gray-700 border-gray-200' },
                ];
                const handleSave = async () => {
                  if (!editForm.title.trim() || !String(editForm.price).trim()) {
                    showToast(language === 'বাংলা' ? 'নাম এবং মূল্য আবশ্যক!' : 'Title and price are required!');
                    return;
                  }

                  const parseSafeNum = (val) => {
                    if (!val && val !== 0) return 0;
                    const bnToEn = str => String(str).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
                    const cleaned = bnToEn(val).replace(/[^\d.]/g, '');
                    return Number(cleaned) || 0;
                  };

                  const priceNumber = parseSafeNum(editForm.price);
                  const cover = editForm.img || (editForm.roomPhotos || [])[0]?.preview || (editForm.roomPhotos || [])[0]?.url || '';
                  
                  const existingRoomPhotos = modalData.roomPhotos || [];
                  const roomPhotos = editForm.roomPhotos || [];
                  
                  const patch = {
                    title: editForm.title.trim(),
                    location: editForm.location.trim(),
                    beds: parseSafeNum(editForm.beds),
                    baths: parseSafeNum(editForm.baths),
                    sqft: parseSafeNum(editForm.sqft),
                    floor: parseSafeNum(editForm.floor),
                    furnishing: editForm.furnishing,
                    description: editForm.description,
                    status: editForm.status,
                    coverPhoto: cover,
                    price: priceNumber,
                    roomPhotos: roomPhotos,
                    specificDetails: editForm.specificDetails || {},
                  };
                  // Persist host-owned listings; demo seed entries fall through
                  // and live only in component state.
                  try {
                    const updatedProperty = await propertyService.updateProperty(modalData.id, patch);
                    
                    setProperties(prev => prev.map(p => p.id === modalData.id ? {
                      ...p,
                      ...updatedProperty,
                      // Mirror the cover to the display aliases the card reads.
                      img: updatedProperty.coverPhoto || cover,
                      coverPhoto: updatedProperty.coverPhoto || cover,
                      images: Array.isArray(updatedProperty.roomPhotos) 
                        ? updatedProperty.roomPhotos.map(rp => rp.url).filter(Boolean)
                        : (editForm.roomPhotos || []).map(p => p.preview || p.url),
                      // Keep the display-formatted price string on the card.
                      price: priceNumber.toLocaleString('en-IN'),
                    } : p));
                    showToast(language === 'বাংলা' ? 'প্রপার্টি আপডেট হয়েছে!' : 'Property Saved Successfully!');
                    setActiveModal(null);
                  } catch (err) {
                    console.error('[EditProperty] Failed to update:', err);
                    showToast(language === 'বাংলা' ? 'আপডেট ব্যর্থ হয়েছে!' : 'Failed to update property.');
                  }
                };
                const coverPreview = editForm.img || editForm.roomPhotos?.[0]?.preview || '';
                const showBedsBaths = modalData.intent !== 'commercial' && !['land', 'building'].includes(modalData.type);
                return (
                  <div className="space-y-5">
                    {/* Cover photo swap */}
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'কভার ছবি' : 'Cover Photo'}</label>
                      <div className="mt-1.5 relative w-full aspect-[16/9] bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                        {coverPreview ? (
                          <img src={coverPreview} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs font-black">
                            {language === 'বাংলা' ? 'কভার ছবি যোগ করুন' : 'Add a cover photo'}
                          </div>
                        )}
                        <label className="absolute bottom-3 right-3 cursor-pointer inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black text-gray-900 border border-gray-100 shadow-sm hover:bg-white">
                          <Camera size={12}/> {language === 'বাংলা' ? 'বদলান' : 'Replace'}
                          <input type="file" accept="image/*" className="hidden" onChange={onCoverChange} />
                        </label>
                      </div>
                    </div>

                    {/* Room Photos */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                         <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'রুম অনুযায়ী ছবি' : 'Room Photos'}</label>
                            <p className="text-[11px] font-bold text-gray-400 mt-1">
                               {language === 'বাংলা' 
                                 ? 'শোবার ঘর, বাথরুম, বসার ঘর ইত্যাদির ছবি আলাদাভাবে যোগ করুন।' 
                                 : 'Add photos for each room separately.'}
                            </p>
                         </div>
                         <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{(editForm.roomPhotos || []).length}/20</span>
                      </div>

                      {/* Room Photo Tabs */}
                      <div className="flex gap-2 flex-wrap mb-4">
                        {getRoomTypes(modalData.intent, modalData.type).map(rt => (
                          <button key={rt.id} type="button"
                            onClick={() => setSelectedRoomType(rt.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all
                              ${selectedRoomType === rt.id
                                ? 'bg-gray-900 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {rt.icon && <rt.icon size={15} />}
                            {language === 'বাংলা' ? rt.labelBn : rt.label}
                            <span className="text-[9px] font-black opacity-60">
                              ({(editForm.roomPhotos || []).filter(p => p.room === rt.id).length})
                            </span>
                          </button>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {/* Upload Button specific for room */}
                        {(editForm.roomPhotos || []).length < 20 && (
                          <label className="aspect-square border-2 border-dashed border-gray-200 hover:border-[#ba0036] hover:bg-red-50/20 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group">
                             <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;
                                const urls = await Promise.all(files.map(readFileAsDataUrl));
                                const newPhotos = urls.filter(Boolean).map((url, index) => ({
                                   id: Date.now() + Math.random(),
                                   url: url,
                                   preview: url,
                                   room: selectedRoomType,
                                   file: files[index]
                                }));
                                setEditForm(f => ({ ...f, roomPhotos: [...(f.roomPhotos || []), ...newPhotos] }));
                                e.target.value = '';
                             }} />
                             <Plus size={20} className="text-gray-400 group-hover:text-[#ba0036] mb-1" />
                             <span className="text-[9px] font-bold text-gray-400 group-hover:text-[#ba0036] px-2">{language === 'বাংলা' ? 'ছবি যোগ' : 'Add Photos'}</span>
                          </label>
                        )}
                        
                        {/* Filtered Photos */}
                        {(editForm.roomPhotos || []).filter(p => p.room === selectedRoomType).map((photo) => (
                          <div key={photo.id || photo.preview || photo.url} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100 shadow-sm">
                            <img src={photo.preview || photo.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            {editForm.img === (photo.preview || photo.url) && (
                              <div className="absolute top-1 left-1 bg-[#ba0036] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">{language === 'বাংলা' ? 'কভার' : 'Cover'}</div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                              {editForm.img !== (photo.preview || photo.url) && (
                                <button type="button" onClick={() => setEditForm(f => ({...f, img: (photo.preview || photo.url)}))} className="bg-white text-gray-900 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">{language === 'বাংলা' ? 'কভার' : 'Cover'}</button>
                              )}
                              <button type="button" onClick={() => {
                                setEditForm(f => {
                                  const next = (f.roomPhotos || []).filter(p => p !== photo);
                                  const removedUrl = photo.preview || photo.url;
                                  const img = f.img === removedUrl ? (next[0]?.preview || next[0]?.url || '') : f.img;
                                  return { ...f, roomPhotos: next, img };
                                });
                              }} className="bg-red-500 text-white p-1.5 rounded-md"><Trash size={12}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t?.propertyTitleLabel || (language === 'বাংলা' ? 'প্রপার্টির নাম' : 'Property Title')}</label>
                        <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({...f, title: e.target.value}))} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t?.priceLabel || (language === 'বাংলা' ? 'মূল্য (টাকা)' : 'Price (BDT)')}</label>
                        <input type="text" value={editForm.price} onChange={e => setEditForm(f => ({...f, price: e.target.value}))} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'লোকেশন' : 'Location'}</label>
                      <input type="text" value={editForm.location} onChange={e => setEditForm(f => ({...f, location: e.target.value}))} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20" />
                    </div>

                    <div className={`grid ${showBedsBaths ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
                      {showBedsBaths && (
                        <>
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বেডরুম' : 'Beds'}</label>
                            <input type="number" min="0" value={editForm.beds} onChange={e => setEditForm(f => ({...f, beds: e.target.value}))} className="w-full mt-1.5 p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বাথরুম' : 'Baths'}</label>
                            <input type="number" min="0" value={editForm.baths} onChange={e => setEditForm(f => ({...f, baths: e.target.value}))} className="w-full mt-1.5 p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20" />
                          </div>
                        </>
                      )}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বর্গফুট' : 'Sqft'}</label>
                        <input type="number" min="0" value={editForm.sqft} onChange={e => setEditForm(f => ({...f, sqft: e.target.value}))} className="w-full mt-1.5 p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'কত তলায়' : 'Floor'}</label>
                        <input type="number" min="0" value={editForm.floor} onChange={e => setEditForm(f => ({...f, floor: e.target.value}))} className="w-full mt-1.5 p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'ফার্নিশিং' : 'Furnishing'}</label>
                      <select
                        value={editForm.furnishing}
                        onChange={e => setEditForm(f => ({...f, furnishing: e.target.value}))}
                        className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20"
                      >
                        <option value="Furnished">{language === 'বাংলা' ? 'ফার্নিশড' : 'Furnished'}</option>
                        <option value="Semi-Furnished">{language === 'বাংলা' ? 'সেমি-ফার্নিশড' : 'Semi-Furnished'}</option>
                        <option value="Unfurnished">{language === 'বাংলা' ? 'আনফার্নিশড' : 'Unfurnished'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'বিবরণ' : 'Description'}</label>
                      <textarea
                        rows={4}
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({...f, description: e.target.value}))}
                        className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20 resize-none"
                        placeholder={language === 'বাংলা' ? 'প্রপার্টির বিবরণ লিখুন...' : 'Describe the property...'}
                      />
                    </div>

                    {/* Status picker — including the user's requested
                        "Rented" option. Switching to rented flips the card
                        chrome to the lease view and removes the
                        Inquiries/Pause buttons in the grid. */}
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'স্ট্যাটাস' : 'Status'}</label>
                      <div className="mt-1.5 grid grid-cols-3 gap-2">
                        {statusOptions.map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setEditForm(f => ({...f, status: opt.id}))}
                            className={`px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${editForm.status === opt.id ? `${opt.tone} ring-2 ring-offset-1 ring-[#ba0036]/30` : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Intent-specific details — the SAME fields as the
                        AddProperty wizard, driven by this property's intent +
                        type (shared config). Hidden when the property has no
                        intent/type or that combo has no extra fields. */}
                    {(() => {
                      const dynFields = getDynamicFields(modalData.intent, modalData.type);
                      if (!modalData.intent || !modalData.type || dynFields.length === 0) return null;
                      const isBn = language === 'বাংলা';
                      const labelCls = "text-[10px] font-black text-gray-400 uppercase tracking-widest";
                      const fieldCls = "w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all border border-transparent focus:border-[#ba0036]/20";
                      const setSpec = (key, val) => setEditForm(f => ({ ...f, specificDetails: { ...(f.specificDetails || {}), [key]: val } }));
                      return (
                        <div className="space-y-4 pt-1">
                          <p className="text-[11px] font-black text-gray-900">{isBn ? 'অতিরিক্ত তথ্য' : 'Additional Details'}</p>
                          {dynFields.map((fld) => {
                            const v = (editForm.specificDetails || {})[fld.key];
                            if (fld.kind === 'select') {
                              return (
                                <div key={fld.key}>
                                  <label className={labelCls}>{isBn ? fld.labelBn : fld.label}</label>
                                  <select value={v || ''} onChange={e => setSpec(fld.key, e.target.value)} className={fieldCls}>
                                    <option value="">{isBn ? 'নির্বাচন করুন' : 'Select…'}</option>
                                    {fld.options.map(o => <option key={o.id} value={o.id}>{isBn ? o.labelBn : o.label}</option>)}
                                  </select>
                                </div>
                              );
                            }
                            if (fld.kind === 'toggle') {
                              return (
                                <div key={fld.key}>
                                  <label className={labelCls}>{isBn ? fld.labelBn : fld.label}</label>
                                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                                    {[{ val: true, en: 'Yes', bn: 'হ্যাঁ' }, { val: false, en: 'No', bn: 'না' }].map(opt => (
                                      <button key={String(opt.val)} type="button" onClick={() => setSpec(fld.key, opt.val)}
                                        className={`py-3 rounded-xl text-xs font-black border transition-all ${v === opt.val ? 'bg-[#ba0036]/5 border-[#ba0036] text-[#ba0036]' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}>
                                        {isBn ? opt.bn : opt.en}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={fld.key}>
                                <label className={labelCls}>{isBn ? fld.labelBn : fld.label}</label>
                                <input type={fld.kind === 'number' ? 'number' : 'text'} value={v || ''}
                                  onChange={e => setSpec(fld.key, e.target.value)}
                                  placeholder={isBn ? (fld.placeholderBn || '') : (fld.placeholder || '')}
                                  className={fieldCls} />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleSave}
                      className="w-full mt-2 bg-[#ba0036] text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(186,0,54,0.2)] hover:shadow-[0_12px_20px_rgba(186,0,54,0.3)] hover:-translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <Check size={16}/> {t?.saveChangesBtn || (language === 'বাংলা' ? 'সেভ করুন' : 'Save Changes')}
                    </button>
                  </div>
                );
              })()}

              {activeModal === 'lease' && modalData && (() => {
                // Pull live lease info from the booking that matches this
                // property, if one exists. No hardcoded "Mr. John Doe" — show
                // a friendly placeholder when there's no active lease yet.
                const booking = bookings.find(b => String(b.propertyId) === String(modalData.id));
                const tenantName = booking?.tenant || booking?.tenantName || (language === 'বাংলা' ? 'কোনো ভাড়াটিয়া নেই' : 'No active tenant');
                const rentDisplay = typeof booking?.monthlyRent === 'number'
                  ? formatBDT(booking.monthlyRent)
                  : (modalData.price ? `৳ ${modalData.price}` : '—');
                // No end date on a live lease means ongoing, not "not set" —
                // that read like the host had forgotten to fill something in.
                const validUntil = booking?.leaseEnd
                  ? new Date(booking.leaseEnd).toLocaleDateString(language === 'বাংলা' ? 'bn-BD' : 'en-US', { month: 'short', year: 'numeric' })
                  : booking
                    ? (language === 'বাংলা' ? 'চলমান' : 'Ongoing')
                    : (language === 'বাংলা' ? 'নির্ধারিত হয়নি' : 'Not set');
                return (
                  <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-[1.2rem] flex items-center justify-center mx-auto mb-3 shadow-sm"><FileText size={32} /></div>
                    <div><h4 className="text-2xl font-black text-gray-900 leading-tight">{modalData.title}</h4><p className="text-gray-500 font-bold mt-1.5 text-xs">{t?.activeLeaseAgreement || (language === 'বাংলা' ? 'অ্যাক্টিভ লিজ এগ্রিমেন্ট' : 'Active Lease Agreement')}</p></div>
                    <div className="bg-gray-50 p-6 rounded-2xl text-left space-y-4">
                      <div className="flex justify-between items-center"><span className="text-gray-400 font-black text-[10px] uppercase tracking-widest">{t?.tenantLabel || (language === 'বাংলা' ? 'ভাড়াটিয়া' : 'Tenant')}</span> <span className="font-black text-gray-900 text-[15px]">{tenantName}</span></div>
                      <div className="flex justify-between items-center"><span className="text-gray-400 font-black text-[10px] uppercase tracking-widest">{t?.rentLabel || (language === 'বাংলা' ? 'ভাড়া' : 'Rent')}</span> <span className="font-black text-gray-900 text-[15px]">{rentDisplay}{booking ? '/mo' : ''}</span></div>
                      <div className="flex justify-between items-center"><span className="text-gray-400 font-black text-[10px] uppercase tracking-widest">{t?.validUntilLabel || (language === 'বাংলা' ? 'মেয়াদ' : 'Valid Until')}</span> <span className="font-black text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs">{validUntil}</span></div>
                    </div>
                    <button onClick={() => { showToast(language === 'বাংলা' ? 'ডাউনলোড হচ্ছে...' : 'Downloading Document...'); setActiveModal(null); }} className="w-full bg-gray-900 text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(0,0,0,0.1)] hover:bg-[#ba0036] transition-all text-sm">{t?.downloadPdfBtn || (language === 'বাংলা' ? 'পিডিএফ ডাউনলোড করুন' : 'Download PDF')}</button>
                  </div>
                );
              })()}

              {activeModal === 'settings' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-[#ba0036]"><Mail size={20}/></div>
                      <div><p className="text-sm font-black text-gray-900">{t?.emailAlerts || (language === 'বাংলা' ? 'ইমেইল অ্যালার্ট' : 'Email Alerts')}</p><p className="text-[10px] text-gray-500 font-bold mt-0.5">{t?.emailAlertsDesc || (language === 'বাংলা' ? 'ইনকোয়ারি ইমেইল পান' : 'Get inquiry emails')}</p></div>
                    </div>
                    <div className="w-12 h-7 bg-[#ba0036] rounded-full relative cursor-pointer shadow-inner"><div className="w-5 h-5 bg-white rounded-full absolute right-1 top-1 shadow-sm"></div></div>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Shield size={20}/></div>
                      <div><p className="text-sm font-black text-gray-900">{t?.twoFactorAuth || (language === 'বাংলা' ? '২-ফ্যাক্টর' : '2-Factor Auth')}</p><p className="text-[10px] text-gray-500 font-bold mt-0.5">{t?.twoFactorAuthDesc || (language === 'বাংলা' ? 'অ্যাকাউন্ট সুরক্ষিত রাখুন' : 'Secure your account')}</p></div>
                    </div>
                    <div className="w-12 h-7 bg-gray-200 rounded-full relative cursor-pointer shadow-inner"><div className="w-5 h-5 bg-white rounded-full absolute left-1 top-1 shadow-sm"></div></div>
                  </div>
                  <button onClick={() => { showToast(language === 'বাংলা' ? 'সেটিংস সেভ হয়েছে!' : 'Settings Saved!'); setActiveModal(null); }} className="w-full mt-5 bg-[#ba0036] text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(186,0,54,0.25)] hover:-translate-y-0.5 transition-all text-sm">{t?.savePreferencesBtn || (language === 'বাংলা' ? 'সেভ করুন' : 'Save Preferences')}</button>
                </div>
              )}

              {activeModal === 'support' && (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-gray-500 mb-3">{t?.needHelpDesc || (language === 'বাংলা' ? 'কোনো সমস্যা হচ্ছে? আমাদের মেসেজ দিন।' : 'Need help with your properties? Send us a message.')}</p>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t?.subjectLabel || (language === 'বাংলা' ? 'বিষয়' : 'Subject')}</label><input type="text" placeholder={t?.subjectPlaceholder || (language === 'বাংলা' ? 'যেমন: পেমেন্ট সমস্যা' : 'e.g. Payment Issue')} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t?.messageLabel || (language === 'বাংলা' ? 'মেসেজ' : 'Message')}</label><textarea rows="4" placeholder={t?.messagePlaceholder || (language === 'বাংলা' ? 'আপনার সমস্যার কথা লিখুন...' : 'Describe your issue...')} className="w-full mt-1.5 p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] transition-all resize-none" /></div>
                  <button onClick={() => { showToast(language === 'বাংলা' ? 'মেসেজ পাঠানো হয়েছে!' : 'Message Sent to Support!'); setActiveModal(null); }} className="w-full mt-3 bg-[#ba0036] text-white py-4 rounded-xl font-black shadow-[0_8px_15px_rgba(186,0,54,0.2)] hover:-translate-y-0.5 transition-all text-sm">{t?.sendMessageBtn || (language === 'বাংলা' ? 'সেন্ড করুন' : 'Send Message')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─ Booking Delete Confirmation ─ Full-screen overlay modal ─ */}
      {confirmDeleteBookingId && (() => {
        const bk = bookings.find(b => b.id === confirmDeleteBookingId);
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteBookingId(null)}>
            <div className="bg-white rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.2)] max-w-sm w-[90%] mx-auto p-8 text-center space-y-5 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 flex items-center justify-center">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <div>
                <h4 className="text-xl font-black text-gray-900">{language === 'বাংলা' ? 'বুকিং ডিলিট করবেন?' : 'Delete this booking?'}</h4>
                {bk && <p className="text-sm text-gray-500 font-bold mt-2">{bk.tenant} — {bk.property}</p>}
                <p className="text-xs text-gray-400 mt-1">{language === 'বাংলা' ? 'এই অ্যাকশন আর undo করা যাবে না।' : 'This action cannot be undone.'}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteBookingId(null)} className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                  {language === 'বাংলা' ? 'বাতিল' : 'Cancel'}
                </button>
                <button onClick={() => handleRemoveBooking(confirmDeleteBookingId)} className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-red-600 text-white hover:bg-red-700 transition-colors shadow-[0_8px_20px_rgba(220,38,38,0.3)]">
                  {language === 'বাংলা' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {activeModal === 'schedule_visit' && modalData && (
        <ScheduleVisitModal 
          inquiry={modalData} 
          onClose={closeModal} 
          onSchedule={(visit) => {
            const updated = inquiries.map(i => i.id === modalData.id ? { ...i, visitSchedule: visit } : i);
            setInquiries(updated);
            closeModal();
            showToast(language === 'বাংলা' ? 'ভিজিট শিডিউল করা হয়েছে' : 'Visit scheduled successfully.');
          }}
        />
      )}
    </div>
  );
};

export default HostDashboard;

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  TimelineRow — Single timeline row for the "Verification Status"     ║
// ╚══════════════════════════════════════════════════════════════════════╝
const TimelineRow = ({ done, icon: Icon, textEn, textBn, language, isFinal = false }) => (
  <div className="flex items-center gap-3">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
      done
        ? (isFinal ? 'bg-blue-500 text-white' : 'bg-green-500 text-white')
        : 'bg-gray-100 text-gray-400'
    }`}>
      {done ? (isFinal ? <BadgeCheck size={16} /> : <Check size={14} />) : <Icon size={14} />}
    </div>
    <p className={`text-sm font-black ${done ? 'text-gray-900' : 'text-gray-400'}`}>
      {language === 'বাংলা' ? textBn : textEn}
    </p>
  </div>
);

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  TrustGauge — circular 0-100 score with tier (Bronze/Silver/Gold/   ║
// ║  Platinum) + breakdown list. Lives in the right sidebar of the      ║
// ║  Profile tab. The headline metric landlords + tenants both see.     ║
// ╚══════════════════════════════════════════════════════════════════════╝
const TrustGauge = ({ score, tier, breakdown, language }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const tierMeta = {
    bronze:   { label: language === 'বাংলা' ? 'ব্রোঞ্জ' : 'Bronze',     color: '#a1764e', glow: 'rgba(161,118,78,0.20)' },
    silver:   { label: language === 'বাংলা' ? 'সিলভার' : 'Silver',     color: '#9ca3af', glow: 'rgba(156,163,175,0.20)' },
    gold:     { label: language === 'বাংলা' ? 'গোল্ড' : 'Gold',         color: '#d4a017', glow: 'rgba(212,160,23,0.25)' },
    platinum: { label: language === 'বাংলা' ? 'প্ল্যাটিনাম' : 'Platinum', color: '#3b82f6', glow: 'rgba(59,130,246,0.30)' },
  }[tier] || { label: 'Bronze', color: '#a1764e', glow: 'rgba(0,0,0,0.05)' };

  return (
    <div className="relative bg-gradient-to-br from-white to-gray-50/40 rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 md:p-8 overflow-hidden">
      {/* Tier-tinted halo for futuristic feel */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: tierMeta.glow }}
      />
      <div className="relative z-10 flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: `${tierMeta.color}18` }}>
          <ShieldCheck size={18} style={{ color: tierMeta.color }} />
        </div>
        <div>
          <h3 className="text-sm font-black text-gray-900">
            {language === 'বাংলা' ? 'ট্রাস্ট স্কোর' : 'Trust Score'}
          </h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {language === 'বাংলা' ? 'ভাড়াটিয়ারা যা দেখে' : 'What tenants see'}
          </p>
        </div>
      </div>

      {/* Circular gauge */}
      <div className="relative z-10 flex flex-col items-center mb-6">
        <div className="relative" style={{ filter: `drop-shadow(0 8px 24px ${tierMeta.glow})` }}>
          <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
            <defs>
              <linearGradient id={`grad-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={tierMeta.color} stopOpacity="1" />
                <stop offset="100%" stopColor={tierMeta.color} stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="80" r={r} fill="none" stroke="#f3f4f6" strokeWidth="11" />
            <circle
              cx="80" cy="80" r={r} fill="none"
              stroke={`url(#grad-${tier})`}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Big score with subtle gradient text — feels premium */}
            <div className="flex items-baseline gap-0.5">
              <span className="text-5xl font-black leading-none tabular-nums tracking-tight bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-transparent">{score}</span>
              <span className="text-base font-black text-gray-300 leading-none">/100</span>
            </div>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.18em] mt-1.5">
              {language === 'বাংলা' ? 'স্কোর' : 'SCORE'}
            </span>
          </div>
        </div>
        <div
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm"
          style={{ background: `${tierMeta.color}15`, color: tierMeta.color, borderColor: `${tierMeta.color}30` }}
        >
          <BadgeCheck size={12} /> {tierMeta.label}
        </div>
      </div>

      {/* Breakdown list — three states, matching TenantDashboard's gauge.
          The amber "in review" row is what tells a landlord their NID upload
          landed but is still queued, instead of looking indistinguishable from
          never having sent it. */}
      <div className="relative z-10 space-y-2">
        {breakdown.map((b) => {
          const inReview = !b.done && b.supplied;
          return (
            <div key={b.key} className="flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className={`flex items-center gap-2 min-w-0 ${b.done ? 'text-gray-700' : inReview ? 'text-amber-700' : 'text-gray-400'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  b.done
                    ? 'bg-green-500 text-white shadow-[0_0_0_3px_rgba(34,197,94,0.12)]'
                    : inReview
                      ? 'bg-amber-500 text-white shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
                      : 'bg-gray-100'
                }`}>
                  {b.done ? <Check size={10} /> : inReview ? <Hourglass size={9} /> : null}
                </span>
                <span className="truncate">{language === 'বাংলা' ? b.labelBn : b.labelEn}</span>
              </span>
              {inReview ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 shrink-0 whitespace-nowrap">
                  {language === 'বাংলা' ? 'রিভিউতে' : 'In review'}
                </span>
              ) : (
                <span className={`tabular-nums shrink-0 ${b.done ? 'text-green-600' : 'text-gray-300'}`}>+{b.pts}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  QuickWinsCard — top 3 unfilled high-impact items the user can      ║
// ║  knock out fastest to raise their Trust Score.                       ║
// ╚══════════════════════════════════════════════════════════════════════╝
const QuickWinsCard = ({ breakdown, language, onJump }) => {
  // Suggest the 3 highest-value items the landlord can still ACT on. Items
  // already sitting in the review queue are not actionable — asking for them
  // again just makes the user redo work.
  const top = [...breakdown]
    .filter((b) => !(b.supplied ?? b.done))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3);
  if (top.length === 0) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-white rounded-[2rem] border border-emerald-100 shadow-[0_4px_20px_rgba(16,185,129,0.08)] p-6 md:p-8">
        <div className="flex items-center gap-3 mb-2">
          <BadgeCheck className="text-emerald-600" size={20} />
          <h3 className="text-sm font-black text-gray-900">{language === 'বাংলা' ? 'প্রোফাইল সম্পূর্ণ! 🎉' : 'Profile Complete! 🎉'}</h3>
        </div>
        <p className="text-xs font-bold text-gray-600 leading-relaxed">
          {language === 'বাংলা' ? 'অসাধারণ! আপনার প্রোফাইল ১০০% — ভাড়াটিয়াদের কাছে আপনি এখন প্ল্যাটিনাম।' : 'You hit max Trust Score. Tenants see you as Platinum tier.'}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#ba0036]/10 flex items-center justify-center">
          <Edit3 className="text-[#ba0036]" size={18} />
        </div>
        <div>
          <h3 className="text-sm font-black text-gray-900">{language === 'বাংলা' ? 'দ্রুত উন্নতি' : 'Quick Wins'}</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'স্কোর বাড়ান' : 'Boost your score'}</p>
        </div>
      </div>
      <div className="space-y-2">
        {top.map((b) => (
          <button
            key={b.key}
            onClick={() => onJump && onJump(b.key)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-[#ba0036]/5 border border-gray-100 hover:border-[#ba0036]/20 transition-all group text-left"
          >
            <span className="text-[12px] font-black text-gray-800 group-hover:text-[#ba0036] transition-colors">{language === 'বাংলা' ? b.labelBn : b.labelEn}</span>
            <span className="bg-[#ba0036]/10 text-[#ba0036] px-2 py-0.5 rounded-full text-[10px] font-black">+{b.pts}</span>
          </button>
        ))}
      </div>
    </div>
  );
};