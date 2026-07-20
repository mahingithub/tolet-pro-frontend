import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, X, Trash2, Edit3, Star, Copy, Check, CreditCard, Smartphone,
  Landmark, UploadCloud, Image as ImageIcon, Loader2, AlertCircle, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import {
  listMyPaymentMethods, createPaymentMethod, updatePaymentMethod,
  deletePaymentMethod, uploadPaymentMethodQr, deletePaymentMethodQr,
} from '../../services/paymentMethodService';

// Rail presentation — colours + icon + label per payment type.
export const METHOD_META = {
  bkash:  { label: 'bKash',  icon: Smartphone, ring: 'ring-pink-200',   tint: 'bg-pink-50 text-pink-600 border-pink-100',       dot: 'bg-pink-500' },
  nagad:  { label: 'Nagad',  icon: Smartphone, ring: 'ring-orange-200', tint: 'bg-orange-50 text-orange-600 border-orange-100', dot: 'bg-orange-500' },
  rocket: { label: 'Rocket', icon: Smartphone, ring: 'ring-violet-200', tint: 'bg-violet-50 text-violet-600 border-violet-100', dot: 'bg-violet-500' },
  bank:   { label: 'Bank',   icon: Landmark,   ring: 'ring-blue-200',   tint: 'bg-blue-50 text-blue-600 border-blue-100',       dot: 'bg-blue-500' },
};

const TYPE_OPTIONS = [
  { id: 'bkash',  labelEn: 'bKash Personal',  labelBn: 'বিকাশ (পার্সোনাল)' },
  { id: 'nagad',  labelEn: 'Nagad Personal',  labelBn: 'নগদ (পার্সোনাল)' },
  { id: 'rocket', labelEn: 'Rocket Personal', labelBn: 'রকেট (পার্সোনাল)' },
  { id: 'bank',   labelEn: 'Bank Account',    labelBn: 'ব্যাংক অ্যাকাউন্ট' },
];

function CopyButton({ value, language }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(String(value || '')).then(() => {
          setCopied(true);
          toast.success(language === 'বাংলা' ? 'কপি হয়েছে' : 'Copied');
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
      title={language === 'বাংলা' ? 'কপি করুন' : 'Copy'}
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  );
}

/**
 * PaymentSettings — landlord manages their manual-payment accounts.
 * Fully self-contained (fetches + mutates). Reports the current method list up
 * via `onChange(methods)` so the parent dashboard can update its warning badge
 * and rent-reminder instructions without a second fetch.
 */
export default function PaymentSettings({ onChange }) {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Keep the latest onChange in a ref so `load` doesn't depend on its identity.
  // Parents almost always pass an inline arrow (e.g. onChange={rows => ...}),
  // which is a NEW function reference on every render. If `load` depended on
  // `onChange`, that fresh reference would recreate `load` → re-fire the mount
  // effect → refetch → call onChange → parent re-render → new onChange → …, an
  // infinite loop that pins the spinner on forever. That was the reported bug:
  // an added bKash number never appeared, the panel just kept reloading.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listMyPaymentMethods();
      setMethods(rows);
      onChangeRef.current?.(rows);
    } catch (err) {
      setError(err.message || (bn ? 'লোড করা যায়নি।' : 'Could not load payment methods.'));
    } finally {
      setLoading(false);
    }
  }, [bn]);

  // Fetch once on mount (and again only if the language flips — rare and
  // harmless). It no longer re-runs just because the parent re-rendered.
  useEffect(() => { load(); }, [load]);

  const handleSetDefault = async (m) => {
    if (m.isDefault) return;
    setBusyId(m.id);
    try {
      await updatePaymentMethod(m.id, { isDefault: true });
      toast.success(bn ? 'ডিফল্ট সেট হয়েছে' : 'Default updated');
      await load();
    } catch (err) {
      toast.error(err.message || (bn ? 'ব্যর্থ হয়েছে' : 'Failed'));
    } finally { setBusyId(null); }
  };

  const handleToggleActive = async (m) => {
    setBusyId(m.id);
    try {
      await updatePaymentMethod(m.id, { isActive: !m.isActive });
      toast.success(!m.isActive ? (bn ? 'চালু হয়েছে' : 'Activated') : (bn ? 'বন্ধ হয়েছে' : 'Deactivated'));
      await load();
    } catch (err) {
      toast.error(err.message || (bn ? 'ব্যর্থ হয়েছে' : 'Failed'));
    } finally { setBusyId(null); }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(bn ? 'এই পেমেন্ট মেথড মুছে ফেলবেন?' : 'Delete this payment method?')) return;
    setBusyId(m.id);
    try {
      await deletePaymentMethod(m.id);
      toast.success(bn ? 'মুছে ফেলা হয়েছে' : 'Deleted');
      await load();
    } catch (err) {
      toast.error(err.message || (bn ? 'ব্যর্থ হয়েছে' : 'Failed'));
    } finally { setBusyId(null); }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CreditCard size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-black text-gray-900 leading-tight">
              {bn ? 'পেমেন্ট সেটিংস' : 'Payment Settings'}
            </h3>
            <p className="text-[11px] md:text-xs font-bold text-gray-500 mt-0.5">
              {bn
                ? 'আপনার bKash/Nagad/Rocket/ব্যাংক অ্যাকাউন্ট যোগ করুন — ভাড়াটিয়া সরাসরি এখানে ভাড়া পাঠাবে।'
                : 'Add your bKash / Nagad / Rocket / Bank account so tenants pay rent directly to you.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="inline-flex items-center gap-1.5 bg-[#ba0036] hover:bg-[#a1002f] text-white px-4 py-2.5 rounded-xl font-black text-xs shadow-[0_8px_15px_rgba(186,0,54,0.2)] active:scale-95 transition-all shrink-0"
        >
          <Plus size={15} /> {bn ? 'যোগ করুন' : 'Add'}
        </button>
      </div>

      {/* No-method warning */}
      {!loading && methods.length === 0 && !error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-amber-900">
              {bn ? 'কোনো পেমেন্ট মেথড যোগ করা হয়নি' : 'No payment method added yet'}
            </h4>
            <p className="text-xs font-bold text-amber-700/90 mt-1">
              {bn
                ? 'অন্তত একটি পেমেন্ট অ্যাকাউন্ট যোগ করুন যাতে ভাড়াটিয়া ভাড়া পাঠাতে পারে।'
                : 'Add at least one payment account so your tenants can send rent.'}
            </p>
            <button
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
            >
              <Plus size={13} /> {bn ? 'পেমেন্ট মেথড যোগ করুন' : 'Add Payment Method'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {/* Method cards */}
      {!loading && methods.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((m) => {
            const meta = METHOD_META[m.type] || METHOD_META.bank;
            const Icon = meta.icon;
            const busy = busyId === m.id;
            return (
              <div
                key={m.id}
                className={`relative bg-white rounded-[1.25rem] border p-4 shadow-sm transition-all ${m.isDefault ? `ring-2 ${meta.ring} border-transparent` : 'border-gray-100'} ${!m.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${meta.tint}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-gray-900">{meta.label}</span>
                      {m.isDefault && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black uppercase tracking-widest">
                          <Star size={9} className="fill-amber-400 text-amber-400" /> {bn ? 'ডিফল্ট' : 'Default'}
                        </span>
                      )}
                      {!m.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-black uppercase tracking-widest">
                          {bn ? 'বন্ধ' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-500 mt-0.5 truncate">{m.accountHolderName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm font-black text-gray-900 tabular-nums tracking-tight truncate">{m.accountNumber}</span>
                      <CopyButton value={m.accountNumber} language={language} />
                    </div>
                    {m.type === 'bank' && (m.bankName || m.branchName) && (
                      <p className="text-[11px] font-bold text-gray-400 mt-1 truncate">
                        {[m.bankName, m.branchName].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                  {m.qrImageUrl && (
                    <img
                      src={m.qrImageUrl}
                      alt="QR"
                      className="w-14 h-14 rounded-lg object-cover border border-gray-100 shrink-0"
                    />
                  )}
                </div>

                {/* Actions — thumb-friendly targets on mobile */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    disabled={busy || m.isDefault}
                    onClick={() => handleSetDefault(m)}
                    className={`flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${m.isDefault ? 'bg-amber-50 text-amber-400 cursor-default' : 'bg-gray-50 text-gray-600 hover:bg-amber-50 hover:text-amber-600'}`}
                  >
                    <Star size={12} className={m.isDefault ? 'fill-amber-300 text-amber-300' : ''} />
                    {bn ? 'ডিফল্ট' : 'Default'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleToggleActive(m)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {m.isActive ? (bn ? 'বন্ধ করুন' : 'Disable') : (bn ? 'চালু করুন' : 'Enable')}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => { setEditing(m); setFormOpen(true); }}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shrink-0"
                    title={bn ? 'এডিট' : 'Edit'}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(m)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0"
                    title={bn ? 'মুছুন' : 'Delete'}
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust note */}
      {!loading && methods.length > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
          <ShieldCheck size={13} className="text-emerald-500" />
          {bn
            ? 'শুধু ডিফল্ট মেথডটি ভাড়ার রিমাইন্ডারে দেখানো হবে।'
            : 'Only your default method is shown in rent reminders.'}
        </p>
      )}

      {formOpen && (
        <PaymentMethodFormModal
          method={editing}
          language={language}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={async () => { setFormOpen(false); setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit form modal
// ─────────────────────────────────────────────────────────────────────────────
function PaymentMethodFormModal({ method, language, onClose, onSaved }) {
  const bn = language === 'বাংলা';
  const isEdit = !!method;

  // Add mode supports selecting MULTIPLE wallet types that share ONE number
  // (e.g. the same 01XXXXXXXXX is used for bKash + Nagad). Bank is exclusive
  // (its own account number + branch). Edit mode stays single-type.
  const [selectedTypes, setSelectedTypes] = useState(() => new Set([method?.type || 'bkash']));
  const hasBank = selectedTypes.has('bank');
  const toggleType = (id) => {
    if (isEdit) { setSelectedTypes(new Set([id])); return; }
    setSelectedTypes((prev) => {
      if (id === 'bank') return prev.has('bank') ? new Set(['bkash']) : new Set(['bank']);
      const next = new Set(prev);
      next.delete('bank');
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next.size ? next : new Set([id]);
    });
  };

  const [accountHolderName, setHolder] = useState(method?.accountHolderName || '');
  const [accountNumber, setNumber] = useState(method?.accountNumber || '');
  const [bankName, setBankName] = useState(method?.bankName || '');
  const [branchName, setBranchName] = useState(method?.branchName || '');
  const [isDefault, setIsDefault] = useState(method?.isDefault || false);
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(method?.qrImageUrl || '');
  const [removeQr, setRemoveQr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const onPickQr = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast.error(bn ? 'ছবি নির্বাচন করুন' : 'Please pick an image'); return; }
    setQrFile(f);
    setRemoveQr(false);
    setQrPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!accountHolderName.trim()) { setErr(bn ? 'অ্যাকাউন্ট হোল্ডারের নাম দিন।' : 'Enter the account holder name.'); return; }
    if (!accountNumber.trim()) { setErr(bn ? 'মোবাইল/অ্যাকাউন্ট নম্বর দিন।' : 'Enter the mobile / account number.'); return; }
    const typesArr = [...selectedTypes];
    if (!typesArr.length) { setErr(bn ? 'অন্তত একটি পেমেন্ট টাইপ বেছে নিন।' : 'Pick at least one payment type.'); return; }
    setSaving(true);
    setErr('');
    try {
      const base = {
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
      };
      if (isEdit) {
        const t = typesArr[0];
        const saved = await updatePaymentMethod(method.id, {
          ...base,
          type: t,
          bankName: t === 'bank' ? bankName.trim() : '',
          branchName: t === 'bank' ? branchName.trim() : '',
          isDefault,
        });
        if (qrFile && saved?.id) {
          await uploadPaymentMethodQr(saved.id, qrFile);
        } else if (removeQr && method.qrImageUrl) {
          await deletePaymentMethodQr(method.id);
        }
      } else {
        // One PaymentMethod per selected type, all sharing the same number —
        // this is how "2-3 methods on one number" shows up as separate cards.
        for (let i = 0; i < typesArr.length; i++) {
          const t = typesArr[i];
          const saved = await createPaymentMethod({
            ...base,
            type: t,
            bankName: t === 'bank' ? bankName.trim() : '',
            branchName: t === 'bank' ? branchName.trim() : '',
            isDefault: isDefault && i === 0,
          });
          if (qrFile && saved?.id) await uploadPaymentMethodQr(saved.id, qrFile);
        }
      }
      toast.success(isEdit ? (bn ? 'আপডেট হয়েছে' : 'Updated') : (bn ? 'যোগ হয়েছে' : 'Added'));
      onSaved();
    } catch (error) {
      setErr(error.message || (bn ? 'সেভ করা যায়নি।' : 'Could not save.'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full sm:max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <CreditCard className="text-[#ba0036]" size={22} />
            {isEdit ? (bn ? 'পেমেন্ট মেথড এডিট' : 'Edit Payment Method') : (bn ? 'নতুন পেমেন্ট মেথড' : 'Add Payment Method')}
          </h2>
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 overflow-y-auto custom-scrollbar space-y-4">
          {/* Type selector — multi-select in add mode (one number ⇒ many wallets) */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              {bn ? 'পেমেন্ট টাইপ' : 'Payment Type'}
              {!isEdit && (
                <span className="ml-1 text-gray-300 normal-case tracking-normal font-bold">
                  {bn ? '(একই নম্বরে একাধিক বেছে নিন)' : '(pick one or more that share this number)'}
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const meta = METHOD_META[opt.id];
                const Icon = meta.icon;
                const active = selectedTypes.has(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleType(opt.id)}
                    className={`relative flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition-all ${active ? `${meta.tint} ring-2 ${meta.ring} border-transparent` : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="text-[11px] font-black leading-tight">{bn ? opt.labelBn : opt.labelEn}</span>
                    {active && !isEdit && <Check size={14} className="absolute top-1.5 right-1.5 text-emerald-600" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'অ্যাকাউন্ট হোল্ডারের নাম' : 'Account Holder Name'}</label>
            <input
              type="text" value={accountHolderName} onChange={(e) => setHolder(e.target.value)}
              placeholder={bn ? 'যেমন: মোঃ আসরাফ' : 'e.g. Md. Asraf'}
              className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              {hasBank ? (bn ? 'অ্যাকাউন্ট নম্বর' : 'Account Number') : (bn ? 'মোবাইল নম্বর' : 'Mobile Number')}
            </label>
            <input
              type="text" inputMode={hasBank ? 'text' : 'tel'} value={accountNumber} onChange={(e) => setNumber(e.target.value)}
              placeholder={hasBank ? '0000000000000' : '01XXXXXXXXX'}
              className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all"
            />
          </div>

          {hasBank && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'ব্যাংকের নাম' : 'Bank Name'}</label>
                <input
                  type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
                  placeholder={bn ? 'যেমন: সিটি ব্যাংক' : 'e.g. City Bank'}
                  className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'ব্রাঞ্চ' : 'Branch'}</label>
                <input
                  type="text" value={branchName} onChange={(e) => setBranchName(e.target.value)}
                  placeholder={bn ? 'যেমন: গুলশান' : 'e.g. Gulshan'}
                  className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white border border-transparent focus:border-blue-500/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* QR upload */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{bn ? 'QR ছবি (ঐচ্ছিক)' : 'QR Image (optional)'}</label>
            <div className="flex items-center gap-3">
              {qrPreview && !removeQr ? (
                <div className="relative">
                  <img src={qrPreview} alt="QR preview" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => { setQrFile(null); setQrPreview(''); setRemoveQr(!!method?.qrImageUrl); }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                  <ImageIcon size={22} />
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 text-[11px] font-black uppercase tracking-widest cursor-pointer transition-colors">
                <UploadCloud size={15} />
                {bn ? 'আপলোড' : 'Upload'}
                <input type="file" accept="image/*" className="hidden" onChange={onPickQr} />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2.5 px-1 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 rounded accent-[#ba0036]" />
            <span className="text-xs font-bold text-gray-700">{bn ? 'ডিফল্ট পেমেন্ট মেথড হিসেবে সেট করুন' : 'Set as default payment method'}</span>
          </label>

          {err && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{err}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#ba0036] hover:bg-[#a1002f] disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-sm shadow-[0_8px_15px_rgba(186,0,54,0.2)] active:scale-95 transition-all inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? (bn ? 'সেভ হচ্ছে...' : 'Saving...') : (isEdit ? (bn ? 'আপডেট করুন' : 'Update') : (bn ? 'যোগ করুন' : 'Add Method'))}
          </button>
        </form>
      </div>
    </div>
  );
}
