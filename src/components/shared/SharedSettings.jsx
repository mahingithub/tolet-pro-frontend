/**
 * SharedSettings — the global settings hub.
 * ──────────────────────────────────────────────────────────────────────────
 * A single, role-aware settings screen rendered as the "Account settings" tab
 * inside BOTH the Tenant and Host dashboards. It is organised into three
 * scopes that mirror the backend `User.preferences` schema:
 *
 *   • App settings       — apply to the whole account (theme, language,
 *                          notifications, privacy, AI & data, legal).
 *   • Tenant settings     — shown when the user has the `tenant` role.
 *   • Landlord settings   — shown when the user has the `landlord` role.
 *
 * LAYOUT
 *   • Desktop (lg+): each scope is a master-detail — a left-hand category rail
 *     (Account, Notifications, …) drives a right-hand detail pane. Clicking a
 *     category swaps the pane; the active category is highlighted.
 *   • Mobile: the same categories collapse into a stacked accordion.
 *
 * Every control is wired to the backend through `useSettings()` (which calls
 * PATCH /api/users/me/preferences and caches locally). There are no mock
 * toggles — each change persists. Sound + Do Not Disturb additionally drive
 * the live NotificationContext; theme + reduce-motion are applied globally by
 * SettingsContext.
 *
 * Props:
 *   onGoToProfile?: () => void  — the parent dashboard flips its own tab to
 *                                 "Profile"; when absent we route there.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronRight, User, Shield, ShieldCheck, Bell, CreditCard,
  Smartphone, Scale, Globe, Trash2, LogOut, Download, ExternalLink,
  Home, Search, MessageSquare, Eye, Calendar, Building2, Sparkles,
  KeyRound, RotateCcw, Pencil, Sun, Moon, Monitor,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useNotificationSettings } from '../../context/NotificationContext';
import ChangePasswordModal from './ChangePasswordModal.jsx';

// ─── Language mapping (LanguageContext uses labels, backend uses codes) ──────
const toLangCode = (label) => (label === 'বাংলা' ? 'bn' : 'en');

// ─── Row + control primitives ─────────────────────────────────────────────────
const Row = ({ label, sublabel, right, children }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-b-0">
    <div className="min-w-0">
      <p className="text-sm font-black text-gray-900 truncate">{label}</p>
      {sublabel && <p className="text-[11px] font-bold text-gray-400 truncate">{sublabel}</p>}
    </div>
    <div className="shrink-0">{right ?? children}</div>
  </div>
);

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/25 [-webkit-tap-highlight-color:transparent] ${checked ? 'bg-[#ba0036]' : 'bg-gray-300'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    role="switch"
    aria-checked={checked}
  >
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const SelectInput = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-900 cursor-pointer transition-all duration-150 hover:border-gray-300 focus:outline-none focus:border-[#ba0036] focus:ring-4 focus:ring-[#ba0036]/15 [-webkit-tap-highlight-color:transparent]"
  >
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

// ─── Theme segmented control (Light / Dark / System) ─────────────────────────
const ThemeSwitcher = ({ value, onChange, bn }) => {
  const items = [
    { value: 'light', label: bn ? 'লাইট' : 'Light', icon: Sun },
    { value: 'dark', label: bn ? 'ডার্ক' : 'Dark', icon: Moon },
    { value: 'system', label: bn ? 'সিস্টেম' : 'System', icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label={bn ? 'থিম' : 'Theme'} className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-gray-100">
      {items.map(({ value: v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-black transition-all duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/25 [-webkit-tap-highlight-color:transparent] ${
              active
                ? 'bg-[#ba0036] text-white shadow-[0_6px_16px_-6px_rgba(186,0,54,0.6)]'
                : 'text-gray-500 hover:text-gray-900 hover:bg-white/70'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        );
      })}
    </div>
  );
};

// ─── Chip-style action button ─────────────────────────────────────────────────
// The single, consistent button used for every right-aligned row action. Solid
// tinted background so it reads as a button, plus hover / pressed (active:scale)
// / keyboard-focus states. Renders as a router <Link> (when `to` is given) or a
// real <button>.
const TONES = {
  brand:   'bg-rose-50 text-[#ba0036] hover:bg-rose-100 active:bg-rose-100 focus-visible:ring-[#ba0036]/25',
  neutral: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-200 focus-visible:ring-gray-300/70',
  danger:  'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-100 focus-visible:ring-red-400/30',
};
const ActionButton = ({ to, onClick, children, icon: Icon, trailingIcon: Trailing, tone = 'brand', className = '' }) => {
  const cls = `inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all duration-150 active:scale-[0.95] focus:outline-none focus-visible:ring-4 select-none [-webkit-tap-highlight-color:transparent] ${TONES[tone]} ${className}`;
  const inner = (
    <>
      {Icon && <Icon size={13} />}
      {children}
      {Trailing && <Trailing size={12} className="opacity-70" />}
    </>
  );
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
};

// Text input that only commits on blur / Enter, so we don't PATCH per keystroke.
const TextField = ({ value, onCommit, placeholder, multiline, maxLength, className = 'w-40' }) => {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const commit = () => { if ((v ?? '') !== (value ?? '')) onCommit(v); };
  const cls = `px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-900 focus:outline-none focus:border-[#ba0036] ${className}`;
  if (multiline) {
    return (
      <textarea
        rows={3}
        maxLength={maxLength}
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        className={`${cls} resize-none`}
      />
    );
  }
  return (
    <input
      maxLength={maxLength}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={cls}
    />
  );
};

// Numeric input (or null when empty). Commits on blur / Enter.
const NumberField = ({ value, onCommit, placeholder, className = 'w-28' }) => {
  const [v, setV] = useState(value == null ? '' : String(value));
  useEffect(() => { setV(value == null ? '' : String(value)); }, [value]);
  const commit = () => {
    const trimmed = String(v).trim();
    const next = trimmed === '' ? null : Number(trimmed);
    const clean = next === null ? null : (Number.isFinite(next) ? next : null);
    if (clean !== (value == null ? null : value)) onCommit(clean);
  };
  return (
    <input
      inputMode="numeric"
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-900 focus:outline-none focus:border-[#ba0036] ${className}`}
    />
  );
};

const LinkAction = ({ to, children }) => (
  <ActionButton to={to} tone="brand" trailingIcon={ExternalLink}>{children}</ActionButton>
);

const TimeRange = ({ from, until, onFrom, onUntil, bn }) => (
  <div className="flex items-center gap-2">
    <input type="time" value={from} onChange={(e) => onFrom(e.target.value)} className="text-xs px-2 py-1 border rounded-md" />
    <span className="text-xs font-bold text-gray-400">{bn ? 'থেকে' : 'to'}</span>
    <input type="time" value={until} onChange={(e) => onUntil(e.target.value)} className="text-xs px-2 py-1 border rounded-md" />
  </div>
);

// ─── Scope + master-detail primitives ─────────────────────────────────────────
const ScopeHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mt-10 mb-4 first:mt-2">
    <span className="w-8 h-8 rounded-lg bg-[#ba0036] text-white flex items-center justify-center shrink-0">
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <h2 className="text-base md:text-lg font-black tracking-tight text-gray-900 truncate">{title}</h2>
      {subtitle && <p className="text-[11px] font-bold text-gray-400 truncate">{subtitle}</p>}
    </div>
  </div>
);

// Left-rail category button (desktop). Active = solid brand icon + ring.
const CategoryNavButton = ({ icon: Icon, title, subtitle, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'true' : undefined}
    className={`group w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left border transition-all duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/20 select-none [-webkit-tap-highlight-color:transparent] ${
      active
        ? 'bg-white border-[#ba0036]/25 shadow-[0_10px_30px_-16px_rgba(186,0,54,0.45)] ring-1 ring-[#ba0036]/5'
        : 'bg-white/50 border-gray-100 hover:bg-white hover:border-gray-200'
    }`}
  >
    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150 ${active ? 'bg-[#ba0036] text-white' : 'bg-rose-50 text-[#ba0036] group-hover:bg-rose-100'}`}>
      <Icon size={17} />
    </span>
    <div className="min-w-0 flex-1">
      <p className={`text-sm font-black tracking-tight truncate ${active ? 'text-gray-900' : 'text-gray-700'}`}>{title}</p>
      {subtitle && <p className="text-[11px] font-bold text-gray-400 truncate">{subtitle}</p>}
    </div>
    <ChevronRight size={16} className={`shrink-0 transition-all duration-150 ${active ? 'text-[#ba0036] translate-x-0.5' : 'text-gray-300 group-hover:text-gray-400'}`} />
  </button>
);

// Header of the right-hand detail pane (desktop).
const DetailHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-50">
    <span className="w-10 h-10 rounded-xl bg-rose-50 text-[#ba0036] flex items-center justify-center shrink-0">
      <Icon size={19} />
    </span>
    <div className="min-w-0">
      <h3 className="text-base font-black text-gray-900 tracking-tight truncate">{title}</h3>
      {subtitle && <p className="text-xs font-bold text-gray-400 truncate">{subtitle}</p>}
    </div>
  </div>
);

// Mobile accordion card (one per category).
const AccordionCard = ({ icon: Icon, title, subtitle, defaultOpen, children }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors duration-150 hover:bg-gray-50/80 active:bg-gray-100/70 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#ba0036]/15 select-none [-webkit-tap-highlight-color:transparent]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-rose-50 text-[#ba0036] flex items-center justify-center shrink-0">
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-gray-900 tracking-tight truncate">{title}</h2>
            {subtitle && <p className="text-[11px] font-bold text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-50">{children}</div>}
    </section>
  );
};

/**
 * SettingsScope — renders one scope's categories as a master-detail on desktop
 * and a stacked accordion on mobile. `categories` is an array of
 * { id, icon, title, subtitle, content } (content is ready-to-render JSX).
 */
const SettingsScope = ({ icon, title, subtitle, categories }) => {
  const ids = categories.map((c) => c.id).join('|');
  const [activeId, setActiveId] = useState(categories[0]?.id);
  // If the category set changes (role toggles) and the active one vanished,
  // fall back to the first available category.
  useEffect(() => {
    if (!categories.some((c) => c.id === activeId)) setActiveId(categories[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const active = categories.find((c) => c.id === activeId) || categories[0];
  if (!categories.length) return null;

  return (
    <>
      <ScopeHeader icon={icon} title={title} subtitle={subtitle} />

      {/* Desktop: master-detail */}
      <div className="hidden lg:grid lg:grid-cols-[290px_minmax(0,1fr)] gap-5 items-start">
        <nav className="flex flex-col gap-2.5" aria-label={title}>
          {categories.map((cat) => (
            <CategoryNavButton
              key={cat.id}
              icon={cat.icon}
              title={cat.title}
              subtitle={cat.subtitle}
              active={cat.id === active?.id}
              onClick={() => setActiveId(cat.id)}
            />
          ))}
        </nav>
        <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
          {active && (
            <div key={active.id} className="animate-tp-fade-in">
              <DetailHeader icon={active.icon} title={active.title} subtitle={active.subtitle} />
              <div className="px-6 pb-6 pt-1">{active.content}</div>
            </div>
          )}
        </section>
      </div>

      {/* Mobile: accordion */}
      <div className="lg:hidden grid gap-4">
        {categories.map((cat, i) => (
          <AccordionCard key={cat.id} icon={cat.icon} title={cat.title} subtitle={cat.subtitle} defaultOpen={i === 0}>
            {cat.content}
          </AccordionCard>
        ))}
      </div>
    </>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const SharedSettings = ({ onGoToProfile } = {}) => {
  const navigate = useNavigate();
  const { user, logout, hasRole, activeRole } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { settings, update, saving, loading } = useSettings();
  const { soundEnabled, setSoundEnabled, dndSchedule, setDndSchedule } = useNotificationSettings();
  const bn = language === 'বাংলা';

  // Change / forgot password modal (uses the OTP reset flow under the hood).
  const [pwModalOpen, setPwModalOpen] = useState(false);

  // After a successful password change the backend invalidates the current
  // session token, so sign the user out locally and send them to login.
  const handlePasswordChanged = useCallback(async () => {
    setPwModalOpen(false);
    try { await logout(); } catch { /* ignore */ }
    navigate('/');
  }, [logout, navigate]);

  const isTenant = typeof hasRole === 'function' ? hasRole('tenant') : true;
  const isLandlord = typeof hasRole === 'function' ? hasRole('landlord') : false;

  // Convenient scoped views (settings is always fully-defaulted by the service).
  const n = settings.notifications;
  const app = settings.app;
  const tn = settings.tenant;
  const ll = settings.landlord;

  // Persist helper — surfaces validation errors as a toast.
  const save = useCallback(async (patch) => {
    try {
      await update(patch);
    } catch (e) {
      toast.error(bn ? 'সেটিং সেভ করা যায়নি।' : 'Could not save that setting.');
    }
  }, [update, bn]);

  // ── Mirror Sound + DND from settings → NotificationContext (runtime) ──────
  useEffect(() => {
    if (loading) return;
    if (typeof n.sound === 'boolean' && n.sound !== soundEnabled) setSoundEnabled(n.sound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, n.sound]);

  useEffect(() => {
    if (loading) return;
    const next = { enabled: !!n.dnd.enabled, from: n.dnd.from, until: n.dnd.until };
    const cur = { enabled: !!dndSchedule.enabled, from: dndSchedule.from, until: dndSchedule.until };
    if (JSON.stringify(next) !== JSON.stringify(cur)) setDndSchedule(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, n.dnd.enabled, n.dnd.from, n.dnd.until]);

  const goToProfile = () => {
    if (typeof onGoToProfile === 'function') return onGoToProfile();
    const dest = activeRole === 'landlord' ? '/host-dashboard' : '/tenant-dashboard';
    navigate(dest, { state: { activeTab: 'profile' } });
  };

  // ── Localised option lists ───────────────────────────────────────────────
  const opts = useMemo(() => ({
    language: [
      { value: 'English', label: 'English' },
      { value: 'বাংলা', label: 'বাংলা' },
    ],
    currency: [
      { value: 'BDT', label: 'BDT (৳)' },
      { value: 'USD', label: 'USD ($)' },
    ],
    frequency: [
      { value: 'instant', label: bn ? 'তাৎক্ষণিক' : 'Instant' },
      { value: 'daily', label: bn ? 'দৈনিক সারসংক্ষেপ' : 'Daily digest' },
      { value: 'weekly', label: bn ? 'সাপ্তাহিক সারসংক্ষেপ' : 'Weekly digest' },
    ],
    landingRole: [
      { value: 'auto', label: bn ? 'স্বয়ংক্রিয়' : 'Automatic' },
      { value: 'tenant', label: bn ? 'ভাড়াটিয়া' : 'Tenant' },
      { value: 'landlord', label: bn ? 'বাড়িওয়ালা' : 'Landlord' },
    ],
    visibility: [
      { value: 'public', label: bn ? 'পাবলিক' : 'Public' },
      { value: 'private', label: bn ? 'প্রাইভেট' : 'Private' },
    ],
    tenantType: [
      { value: 'any', label: bn ? 'যেকোনো' : 'Any' },
      { value: 'apartment', label: bn ? 'অ্যাপার্টমেন্ট' : 'Apartment' },
      { value: 'duplex', label: bn ? 'ডুপ্লেক্স' : 'Duplex' },
      { value: 'studio', label: bn ? 'স্টুডিও' : 'Studio' },
      { value: 'sublet', label: bn ? 'সাবলেট' : 'Sublet' },
      { value: 'commercial', label: bn ? 'বাণিজ্যিক' : 'Commercial' },
    ],
    listingType: [
      { value: 'apartment', label: bn ? 'অ্যাপার্টমেন্ট' : 'Apartment' },
      { value: 'duplex', label: bn ? 'ডুপ্লেক্স' : 'Duplex' },
      { value: 'studio', label: bn ? 'স্টুডিও' : 'Studio' },
      { value: 'sublet', label: bn ? 'সাবলেট' : 'Sublet' },
      { value: 'commercial', label: bn ? 'বাণিজ্যিক' : 'Commercial' },
    ],
  }), [bn]);

  const phoneVerified = !!user?.phoneVerified;

  // ══════════════════════ APP SETTINGS categories ══════════════════════
  const appCategories = [
    {
      id: 'account',
      icon: User,
      title: bn ? 'অ্যাকাউন্ট' : 'Account',
      subtitle: bn ? 'প্রোফাইল, পাসওয়ার্ড, সাইন আউট' : 'Profile, password, sign out',
      content: (
        <>
          <Row
            label={bn ? 'প্রোফাইল এডিট করুন' : 'Edit profile'}
            sublabel={bn ? 'নাম, ছবি, পরিচয়' : 'Name, photo, identity'}
            right={<ActionButton onClick={goToProfile} tone="brand" trailingIcon={ExternalLink}>{bn ? 'খুলুন' : 'Open'}</ActionButton>}
          />
          <Row label={bn ? 'ইমেইল' : 'Email'} sublabel={user?.email || (bn ? 'যোগ করা হয়নি' : 'Not added')} right={
            <ActionButton onClick={goToProfile} tone="neutral" icon={Pencil}>{bn ? 'এডিট' : 'Edit'}</ActionButton>
          } />
          <Row
            label={bn ? 'ফোন নম্বর' : 'Phone number'}
            sublabel={user?.phone || '—'}
            right={
              <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${phoneVerified ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                {phoneVerified ? <ShieldCheck size={12} /> : null}
                {phoneVerified ? (bn ? 'যাচাইকৃত' : 'Verified') : (bn ? 'যাচাই বাকি' : 'Unverified')}
              </span>
            }
          />
          <Row
            label={bn ? 'পাসওয়ার্ড পরিবর্তন' : 'Change password'}
            sublabel={bn ? 'ফোনে পাঠানো কোড দিয়ে নতুন পাসওয়ার্ড সেট করুন' : 'Set a new password with a code sent to your phone'}
            right={<ActionButton onClick={() => setPwModalOpen(true)} tone="brand" icon={KeyRound}>{bn ? 'পরিবর্তন' : 'Change'}</ActionButton>}
          />
          <Row
            label={bn ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
            sublabel={bn ? 'বর্তমান পাসওয়ার্ড ছাড়াই OTP দিয়ে রিসেট করুন' : 'Reset with an OTP — no current password needed'}
            right={<ActionButton onClick={() => setPwModalOpen(true)} tone="neutral" icon={RotateCcw}>{bn ? 'রিসেট' : 'Reset'}</ActionButton>}
          />
          <Row
            label={bn ? 'লগ আউট' : 'Sign out'}
            right={
              <ActionButton onClick={async () => { await logout(); navigate('/'); }} tone="danger" icon={LogOut}>
                {bn ? 'এখন লগআউট' : 'Sign out'}
              </ActionButton>
            }
          />
        </>
      ),
    },
    {
      id: 'notifications',
      icon: Bell,
      title: bn ? 'নোটিফিকেশন' : 'Notifications',
      subtitle: bn ? 'চ্যানেল, সাউন্ড, DND, টপিক' : 'Channels, sound, DND, topics',
      content: (
        <>
          <Row label={bn ? 'পুশ নোটিফিকেশন' : 'Push notifications'} sublabel={bn ? 'এই ডিভাইসে অ্যালার্ট' : 'Alerts on this device'} right={<Toggle checked={n.push} onChange={(v) => save({ notifications: { push: v } })} />} />
          <Row label={bn ? 'ইমেইল নোটিফিকেশন' : 'Email notifications'} sublabel={bn ? 'লেনদেন ও আপডেট' : 'Transactional updates'} right={<Toggle checked={n.email} onChange={(v) => save({ notifications: { email: v } })} />} />
          <Row label={bn ? 'SMS অ্যালার্ট' : 'SMS alerts'} right={<Toggle checked={settings.smsAlerts} onChange={(v) => save({ smsAlerts: v })} />} />
          <Row label={bn ? 'কল নোটিফিকেশন' : 'Call notifications'} sublabel={bn ? 'ইনকামিং কল পুশ' : 'Incoming call push'} right={<Toggle checked={settings.callNotifications} onChange={(v) => save({ callNotifications: v })} />} />
          <Row label={bn ? 'মার্কেটিং ইমেইল' : 'Marketing emails'} sublabel={bn ? 'অফার ও টিপস' : 'Offers and tips'} right={<Toggle checked={settings.marketingEmails} onChange={(v) => save({ marketingEmails: v })} />} />
          <Row label={bn ? 'সাউন্ড' : 'Sound'} sublabel={bn ? 'নোটিফিকেশন সাউন্ড' : 'Play notification sounds'} right={<Toggle checked={n.sound} onChange={(v) => save({ notifications: { sound: v } })} />} />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 border-b border-gray-50">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-gray-900 truncate">{bn ? 'ডু নট ডিস্টার্ব (DND)' : 'Do Not Disturb (DND)'}</p>
              <p className="text-[11px] font-bold text-gray-400 truncate">{bn ? 'নির্দিষ্ট সময়ে সাউন্ড ও টোস্ট বন্ধ' : 'Silence sound and toasts in a window'}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Toggle checked={n.dnd.enabled} onChange={(v) => save({ notifications: { dnd: { enabled: v } } })} />
              {n.dnd.enabled && (
                <TimeRange
                  from={n.dnd.from} until={n.dnd.until} bn={bn}
                  onFrom={(val) => save({ notifications: { dnd: { from: val } } })}
                  onUntil={(val) => save({ notifications: { dnd: { until: val } } })}
                />
              )}
            </div>
          </div>

          <Row
            label={bn ? 'ইমেইল ফ্রিকোয়েন্সি' : 'Email frequency'}
            right={<SelectInput value={n.frequency} onChange={(v) => save({ notifications: { frequency: v } })} options={opts.frequency} />}
          />

          <div className="pt-3">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide mb-1">{bn ? 'কী কী জানাবো' : 'Notify me about'}</p>
          </div>
          <Row label={bn ? 'মেসেজ' : 'Messages'} right={<Toggle checked={n.messages} onChange={(v) => save({ notifications: { messages: v } })} />} />
          <Row label={bn ? 'বুকিং' : 'Bookings'} right={<Toggle checked={n.bookings} onChange={(v) => save({ notifications: { bookings: v } })} />} />
          <Row label={bn ? 'পেমেন্ট ও রসিদ' : 'Payments & receipts'} right={<Toggle checked={n.payments} onChange={(v) => save({ notifications: { payments: v } })} />} />
          <Row label={bn ? 'ভিজিট শিডিউল' : 'Visit schedules'} right={<Toggle checked={n.visits} onChange={(v) => save({ notifications: { visits: v } })} />} />
        </>
      ),
    },
    {
      id: 'appearance',
      icon: Smartphone,
      title: bn ? 'অ্যাপিয়ারেন্স ও অ্যাপ' : 'Appearance & app',
      subtitle: bn ? 'থিম, ভাষা, মুদ্রা, মোশন' : 'Theme, language, currency, motion',
      content: (
        <>
          <div className="py-3.5 border-b border-gray-50">
            <div className="mb-3">
              <p className="text-sm font-black text-gray-900">{bn ? 'থিম' : 'Theme'}</p>
              <p className="text-[11px] font-bold text-gray-400">{bn ? 'লাইট, ডার্ক বা সিস্টেম অনুযায়ী' : 'Light, dark, or match your system'}</p>
            </div>
            <ThemeSwitcher value={settings.theme} onChange={(v) => save({ theme: v })} bn={bn} />
          </div>
          <Row
            label={bn ? 'ভাষা' : 'Language'}
            right={
              <SelectInput
                value={language}
                onChange={(val) => { setLanguage && setLanguage(val); save({ language: toLangCode(val) }); }}
                options={opts.language}
              />
            }
          />
          <Row label={bn ? 'মুদ্রা প্রদর্শন' : 'Currency display'} right={<SelectInput value={app.currency} onChange={(v) => save({ app: { currency: v } })} options={opts.currency} />} />
          <Row
            label={bn ? 'মোশন কমান' : 'Reduce motion'}
            sublabel={bn ? 'অ্যানিমেশন কমিয়ে দিন' : 'Minimise animations'}
            right={<Toggle checked={app.reduceMotion} onChange={(v) => save({ app: { reduceMotion: v } })} />}
          />
          <Row
            label={bn ? 'প্রপার্টি ভিডিও অটোপ্লে' : 'Auto-play property videos'}
            sublabel={bn ? 'মোবাইল ডেটা বাঁচাতে বন্ধ করুন' : 'Turn off to save mobile data'}
            right={<Toggle checked={app.autoplayVideos} onChange={(v) => save({ app: { autoplayVideos: v } })} />}
          />
          {(isTenant && isLandlord) && (
            <Row
              label={bn ? 'ডিফল্ট ড্যাশবোর্ড' : 'Default dashboard'}
              sublabel={bn ? 'লগইনের পর কোনটি খুলবে' : 'Where you land after login'}
              right={<SelectInput value={app.defaultLandingRole} onChange={(v) => save({ app: { defaultLandingRole: v } })} options={opts.landingRole} />}
            />
          )}
        </>
      ),
    },
    {
      id: 'privacy',
      icon: Shield,
      title: bn ? 'প্রাইভেসি ও সিকিউরিটি' : 'Privacy & security',
      subtitle: bn ? 'সেশন, ডেটা, অ্যাকাউন্ট' : 'Sessions, data, account',
      content: (
        <>
          <Row label={bn ? 'সক্রিয় সেশন' : 'Active sessions'} sublabel={bn ? 'সাইন-ইন করা ডিভাইস দেখুন' : 'See signed-in devices'} right={<LinkAction to="/account/privacy">{bn ? 'দেখুন' : 'View'}</LinkAction>} />
          <Row
            label={bn ? 'আমার ডেটা ডাউনলোড' : 'Download my data'}
            sublabel={bn ? 'সম্পূর্ণ অ্যাকাউন্ট এক্সপোর্ট (PDF)' : 'Full account export (PDF)'}
            right={<ActionButton to="/account/privacy" tone="neutral" icon={Download}>{bn ? 'এক্সপোর্ট' : 'Export'}</ActionButton>}
          />
          <Row
            label={bn ? 'অ্যাকাউন্ট ডিলিট' : 'Delete account'}
            sublabel={bn ? '৩০ দিনের গ্রেস পিরিয়ড' : '30-day grace period'}
            right={<ActionButton to="/account/privacy" tone="danger" icon={Trash2}>{bn ? 'অনুরোধ' : 'Request'}</ActionButton>}
          />
        </>
      ),
    },
    {
      id: 'ai',
      icon: Sparkles,
      title: bn ? 'AI ও ডেটা' : 'AI & data',
      subtitle: bn ? 'ব্যক্তিগতকরণ নিয়ন্ত্রণ' : 'Control personalisation',
      content: (
        <Row
          label={bn ? 'AI লার্নিং' : 'AI learning'}
          sublabel={bn ? 'আমার ব্যবহার থেকে সাজেশন উন্নত করুন' : 'Improve suggestions from my activity'}
          right={<Toggle checked={settings.aiLearningOptIn} onChange={(v) => save({ aiLearningOptIn: v })} />}
        />
      ),
    },
    {
      id: 'legal',
      icon: Scale,
      title: bn ? 'লিগ্যাল' : 'Legal',
      subtitle: bn ? 'টার্মস, প্রাইভেসি, রিফান্ড' : 'Terms, privacy, refund',
      content: (
        <>
          <Row label={bn ? 'সার্ভিস শর্তাবলি' : 'Terms of service'} right={<LinkAction to="/terms">{bn ? 'দেখুন' : 'View'}</LinkAction>} />
          <Row label={bn ? 'প্রাইভেসি পলিসি' : 'Privacy policy'} right={<LinkAction to="/privacy-policy">{bn ? 'দেখুন' : 'View'}</LinkAction>} />
          <Row label={bn ? 'রিফান্ড পলিসি' : 'Refund policy'} right={<LinkAction to="/refund">{bn ? 'দেখুন' : 'View'}</LinkAction>} />
        </>
      ),
    },
  ];

  // ══════════════════════ TENANT SETTINGS categories ══════════════════════
  const tenantCategories = [
    {
      id: 'tenant-privacy',
      icon: Eye,
      title: bn ? 'প্রোফাইল ও প্রাইভেসি' : 'Profile & privacy',
      subtitle: bn ? 'দৃশ্যমানতা ও যোগাযোগ' : 'Visibility & contact',
      content: (
        <>
          <Row
            label={bn ? 'পাবলিক প্রোফাইল' : 'Public profile'}
            sublabel={bn ? 'বাড়িওয়ালারা আপনার ট্রাস্ট কার্ড দেখতে পারবে' : 'Landlords can see your trust card'}
            right={<SelectInput value={tn.profileVisibility} onChange={(v) => save({ tenant: { profileVisibility: v } })} options={opts.visibility} />}
          />
          <Row
            label={bn ? 'বাড়িওয়ালাকে যোগাযোগ দেখান' : 'Share contact with landlords'}
            sublabel={bn ? 'চ্যাট শুরু হলে ফোন/ইমেইল' : 'Phone/email once a chat starts'}
            right={<Toggle checked={tn.showContactToLandlords} onChange={(v) => save({ tenant: { showContactToLandlords: v } })} />}
          />
        </>
      ),
    },
    {
      id: 'tenant-alerts',
      icon: Bell,
      title: bn ? 'সার্চ অ্যালার্ট' : 'Search alerts',
      subtitle: bn ? 'নতুন ম্যাচ ও দাম' : 'New matches & pricing',
      content: (
        <>
          <Row
            label={bn ? 'সেভড সার্চ অ্যালার্ট' : 'Saved-search alerts'}
            sublabel={bn ? 'ম্যাচিং লিস্টিং এলে জানান' : 'Notify me on matching listings'}
            right={<Toggle checked={tn.savedSearchAlerts} onChange={(v) => save({ tenant: { savedSearchAlerts: v } })} />}
          />
          <Row
            label={bn ? 'দাম কমার অ্যালার্ট' : 'Price-drop alerts'}
            sublabel={bn ? 'পছন্দের বাসার দাম কমলে' : 'When a watched home drops price'}
            right={<Toggle checked={n.priceAlerts} onChange={(v) => save({ notifications: { priceAlerts: v } })} />}
          />
        </>
      ),
    },
    {
      id: 'tenant-search',
      icon: Search,
      title: bn ? 'ডিফল্ট সার্চ' : 'Default search',
      subtitle: bn ? 'সার্চ বার প্রি-ফিল করুন' : 'Pre-fill the search bar',
      content: (
        <>
          <Row label={bn ? 'শহর' : 'City'} right={<TextField value={tn.defaultCity} onCommit={(v) => save({ tenant: { defaultCity: v } })} placeholder={bn ? 'ঢাকা' : 'Dhaka'} maxLength={60} className="w-36" />} />
          <Row label={bn ? 'এলাকা' : 'Area'} right={<TextField value={tn.defaultArea} onCommit={(v) => save({ tenant: { defaultArea: v } })} placeholder="Gulshan" maxLength={80} className="w-36" />} />
          <Row label={bn ? 'সর্বনিম্ন বাজেট (৳)' : 'Min budget (৳)'} right={<NumberField value={tn.defaultBudgetMin} onCommit={(v) => save({ tenant: { defaultBudgetMin: v } })} placeholder="10,000" />} />
          <Row label={bn ? 'সর্বোচ্চ বাজেট (৳)' : 'Max budget (৳)'} right={<NumberField value={tn.defaultBudgetMax} onCommit={(v) => save({ tenant: { defaultBudgetMax: v } })} placeholder="40,000" />} />
          <Row label={bn ? 'প্রপার্টি টাইপ' : 'Property type'} right={<SelectInput value={tn.defaultPropertyType} onChange={(v) => save({ tenant: { defaultPropertyType: v } })} options={opts.tenantType} />} />
        </>
      ),
    },
  ];

  // ══════════════════════ LANDLORD SETTINGS categories ══════════════════════
  const landlordCategories = [
    {
      id: 'inquiries',
      icon: MessageSquare,
      title: bn ? 'ইনকোয়ারি ও উত্তর' : 'Inquiries & responses',
      subtitle: bn ? 'অ্যালার্ট ও অটো-রিপ্লাই' : 'Alerts & auto-reply',
      content: (
        <>
          <Row
            label={bn ? 'নতুন ইনকোয়ারি অ্যালার্ট' : 'New inquiry alerts'}
            sublabel={bn ? 'ইনকোয়ারি এলে সাথে সাথে জানান' : 'Notify me the moment one arrives'}
            right={<Toggle checked={ll.inquiryNotifications} onChange={(v) => save({ landlord: { inquiryNotifications: v } })} />}
          />
          <Row
            label={bn ? 'অটো-রিপ্লাই' : 'Auto-reply'}
            sublabel={bn ? 'প্রথম ইনকোয়ারিতে স্বয়ংক্রিয় উত্তর' : 'Auto-answer first-time inquiries'}
            right={<Toggle checked={ll.autoReplyEnabled} onChange={(v) => save({ landlord: { autoReplyEnabled: v } })} />}
          />
          {ll.autoReplyEnabled && (
            <div className="py-3 border-b border-gray-50">
              <p className="text-[11px] font-black text-gray-400 mb-2">{bn ? 'অটো-রিপ্লাই বার্তা' : 'Auto-reply message'}</p>
              <TextField
                multiline
                value={ll.autoReplyMessage}
                onCommit={(v) => save({ landlord: { autoReplyMessage: v } })}
                maxLength={500}
                className="w-full"
                placeholder={bn ? 'ধন্যবাদ! আমি খুব দ্রুত উত্তর দেব।' : 'Thanks for reaching out — I will reply shortly.'}
              />
            </div>
          )}
        </>
      ),
    },
    {
      id: 'listing',
      icon: Building2,
      title: bn ? 'লিস্টিং ও বুকিং' : 'Listing & booking',
      subtitle: bn ? 'যোগাযোগ, বুকিং, ভিজিট' : 'Contact, booking, visits',
      content: (
        <>
          <Row
            label={bn ? 'লিস্টিং-এ ফোন দেখান' : 'Show phone on listings'}
            sublabel={bn ? 'পাবলিক লিস্টিং-এ নম্বর' : 'Number visible on public listings'}
            right={<Toggle checked={ll.showPhoneOnListings} onChange={(v) => save({ landlord: { showPhoneOnListings: v } })} />}
          />
          <Row
            label={bn ? 'ইনস্ট্যান্ট বুকিং' : 'Instant booking'}
            sublabel={bn ? 'অনুমোদন ছাড়াই বুক করা যাবে' : 'Book without manual approval'}
            right={<Toggle checked={ll.instantBooking} onChange={(v) => save({ landlord: { instantBooking: v } })} />}
          />
          <Row
            label={bn ? 'ভিজিট রিকোয়েস্ট নিন' : 'Allow visit requests'}
            sublabel={bn ? 'ভাড়াটিয়া ভিজিট শিডিউল চাইতে পারবে' : 'Tenants can request a visit slot'}
            right={<Toggle checked={ll.allowVisitRequests} onChange={(v) => save({ landlord: { allowVisitRequests: v } })} />}
          />
          <Row label={bn ? 'ডিফল্ট লিস্টিং টাইপ' : 'Default listing type'} right={<SelectInput value={ll.defaultListingType} onChange={(v) => save({ landlord: { defaultListingType: v } })} options={opts.listingType} />} />
        </>
      ),
    },
    {
      id: 'quiet-hours',
      icon: Calendar,
      title: bn ? 'কোয়ায়েট আওয়ার্স' : 'Quiet hours',
      subtitle: bn ? 'ইনকোয়ারি পিং বন্ধ রাখার সময়' : 'Mute inquiry pings in a window',
      content: (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-900 truncate">{bn ? 'কোয়ায়েট আওয়ার্স চালু' : 'Enable quiet hours'}</p>
            <p className="text-[11px] font-bold text-gray-400 truncate">{bn ? 'এই সময়ে ইনকোয়ারি পুশ বন্ধ' : 'No inquiry push during this window'}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Toggle checked={ll.quietHours.enabled} onChange={(v) => save({ landlord: { quietHours: { enabled: v } } })} />
            {ll.quietHours.enabled && (
              <TimeRange
                from={ll.quietHours.from} until={ll.quietHours.until} bn={bn}
                onFrom={(val) => save({ landlord: { quietHours: { from: val } } })}
                onUntil={(val) => save({ landlord: { quietHours: { until: val } } })}
              />
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'billing',
      icon: CreditCard,
      title: bn ? 'সাবস্ক্রিপশন ও বিলিং' : 'Subscription & billing',
      subtitle: bn ? 'প্ল্যান ও রসিদ' : 'Plan & receipts',
      content: (
        <Row label={bn ? 'সাবস্ক্রিপশন প্ল্যান' : 'Subscription plan'} right={<LinkAction to="/subscription">{bn ? 'ম্যানেজ' : 'Manage'}</LinkAction>} />
      ),
    },
  ];

  return (
    <div className="w-full mb-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="max-w-[1080px] mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900">{bn ? 'সেটিংস' : 'Settings'}</h1>
            <p className="text-sm font-bold text-gray-500 mb-2">
              {bn ? 'অ্যাপ, ভাড়াটিয়া ও বাড়িওয়ালা — সব সেটিং এক জায়গায়।' : 'App, tenant and landlord preferences in one place.'}
            </p>
          </div>
          {saving && (
            <span className="text-[11px] font-black text-gray-400 mt-1 shrink-0 animate-pulse">
              {bn ? 'সেভ হচ্ছে…' : 'Saving…'}
            </span>
          )}
        </div>

        <SettingsScope
          icon={Globe}
          title={bn ? 'অ্যাপ সেটিংস' : 'App settings'}
          subtitle={bn ? 'পুরো অ্যাকাউন্টে প্রযোজ্য' : 'Apply to your whole account'}
          categories={appCategories}
        />

        {isTenant && (
          <SettingsScope
            icon={Home}
            title={bn ? 'ভাড়াটিয়া সেটিংস' : 'Tenant settings'}
            subtitle={bn ? 'ভাড়াটিয়া হিসেবে যা প্রযোজ্য' : 'Apply when you rent as a tenant'}
            categories={tenantCategories}
          />
        )}

        {isLandlord && (
          <SettingsScope
            icon={Building2}
            title={bn ? 'বাড়িওয়ালা সেটিংস' : 'Landlord settings'}
            subtitle={bn ? 'বাড়িওয়ালা হিসেবে যা প্রযোজ্য' : 'Apply when you host as a landlord'}
            categories={landlordCategories}
          />
        )}
      </div>

      {/* Change / forgot password — OTP-based reset via the user's phone. */}
      <ChangePasswordModal
        open={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
        phone={user?.phone}
        phoneVerified={phoneVerified}
        bn={bn}
        onSuccess={handlePasswordChanged}
      />
    </div>
  );
};

export default SharedSettings;
