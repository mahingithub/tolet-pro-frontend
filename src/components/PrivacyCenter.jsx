import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import {
  Download, Trash2, Monitor, Sparkles, ShieldCheck, ChevronLeft,
  AlertTriangle, RefreshCcw, CheckCircle2, X, Lock,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext.jsx';
import { useIsBn } from '../context/LanguageContext';
import {
  exportMyData,
  requestAccountDeletion,
  cancelAccountDeletion,
  getPendingDeletion,
  listMySessions,
  revokeSession,
  revokeAllOtherSessions,
  getPreferences,
  setPreferences,
} from '../services/privacyService.js';
import LoadingState from './common/LoadingState.jsx';
import ErrorState from './common/ErrorState.jsx';
// Phase Call-6: enable/disable incoming-call push (handles device token too)
import fcmService from '../services/fcmService';

/**
 * /account/privacy
 *
 * Single-page user privacy hub. Four sections:
 *
 *   1. Export my data        — PDF download (rendered client-side from the export payload)
 *   2. Active sessions       — revoke individual or all-other sessions
 *   3. AI & comms preferences— opt-in/out toggles
 *   4. Delete account        — soft delete with 30-day grace period
 *
 * Designed to be the kind of page you can show a regulator with a
 * straight face. No dark patterns; "Delete account" sits at the bottom
 * with a confirmation modal and an undo path.
 */

const PrivacyCenter = () => {
  const navigate = useNavigate();
  const goBack = useGoBack('/');
  const { user, logout } = useAuth();
  const isBn = useIsBn();
  const L = (bn, en) => (isBn ? bn : en);

  const [sessions, setSessions] = useState(/** @type {any[]} */([]));
  const [prefs, setPrefs] = useState(/** @type {any} */(null));
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {Error|null} */(null));

  const [busy, setBusy] = useState({ export: false, sessions: false, delete: false });
  const [exportToast, setExportToast] = useState(/** @type {string|null} */(null));
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [s, p, del] = await Promise.all([listMySessions(), getPreferences(), getPendingDeletion()]);
      setSessions(s);
      setPrefs(p);
      setPendingDeletion(del);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── handlers ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    setBusy((b) => ({ ...b, export: true }));
    try {
      const { downloadUrl, filename } = await exportMyData();
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      setExportToast(L('এক্সপোর্ট তৈরি — ডাউনলোড শুরু হয়েছে।', 'Export ready — your download has started.'));
      setTimeout(() => setExportToast(null), 4000);
    } catch (e) {
      setExportToast(L('এক্সপোর্ট করা যায়নি। আবার চেষ্টা করুন।', `Export failed: ${e?.message ?? 'unknown error'}`));
    } finally {
      setBusy((b) => ({ ...b, export: false }));
    }
  };

  const handleRevokeSession = async (id) => {
    setBusy((b) => ({ ...b, sessions: true }));
    try {
      await revokeSession(id);
      await refresh();
    } finally {
      setBusy((b) => ({ ...b, sessions: false }));
    }
  };

  const handleRevokeAllOthers = async () => {
    setBusy((b) => ({ ...b, sessions: true }));
    try {
      await revokeAllOtherSessions();
      await refresh();
    } finally {
      setBusy((b) => ({ ...b, sessions: false }));
    }
  };

  const handlePrefToggle = async (key) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await setPreferences({ [key]: next[key] });
  };

  // Phase Call-6: call-notification toggle is special — besides saving the
  // preference, turning it ON must request notification permission + register
  // this device's push token, and turning it OFF should unregister it.
  const handleCallNotifToggle = async () => {
    if (!prefs) return;
    const enabling = !prefs.callNotifications;
    // Optimistic UI flip.
    setPrefs((p) => ({ ...p, callNotifications: enabling }));
    try {
      if (enabling) {
        const token = await fcmService.enableCallNotifications();
        // If the browser blocked permission, revert the switch so it reflects reality.
        if (!token) {
          setPrefs((p) => ({ ...p, callNotifications: false }));
          await fcmService.setCallNotificationPref(false);
          return;
        }
        await fcmService.setCallNotificationPref(true);
      } else {
        await fcmService.disableCallNotifications();
        await fcmService.setCallNotificationPref(false);
      }
    } catch {
      // On any failure, fall back to the previous value.
      setPrefs((p) => ({ ...p, callNotifications: !enabling }));
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setBusy((b) => ({ ...b, delete: true }));
    try {
      const pending = await requestAccountDeletion();
      setPendingDeletion(pending);
      setDeleteModalOpen(false);
      setDeleteConfirmText('');
    } finally {
      setBusy((b) => ({ ...b, delete: false }));
    }
  };

  const handleCancelDelete = async () => {
    setBusy((b) => ({ ...b, delete: true }));
    try {
      await cancelAccountDeletion();
      setPendingDeletion(null);
    } finally {
      setBusy((b) => ({ ...b, delete: false }));
    }
  };

  // ── render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <LoadingState label={L('প্রাইভেসি সেটিংস লোড হচ্ছে', 'Loading your privacy settings')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorState onRetry={refresh} description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ── header ─────────────────────────────────────────────────── */}
      {/* /account/privacy is under "/account", which is in hideNavbarRoutes —
          so there is no Navbar above this to absorb the status bar. */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10" style={{ paddingTop: 'var(--sat)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={goBack}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-150 active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/60 [-webkit-tap-highlight-color:transparent]"
            aria-label={L('ফিরে যান', 'Back')}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 truncate">{L('প্রাইভেসি ও ডেটা', 'Privacy & Data')}</h1>
            <p className="text-xs font-bold text-gray-500 mt-0.5 truncate">
              {user?.name} · {user?.phone}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
            <ShieldCheck size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{L('সুরক্ষিত', 'End-to-end secured')}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* deletion banner */}
        {pendingDeletion && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-black text-amber-900">{L('অ্যাকাউন্ট মুছে ফেলার সময় নির্ধারিত', 'Account deletion scheduled')}</h3>
              <p className="text-xs font-bold text-amber-800 mt-1">
                {isBn
                  ? <>আপনার অ্যাকাউন্ট {new Date(pendingDeletion.restoreDeadline).toLocaleString('bn-BD')} তারিখে স্থায়ীভাবে মুছে ফেলা হবে। অ্যাকাউন্ট রাখতে চাইলে এর আগে যেকোনো সময় বাতিল করুন।</>
                  : <>Your account will be permanently deleted on{' '}
                {new Date(pendingDeletion.restoreDeadline).toLocaleString()}.
                Cancel any time before then to keep your account.</>}
              </p>
              <button
                onClick={handleCancelDelete}
                disabled={busy.delete}
                className="mt-3 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/30 select-none [-webkit-tap-highlight-color:transparent] disabled:opacity-60"
              >
                <RefreshCcw size={12} /> {L('মুছে ফেলা বাতিল করুন', 'Cancel deletion')}
              </button>
            </div>
          </div>
        )}

        {/* export */}
        <Section
          icon={Download}
          title={L('আমার ডেটা ডাউনলোড', 'Download my data')}
          description={L('আপনার সব তথ্যের একটি PDF কপি নিন — প্রোফাইল, প্রপার্টি, ইনকোয়ারি, এআই চ্যাট, সাপোর্ট টিকিট ও পছন্দসমূহ।', 'Get a PDF copy of every record we hold for you — profile, properties, inquiries, AI chat history, support tickets, preferences.')}
        >
          <button
            onClick={handleExport}
            disabled={busy.export}
            className="bg-[#ba0036] hover:bg-[#d4004a] disabled:opacity-60 text-white px-5 py-3 rounded-xl text-xs font-black shadow-[0_4px_15px_rgba(186,0,54,0.2)] transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/25 select-none [-webkit-tap-highlight-color:transparent] flex items-center gap-2"
          >
            <Download size={14} /> {busy.export ? L('তৈরি হচ্ছে…', 'Preparing…') : L('এখনই এক্সপোর্ট (PDF)', 'Export now (PDF)')}
          </button>
          {exportToast && (
            <div className="mt-3 bg-green-50 text-green-700 text-xs font-bold rounded-xl px-3 py-2 inline-flex items-center gap-2">
              <CheckCircle2 size={14} /> {exportToast}
            </div>
          )}
        </Section>

        {/* sessions */}
        <Section
          icon={Monitor}
          title={L('সক্রিয় সেশন', 'Active sessions')}
          description={L('যেসব ডিভাইসে আপনার অ্যাকাউন্টে লগইন আছে। অচেনা কোনো ডিভাইস থেকে সাইন আউট করুন।', "Devices currently signed into your account. Sign out anywhere you don't recognize.")}
          right={
            sessions.length > 1 && (
              <button
                onClick={handleRevokeAllOthers}
                disabled={busy.sessions}
                className="text-xs font-black px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-60 transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-400/40 select-none [-webkit-tap-highlight-color:transparent]"
              >
                {L('অন্য সব ডিভাইস থেকে সাইন আউট', 'Sign out all other devices')}
              </button>
            )
          }
        >
          <div className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <div key={s.id} className="py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                  <Monitor size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-gray-900 truncate">{s.device}</h4>
                    {s.current && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        {L('এই ডিভাইস', 'This device')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-gray-500 mt-0.5">
                    {s.ipAddress} · {L(`সর্বশেষ ${timeAgo(s.lastSeenAt, true)}`, `last seen ${timeAgo(s.lastSeenAt)}`)}
                  </p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    disabled={busy.sessions}
                    className="text-xs font-black px-3 py-2 rounded-xl bg-red-50 text-[#ba0036] hover:bg-red-100 disabled:opacity-60 transition-all duration-150 active:scale-[0.95] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/25 select-none [-webkit-tap-highlight-color:transparent]"
                  >
                    {L('সাইন আউট', 'Sign out')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* preferences */}
        <Section
          icon={Sparkles}
          title={L('এআই ও যোগাযোগের পছন্দ', 'AI & communication preferences')}
          description={L('আপনার ডেটা কীভাবে ব্যবহার হবে এবং কত ঘন ঘন আমরা যোগাযোগ করব, তা নিয়ন্ত্রণ করুন।', 'Control how we use your data and how often we contact you.')}
        >
          <div className="divide-y divide-gray-100">
            <Toggle
              label={L('আমার চ্যাট থেকে এআই-কে শিখতে দিন', 'Allow AI to learn from my chats')}
              description={L('বন্ধ থাকলে এআই কথোপকথন আমাদের মডেল উন্নয়নে ব্যবহার হয় না। ডিফল্ট: বন্ধ।', 'When off, AI conversations are not used to improve our models. Default: off.')}
              checked={prefs?.aiLearningOptIn ?? false}
              onChange={() => handlePrefToggle('aiLearningOptIn')}
            />
            <Toggle
              label={L('মার্কেটিং ইমেইল', 'Marketing emails')}
              description={L('অফার, নিউজলেটার ও নতুন ফিচারের খবর।', 'Promotional offers, newsletters, and feature announcements.')}
              checked={prefs?.marketingEmails ?? false}
              onChange={() => handlePrefToggle('marketingEmails')}
            />
            <Toggle
              label={L('SMS অ্যালার্ট', 'SMS alerts')}
              description={L('বুকিং আপডেট ও টিকিটের উত্তর আপনার ফোনে পাঠানো হবে।', 'Booking updates and ticket replies sent to your phone.')}
              checked={prefs?.smsAlerts ?? false}
              onChange={() => handlePrefToggle('smsAlerts')}
            />
            <Toggle
              label={L('কল নোটিফিকেশন', 'Call notifications')}
              description={L('অ্যাপ বন্ধ থাকলেও ভয়েস/ভিডিও কল এলে নোটিফিকেশন পাবেন। নোটিফিকেশন অনুমতি লাগবে।', 'Get a push notification for incoming voice/video calls, even when the app is closed. Requires notification permission.')}
              checked={prefs?.callNotifications ?? false}
              onChange={handleCallNotifToggle}
            />
          </div>
        </Section>

        {/* delete */}
        <Section
          icon={Trash2}
          title={L('অ্যাকাউন্ট মুছে ফেলুন', 'Delete my account')}
          description={L('৩০ দিন পর্যন্ত অ্যাকাউন্টটি ফেরত আনা যাবে, তারপর সবকিছু স্থায়ীভাবে মুছে ফেলা হবে।', "We'll keep your account in a recoverable state for 30 days, then permanently delete everything.")}
          danger
        >
          <button
            onClick={() => setDeleteModalOpen(true)}
            disabled={!!pendingDeletion}
            className="bg-red-50 hover:bg-red-100 text-[#ba0036] disabled:opacity-50 px-5 py-3 rounded-xl text-xs font-black border border-red-100 transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/25 select-none [-webkit-tap-highlight-color:transparent] flex items-center gap-2"
          >
            <Trash2 size={14} />
            {pendingDeletion ? L('মুছে ফেলার সময় নির্ধারিত আছে', 'Deletion already scheduled') : L('অ্যাকাউন্ট মুছে ফেলুন', 'Delete my account')}
          </button>
        </Section>

        <p className="text-center text-[11px] font-bold text-gray-400 pt-4">
          {L('আপনার ডেটা নিয়ে প্রশ্ন আছে?', 'Questions about your data?')}{' '}
          <button
            onClick={() => {
              navigate('/');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('tolet:open-assistant'));
              }, 100);
            }}
            className="text-[#ba0036] hover:underline"
          >
            {L('সাপোর্টে কথা বলুন', 'Talk to support')}
          </button>
        </p>
      </main>

      {/* ── delete-confirmation modal ─────────────────────────────── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-50 text-[#ba0036] flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <h2 className="text-lg font-black text-gray-900">{L('অ্যাকাউন্ট মুছে ফেলবেন?', 'Delete your account?')}</h2>
              </div>
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-150 active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/60 [-webkit-tap-highlight-color:transparent]"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm font-bold text-gray-700">
              {isBn ? (
                <>আপনার অ্যাকাউন্ট এখনই <span className="text-[#ba0036]">নিষ্ক্রিয়</span> করা হবে এবং ৩০ দিন পর স্থায়ীভাবে মুছে ফেলা হবে। সময়সীমার আগে যেকোনো সময় বাতিল করতে পারবেন।</>
              ) : (
                <>We&apos;ll <span className="text-[#ba0036]">soft-delete</span> your account
              now and permanently delete it after 30 days. You can cancel any time
              before the deadline.</>
              )}
            </p>
            <ul className="text-xs font-bold text-gray-600 list-disc pl-5 mt-3 space-y-1">
              <li>{L('আপনার বিজ্ঞাপনগুলো সঙ্গে সঙ্গে সরিয়ে নেওয়া হবে।', 'Your listings will be unpublished immediately.')}</li>
              <li>{L('চলমান ইনকোয়ারিগুলো বন্ধ হবে এবং অপর পক্ষকে জানানো হবে।', 'Open inquiries will be closed and the other party notified.')}</li>
              <li>{L('পরবর্তী ৩০ দিন আপনার ডেটা এক্সপোর্ট করা যাবে।', 'Your data is exportable for the next 30 days.')}</li>
            </ul>
            <div className="mt-5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {isBn
                  ? <>নিশ্চিত করতে <code className="text-[#ba0036] mx-1">DELETE</code> লিখুন</>
                  : <>Type <code className="text-[#ba0036] mx-1">DELETE</code> to confirm</>}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2 w-full bg-[#f4f7fb] rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#ba0036]/20"
                placeholder="DELETE"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-black transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/60 select-none [-webkit-tap-highlight-color:transparent]"
              >
                {L('অ্যাকাউন্ট রাখুন', 'Keep my account')}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== 'DELETE' || busy.delete}
                className="flex-1 bg-[#ba0036] hover:bg-[#d4004a] disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-black shadow-[0_4px_15px_rgba(186,0,54,0.25)] transition-all duration-150 active:scale-[0.97] disabled:active:scale-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/30 select-none [-webkit-tap-highlight-color:transparent] flex items-center justify-center gap-2"
              >
                <Lock size={14} /> {busy.delete ? L('নির্ধারণ হচ্ছে…', 'Scheduling…') : L('মুছে ফেলা নিশ্চিত করুন', 'Schedule deletion')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── small subcomponents ───────────────────────────────────────────────

const Section = ({ icon: Icon, title, description, children, right, danger }) => (
  <section
    className={`bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] ${
      danger ? 'border border-red-100' : ''
    }`}
  >
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            danger ? 'bg-red-50 text-[#ba0036]' : 'bg-[#ba0036]/10 text-[#ba0036]'
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-gray-900">{title}</h2>
          {description && (
            <p className="text-xs font-bold text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
    <div>{children}</div>
  </section>
);

const Toggle = ({ label, description, checked, onChange }) => (
  <div className="py-3 flex items-start gap-3">
    <div className="flex-1">
      <h4 className="text-sm font-black text-gray-900">{label}</h4>
      {description && (
        <p className="text-[11px] font-bold text-gray-500 mt-0.5">{description}</p>
      )}
    </div>
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-[#ba0036]' : 'bg-gray-200'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  </div>
);

function timeAgo(iso, isBn = false) {
  if (!iso) return '';
  const n = (v) => (isBn ? v.toLocaleString('bn-BD') : v);
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return isBn ? 'এইমাত্র' : 'just now';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return isBn ? `${n(min)} মিনিট আগে` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isBn ? `${n(hr)} ঘণ্টা আগে` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return isBn ? `${n(day)} দিন আগে` : `${day}d ago`;
}

export default PrivacyCenter;
