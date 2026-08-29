/*
 * InviteShareSheet.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The landlord's half of tenant self-onboarding: a QR and a link, and nothing
 * else to think about.
 *
 * WHY THIS IS A SHEET AND NOT A DASHBOARD SECTION
 * The host dashboard already carries sixteen sidebar items, a quick-action row
 * and a second action grid. An "Invite Tenants" panel would have been the
 * seventeenth thing competing for the same screen — and it would have sat there
 * permanently to serve an action that happens twice a year per room.
 *
 * So there is no new surface. This opens from the affordances that already mark
 * the thing being shared: the invite chip on a room's member list, and the
 * share icon on a unit. The landlord taps the room they mean and gets the code
 * for that room, which is the question they were going to ask anyway.
 *
 * ONE SHEET, TWO SCOPES
 * A building invite is a notice board — forwardable, and every submission
 * through it waits for approval. A unit invite is a key — handed to one person
 * for one room, and it takes effect immediately. The copy says which is which,
 * because a landlord who thinks they are sending a key and is actually posting
 * a notice board will hand out the wrong link exactly once.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  X, Copy, Check, Share2, Download, RefreshCw, QrCode, Loader2, AlertTriangle, Users, DoorOpen,
} from 'lucide-react';
import {
  getBuildingInvite, getUnitInvite, revokeBuildingInvite, revokeUnitInvite,
} from '../../services/inviteService';

export default function InviteShareSheet({
  scope,            // 'building' | 'unit'
  buildingId,       // required when scope === 'building'
  unitId,           // required when scope === 'unit'
  // Display context, so the sheet can name the room before the request lands.
  buildingName = '',
  roomLabel = '',
  language,
  onClose,
}) {
  const isBn = language === 'বাংলা';
  const L = (bn, en) => (isBn ? bn : en);

  const [invite, setInvite]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = scope === 'unit'
        ? await getUnitInvite(unitId)
        : await getBuildingInvite(buildingId);
      setInvite(data);
    } catch (err) {
      setError(err.message || L('লিংক তৈরি করা যায়নি।', 'Could not create the link.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, unitId, buildingId]);

  useEffect(() => { load(); }, [load]);

  // Escape closes, like every other modal in the dashboard.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    if (!invite?.url) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable (insecure origin / old webview) — the
                 link is on screen and selectable, so this is not worth an error */ }
  };

  // The native share sheet is the whole point on a phone: the landlord's next
  // move is almost always "send this into the WhatsApp group", and this is the
  // one control that does it without a copy-paste round trip. Falls back to
  // copy where the API doesn't exist (desktop browsers, older webviews).
  const share = async () => {
    if (!invite?.url) return;
    const text = scope === 'unit'
      ? L(`${buildingName} — ${roomLabel} এর জন্য আপনার তথ্য পূরণ করুন:`,
          `Fill in your details for ${roomLabel} at ${buildingName}:`)
      : L(`${buildingName} — আপনার রুম নির্বাচন করে তথ্য পূরণ করুন:`,
          `Select your room at ${buildingName} and fill in your details:`);
    if (navigator.share) {
      try {
        await navigator.share({ title: buildingName || 'TO-LET PRO', text, url: invite.url });
        return;
      } catch { /* user dismissed the share sheet — not an error */ }
    }
    copy();
  };

  // Saving the QR is what makes the printed-on-the-wall use case work. The QR
  // arrives as a data URL, so this needs no network and no canvas.
  const downloadQr = () => {
    if (!invite?.qr) return;
    const a = document.createElement('a');
    a.href = invite.qr;
    const slug = `${buildingName || 'property'}${roomLabel ? `-${roomLabel}` : ''}`
      .replace(/[^\wঀ-৿-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    a.download = `tolet-invite-${slug || 'qr'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const revoke = async () => {
    setRevoking(true);
    try {
      const data = scope === 'unit'
        ? await revokeUnitInvite(unitId)
        : await revokeBuildingInvite(buildingId);
      // The revoke response carries only the new token/url/qr, so the display
      // context (room number, building name) is preserved from what we had.
      setInvite((prev) => ({ ...prev, ...data }));
      setConfirmRevoke(false);
    } catch (err) {
      setError(err.message || L('নতুন লিংক তৈরি করা যায়নি।', 'Could not issue a new link.'));
    } finally {
      setRevoking(false);
    }
  };

  const isUnit = scope === 'unit';
  const title = isUnit
    ? L(`${roomLabel} — ভাড়াটিয়া যুক্ত করুন`, `${roomLabel} — Invite tenant`)
    : L('সবাইকে ইনভাইট করুন', 'Invite everyone');

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-4">

          {/* Header */}
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center ${
              isUnit ? 'bg-blue-50 text-blue-600' : 'bg-[#ba0036]/10 text-[#ba0036]'
            }`}>
              {isUnit ? <DoorOpen size={18} /> : <Users size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-gray-900 leading-tight">{title}</h2>
              <p className="text-[11px] font-bold text-gray-500 mt-0.5 truncate">{buildingName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <X size={17} />
            </button>
          </div>

          {/* What this link does. A landlord about to paste something into a
              group of forty people should know which of the two it is. */}
          <div className={`rounded-2xl p-3 border ${
            isUnit
              ? 'bg-blue-50/60 border-blue-100'
              : 'bg-amber-50/60 border-amber-100'
          }`}>
            <p className={`text-[11px] font-bold leading-relaxed ${isUnit ? 'text-blue-900' : 'text-amber-900'}`}>
              {isUnit
                ? L('যাকে পাঠাবেন তিনি নিজের নাম, NID ও ছবি দিয়ে সরাসরি এই রুমে যুক্ত হয়ে যাবেন। শুধু একজনকেই পাঠান।',
                    'Whoever you send this to fills in their own name, NID and photo and joins this room directly. Send it to one person only.')
                : L('গ্রুপে পাঠানোর জন্য। যে কেউ নিজের রুম বেছে নিয়ে তথ্য পূরণ করবেন — তবে আপনার অনুমোদনের পরেই যুক্ত হবেন।',
                    'Made for group chats. Anyone can pick their room and fill in their details — but they only join after you approve.')}
            </p>
          </div>

          {loading && (
            <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-[11px] font-black uppercase tracking-widest">
                {L('লিংক তৈরি হচ্ছে', 'Creating link')}
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl bg-red-50 border border-red-100 p-3.5 flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-[#ba0036] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-red-900 leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#ba0036] hover:underline"
                >
                  {L('আবার চেষ্টা করুন', 'Try again')}
                </button>
              </div>
            </div>
          )}

          {!loading && !error && invite && (
            <>
              {/* The QR itself — big enough to scan off a screen held up to
                  another phone, which is how this gets used in person. */}
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-3xl bg-white border-2 border-gray-100 shadow-sm">
                  {invite.qr
                    ? <img src={invite.qr} alt={L('ইনভাইট QR', 'Invite QR')} className="w-44 h-44 sm:w-52 sm:h-52" />
                    : <div className="w-44 h-44 flex items-center justify-center text-gray-200"><QrCode size={48} /></div>}
                </div>
                <p className="text-[10px] font-bold text-gray-400 text-center leading-relaxed px-2">
                  {L('ভাড়াটিয়া ফোনের ক্যামেরা দিয়ে স্ক্যান করলেই ফর্ম খুলে যাবে — আলাদা অ্যাপ লাগবে না।',
                     'Tenants scan it with their phone camera — no separate app needed.')}
                </p>
              </div>

              {/* The link, selectable, above the buttons that act on it. */}
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  {L('লিংক', 'Link')}
                </p>
                <p className="text-[11px] font-bold text-gray-700 break-all leading-relaxed select-all">
                  {invite.url}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={share}
                  className="bg-gray-900 text-white py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Share2 size={13} /> {L('শেয়ার', 'Share')}
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:border-gray-900 hover:text-gray-900 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                  {copied ? L('কপি হয়েছে', 'Copied') : L('কপি', 'Copy')}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadQr}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:border-gray-300 hover:text-gray-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Download size={12} /> {L('QR সেভ করুন', 'Save QR')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(true)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:border-amber-300 hover:text-amber-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={12} /> {L('নতুন লিংক', 'New link')}
                </button>
              </div>

              {/* Revoking is destructive to something physical — a QR that may
                  already be taped to a wall. It says so before it happens. */}
              {confirmRevoke && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 space-y-2.5">
                  <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                    {L('নতুন লিংক তৈরি করলে পুরোনো লিংক ও প্রিন্ট করা QR সঙ্গে সঙ্গে কাজ করা বন্ধ করবে। যাদের পুরোনো লিংক দেওয়া আছে তাদের আবার পাঠাতে হবে।',
                       'Issuing a new link stops the old link — and any printed QR — from working immediately. Anyone holding the old one will need it again.')}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={revoke}
                      disabled={revoking}
                      className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 active:scale-[0.98] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      {revoking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {L('হ্যাঁ, নতুন লিংক দিন', 'Yes, issue a new link')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRevoke(false)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-amber-200 text-amber-800 font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all"
                    >
                      {L('বাতিল', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
