import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Landmark, ImagePlus, X } from 'lucide-react';
import { subscriptionService } from '../../services/subscriptionService';
import { useAuth } from '../../context/AuthContext.jsx';

const MAX_SCREENSHOT = 5 * 1024 * 1024; // the API's image cap (uploadSingleImage)

export const METHOD_LABEL = {
  bkash: { bn: 'বিকাশ', en: 'bKash' },
  nagad: { bn: 'নগদ', en: 'Nagad' },
  rocket: { bn: 'রকেট', en: 'Rocket' },
  bank: { bn: 'ব্যাংক ট্রান্সফার', en: 'Bank transfer' },
};

const LOGOS = { bkash: '/payment svg/bkash.svg', nagad: '/payment svg/nagad.png', rocket: '/payment svg/rocket.svg' };

export const fmtTaka = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`;

export function MethodLogo({ type, size = 'md' }) {
  const box = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12';
  return (
    // Not bg-white: dark mode remaps that, and brand logos need a light chip.
    <span className={`${box} rounded-xl bg-[#fefefe] border border-slate-200 flex items-center justify-center overflow-hidden shrink-0`}>
      {LOGOS[type]
        ? <img src={LOGOS[type]} alt="" className="w-[78%] h-[78%] object-contain" />
        : <Landmark size={size === 'sm' ? 16 : 20} className="text-[#334155]" />}
    </span>
  );
}

function CopyButton({ value, isBn }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* it's on screen to type */ }
  };
  return (
    <button type="button" onClick={copy}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 shrink-0">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}
    </button>
  );
}

const StepNo = ({ n }) => (
  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
);

/**
 * Step 3 of the checkout: how to pay into the chosen method, then the form
 * for what the host got back (TrxID / reference, who paid, a screenshot).
 * The server accepts it at once if our wallet's SMS already arrived, else it
 * waits for the SMS or an admin — tolet-pro-backend/services/subscriptionPayment.service.js.
 * Remount with key={method.id} so a new method starts on a clean form.
 */
export default function PaymentStep({ plan, method, isBn, onSubmitted }) {
  const tr = (bn, en) => (isBn ? bn : en);
  const num = (n) => (isBn ? Number(n).toLocaleString('bn-BD') : String(n));
  const { user } = useAuth() || {};
  const isBank = method.type === 'bank';
  const wallet = tr(METHOD_LABEL[method.type].bn, METHOD_LABEL[method.type].en);
  const action = method.accountType === 'merchant' ? tr('পেমেন্ট', 'Payment') : tr('সেন্ড মানি', 'Send Money');

  const [trxId, setTrxId] = useState('');
  // Most hosts pay from their own number.
  const [sender, setSender] = useState(!isBank && /^\+8801\d{9}$/.test(user?.phone || '') ? user.phone.slice(3) : '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (f && f.size > MAX_SCREENSHOT) {
      setError(tr('ছবি সর্বোচ্চ ৫MB হতে পারে।', 'The image can be at most 5 MB.'));
      return;
    }
    setError('');
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payment = await subscriptionService.submitPayment({ planId: plan.id, methodId: method.id, trxId, sender, file });
      onSubmitted(payment);
    } catch (err) {
      setError(err.message || tr('পাঠানো যায়নি। আবার চেষ্টা করুন।', 'Could not send. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-base outline-none focus:border-slate-900 dark:focus:border-white/40';
  const label = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="space-y-5">
      <ol className="space-y-4">
        {isBank ? (
          <li className="flex gap-3">
            <StepNo n={num(1)} />
            <div className="flex-1 min-w-0 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {tr(`ব্যাংক অ্যাপ (NPSB / BEFTN) বা শাখা থেকে ঠিক ${fmtTaka(plan.price)} এই অ্যাকাউন্টে পাঠান`,
                  `From your bank app (NPSB / BEFTN) or branch, transfer exactly ${fmtTaka(plan.price)} to`)}
              </p>
              <dl className="rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 text-sm">
                {[
                  [tr('ব্যাংক', 'Bank'), method.bankName],
                  [tr('অ্যাকাউন্টের নাম', 'Account name'), method.accountName],
                  [tr('অ্যাকাউন্ট নম্বর', 'Account number'), method.accountNumber, true],
                  [tr('শাখা', 'Branch'), method.branchName],
                  [tr('রাউটিং নম্বর', 'Routing number'), method.routingNumber],
                ].filter(([, v]) => v).map(([k, v, copy]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                    <dd className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-right" dir="auto">
                      <span className={copy ? 'font-mono' : ''}>{v}</span>
                      {copy && <CopyButton value={v} isBn={isBn} />}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ) : (
          <>
            <li className="flex gap-3">
              <StepNo n={num(1)} />
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {tr(`আপনার ${wallet} অ্যাপ খুলে "${action}" বেছে নিন`, `Open your ${wallet} app and choose "${action}"`)}
              </p>
            </li>
            <li className="flex gap-3">
              <StepNo n={num(2)} />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {tr(`এই নম্বরে ঠিক ${fmtTaka(plan.price)} পাঠান`, `Send exactly ${fmtTaka(plan.price)} to`)}
                </p>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5">
                  <MethodLogo type={method.type} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-extrabold tracking-wide text-slate-900 dark:text-white font-mono" dir="ltr">{method.accountNumber}</p>
                    {method.accountName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{tr('প্রাপক', 'Recipient')}: {method.accountName}</p>
                    )}
                  </div>
                  <CopyButton value={method.accountNumber} isBn={isBn} />
                </div>
              </div>
            </li>
          </>
        )}

        <li className="flex gap-3">
          <StepNo n={num(isBank ? 2 : 3)} />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {isBank
              ? tr('ট্রান্সফারের রেফারেন্স নম্বর নিচে লিখে জমা দিন', 'Enter the transfer reference below and submit')
              : tr('মেসেজে আসা TrxID নিচে লিখে জমা দিন', 'Enter the TrxID from the confirmation message below and submit')}
          </p>
        </li>
      </ol>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3">
        <span className="text-sm text-slate-600 dark:text-slate-400">{tr('পাঠাতে হবে', 'Amount to send')}</span>
        <span className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-slate-900 dark:text-white">{fmtTaka(plan.price)}</span>
          <CopyButton value={plan.price} isBn={isBn} />
        </span>
      </div>

      {method.instructions && (
        <p className="text-sm rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 px-4 py-3" dir="auto">
          {method.instructions}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4 pt-1">
        <div>
          <label htmlFor="pay-trx" className={label}>
            {isBank ? tr('রেফারেন্স / ট্রানজেকশন নম্বর', 'Reference / transaction number') : tr('ট্রানজেকশন আইডি (TrxID)', 'Transaction ID (TrxID)')}
          </label>
          <input id="pay-trx" type="text" required autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder={isBank ? 'FT26100042' : '9GH7K2L3M4'} value={trxId} onChange={(e) => setTrxId(e.target.value)} className={`${field} font-mono`} />
        </div>
        <div>
          <label htmlFor="pay-sender" className={label}>
            {isBank
              ? tr('যে অ্যাকাউন্ট থেকে পাঠিয়েছেন (নাম বা নম্বর)', 'Paid from (account name or number)')
              : tr(`যে ${wallet} নম্বর থেকে পাঠিয়েছেন`, `The ${wallet} number you paid from`)}
          </label>
          <input id="pay-sender" required type={isBank ? 'text' : 'tel'} autoComplete={isBank ? 'name' : 'tel'}
            placeholder={isBank ? '' : '01XXXXXXXXX'} value={sender} onChange={(e) => setSender(e.target.value)} className={field} />
        </div>
        <div>
          <span className={label}>{tr('স্ক্রিনশট বা রসিদ (ঐচ্ছিক)', 'Screenshot or receipt (optional)')}</span>
          {preview ? (
            <div className="flex items-center gap-3">
              <img src={preview} alt={tr('পেমেন্টের স্ক্রিনশট', 'Payment screenshot')} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-white/10" />
              <span className="flex-1 min-w-0 text-sm text-slate-600 dark:text-slate-400 truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label={tr('ছবি সরান', 'Remove image')}
                className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                <X size={16} className="text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          ) : (
            <label htmlFor="pay-shot"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-300 dark:border-white/15 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
              <ImagePlus size={20} className="text-slate-400" />
              <span className="text-sm text-slate-600 dark:text-slate-400">{tr('ছবি যোগ করুন — দ্রুত যাচাইয়ে সাহায্য করে', 'Add an image — helps us verify faster')}</span>
            </label>
          )}
          <input id="pay-shot" type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} className="sr-only" />
        </div>

        {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={busy}
          className="w-full py-4 rounded-xl font-bold text-base text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 disabled:opacity-60 transition-colors">
          {busy ? tr('পাঠানো হচ্ছে…', 'Sending…') : tr(`পেমেন্ট জমা দিন · ${fmtTaka(plan.price)}`, `Submit payment · ${fmtTaka(plan.price)}`)}
        </button>
      </form>
    </div>
  );
}
