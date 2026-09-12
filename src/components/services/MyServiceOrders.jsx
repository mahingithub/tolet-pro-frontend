import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Phone, Star, ClipboardList, X, MapPin, Clock, Bike,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import {
  listMyServiceRequests, cancelServiceRequest, rateProvider, getDeliveryTrack,
} from '../../services/marketplaceService';
import { getCurrentToken } from '../../services/authService';
import { formatTaka } from './fieldFormat';

/**
 * MyServiceOrders — what the tenant asked for, and what happened to it.
 * ──────────────────────────────────────────────────────────────────────────
 * ─── `expired` IS NAMED AS OUR FAILURE, NOT THEIRS ───────────────────────────
 * When nobody answers inside the 30-minute window the server closes the order
 * and tells the tenant. The copy for that state says the SHOP did not answer —
 * because it did not, and because a tenant who reads "your order was cancelled"
 * concludes they did something wrong and stops using the order button. The
 * whole reason `expired` is a separate status from `declined` on the server is
 * so this screen can tell the truth about which one happened.
 *
 * ─── THE REVIEW PROMPT ONLY APPEARS WHERE IT IS EARNED ───────────────────────
 * A rating is gated server-side on a completed order, so it is offered here on
 * exactly those rows. Asking somebody to rate an order that never arrived is
 * asking them to rate their own disappointment.
 */

const toBn = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

const STATUS = {
  placed:     { tone: 'bg-amber-50 text-amber-700',     bn: 'উত্তরের অপেক্ষায়', en: 'Waiting for a reply' },
  accepted:   { tone: 'bg-blue-50 text-blue-700',       bn: 'গ্রহণ করেছেন',     en: 'Accepted' },
  on_the_way: { tone: 'bg-blue-50 text-blue-700',       bn: 'পথে আছে',          en: 'On the way' },
  completed:  { tone: 'bg-emerald-50 text-emerald-700', bn: 'সম্পন্ন',          en: 'Completed' },
  declined:   { tone: 'bg-gray-100 text-gray-600',      bn: 'নিতে পারেননি',     en: 'Declined' },
  cancelled:  { tone: 'bg-gray-100 text-gray-600',      bn: 'বাতিল',            en: 'Cancelled' },
  expired:    { tone: 'bg-red-50 text-red-700',         bn: 'উত্তর আসেনি',      en: 'No answer' },
};

const OPEN = ['placed', 'accepted', 'on_the_way'];

function RateSheet({ order, bn, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await rateProvider({ providerId: order.providerId, rating, comment: comment.trim() });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={bn ? 'বন্ধ' : 'Close'}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] p-6 space-y-4 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900">
            {bn ? `${order.providerName} কেমন ছিল?` : `How was ${order.providerName}?`}
          </h2>
          <button type="button" onClick={onClose} className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              aria-label={`${i}`}
              className="active:scale-90 transition"
            >
              <Star
                size={34}
                className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          placeholder={bn
            ? 'কী ভালো লেগেছে, কী হয়নি — অন্য ভাড়াটিয়ারাও এটি পড়বেন।'
            : 'What went well, what did not — other tenants read this too.'}
          className="w-full min-h-[90px] px-4 py-3 rounded-xl bg-white border border-gray-300 focus:border-[#ba0036] focus:ring-2 focus:ring-[#ba0036]/15 text-[14px] outline-none resize-none"
        />

        <p className="text-[11px] font-bold text-gray-500 leading-snug">
          {/* Said before they write it. The shopkeeper may answer publicly, and
              somebody who learns that afterwards feels ambushed. */}
          {bn
            ? 'আপনার নাম দেখা যাবে, ফোন নম্বর নয়। দোকানদার প্রকাশ্যে উত্তর দিতে পারেন।'
            : 'Your name is shown, never your number. The shop can reply publicly.'}
        </p>

        {error ? (
          <p className="text-[12px] font-bold text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={busy || rating < 1}
          className="w-full py-3.5 rounded-2xl bg-[#ba0036] text-white text-sm font-black disabled:opacity-40 active:scale-[0.98] inline-flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : null}
          {bn ? 'রিভিউ দিন' : 'Post review'}
        </button>
      </div>
    </div>
  );
}

/**
 * The courier's dot, for the person waiting at the door.
 *
 * Polls only while the delivery is OPEN — the server says so in `isOpen`, and
 * stopping on that flag is the difference between a live view and a tab that
 * quietly burns a data plan all night on a delivery that arrived an hour ago.
 */
function DeliveryStrip({ requestId, bn }) {
  const [track, setTrack] = useState(null);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getDeliveryTrack(requestId);
      setTrack(data.track);
      return data.track;
    } catch {
      // Never surfaced. A tracking link is a bonus on top of the order, and an
      // error toast about one would be alarming out of all proportion.
      return null;
    } finally {
      setChecked(true);
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!track?.isOpen) return undefined;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [track?.isOpen, load]);

  if (!checked || !track || !track.lastPoint) return null;

  const metres = track.metresLeft;
  const arrived = track.status === 'arrived';

  return (
    <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2.5 ${
      arrived ? 'bg-emerald-50' : 'bg-blue-50'
    }`}
    >
      <Bike size={16} className={arrived ? 'text-emerald-600' : 'text-blue-600'} />
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] font-black ${arrived ? 'text-emerald-800' : 'text-blue-800'}`}>
          {arrived
            ? (bn ? 'পৌঁছে গেছেন — দরজা খুলুন' : 'Arrived — they are at your door')
            : (bn ? 'ডেলিভারি পথে আছে' : 'On the way to you')}
        </p>
        {!arrived && metres != null ? (
          <p className="text-[11px] font-bold text-blue-700">
            {metres >= 1000
              ? (bn ? `${toBn((metres / 1000).toFixed(1))} কিমি দূরে` : `${(metres / 1000).toFixed(1)} km away`)
              : (bn ? `${toBn(metres)} মিটার দূরে` : `${metres} m away`)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const MyServiceOrders = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rating, setRating] = useState(null);

  const load = useCallback(() => {
    if (!getCurrentToken?.()) {
      navigate(`/login?next=${encodeURIComponent('/services/orders')}`);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    listMyServiceRequests({ limit: 50 })
      .then((data) => { if (!cancelled) setOrders(data.requests || []); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(load, [load]);

  // An open order changes underneath the tenant — the shop accepts it, sets off,
  // or lets it expire — and there is no push channel to a browser tab. A poll
  // while at least one order is live is the cheapest honest answer.
  useEffect(() => {
    if (!orders.some((o) => OPEN.includes(o.status))) return undefined;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [orders, load]);

  const cancel = async (order) => {
    setBusyId(order.id);
    try {
      await cancelServiceRequest(order.id, '');
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eaeff5] flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans text-gray-900">
      <div className="w-full max-w-[760px] mx-auto px-4 md:px-8 pt-6 pb-24">
        <button
          onClick={() => navigate('/services')}
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 border border-gray-100 hover:border-gray-300 text-gray-600 hover:text-[#ba0036] text-[12px] font-black shadow-sm backdrop-blur-sm transition-all active:scale-95 mb-4"
        >
          <ArrowLeft size={14} className="-ml-1 group-hover:-translate-x-0.5 transition-transform" />
          {bn ? 'সব সার্ভিস' : 'All services'}
        </button>

        <h1 className="text-xl md:text-2xl font-black text-gray-900 mb-4">
          {bn ? 'আমার অর্ডার' : 'My orders'}
        </h1>

        {error ? (
          <p className="text-[12px] font-bold text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">
            {error.message}
          </p>
        ) : null}

        {!orders.length ? (
          <div className="rounded-2xl bg-white/90 border border-gray-100 p-10 text-center">
            <ClipboardList size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-black text-gray-900">
              {bn ? 'এখনো কোনো অর্ডার নেই' : 'No orders yet'}
            </p>
            <Link
              to="/services"
              className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#ba0036] text-white text-xs font-black"
            >
              {bn ? 'দোকান দেখুন' : 'Browse shops'}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const meta = STATUS[o.status] || STATUS.placed;
              return (
                <div
                  key={o.id}
                  className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-400">
                        {bn ? 'অর্ডার' : 'Order'} #{bn ? toBn(o.code) : o.code}
                      </p>
                      <Link
                        to={`/services/p/${o.providerId}`}
                        className="text-sm font-black text-gray-900 truncate block hover:text-[#ba0036]"
                      >
                        {o.providerName}
                      </Link>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${meta.tone}`}>
                      {bn ? meta.bn : meta.en}
                    </span>
                  </div>

                  <ul className="space-y-1">
                    {(o.items || []).map((i) => (
                      <li key={i.rowKey} className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="font-bold text-gray-800 truncate">
                          {i.label}
                          {i.qty > 1 ? (
                            <span className="text-gray-500 font-normal">
                              {' '}× {bn ? toBn(i.qty) : i.qty} {i.unit}
                            </span>
                          ) : null}
                        </span>
                        <span className="font-black text-gray-900 tabular-nums shrink-0">
                          {formatTaka(i.unitPrice * i.qty, bn)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-baseline justify-between border-t border-gray-100 pt-2">
                    <span className="text-[12px] font-bold text-gray-500">{bn ? 'মোট' : 'Total'}</span>
                    <span className="text-[15px] font-black text-gray-900 tabular-nums">
                      {formatTaka(o.finalTotal ?? o.quotedTotal, bn)}
                    </span>
                  </div>

                  {/* Only on orders the shop has actually taken. A `placed`
                      order has nobody on a bicycle yet. */}
                  {['accepted', 'on_the_way'].includes(o.status) ? (
                    <DeliveryStrip requestId={o.id} bn={bn} />
                  ) : null}

                  {o.deliverTo?.addressText ? (
                    <p className="text-[11px] font-bold text-gray-500 flex items-start gap-1.5">
                      <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                      {o.deliverTo.addressText}
                    </p>
                  ) : null}

                  {/* The shop's own words, passed through verbatim. A generic
                      "declined" tells the tenant nothing about whether to wait
                      or ring somebody else. */}
                  {['declined', 'cancelled'].includes(o.status) && o.timeline?.at(-1)?.reason ? (
                    <p className="text-[12px] font-bold text-gray-700 bg-gray-50 rounded-xl px-3 py-2">
                      {o.timeline.at(-1).reason}
                    </p>
                  ) : null}

                  {o.status === 'expired' ? (
                    <p className="text-[12px] font-bold text-red-700 bg-red-50 rounded-xl px-3 py-2 flex items-start gap-1.5">
                      <Clock size={13} className="mt-0.5 shrink-0" />
                      {bn
                        ? 'দোকানদার সময়মতো উত্তর দেননি — অন্য দোকান দেখে নিন।'
                        : 'The shop did not answer in time — try another one.'}
                    </p>
                  ) : null}

                  <div className="flex gap-2 pt-0.5">
                    {OPEN.includes(o.status) ? (
                      <>
                        {o.providerPhone ? (
                          <a
                            href={`tel:${o.providerPhone}`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 text-[12px] font-black active:scale-95"
                          >
                            <Phone size={13} /> {bn ? 'ফোন' : 'Call'}
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => cancel(o)}
                          disabled={busyId === o.id}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-[12px] font-black active:scale-95 disabled:opacity-50"
                        >
                          {bn ? 'বাতিল করুন' : 'Cancel'}
                        </button>
                      </>
                    ) : null}

                    {/* Offered on completed orders only — the server gates on
                        exactly that, and asking somebody to rate an order that
                        never arrived is asking them to rate a disappointment. */}
                    {o.status === 'completed' && !o.ratedAt ? (
                      <button
                        type="button"
                        onClick={() => setRating(o)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#ba0036] text-white text-[12px] font-black active:scale-95"
                      >
                        <Star size={13} /> {bn ? 'রিভিউ দিন' : 'Rate it'}
                      </button>
                    ) : null}

                    {o.status === 'completed' && o.ratedAt ? (
                      <span className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-black text-gray-400">
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        {bn ? 'রিভিউ দেওয়া হয়েছে' : 'Reviewed'}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rating ? (
        <RateSheet
          order={rating}
          bn={bn}
          onClose={() => setRating(null)}
          onDone={() => { setRating(null); load(); }}
        />
      ) : null}
    </div>
  );
};

export default MyServiceOrders;
