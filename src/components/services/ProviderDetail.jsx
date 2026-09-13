import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, Star, BadgeCheck, Loader2, MapPin, Store, Clock,
  Minus, Plus, X, ShoppingBasket, MessageSquare, Crosshair,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useServiceLocation from '../../hooks/useServiceLocation';
import {
  getProvider, getProviderReviews, getServiceCategory, recordContact,
  placeServiceRequest,
} from '../../services/marketplaceService';
import { getCurrentToken } from '../../services/authService';
import { tintFor } from './serviceIcons';
import { priceRows, detailRows, formatTaka } from './fieldFormat';

/**
 * ProviderDetail — one shop, everything it sells, and the two ways to reach it.
 * ──────────────────────────────────────────────────────────────────────────
 * ─── THE CALL BUTTON IS NEVER SECONDARY ──────────────────────────────────────
 * Four of the eight live categories — গৃহকর্মী, ইলেকট্রিশিয়ান, প্লাম্বার,
 * ইন্টারনেট — have no order flow at all, by design: the tenant rings and
 * arranges it. Even in the two order-tier categories, a phone call is how most
 * of this business is actually done. So `ফোন করুন` is pinned to the bottom of
 * the screen on every tier, and the order sheet is the addition, not the point.
 *
 * ─── PRICES ARE READ-ONLY HERE AND FROZEN SERVER-SIDE ────────────────────────
 * The cart sends `{ field, rowKey, qty }` and never a price. The server reads
 * the provider's current row and stamps it onto the order, so what the tenant
 * agreed to cannot be changed afterwards by either side — and a client cannot
 * name its own price.
 */

const toBn = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

function Stars({ n, size = 13 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(n) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}

const ProviderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const { query } = useServiceLocation();

  const [provider, setProvider] = useState(null);
  const [categoryDef, setCategoryDef] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── The cart ──────────────────────────────────────────────────────────────
  const [cart, setCart] = useState({});          // `${field}.${rowKey}` → qty
  const [sheet, setSheet] = useState(false);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  // The delivery POINT, which is not the same thing as the search origin —
  // see the note on `submit`. Captured only by a deliberate tap.
  const [pin, setPin] = useState(null);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [placed, setPlaced] = useState(null);

  // One id per ATTEMPT, reused across retries. A double tap on a flaky
  // connection must not buy two cylinders; the server returns the original
  // order rather than an error the client would retry again.
  const attemptId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProvider(id)
      .then((data) => {
        if (cancelled) return;
        const p = data.provider || data;
        setProvider(p);
        // Recorded once the card is actually OPEN, never for every row in a
        // list — the server dedupes a view per person per day, and counting a
        // scroll-past as a view would hand a shopkeeper a number he would
        // laugh at.
        recordContact({
          providerId: p.id,
          kind: 'view',
          thana: query?.thana || p.thana,
          distanceKm: p.distanceKm,
        });
        return getServiceCategory(p.category).catch(() => null);
      })
      .then((d) => { if (!cancelled && d) setCategoryDef(d.category || null); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reviews are a second call on purpose: they are below the fold and must
  // never delay the prices and the phone number above it.
  useEffect(() => {
    let cancelled = false;
    getProviderReviews(id, 10)
      .then((d) => { if (!cancelled) setReviews(d); })
      .catch(() => { if (!cancelled) setReviews({ reviews: [] }); });
    return () => { cancelled = true; };
  }, [id]);

  const prices = useMemo(
    () => priceRows(categoryDef, provider?.fields, bn),
    [categoryDef, provider, bn],
  );
  const details = useMemo(
    () => detailRows(categoryDef, provider?.fields, bn),
    [categoryDef, provider, bn],
  );

  const cartLines = useMemo(() => prices
    .map((row) => ({ ...row, qty: cart[`${row.field}.${row.key}`] || 0 }))
    .filter((row) => row.qty > 0), [prices, cart]);

  const cartTotal = cartLines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const bump = (row, delta) => {
    const key = `${row.field}.${row.key}`;
    setCart((prev) => {
      const next = Math.max(0, Math.min(99, (prev[key] || 0) + delta));
      const out = { ...prev };
      if (next === 0) delete out[key]; else out[key] = next;
      return out;
    });
  };

  const onCall = useCallback(() => {
    recordContact({
      providerId: id,
      kind: 'call_tel',
      thana: query?.thana || provider?.thana,
      distanceKm: provider?.distanceKm,
    });
  }, [id, provider, query]);

  /**
   * Capture where the order should actually GO.
   *
   * Separate from the search origin on purpose: `useServiceLocation` will
   * happily hand back a thana centroid, which is fine for "who is nearby" and
   * catastrophic as a delivery destination — a courier would be sent to the
   * middle of the neighbourhood with a confident pin. This is the only thing
   * that may set `deliverTo.lat/lng`.
   */
  const capturePin = () => {
    if (!navigator.geolocation) {
      setPinError(bn ? 'এই ফোনে লোকেশন পাওয়া যাচ্ছে না।' : 'Location is unavailable on this device.');
      return;
    }
    setPinning(true);
    setPinError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        });
        setPinning(false);
      },
      () => {
        setPinning(false);
        // Not fatal. The order still goes with a written address, and the shop
        // rings if it cannot find the place — which is what happens today.
        setPinError(bn
          ? 'লোকেশন নেওয়া গেল না — ঠিকানা লিখলেই চলবে।'
          : 'Could not get your location — the written address is enough.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const openSheet = () => {
    if (!getCurrentToken?.()) {
      // Browsing is public; ordering is not. Sent to login with a way back,
      // rather than letting them fill in a cart and fail at the end.
      navigate(`/login?next=${encodeURIComponent(`/services/p/${id}`)}`);
      return;
    }
    attemptId.current = `svc-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPlaceError('');
    setSheet(true);
  };

  const submit = async () => {
    setPlacing(true);
    setPlaceError('');
    try {
      const data = await placeServiceRequest({
        providerId: id,
        clientRequestId: attemptId.current,
        items: cartLines.map((l) => ({ field: l.field, rowKey: l.key, qty: l.qty })),
        deliverTo: {
          addressText: address.trim(),
          note: note.trim(),
          thana: query?.thana || provider?.thana || '',
          // The PINNED point only. `query` is where the SEARCH was made from
          // and may be a thana centroid — sending that as a delivery
          // destination would hand the courier a confident pin in the middle
          // of the neighbourhood, which is worse than no pin at all, because
          // he would drive to it instead of ringing.
          lat: pin?.lat ?? null,
          lng: pin?.lng ?? null,
        },
      });
      setPlaced(data.request);
      setSheet(false);
      setCart({});
    } catch (err) {
      setPlaceError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eaeff5] flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="min-h-screen bg-[#eaeff5] flex flex-col items-center justify-center px-6 text-center">
        <Store size={30} className="text-gray-300 mb-3" />
        <p className="text-sm font-black text-gray-900">
          {/* A suspended, expired or in-review provider 404s rather than
              rendering as "hidden" — the state of somebody's application is
              not a tenant's business. */}
          {bn ? 'এই দোকানটি এখন নেই' : 'This shop is not available'}
        </p>
        <button
          onClick={() => navigate('/services')}
          className="mt-4 px-4 py-2 rounded-xl bg-[#ba0036] text-white text-xs font-black"
        >
          {bn ? 'সব সার্ভিস' : 'All services'}
        </button>
      </div>
    );
  }

  const canOrder = provider.interaction !== 'contact';

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans text-gray-900 pb-44 md:pb-28">
      <div className="w-full max-w-[760px] mx-auto px-4 md:px-8 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 border border-gray-100 hover:border-gray-300 text-gray-600 hover:text-[#ba0036] text-[12px] font-black shadow-sm backdrop-blur-sm transition-all active:scale-95 mb-4"
        >
          <ArrowLeft size={14} className="-ml-1 group-hover:-translate-x-0.5 transition-transform" />
          {bn ? 'ফিরে যান' : 'Back'}
        </button>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-sm rounded-[1.5rem] border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-5 flex gap-4">
          {provider.photoUrl ? (
            <img
              src={provider.photoUrl}
              alt={provider.name}
              className="w-20 h-20 rounded-2xl object-cover border border-gray-100 shrink-0"
            />
          ) : (
            <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center shrink-0 ${tintFor(provider.category)}`}>
              <Store size={26} strokeWidth={2.2} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h1 className="text-lg font-black text-gray-900 leading-tight">{provider.name}</h1>
              {provider.isVerified ? (
                <BadgeCheck size={17} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : null}
            </div>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">
              {bn ? provider.categoryLabel?.bn : provider.categoryLabel?.en}
            </p>

            <div className="flex items-center gap-2 flex-wrap mt-2">
              {provider.ratingCount ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-black text-gray-800">
                  <Stars n={provider.ratingAvg} />
                  {bn ? toBn(provider.ratingAvg) : provider.ratingAvg}
                  <span className="text-gray-400 font-bold">
                    ({bn ? toBn(provider.ratingCount) : provider.ratingCount})
                  </span>
                </span>
              ) : (
                <span className="text-[11px] font-bold text-gray-400">
                  {bn ? 'এখনো রিভিউ নেই' : 'No reviews yet'}
                </span>
              )}
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                provider.openNow ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}
              >
                {provider.openNow ? (bn ? 'খোলা' : 'Open') : (bn ? 'বন্ধ' : 'Closed')}
              </span>
            </div>

            {provider.addressText || provider.thana ? (
              <p className="text-[11px] font-bold text-gray-500 mt-2 flex items-start gap-1">
                <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                <span>{provider.addressText || [provider.area, provider.thana].filter(Boolean).join(', ')}</span>
              </p>
            ) : null}
          </div>
        </div>

        {provider.about ? (
          <p className="mt-3 text-[13px] font-bold text-gray-700 leading-relaxed bg-white/60 rounded-2xl px-4 py-3">
            {provider.about}
          </p>
        ) : null}

        {/* ── Prices ─────────────────────────────────────────────────────── */}
        {provider.pricesHidden ? (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3.5 flex items-start gap-2.5">
            <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-black text-amber-900">
                {bn ? 'দামের তালিকা পুরোনো' : 'Price list is out of date'}
              </p>
              <p className="text-[11px] font-bold text-amber-800 mt-0.5 leading-snug">
                {/* The numbers are withheld; the shop is not. Showing a price
                    we no longer believe is worse than admitting we don't know
                    it — a tenant who turns up expecting ৳১২০০ and pays ৳১৫০০
                    blames us, correctly. */}
                {bn
                  ? 'পুরোনো দাম দেখানোর চেয়ে না দেখানো ভালো। ফোন করে জেনে নিন।'
                  : 'Better not shown than shown wrong — please call to confirm.'}
              </p>
            </div>
          </div>
        ) : prices.length ? (
          <div className="mt-4 bg-white/90 backdrop-blur-sm rounded-[1.5rem] border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 mb-3">
              {bn ? 'দাম' : 'Prices'}
            </p>
            <div className="divide-y divide-gray-100">
              {prices.map((row) => {
                const qty = cart[`${row.field}.${row.key}`] || 0;
                return (
                  <div key={`${row.field}.${row.key}`} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900 truncate">{row.label}</p>
                      {row.unit ? (
                        <p className="text-[10px] font-bold text-gray-400">{row.unit}</p>
                      ) : null}
                    </div>
                    <p className="text-[14px] font-black text-gray-900 tabular-nums shrink-0">
                      {row.priceText}
                    </p>

                    {canOrder && provider.openNow ? (
                      qty > 0 ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => bump(row, -1)}
                            className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center active:scale-90"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-black tabular-nums">
                            {bn ? toBn(qty) : qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => bump(row, 1)}
                            className="w-8 h-8 rounded-lg bg-[#ba0036] text-white flex items-center justify-center active:scale-90"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => bump(row, 1)}
                          className="shrink-0 w-8 h-8 rounded-lg bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center active:scale-90"
                        >
                          <Plus size={15} strokeWidth={2.6} />
                        </button>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>

            {canOrder && !provider.openNow ? (
              <p className="text-[11px] font-bold text-gray-500 mt-3">
                {/* Said before the cart, not after it: letting somebody build an
                    order at a closed shop and refusing it at submit is the most
                    annoying possible way to deliver this information. */}
                {bn ? 'এখন বন্ধ — খুললে অর্ডার নেওয়া যাবে।' : 'Closed right now — orders open when the shop does.'}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── Everything that is not a price ─────────────────────────────── */}
        {details.length ? (
          <div className="mt-3 bg-white/90 backdrop-blur-sm rounded-[1.5rem] border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-5">
            <dl className="space-y-2">
              {details.map((d) => (
                <div key={d.key} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12px] font-bold text-gray-500">{d.label}</dt>
                  <dd className="text-[13px] font-black text-gray-900 text-right">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {/* ── Reviews ────────────────────────────────────────────────────── */}
        <div className="mt-3 bg-white/90 backdrop-blur-sm rounded-[1.5rem] border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 mb-3">
            {bn ? 'রিভিউ' : 'Reviews'}
          </p>

          {!reviews ? (
            <Loader2 size={18} className="animate-spin text-gray-300" />
          ) : !reviews.reviews?.length ? (
            <p className="text-[12px] font-bold text-gray-400">
              {bn
                ? 'এখনো কেউ রিভিউ দেননি। অর্ডারের পরে আপনি দিতে পারবেন।'
                : 'No reviews yet. You can leave one after an order.'}
            </p>
          ) : (
            <div className="space-y-3.5">
              {reviews.reviews.map((r) => (
                <div key={r.id} className="border-b border-gray-100 last:border-0 pb-3.5 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Stars n={r.rating} size={12} />
                    <span className="text-[12px] font-black text-gray-800">{r.reviewerName}</span>
                    {/* Which evidence entitled the review. `order` is the
                        strong one; `contact` is a recorded call, which is all a
                        contact-tier category can ever produce. */}
                    <span className="text-[10px] font-bold text-gray-400">
                      {r.basis === 'order'
                        ? (bn ? 'অর্ডার করেছিলেন' : 'Ordered')
                        : (bn ? 'ফোন করেছিলেন' : 'Called')}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="text-[12.5px] font-bold text-gray-700 mt-1.5 leading-relaxed">
                      {r.comment}
                    </p>
                  ) : null}
                  {r.reply?.text ? (
                    <div className="mt-2 border-l-2 border-[#ba0036] pl-3">
                      <p className="text-[10px] font-black text-[#ba0036]">
                        {bn ? 'দোকানের উত্তর' : "Shop's reply"}
                      </p>
                      <p className="text-[12px] font-bold text-gray-600 mt-0.5">{r.reply.text}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── The action bar. Call is always here, on every tier. ──────────── */}
      {/* `--bottom-nav-h` on mobile, NOT bottom-0: MobileBottomNav is a fixed
          bar at z-40 on the same edge, and it renders after the routes in
          App.jsx — so an action bar sharing that layer and that offset is
          simply covered by it. Stacking above is right rather than hiding the
          app nav: this is a page inside the app, not a takeover of it.

          The token, not a bare 64px, because the rail is 64px PLUS the gesture
          inset — offsetting by 64 alone tucks this bar under it.

          The safe-area padding is md:-only on purpose. On mobile the rail below
          already clears the gesture bar, so adding the inset here too would
          pad against nothing twice; on md+ the rail is hidden (md:hidden) and
          this bar owns the bottom edge, so there it needs the inset itself. */}
      <div className="fixed bottom-[var(--bottom-nav-h)] md:bottom-0 inset-x-0 z-[45] bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 md:pb-[calc(var(--sab)+0.75rem)]">
        <div className="max-w-[760px] mx-auto flex gap-2.5">
          <a
            href={`tel:${provider.phone}`}
            onClick={onCall}
            className={`${cartLines.length ? 'w-auto px-5' : 'flex-1'} inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#ba0036] text-white text-sm font-black active:scale-[0.98] transition`}
          >
            <Phone size={17} /> {cartLines.length ? '' : (bn ? 'ফোন করুন' : 'Call')}
          </a>

          {canOrder && cartLines.length ? (
            <button
              type="button"
              onClick={openSheet}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-900 text-white text-sm font-black active:scale-[0.98] transition"
            >
              <ShoppingBasket size={17} />
              {bn ? `অর্ডার · ${formatTaka(cartTotal, true)}` : `Order · ${formatTaka(cartTotal, false)}`}
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Order sheet ─────────────────────────────────────────────────── */}
      {sheet ? (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={bn ? 'বন্ধ' : 'Close'}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setSheet(false)}
          />
          <div
            className="relative w-full sm:max-w-md bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] p-5 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl"
            style={{ paddingBottom: 'calc(var(--sab) + 1.25rem)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">
                {bn ? 'অর্ডার নিশ্চিত করুন' : 'Confirm your order'}
              </h2>
              <button
                type="button"
                onClick={() => setSheet(false)}
                className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 space-y-1.5">
              {cartLines.map((l) => (
                <div key={`${l.field}.${l.key}`} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-bold text-gray-800">
                    {l.label}
                    <span className="text-gray-500 font-normal">
                      {' '}× {bn ? toBn(l.qty) : l.qty} {l.unit}
                    </span>
                  </span>
                  <span className="font-black text-gray-900 tabular-nums shrink-0">
                    {formatTaka(l.price * l.qty, bn)}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200">
                <span className="text-[13px] font-black text-gray-600">{bn ? 'মোট' : 'Total'}</span>
                <span className="text-base font-black text-gray-900 tabular-nums">
                  {formatTaka(cartTotal, bn)}
                </span>
              </div>
            </div>

            <label className="block">
              <span className="block text-[13px] font-black text-gray-800 mb-1.5">
                {bn ? 'কোথায় পৌঁছে দেবেন?' : 'Where should it go?'}
                <span className="text-[#ba0036] ml-1">*</span>
              </span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={bn ? 'বাড়ি ১২, রোড ৫, ধানমন্ডি' : 'House 12, Road 5, Dhanmondi'}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-300 focus:border-[#ba0036] focus:ring-2 focus:ring-[#ba0036]/15 text-base outline-none"
              />
            </label>

            {/* Pinning is OPTIONAL and says so. An exact point lets the shop
                measure the distance and send a courier straight there; without
                one the order still goes, and he rings. Making it required
                would lose every order from somebody indoors with no fix. */}
            <div className="rounded-2xl border border-gray-200 p-3.5">
              {pin ? (
                <div className="flex items-center gap-2.5">
                  <MapPin size={16} className="text-emerald-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-emerald-700">
                      {bn ? 'লোকেশন যোগ হয়েছে' : 'Location attached'}
                    </p>
                    <p className="text-[11px] font-bold text-gray-500">
                      {bn
                        ? `দোকান ঠিক জায়গায় পৌঁছাতে পারবে · ±${toBn(pin.accuracy)} মি`
                        : `The shop can find you exactly · ±${pin.accuracy} m`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPin(null)}
                    className="text-[11px] font-black text-gray-400 underline shrink-0"
                  >
                    {bn ? 'সরান' : 'Remove'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={capturePin}
                  disabled={pinning}
                  className="w-full flex items-center gap-2.5 text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0">
                    {pinning
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Crosshair size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-gray-900">
                      {bn ? 'সঠিক লোকেশন যোগ করুন' : 'Attach your exact location'}
                    </p>
                    <p className="text-[11px] font-bold text-gray-500">
                      {bn ? 'ঐচ্ছিক — ডেলিভারি সহজ হয়' : 'Optional — makes delivery easier'}
                    </p>
                  </div>
                </button>
              )}
              {pinError ? (
                <p className="text-[11px] font-bold text-amber-700 mt-2">{pinError}</p>
              ) : null}
            </div>

            <label className="block">
              <span className="block text-[13px] font-black text-gray-800 mb-1.5">
                {bn ? 'কিছু বলার আছে?' : 'Anything to add?'}
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={bn ? '৩য় তলা, বাম পাশে' : '3rd floor, left side'}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-300 focus:border-[#ba0036] focus:ring-2 focus:ring-[#ba0036]/15 text-base outline-none"
              />
            </label>

            <p className="text-[11px] font-bold text-gray-500 leading-snug">
              {/* Stated before the tap, because it is the thing that makes this
                  different from every other delivery app the tenant has used. */}
              {bn
                ? 'দাম সরাসরি দোকানদারকে দেবেন। To-Let Pro কোনো কমিশন নেয় না।'
                : 'You pay the shop directly. To-Let Pro takes no commission.'}
            </p>

            {placeError ? (
              <p className="text-[12px] font-bold text-red-600 bg-red-50 rounded-xl px-3 py-2">
                {placeError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={placing || !address.trim()}
              className="w-full py-3.5 rounded-2xl bg-[#ba0036] text-white text-sm font-black disabled:opacity-40 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
            >
              {placing ? <Loader2 size={17} className="animate-spin" /> : null}
              {bn ? 'অর্ডার পাঠান' : 'Send order'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Placed ──────────────────────────────────────────────────────── */}
      {placed ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setPlaced(null)} />
          <div className="relative bg-white rounded-[1.75rem] p-7 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={26} strokeWidth={2.3} />
            </div>
            <h2 className="text-lg font-black text-gray-900">
              {bn ? 'অর্ডার পাঠানো হয়েছে' : 'Order sent'}
            </h2>
            <p className="text-[13px] font-bold text-gray-500 mt-2 leading-relaxed">
              {/* The 30-minute window is the provider's deadline, and saying it
                  sets an expectation the system actually keeps: if nobody
                  answers, the order expires and the tenant is told. */}
              {bn
                ? `অর্ডার #${toBn(placed.code)} — দোকানদারকে জানানো হয়েছে। ৩০ মিনিটের মধ্যে উত্তর না এলে আমরা আপনাকে জানিয়ে দেব।`
                : `Order #${placed.code} — the shop has been notified. If nobody answers within 30 minutes we will tell you.`}
            </p>
            <button
              onClick={() => navigate('/services/orders')}
              className="mt-5 w-full py-3.5 rounded-2xl bg-[#ba0036] text-white text-sm font-black active:scale-95"
            >
              {bn ? 'আমার অর্ডার দেখুন' : 'View my orders'}
            </button>
            <button
              onClick={() => setPlaced(null)}
              className="mt-2 w-full py-3 rounded-2xl text-gray-500 text-[13px] font-black"
            >
              {bn ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProviderDetail;
