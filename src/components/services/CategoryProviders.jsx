import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, Star, BadgeCheck, Loader2, MapPin, Store, Clock,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useServiceLocation from '../../hooks/useServiceLocation';
import {
  getNearbyProviders, recordContact, getServiceCategory,
} from '../../services/marketplaceService';
import LocationBar from './LocationBar';
import { iconFor, tintFor } from './serviceIcons';
import { summaryLine } from './fieldFormat';

/**
 * CategoryProviders — every shop in one category, nearest first.
 * ──────────────────────────────────────────────────────────────────────────
 * ─── THE ORDERING IS DISTANCE-BANDED, NOT A SCORE ────────────────────────────
 * The server buckets providers into 500 m bands and only ranks WITHIN a band by
 * quality. That matters here because it is the difference between a directory
 * and an ad platform: a five-star shop three kilometres away must never outrank
 * the decent one at the end of the road, because the tenant wants gas tonight.
 * Nothing on this screen re-sorts what the server sent.
 *
 * ─── A DISTANCE IS ONLY PRINTED WHEN ONE WAS MEASURED ────────────────────────
 * `sortedByDistance` comes back false when the tenant gave only a thana name,
 * and `origin.source` says whether a point was derived from a neighbourhood
 * rather than measured. Printing "৪০০ মিটার দূরে" off a guess is a lie with a
 * decimal point in it, so the badge simply does not render.
 */

const toBn = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

function Stars({ n, count, bn }) {
  if (!count) {
    return (
      <span className="text-[10px] font-bold text-gray-400">
        {bn ? 'নতুন' : 'New'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-black text-gray-700">
      <Star size={12} className="fill-amber-400 text-amber-400" />
      {bn ? toBn(n) : n}
      <span className="text-gray-400 font-bold">({bn ? toBn(count) : count})</span>
    </span>
  );
}

function ProviderCard({ p, categoryDef, precise, bn, onCall }) {
  const summary = useMemo(
    () => summaryLine(categoryDef, p.fields, bn),
    [categoryDef, p.fields, bn],
  );

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] p-4 flex gap-3.5">
      <Link to={`/services/p/${p.id}`} className="shrink-0">
        {p.photoUrl ? (
          <img
            src={p.photoUrl}
            alt={p.name}
            loading="lazy"
            className="w-16 h-16 rounded-2xl object-cover border border-gray-100"
          />
        ) : (
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${tintFor(p.category)}`}>
            <Store size={22} strokeWidth={2.2} />
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={`/services/p/${p.id}`} className="block min-w-0">
          <div className="flex items-start gap-1.5">
            <p className="text-sm font-black text-gray-900 leading-tight truncate">{p.name}</p>
            {/* The green badge means an NID was checked against a selfie taken
                at the pin. It is refused server-side without those documents,
                which is the only reason it is worth showing. */}
            {p.isVerified ? (
              <BadgeCheck size={15} className="text-emerald-600 shrink-0 mt-[1px]" />
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Stars n={p.ratingAvg} count={p.ratingCount} bn={bn} />
            {/* Only a real measurement is printed — see the header note. */}
            {precise && p.distanceKm != null ? (
              <span className="text-[11px] font-bold text-gray-500 inline-flex items-center gap-0.5">
                <MapPin size={11} className="text-gray-400" />
                {bn ? `${toBn(p.distanceKm)} কিমি` : `${p.distanceKm} km`}
              </span>
            ) : p.thana ? (
              <span className="text-[11px] font-bold text-gray-500 inline-flex items-center gap-0.5">
                <MapPin size={11} className="text-gray-400" />
                {p.area ? `${p.area}, ${p.thana}` : p.thana}
              </span>
            ) : null}
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              p.openNow
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
            >
              {p.openNow ? (bn ? 'খোলা' : 'Open') : (bn ? 'বন্ধ' : 'Closed')}
            </span>
          </div>

          {p.pricesHidden ? (
            /* The provider is NOT hidden for a stale price list — only the
               numbers are. A shop with an out-of-date price is still the shop
               at the end of the road, and "ring and ask" is a real answer. */
            <p className="text-[11px] font-bold text-amber-700 mt-1.5 inline-flex items-center gap-1">
              <Clock size={11} />
              {bn ? 'দাম অনেকদিন আপডেট হয়নি — ফোন করে জেনে নিন' : 'Price is out of date — call to confirm'}
            </p>
          ) : summary ? (
            <p className="text-[12px] font-bold text-gray-600 mt-1.5 truncate">{summary}</p>
          ) : null}
        </Link>

        <div className="flex gap-2 mt-2.5">
          <a
            href={`tel:${p.phone}`}
            onClick={() => onCall(p)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#ba0036] text-white text-[12px] font-black active:scale-95 transition"
          >
            <Phone size={13} /> {bn ? 'ফোন করুন' : 'Call'}
          </a>
          {p.interaction !== 'contact' ? (
            <Link
              to={`/services/p/${p.id}`}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 text-[12px] font-black active:scale-95 transition"
            >
              {p.interaction === 'order'
                ? (bn ? 'অর্ডার করুন' : 'Order')
                : (bn ? 'অনুরোধ পাঠান' : 'Request')}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CategoryProviders = () => {
  const { category } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const bn = language === 'বাংলা';

  const { location, query, precise, asking, request, setThana } = useServiceLocation();

  const [providers, setProviders] = useState([]);
  const [categoryDef, setCategoryDef] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The full category definition — needed to turn `{ kg_12: 1450 }` into
  // "১২ কেজি — ৳১৪৫০". Fetched, never bundled: it is the same file that drives
  // the provider's price editor and the server's validation.
  //
  // Allowed to fail quietly. Without it the prices render unlabelled, which is
  // worse — but a list of shops with names, distances and phone numbers is
  // still a usable list, and blanking the page over a label lookup is not.
  useEffect(() => {
    let cancelled = false;
    getServiceCategory(category)
      .then((d) => { if (!cancelled) setCategoryDef(d.category || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [category]);

  const load = useCallback(() => {
    if (!query) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getNearbyProviders({ category, ...query, limit: 30 })
      .then((data) => {
        if (cancelled) return;
        setProviders(data.providers || []);
        setMeta({ sortedByDistance: data.sortedByDistance, origin: data.origin });
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, query?.lat, query?.lng, query?.thana]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const onCall = (p) => {
    // Fire-and-forget, and deliberately NOT awaited: this is the provider's
    // only evidence the fee bought anything for a contact-tier category, but
    // nothing about it may delay or block the dial-out.
    recordContact({
      providerId: p.id,
      kind: 'call_tel',
      thana: query?.thana || p.thana,
      distanceKm: p.distanceKm,
    });
  };

  const Icon = iconFor(categoryDef?.icon);
  const title = categoryDef
    ? (bn ? categoryDef.label?.bn : categoryDef.label?.en)
    : category;

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans text-gray-900">
      <div className="relative z-10 w-full max-w-[900px] mx-auto px-4 md:px-8 pt-6 pb-24">
        <button
          onClick={() => navigate('/services')}
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 border border-gray-100 hover:border-gray-300 text-gray-600 hover:text-[#ba0036] text-[12px] font-black shadow-sm backdrop-blur-sm transition-all active:scale-95 mb-4"
        >
          <ArrowLeft size={14} className="-ml-1 group-hover:-translate-x-0.5 transition-transform" />
          {bn ? 'সব সার্ভিস' : 'All services'}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${tintFor(category)}`}>
            <Icon size={22} strokeWidth={2.3} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight truncate">{title}</h1>
            <p className="text-[11px] font-bold text-gray-500">
              {bn ? categoryDef?.blurb?.bn : categoryDef?.blurb?.en}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <LocationBar
            location={location}
            precise={precise}
            asking={asking}
            onUseGps={request}
            onPickThana={setThana}
            bn={bn}
          />
        </div>

        {!query ? (
          <div className="rounded-2xl bg-white/90 border border-gray-100 p-8 text-center">
            <MapPin size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-black text-gray-900">
              {bn ? 'কোথায় খুঁজছেন?' : 'Where are you looking?'}
            </p>
            <p className="text-[12px] font-bold text-gray-500 mt-1">
              {bn
                ? 'উপরে এলাকা বেছে নিন, বা আপনার অবস্থান ব্যবহার করুন।'
                : 'Pick an area above, or use your location.'}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white/90 border border-gray-100 p-8 text-center">
            <p className="text-sm font-black text-gray-900">{error.message}</p>
            <button
              onClick={load}
              className="mt-4 px-4 py-2 rounded-xl bg-[#ba0036] text-white text-xs font-black"
            >
              {bn ? 'আবার চেষ্টা' : 'Try again'}
            </button>
          </div>
        ) : !providers.length ? (
          <div className="rounded-2xl bg-white/90 border border-gray-100 p-8 text-center">
            <Store size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-black text-gray-900">
              {bn ? 'এই এলাকায় এখনো কেউ নেই' : 'Nobody here yet'}
            </p>
            {/* An honest empty state. Telling somebody to widen the search is
                better than an empty page that looks broken. */}
            <p className="text-[12px] font-bold text-gray-500 mt-1 max-w-xs mx-auto leading-snug">
              {bn
                ? 'আশেপাশের অন্য থানা দেখে নিতে পারেন — নতুন দোকান নিয়মিত যুক্ত হচ্ছে।'
                : 'Try a neighbouring thana — new shops join every week.'}
            </p>
          </div>
        ) : (
          <>
            {meta && !meta.sortedByDistance ? (
              <p className="text-[11px] font-bold text-gray-500 mb-2.5 px-1">
                {bn
                  ? 'এলাকা অনুযায়ী দেখানো হচ্ছে — সঠিক দূরত্ব দেখতে অবস্থান দিন।'
                  : 'Shown by area — share your location for real distances.'}
              </p>
            ) : null}
            <div className="space-y-3">
              {providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  p={p}
                  categoryDef={categoryDef}
                  precise={precise && meta?.sortedByDistance}
                  bn={bn}
                  onCall={onCall}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CategoryProviders;
