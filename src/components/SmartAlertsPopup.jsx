import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Hourglass, Clock, Calendar, Home, MessageSquare,
  CreditCard, Building, Bell, BellRing, X, ArrowRight, RefreshCw,
} from 'lucide-react';

/**
 * SmartAlertsPopup — a proactive, once-per-session modal that surfaces the
 * user's URGENT Smart Alerts (overdue rent, lease expired, etc.) the moment
 * they open the dashboard, so critical items aren't missed just because the
 * user never opened the "Smart Alerts" tab.
 *
 * Behaviour:
 *   • Filters the passed `alerts` down to `type === 'urgent'`.
 *   • Shows EXACTLY ONCE per login session — a `sessionStorage` flag
 *     (`hasSeenAlertPopup:<role>`) is set the first time it opens, so it
 *     won't re-appear on subsequent tab clicks / re-renders in the same
 *     session. It resets naturally on the next login (new session).
 *   • Role-scoped key so a user who is both a tenant AND a landlord sees the
 *     popup once on each surface within a session, not just once total.
 *   • Fully React-free of the alert-building logic — it just renders whatever
 *     urgent alerts it's handed. Works for both tenants and landlords.
 *
 * Props:
 *   alerts     — array of alert objects ({ id, type, title, subtitle, iconType })
 *   language   — 'English' | 'বাংলা'
 *   role       — 'tenant' | 'landlord' (namespaces the sessionStorage key)
 *   onViewAll  — optional callback fired by the "View all alerts" button
 *                (e.g. switch to the Smart Alerts tab). The popup closes first.
 */

const ICONS = {
  overdue: AlertTriangle,
  dueToday: Hourglass,
  dueSoon: Clock,
  upcoming: Calendar,
  leaseEnding: RefreshCw,
  leaseExpired: Building,
  inquiry: MessageSquare,
  hot: Home,
  receipt: CreditCard,
};
const iconFor = (k) => ICONS[k] || Bell;

export default function SmartAlertsPopup({ alerts = [], language = 'English', role = 'tenant', onViewAll }) {
  const bn = language === 'বাংলা';
  const storageKey = `hasSeenAlertPopup:${role}`;

  const [open, setOpen] = useState(false);
  // Snapshot the urgent alerts at the moment we decide to open, so the list
  // stays stable even if `alerts` keeps refreshing (polling) underneath us.
  const [urgent, setUrgent] = useState([]);

  useEffect(() => {
    // Already shown this session — never re-open.
    let seen = false;
    try { seen = window.sessionStorage.getItem(storageKey) === '1'; } catch { /* ignore */ }
    if (seen) return;

    const urgentAlerts = (alerts || []).filter((a) => a && a.type === 'urgent');
    if (urgentAlerts.length === 0) return; // nothing critical yet (or data still loading)

    setUrgent(urgentAlerts);
    setOpen(true);
    try { window.sessionStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
  }, [alerts, storageKey]);

  if (!open || urgent.length === 0) return null;

  const shown = urgent.slice(0, 4);
  const extra = urgent.length - shown.length;

  const close = () => setOpen(false);
  const handleViewAll = () => { close(); if (onViewAll) onViewAll(); };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-md animate-in fade-in duration-300"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={bn ? 'গুরুত্বপূর্ণ অ্যালার্ট' : 'Urgent alerts'}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-[2rem] shadow-[0_30px_80px_rgba(0,0,0,0.25)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative p-6 pb-5 text-white bg-gradient-to-br from-[#ba0036] via-[#d11147] to-[#ff4d6d] overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2 bg-white/15 hover:bg-white/25 rounded-full transition-all active:scale-95"
            aria-label={bn ? 'বন্ধ করুন' : 'Close'}
          >
            <X size={16} />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
              <span className="relative flex">
                <BellRing size={22} />
                <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                {bn ? 'গুরুত্বপূর্ণ' : 'Needs attention'}
              </p>
              <h3 className="text-xl font-black leading-tight">
                {urgent.length}{' '}
                {bn
                  ? 'টি জরুরি অ্যালার্ট'
                  : (urgent.length === 1 ? 'urgent alert' : 'urgent alerts')}
              </h3>
            </div>
          </div>
        </div>

        {/* ── Body — urgent alert list ── */}
        <div className="p-4 md:p-5 space-y-2.5 max-h-[45vh] overflow-y-auto">
          {shown.map((a) => {
            const Icon = iconFor(a.iconType);
            return (
              <div key={a.id} className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
                <div className="w-9 h-9 rounded-xl bg-white border border-rose-100 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-[#ba0036]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black text-gray-900 leading-tight">{a.title}</p>
                  {a.subtitle && (
                    <p className="text-[11px] font-bold text-gray-500 mt-0.5 line-clamp-2">{a.subtitle}</p>
                  )}
                </div>
              </div>
            );
          })}
          {extra > 0 && (
            <p className="text-center text-[11px] font-black text-gray-400 pt-1">
              {bn
                ? `আরও ${extra} টি জরুরি অ্যালার্ট`
                : `+${extra} more urgent alert${extra === 1 ? '' : 's'}`}
            </p>
          )}
        </div>

        {/* ── Footer — actions ── */}
        <div className="p-4 md:p-5 pt-1 flex gap-2">
          <button
            onClick={handleViewAll}
            className="flex-1 py-3 rounded-xl text-[12px] font-black text-white bg-gradient-to-r from-[#ba0036] to-[#d11147] shadow-[0_8px_20px_rgba(186,0,54,0.25)] hover:shadow-[0_12px_30px_rgba(186,0,54,0.4)] active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            {bn ? 'সব অ্যালার্ট দেখুন' : 'View all alerts'}
            <ArrowRight size={14} />
          </button>
          <button
            onClick={close}
            className="px-4 py-3 rounded-xl text-[12px] font-black text-gray-500 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
          >
            {bn ? 'পরে' : 'Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
