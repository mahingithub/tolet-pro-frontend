import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { getSectionGuides } from '../services/aiGuideService';
import {
  ArrowLeft, Check, ChevronDown, Crown, Sparkles, ShieldCheck, Lock, PlayCircle, X, Clock, AlertCircle, CheckCircle2,
} from 'lucide-react';
import PaymentStep, { MethodLogo, METHOD_LABEL, fmtTaka } from './payment/PaymentStep';
import Footer from './Footer';
import FreeProTrialModal from './FreeProTrialModal';

const getEmbedUrl = (url = '') => url
  .replace('youtube.com/watch?v=', 'youtube.com/embed/')
  .replace('youtu.be/', 'youtube.com/embed/');

const card = 'bg-white dark:bg-[#13111C] rounded-2xl border border-slate-200 dark:border-white/10';

// Defined out here, not inside the page: a component created during render
// remounts its children every render — and would wipe the payment form.
const Section = ({ n, title, done, children }) => (
  <section className={`${card} p-4 sm:p-5`}>
    <div className="flex items-center gap-3 mb-4">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}>
        {done ? <Check size={14} strokeWidth={3} /> : n}
      </span>
      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
    </div>
    {children}
  </section>
);

const SummaryRow = ({ label, value, tone = '' }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-slate-600 dark:text-slate-400">{label}</span>
    <span className={`font-semibold ${tone || 'text-slate-900 dark:text-white'}`}>{value}</span>
  </div>
);

/** What happened after submitting: on (matched by SMS) or waiting for a check. */
function ResultCard({ payment, method, planName, status, isBn, fmtDate, onDone }) {
  const tr = (bn, en) => (isBn ? bn : en);
  const approved = payment.status === 'approved';
  return (
    <section className={`${card} p-6 text-center`}>
      {approved
        ? <CheckCircle2 size={52} className="text-emerald-500 mx-auto mb-3" />
        : <Clock size={52} className="text-amber-500 mx-auto mb-3" />}
      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
        {approved ? tr('পেমেন্ট সফল!', 'Payment received!') : tr('পেমেন্টের তথ্য পেয়েছি', 'We got your payment details')}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-5">
        {approved
          ? (status.paidThroughAt
            ? tr(`${planName} চালু হয়েছে — ${fmtDate(status.paidThroughAt)} পর্যন্ত।`, `${planName} is active until ${fmtDate(status.paidThroughAt)}.`)
            : tr(`${planName} চালু হয়েছে।`, `${planName} is now active.`))
          : (method?.autoCheck
            ? tr('টাকা পৌঁছানো নিশ্চিত হলেই প্ল্যান চালু হবে — সাধারণত কয়েক মিনিটের মধ্যে। চালু হলে নোটিফিকেশন পাবেন। আবার টাকা পাঠাবেন না।',
              "Your plan turns on as soon as the money is confirmed — usually within minutes. We'll notify you. Please don't pay again.")
            : tr('আমরা টাকা মিলিয়ে দেখে প্ল্যান চালু করব — সাধারণত কয়েক ঘণ্টার মধ্যে। চালু হলে নোটিফিকেশন পাবেন। আবার টাকা পাঠাবেন না।',
              "We'll check the payment and turn your plan on — usually within a few hours. We'll notify you. Please don't pay again."))}
      </p>
      {payment.screenshotFailed && (
        <p className="text-sm text-amber-700 dark:text-amber-300 max-w-md mx-auto -mt-2 mb-5">
          {tr('স্ক্রিনশটটি আপলোড করা যায়নি — তবে পেমেন্টের তথ্য জমা হয়েছে, যাচাই আটকাবে না।',
            "The screenshot couldn't be uploaded — but your payment details were received, so the check goes ahead.")}
        </p>
      )}
      <dl className="max-w-sm mx-auto text-sm rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 text-left mb-6">
        {[
          [tr('প্ল্যান', 'Plan'), planName],
          [tr('পরিমাণ', 'Amount'), fmtTaka(payment.amount)],
          [tr('পাঠানো হয়েছে', 'Paid to'), payment.paidTo],
          ['TrxID', payment.trxId],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-4 py-2.5">
            <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
            <dd className="font-semibold text-slate-900 dark:text-white font-mono text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onDone}
        className="w-full max-w-sm py-4 rounded-xl font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900">
        {tr('ড্যাশবোর্ডে যান', 'Go to dashboard')}
      </button>
    </section>
  );
}

/**
 * Checkout: plan → payment method → pay, with the order summary alongside.
 *
 * There is no gateway. The host pays into one of the accounts a super admin
 * added ("Add Payment System"), then submits what they got back; the server
 * accepts it on our wallet's SMS or an admin's approval. Prices — including
 * the yearly discount — come from the admin console via fetchCheckoutOptions().
 */
const CheckoutPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/subscription');
  const { language = 'English' } = useLanguage() || {};
  const isBn = language === 'বাংলা';
  const tr = (bn, en) => (isBn ? bn : en);
  const num = (n) => (isBn ? Number(n).toLocaleString('bn-BD') : String(n));

  const [plans, setPlans] = useState(PLANS);
  // undefined = loading · null = couldn't load · [] = none set up
  const [methods, setMethods] = useState(undefined);
  const [methodId, setMethodId] = useState('');
  const [status, setStatus] = useState(subscriptionService.getStatus());
  // The host's latest claim — so a pending one isn't paid for twice.
  const [lastPayment, setLastPayment] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  // The claim submitted on this visit; shows the result in place of the steps.
  const [result, setResult] = useState(null);
  const [showBenefits, setShowBenefits] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [guide, setGuide] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // A deep link lands here without the plans page having loaded anything.
    subscriptionService.fetchStatus();
    const off = subscriptionService.onChange(() => setStatus(subscriptionService.getStatus()));
    subscriptionService.fetchCheckoutOptions().then(({ plans: live, methods: available }) => {
      setPlans(live);
      setMethods(available);
      if (available?.length === 1) setMethodId(available[0].id);
    });
    subscriptionService.getPayments().then((rows) => setLastPayment(rows[0] || null)).catch(() => {});
    getSectionGuides('checkout').then((g) => setGuide(Array.isArray(g) && g[0] ? g[0] : null)).catch(() => {});
    return off;
  }, []);

  const plan = plans.find((p) => p.id === planId);
  useEffect(() => {
    if (!plan) navigate('/subscription', { replace: true });
  }, [plan, navigate]);
  if (!plan) return null;

  const monthly = plans.find((p) => p.tier === plan.tier && p.interval === 'month');
  const yearly = plans.find((p) => p.tier === plan.tier && p.interval === 'year');
  const isYear = plan.interval === 'year';
  const planName = tr(plan.name.bn, plan.name.en);
  const method = methods?.find((m) => m.id === methodId) || null;
  const pending = lastPayment?.status === 'pending';
  const blocked = pending && !correcting;
  const renewing = status.isPaid && status.tier === plan.tier && status.paidThroughAt;
  const offerTrial = !status.isLoading && status.tier === 'free' && !status.shareTrialClaimed;
  const fmtDate = (d) => new Date(d).toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const methodName = (m) => (m.type === 'bank' ? m.bankName : tr(METHOD_LABEL[m.type].bn, METHOD_LABEL[m.type].en));
  const switchCycle = (cycle) => navigate(`/checkout/${plan.tier}_${cycle}`, { replace: true });
  const benefits = (isBn ? plan.benefits?.bn : plan.benefits?.en) || [];

  const steps = [tr('প্ল্যান', 'Plan'), tr('মাধ্যম', 'Method'), tr('পেমেন্ট', 'Pay')];
  const active = result ? 3 : method ? 2 : 1;

  return (
    <div className="min-h-screen pb-[var(--sab)] md:pb-0 bg-slate-50 dark:bg-[#0A0A0F] transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#13111C]/90 backdrop-blur-xl" style={{ paddingTop: 'var(--sat)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button type="button" onClick={goBack} aria-label={tr('ফিরে যান', 'Back')}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{tr('চেকআউট', 'Checkout')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tr(`${planName} প্ল্যান চালু করুন`, `Activate ${planName}`)}</p>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 lg:py-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-4 min-w-0">
          {/* Stepper */}
          <ol className="flex items-center gap-2" aria-label={tr('ধাপ', 'Steps')}>
            {steps.map((label, i) => {
              const done = i < active;
              const current = i === active;
              return (
                <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${done ? 'bg-emerald-500 text-white' : current ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}
                    aria-current={current ? 'step' : undefined}>
                    {done ? <Check size={12} strokeWidth={3} /> : num(i + 1)}
                  </span>
                  <span className={`text-sm font-semibold ${current || done ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{label}</span>
                  {i < steps.length - 1 && <span className={`flex-1 h-px ${done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/10'}`} />}
                </li>
              );
            })}
          </ol>

          {result ? (
            <ResultCard payment={result} method={method} planName={planName} status={status} isBn={isBn}
              fmtDate={fmtDate} onDone={() => navigate('/host-dashboard')} />
          ) : (
            <>
              {offerTrial && (
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
                  <Sparkles size={22} className="text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">{tr('পেমেন্টের আগে: ২ মাস প্রো একদম ফ্রি', 'Before you pay: 2 months of Pro, free')}</p>
                    <p className="text-xs text-amber-800 dark:text-amber-200">{tr('অ্যাপটি শেয়ার করলেই চালু — কোনো টাকা লাগবে না।', 'Just share the app — no payment needed.')}</p>
                  </div>
                  <button type="button" onClick={() => setShowTrial(true)}
                    className="px-3 py-2 rounded-lg text-sm font-bold bg-amber-500 text-white shrink-0">{tr('ফ্রি নিন', 'Get it')}</button>
                </div>
              )}

              {blocked && (
                <div className="flex gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
                  <Clock size={22} className="text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">{tr('আপনার একটি পেমেন্ট যাচাই চলছে', 'A payment of yours is being checked')}</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      TrxID <span className="font-mono">{lastPayment.trxId}</span> · {fmtTaka(lastPayment.amount)} — {tr('নিশ্চিত হলেই প্ল্যান চালু হবে, নোটিফিকেশন পাবেন। আবার টাকা পাঠাবেন না।', "your plan turns on once it's confirmed and we'll notify you. Please don't pay again.")}
                    </p>
                    <button type="button" onClick={() => setCorrecting(true)} className="text-sm font-bold text-amber-900 dark:text-amber-100 underline underline-offset-2">
                      {tr('তথ্য ভুল দিয়েছিলেন? সংশোধন করুন', 'Entered something wrong? Correct it')}
                    </button>
                  </div>
                </div>
              )}

              {lastPayment?.status === 'rejected' && (
                <div className="flex gap-3 p-4 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
                  <AlertCircle size={22} className="text-red-600 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">
                    <span className="font-bold">{tr('আগের পেমেন্টটি যাচাই করা যায়নি', "Your last payment couldn't be verified")}</span>
                    {lastPayment.rejectionReason ? `: ${lastPayment.rejectionReason}` : ''} {tr('সঠিক তথ্য দিয়ে আবার জমা দিন।', 'Please submit the correct details again.')}
                  </p>
                </div>
              )}

              {/* 1 · Plan */}
              <Section n={num(1)} title={tr('আপনার প্ল্যান', 'Your plan')} done>
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={18} className={plan.tier === 'pro' ? 'text-amber-500' : 'text-violet-500'} />
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white">{planName}</span>
                </div>
                {renewing && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-2">
                    {tr(`আপনার ${planName} ${fmtDate(status.paidThroughAt)} পর্যন্ত চালু আছে — এখন পরিশোধ করলে মেয়াদ এর সাথে যোগ হবে।`,
                      `Your ${planName} runs until ${fmtDate(status.paidThroughAt)} — paying now adds to it.`)}
                  </p>
                )}
                <div role="radiogroup" aria-label={tr('বিলিং', 'Billing')} className="grid grid-cols-2 gap-3 mt-3">
                  {[monthly, yearly].filter(Boolean).map((p) => {
                    const selected = p.id === plan.id;
                    const year = p.interval === 'year';
                    return (
                      <button key={p.id} type="button" role="radio" aria-checked={selected} onClick={() => switchCycle(year ? 'yearly' : 'monthly')}
                        className={`relative text-left p-3 sm:p-4 rounded-xl border-2 transition-colors ${selected ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-white/5' : 'border-slate-200 dark:border-white/10 hover:border-slate-300'}`}>
                        {year && p.discount > 0 && (
                          <span className={`absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold ${isBn ? '' : 'uppercase tracking-wide'}`}>
                            {tr(`${num(p.discount)}% ছাড়`, `Save ${p.discount}%`)}
                          </span>
                        )}
                        <span className="block text-sm font-semibold text-slate-600 dark:text-slate-300">{year ? tr('বার্ষিক', 'Yearly') : tr('মাসিক', 'Monthly')}</span>
                        <span className="block text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                          {fmtTaka(p.price)}<span className="text-xs font-semibold text-slate-500">/{year ? tr('বছর', 'yr') : tr('মাস', 'mo')}</span>
                        </span>
                        {year && p.discount > 0 ? (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            <span className="line-through">{fmtTaka(p.listPrice)}</span> · {tr(`মাসে প্রায় ${fmtTaka(Math.round(p.price / 12))}`, `≈ ${fmtTaka(Math.round(p.price / 12))}/mo`)}
                          </span>
                        ) : (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{tr('যেকোনো সময় বন্ধ করুন', 'Stop any time')}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {benefits.length > 0 && (
                  <div className="mt-4">
                    <button type="button" onClick={() => setShowBenefits((v) => !v)} aria-expanded={showBenefits}
                      className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {tr('এই প্ল্যানে যা পাবেন', "What's included")}
                      <ChevronDown size={16} className={`transition-transform ${showBenefits ? 'rotate-180' : ''}`} />
                    </button>
                    {showBenefits && (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {benefits.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Section>

              {/* 2 · Method */}
              {!blocked && (
                <Section n={num(2)} title={tr('কীভাবে পেমেন্ট করবেন?', 'How would you like to pay?')} done={!!method}>
                  {methods === undefined && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-busy="true">
                      {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />)}
                    </div>
                  )}
                  {methods === null && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">{tr('পেমেন্টের মাধ্যম লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।', "Couldn't load payment methods. Check your connection and try again.")}</p>
                  )}
                  {methods?.length === 0 && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">{tr('এই মুহূর্তে অনলাইনে পেমেন্ট নেওয়া হচ্ছে না। সাপোর্টে যোগাযোগ করুন।', "We aren't taking payments online right now. Please contact support.")}</p>
                  )}
                  {methods?.length > 0 && (
                    <div role="radiogroup" aria-label={tr('পেমেন্টের মাধ্যম', 'Payment method')} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {methods.map((m) => {
                        const selected = m.id === methodId;
                        const dup = methods.filter((x) => x.type === m.type).length > 1;
                        return (
                          <button key={m.id} type="button" role="radio" aria-checked={selected} onClick={() => setMethodId(m.id)}
                            className={`relative flex flex-col items-center text-center gap-2 p-3 rounded-xl border-2 transition-colors ${selected ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-white/5' : 'border-slate-200 dark:border-white/10 hover:border-slate-300'}`}>
                            {selected && (
                              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center">
                                <Check size={12} strokeWidth={3} className="text-white dark:text-slate-900" />
                              </span>
                            )}
                            <MethodLogo type={m.type} />
                            <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {methodName(m)}{dup ? ` ··${m.accountNumber.slice(-3)}` : ''}
                            </span>
                            <span className={`text-[11px] font-semibold ${m.autoCheck ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                              {m.autoCheck ? tr('সাথে সাথে চালু', 'Instant activation') : tr('যাচাই করে চালু', 'Activated after review')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Section>
              )}

              {/* 3 · Pay */}
              {!blocked && method && (
                <Section n={num(3)} title={tr(`${methodName(method)} দিয়ে পেমেন্ট`, `Pay with ${methodName(method)}`)}>
                  <PaymentStep key={method.id} plan={plan} method={method} isBn={isBn}
                    onSubmitted={(payment) => { setResult(payment); setLastPayment(payment); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                </Section>
              )}
            </>
          )}
        </div>

        {/* Order summary */}
        <aside className="space-y-3 lg:sticky lg:top-24">
          <div className={`${card} p-5 space-y-3`}>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{tr('অর্ডার সারাংশ', 'Order summary')}</h3>
            <SummaryRow label={`${planName} · ${isYear ? tr('বার্ষিক', 'Yearly') : tr('মাসিক', 'Monthly')}`}
              value={fmtTaka(isYear && plan.discount > 0 ? plan.listPrice : plan.price)} />
            {isYear && plan.discount > 0 && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">{tr(`১২ মাস × ${fmtTaka(monthly?.price)}`, `12 months × ${fmtTaka(monthly?.price)}`)}</p>
                <SummaryRow label={tr(`বার্ষিক ছাড় (${num(plan.discount)}%)`, `Yearly discount (${plan.discount}%)`)}
                  value={`−${fmtTaka(plan.listPrice - plan.price)}`} tone="text-emerald-600 dark:text-emerald-400" />
              </>
            )}
            <div className="border-t border-slate-200 dark:border-white/10 pt-3 flex items-center justify-between">
              <span className="text-base font-bold text-slate-900 dark:text-white">{tr('মোট', 'Total')}</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{fmtTaka(plan.price)}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isYear ? tr('মেয়াদ ১ বছর', 'Lasts 1 year') : tr('মেয়াদ ১ মাস', 'Lasts 1 month')} · {tr('স্বয়ংক্রিয়ভাবে কোনো টাকা কাটা হবে না', 'Nothing is charged automatically')}
            </p>
          </div>

          <ul className={`${card} p-4 space-y-2.5`}>
            <li className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
              {tr('টাকা সরাসরি To-Let Pro-এর অ্যাকাউন্টে যায়', "Money goes straight to To-Let Pro's account")}
            </li>
            <li className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <Lock size={18} className="text-emerald-500 shrink-0" />
              {tr('আমরা কখনো আপনার পিন বা OTP চাই না', 'We never ask for your PIN or OTP')}
            </li>
          </ul>

          {guide?.videoUrl && (
            <button type="button" onClick={() => setPlaying(true)}
              className={`${card} w-full p-4 flex items-center gap-3 text-left hover:border-slate-300`}>
              <PlayCircle size={22} className="text-indigo-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{guide.title || tr('কীভাবে পেমেন্ট করবেন — ভিডিও', 'How to pay — video')}</span>
            </button>
          )}
        </aside>
      </main>

      <FreeProTrialModal
        open={showTrial}
        onSkip={() => setShowTrial(false)}
        onUnlocked={() => { setShowTrial(false); navigate('/host-dashboard'); }}
        reason="manual"
      />

      {playing && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl rounded-2xl overflow-hidden relative bg-black">
            <button type="button" onClick={() => setPlaying(false)} aria-label={tr('বন্ধ করুন', 'Close')}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X size={22} />
            </button>
            <div className="aspect-video">
              <iframe src={getEmbedUrl(guide.videoUrl)} title={guide.title || 'video'} className="w-full h-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default CheckoutPage;
