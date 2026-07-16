import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  ShieldCheck,
  BadgeCheck,
  Sparkles,
  ArrowRight,
  Heart,
  Star,
  Clock,
  Building2,
  ChevronRight,
  ChevronDown,
  Flame,
  Zap,
  Home as HomeIcon,
  Wallet,
  X,
  TrendingUp,
  Camera,
} from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { roomLabel } from '../../constants/roomCategories';
import usePropertyStore from '../../store/usePropertyStore';
import {
  DIVISIONS,
  POPULAR_AREAS,
  POPULAR_AREA_SUBZONES,
  ALL_SUGGESTIONS,
  RESIDENTIAL_TYPES,
  BUDGET_RANGES,
  POPULAR_AREA_IMAGES,
  POPULAR_AREA_TAGLINES,
  getPropertyTypesFor,
  localizedLabel,
  buildSearchUrl,
} from '../../data/searchData';
// Live data source — propertyService aggregates backend + user-uploaded
// properties. There is NO demo data anywhere; if a host hasn't uploaded yet,
// the feed is empty and we show an empty-state card.
import { propertyService, subscribeUserProperties, propertyLocationHaystack } from '../../services/Propertyservice';
import LocationSearchModal from '../shared/LocationSearchModal';
import { locationQueryMatches } from '../../data/locationAliases';

/**
 * MobileHome — TO-LET PRO mobile (md:hidden) home page.
 *
 * Architecture note: this screen now imports its data + helpers from
 * src/data/searchData.js, the same module the desktop hero (HeroSection.jsx)
 * is being migrated onto. That removes the previous "mobile vs desktop
 * duplicate data" smell the user called out.
 *
 *   Search contract is identical to desktop:
 *     /properties/<location-slug>?purpose=<rent|buy|commercial>&category=<id>&budget=<id>
 *
 *   Property feed reads `propertyService.getProperties()` (single source of
 *   truth) — the same list the listings + details screens consume. There is
 *   no demo data anywhere.
 */

// Marketing banner — drop your campaign poster URL here.
const HERO_YOUTUBE_ID = 'PpeE86P9TnA';

const SEARCH_TYPES = [
  { id: 'rent',       labelKey: 'tabRent' },
  { id: 'buy',        labelKey: 'tabBuy' },
  { id: 'commercial', labelKey: 'tabCommercial' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Convert a property `date` / `createdAt` string into a real "days ago"
 *  count relative to NOW. No more synthetic reference date — every age you
 *  see on a card is the genuine upload age. */
const daysBetween = (a, b) => Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
const computeDaysAgo = (dateStr) => {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 0;
  return daysBetween(t, Date.now());
};

/** Friendly area label — strips "Dhaka" suffix when it's redundant. */
const friendlyArea = (loc = '') => {
  const parts = loc.split(',').map((s) => s.trim()).filter(Boolean);
  // The middle token is usually the neighbourhood ("Road 12, Gulshan 2, Dhaka").
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || loc;
};

/** Maps a property's rentalCategory + type into the pill stack labels
 *  ("APARTMENT", "FAMILY FLAT") shown on the card. */
// Human-readable property TYPE label so the card clearly says WHAT it is —
// Office / Shop / Restaurant / Showroom / Hostel / House / Single Room /
// Apartment / Land … The old map defaulted EVERYTHING to "Apartment", which
// mislabelled offices, shops, hostels, etc. on the home feed.
const TYPE_LABELS_MOB = {
  flat:        { en: 'Apartment',   bn: 'অ্যাপার্টমেন্ট' },
  apartment:   { en: 'Apartment',   bn: 'অ্যাপার্টমেন্ট' },
  house:       { en: 'House',       bn: 'বাড়ি' },
  independent: { en: 'House',       bn: 'বাড়ি' },
  duplex:      { en: 'Duplex',      bn: 'ডুপ্লেক্স' },
  studio:      { en: 'Studio',      bn: 'স্টুডিও' },
  penthouse:   { en: 'Penthouse',   bn: 'পেন্টহাউস' },
  sublet:      { en: 'Sublet',      bn: 'সাবলেট' },
  hostel:      { en: 'Hostel',      bn: 'হোস্টেল' },
  single_room: { en: 'Single Room', bn: 'সিঙ্গেল রুম' },
  building:    { en: 'Building',    bn: 'বিল্ডিং' },
  office:      { en: 'Office',      bn: 'অফিস' },
  shop:        { en: 'Shop',        bn: 'দোকান' },
  showroom:    { en: 'Showroom',    bn: 'শোরুম' },
  restaurant:  { en: 'Restaurant',  bn: 'রেস্টুরেন্ট' },
  land:        { en: 'Land',        bn: 'জমি' },
};

// Commercial (+ misc residential) category labels the translation-driven
// `catMap` below doesn't cover. Mirrors PropertyListing's CATEGORY_LABELS so a
// commercial card on the mobile home feed shows the SAME category pill the
// desktop listing does — instead of dropping to null (which used to hide it).
const CAT_LABELS_MOB = {
  commercial_space: { en: 'Commercial Space',    bn: 'কমার্শিয়াল স্পেস' },
  office:           { en: 'Office Space',        bn: 'অফিস স্পেস' },
  co_working:       { en: 'Co-working Space',    bn: 'কো-ওয়ার্কিং স্পেস' },
  shop:             { en: 'Shop',                bn: 'দোকান' },
  showroom:         { en: 'Showroom',            bn: 'শোরুম' },
  restaurant:       { en: 'Restaurant',          bn: 'রেস্টুরেন্ট' },
  fast_food:        { en: 'Fast Food',           bn: 'ফাস্ট ফুড' },
  warehouse:        { en: 'Warehouse',           bn: 'গুদামঘর' },
  garage:           { en: 'Garage',              bn: 'গ্যারেজ' },
  building:         { en: 'Building',            bn: 'পুরো বিল্ডিং' },
  plot:             { en: 'Plot / Land',         bn: 'প্লট / জমি' },
  hostel:           { en: 'Hostel',              bn: 'হোস্টেল' },
  working_professional: { en: 'Working Professional', bn: 'চাকরিজীবী' },
  student_male:     { en: 'Student (Male)',      bn: 'ছাত্র' },
  student_female:   { en: 'Student (Female)',    bn: 'ছাত্রী' },
  other:            { en: 'Others',              bn: 'অন্যান্য' },
};

const prettifyId = (v) =>
  String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const cardLabels = (property, t, isBn = false) => {
  const catMap = {
    family:          t.mobFamilyFlat,
    bachelor_male:   t.mobBachelor,
    bachelor_female: t.mobBachelor,
    sublet:          t.mobSublet,
    student:         t.mobStudent,
  };
  const tl = TYPE_LABELS_MOB[property.type];
  const typeLabel = tl
    ? (isBn ? tl.bn : tl.en)
    : (property.type ? prettifyId(property.type) : (isBn ? 'প্রপার্টি' : 'Property'));

  // Category pill: residential via translation keys first, then the commercial
  // bilingual map, then a prettified raw id — so it's NEVER null when a
  // rentalCategory exists (commercial listings now surface their category).
  let catLabel = catMap[property.rentalCategory] || null;
  if (!catLabel && property.rentalCategory) {
    const cc = CAT_LABELS_MOB[property.rentalCategory];
    catLabel = cc ? (isBn ? cc.bn : cc.en) : prettifyId(property.rentalCategory);
  }

  // Intent pill (rent / sale / commercial) — same 3-way split PropertyListing
  // renders, so the mobile card shows the same badge count as the desktop list.
  let intentLabel = null;
  let intentKind = null;
  if (property.intent === 'sale') {
    intentLabel = isBn ? 'বিক্রির জন্য' : 'For Sale';
    intentKind = 'sale';
  } else if (property.intent === 'commercial') {
    intentLabel = isBn ? 'কমার্শিয়াল' : 'Commercial';
    intentKind = 'commercial';
  } else if (property.intent) {
    intentLabel = isBn ? 'ভাড়ার জন্য' : 'For Rent';
    intentKind = 'rent';
  }

  return { typeLabel, catLabel, intentLabel, intentKind };
};

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

/**
 * Bottom-sheet picker used for Type + Budget. Renders a fixed overlay with
 * a draggable handle. Tap an option to select + close.
 */
const PickerSheet = ({ open, title, options, value, onPick, onClose, langKey }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end md:hidden bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-in slide-in-from-bottom-10 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 pb-3 flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-2 -mr-2 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-3 pb-2 max-h-[60vh] overflow-y-auto">
          {options.map((opt) => {
            const active = value?.id === opt.id;
            const lbl = localizedLabel(opt, langKey);
            return (
              <button
                key={opt.id}
                onClick={() => { onPick(opt); onClose(); }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-2xl text-left active:scale-[0.99] transition-transform ${
                  active ? 'bg-red-50 text-[#ba0036]' : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <span className="text-[13px] font-bold">{lbl}</span>
                {active && <BadgeCheck size={16} className="text-[#ba0036]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── SAFE IMAGE ───────────────────────────────────────────────────────────────
// Renders an <img> ONLY when there is a usable URL. An empty/falsy src (e.g. a
// listing whose legacy base64 cover was stripped by the backend list endpoint)
// or a URL that 404s would otherwise make the browser try to load the page URL
// as an image and paint a broken-image icon + alt text. Instead we paint a
// clean placeholder. `showIconOnError` keeps the camera glyph for the big cover
// tile but renders a plain grey tile for the small thumbnails (less clutter).
const PhotoFallback = ({ className = '', showIcon = true }) => (
  <div className={`bg-gray-100 ${showIcon ? 'text-gray-300 flex items-center justify-center' : ''} ${className}`}>
    {showIcon && <Camera size={26} strokeWidth={1.8} />}
  </div>
);

const SafeImg = ({ src, alt = '', className = '', showIconOnError = true }) => {
  const [ok, setOk] = useState(Boolean(src));
  useEffect(() => { setOk(Boolean(src)); }, [src]);
  if (!ok) return <PhotoFallback className={className} showIcon={showIconOnError} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setOk(false)}
    />
  );
};



/**
 * Horizontally swipeable Explore Divisions strip. Tapping a card opens the
 * DivisionDistrictsSheet (modal of districts) since divisions themselves
 * don't contain homes — their districts do.
 */
const DivisionsStrip = ({ onPick, t }) => (
  <div className="pt-8 mt-2">
    <div className="flex items-center justify-between px-4 mb-2.5">
      <div>
        <h3 className="text-[16px] font-black text-gray-900 tracking-tight">
          {t.mobExploreDivisions}
        </h3>
        <p className="text-[10.5px] text-gray-500 font-semibold mt-0.5">
          {t.mobExploreDivisionsSub}
        </p>
      </div>
    </div>

    <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 pb-2 -mr-4 pr-7">
      {DIVISIONS.map((d) => (
        <button
          key={d.id}
          onClick={() => onPick(d)}
          className="snap-start shrink-0 relative w-[170px] h-[210px] rounded-3xl overflow-hidden shadow-[0_14px_36px_-16px_rgba(15,23,42,0.45)] active:scale-[0.98] transition-transform group"
        >
          <SafeImg
            src={d.image}
            alt={d.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0" />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-3xl pointer-events-none" />

          {d.hot && (
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[8.5px] font-black uppercase tracking-widest text-white shadow-[0_4px_12px_-4px_rgba(186,0,54,0.6)]"
              style={{ background: 'linear-gradient(135deg,#ba0036 0%,#ff4d6d 100%)' }}>
              <Flame size={9} strokeWidth={3} /> {t.mobHot}
            </span>
          )}

          <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center text-slate-800">
            <ChevronRight size={14} strokeWidth={3} />
          </div>

          <div className="absolute bottom-0 inset-x-0 p-3.5">
            <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-white/75 mb-1">
              {d.tagline}
            </span>
            <h4 className="text-white text-[19px] font-black tracking-tight leading-none drop-shadow-md">
              {d.name}
            </h4>
            <p className="text-white/80 text-[10.5px] font-semibold mt-1">
              {d.districts.length} {t.mobDistricts}
            </p>
          </div>
        </button>
      ))}
    </div>
  </div>
);

/**
 * Bottom-sheet modal listing every district inside a division. Tap a
 * district → navigates to /properties/<district-slug>.
 */
const DivisionDistrictsSheet = ({ division, onClose, onPickDistrict, t }) => {
  if (!division) return null;
  return (
    <div
      className="fixed inset-0 z-[85] flex items-end md:hidden bg-black/55 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-in slide-in-from-bottom-10 duration-200 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-32 shrink-0">
          <SafeImg src={division.image} alt={division.name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/0" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-white/80">
                {division.tagline} · {t.mobDivisionText}
              </p>
              <h3 className="text-white text-[22px] font-black tracking-tight leading-none mt-1 drop-shadow-md">
                {division.name}
              </h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
              {division.districts.length} {t.mobDistricts}
            </span>
          </div>
        </div>

        <div className="pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-gray-300 -mt-1.5" />
        </div>
        <div className="px-4 pt-1 pb-3">
          <h4 className="text-[12px] font-black uppercase tracking-widest text-gray-500 mb-2">
            {t.mobPickDistrict}
          </h4>
          <div className="grid grid-cols-2 gap-2 overflow-y-auto" style={{ maxHeight: '40vh' }}>
            {division.districts.map((district) => (
              <button
                key={district}
                onClick={() => { onPickDistrict(district); onClose(); }}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 hover:border-[#ba0036]/40 hover:from-red-50 hover:to-white px-3 py-2.5 text-left active:scale-[0.98] transition-all"
              >
                <span className="block text-[12.5px] font-black text-gray-800 group-hover:text-[#ba0036] truncate">
                  {district}
                </span>
                <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  {t.mobViewHomes}
                </span>
                <ChevronRight size={13} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-300 group-hover:text-[#ba0036] transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * "Popular Areas" — futuristic bento. Each tile represents a popular area
 * (Dhanmondi, Gulshan, Banani, …). Tapping a tile opens a futuristic
 * bottom-sheet that lists every SUB-ZONE inside the area (Dhanmondi 1, 2,
 * 3, Lalmatia, Rayer Bazar; Gulshan 1, 2, Niketon; …). Picking a sub-zone
 * navigates to the property listing page filtered by that sub-zone —
 * NOT to a single property's details page. Matches the user's spec:
 *   "as soon as I click on Dhanmondi … all the areas of Dhanmondi …
 *    will be shown … and when he clicks there, on the property listing
 *    page, all the houses in that sub-zone will be shown."
 */

// Images moved to searchData.js




const PopularAreasBento = ({ t, onPickArea, properties = [] }) => {
  // Build (area, featuredProperty) pairs from the live properties feed so
  // each tile still has a nice cover image. When no listing matches a given
  // area yet, we skip the cover image and rely on the area name + 0-count
  // pill — no fake stock photo, no fake home count.
  const tiles = useMemo(() => {
    const lower = (s) => (s || '').toLowerCase();
    return POPULAR_AREAS.map((area) => {
      const a = lower(area);
      const matches = properties.filter((p) => lower(p.location).includes(a));
      return { area, homeCount: matches.length };
    });
  }, [properties]);

  if (tiles.length === 0) return null;

  return (
    <section className="pt-4 pb-1">
      <div className="px-4 mb-2.5 flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-black text-gray-900 tracking-tight">
            {t.mobPopularAreas}
          </h3>
          <p className="text-[10.5px] text-gray-500 font-semibold mt-0.5">
            {t.mobPopularAreasSub}
          </p>
        </div>
      </div>

      {/* Futuristic edge-to-edge horizontal "sticker" rail. Each tile is a
          large angled card with a holographic ring + sub-zone count chip +
          area name. Tap → opens the sub-zone bottom-sheet. */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 pb-3 -mr-4 pr-7">
        {tiles.map(({ area, homeCount }, idx) => {
          const subzoneCount = POPULAR_AREA_SUBZONES[area]?.length || 0;
          const cover = POPULAR_AREA_IMAGES[area] || '';
          return (
            <button
              key={area}
              onClick={() => onPickArea(area)}
              className="snap-start shrink-0 relative w-[200px] h-[260px] rounded-[28px] overflow-hidden active:scale-[0.98] transition-transform group"
              style={{
                boxShadow: '0 20px 50px -22px rgba(15, 23, 42, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.10) inset',
              }}
            >
              {cover ? (
                <SafeImg
                  src={cover}
                  alt={area}
                  showIconOnError={false}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(135deg, #1f2937 0%, #4c1d95 45%, #831843 100%)',
                  }}
                />
              )}

              {/* Holographic vignette + bottom darkening for legibility */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/85" />
              <div
                className="absolute inset-0 mix-blend-overlay opacity-50 pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 200deg at 70% 20%, rgba(186,0,54,0.55), rgba(168,85,247,0.45), rgba(34,211,238,0.45), rgba(186,0,54,0.55))',
                }}
              />
              <div className="absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/25 pointer-events-none" />

              {/* TOP-CENTER: Logo (100% Match) */}
              <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[16px] bg-[#f8fafc]/95 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.1)] border border-white/40">
                  <div className="bg-[#e11d48] rounded-[6px] flex items-center justify-center w-[20px] h-[20px]">
                    <Building2 size={12} className="text-white" />
                  </div>
                  <span className="text-[11px] font-black text-[#0f172a] mr-1 tracking-wide">
                    TO-LET <span className="text-[#e11d48]">PRO</span>
                  </span>
                </div>
              </div>

              {/* BOTTOM TEXT CONTAINER */}
              <div className="absolute bottom-3 left-3 right-3 flex flex-col items-start text-left pr-10">
                <span className="text-white/90 text-[10px] tracking-wide mb-0.5 font-medium lowercase drop-shadow-sm line-clamp-1">
                  {POPULAR_AREA_TAGLINES[area] || 'residential area'}
                </span>
                <h4 className="text-white text-[20px] leading-tight font-black tracking-tight drop-shadow-md break-words line-clamp-2">
                  {area}
                </h4>
              </div>

              {/* BOTTOM RIGHT: Arrow button */}
              <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white text-[#e11d48] flex items-center justify-center shadow-lg">
                <ArrowRight size={14} strokeWidth={2.5} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

/**
 * AreaSubzonesSheet — futuristic bottom-sheet listing every sub-zone inside
 * a popular area. Picking a sub-zone routes to the listing page using the
 * SAME `buildSearchUrl` contract as the desktop hero (purpose=rent,
 * category=any, budget=any) so the listing page shows every home in that
 * sub-zone.
 */
const AreaSubzonesSheet = ({ area, onClose, onPickLocation, t }) => {
  if (!area) return null;
  const subzones = POPULAR_AREA_SUBZONES[area] || [];
  const cover = POPULAR_AREA_IMAGES[area] || '';

  const handlePick = (sub) => {
    onClose();
    onPickLocation(`${sub.name}, ${area}, Dhaka`);
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end md:hidden bg-black/55 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-in slide-in-from-bottom-10 duration-200 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-32 shrink-0">
          <SafeImg src={cover} alt={area} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/0" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-white/80">
                {t.mobPopularAreas || 'Popular Areas'}
              </p>
              <h3 className="text-white text-[22px] font-black tracking-tight leading-none mt-1 drop-shadow-md">
                {area}
              </h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
              {subzones.length} {t.mobZones || 'zones'}
            </span>
          </div>
        </div>

        <div className="pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-gray-300 -mt-1.5" />
        </div>
        <div className="px-4 pt-1 pb-3">
          <h4 className="text-[12px] font-black uppercase tracking-widest text-gray-500 mb-2">
            {t.mobChooseSubzone || 'Choose a sub-zone'}
          </h4>
          <div className="grid grid-cols-2 gap-2 overflow-y-auto" style={{ maxHeight: '40vh' }}>
            {subzones.map((sub, idx) => (
              <button
                key={sub.id}
                onClick={() => handlePick(sub)}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 hover:border-[#ba0036]/40 hover:from-red-50 hover:to-white px-3 py-2.5 text-left active:scale-[0.98] transition-all"
              >
                <span className="block text-[12.5px] font-black text-gray-800 group-hover:text-[#ba0036] truncate">
                  {sub.name}
                </span>
                <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  {t.mobBrowseHomes || 'Browse homes'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Brand-red landlord CTA card — encourages hosts to list a property.
 */
const LandlordCTA = ({ t }) => {
  const navigate = useNavigate();
  return (
    <div className="px-4 my-4">
      <button
        onClick={() => navigate('/list-property')}
        className="w-full relative overflow-hidden rounded-3xl p-5 text-left bg-gradient-to-br from-[#ba0036] via-[#d4143a] to-[#ff4d6d] shadow-[0_15px_40px_-15px_rgba(186,0,54,0.6)] active:scale-[0.98] transition-transform"
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-xl" />
        <div className="absolute -bottom-12 -left-6 w-32 h-32 bg-white/10 rounded-full blur-xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30">
            <Sparkles size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
              {t.mobHavePropertyKicker}
            </p>
            <h4 className="text-white font-black text-base leading-tight mt-0.5">
              {t.mobHavePropertyTitle}
            </h4>
            <p className="text-white/85 text-[11px] font-semibold mt-0.5">
              {t.mobHavePropertySub}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-white text-[#ba0036] flex items-center justify-center shadow-lg shrink-0">
            <ArrowRight size={18} strokeWidth={2.5} />
          </div>
        </div>
      </button>
    </div>
  );
};

/**
 * Single property card — matches the screenshot the user shared:
 *
 *   ┌────────────────────────────────┬───────────────┐
 *   │  VERIFIED   ♡                   │   thumb 1     │
 *   │  APARTMENT                      ├───────────────┤
 *   │  FAMILY FLAT                    │   thumb 2     │
 *   │                                 ├───────────────┤
 *   │      big primary image          │   thumb 3     │
 *   └─────────────────────────────────┴───────────────┘
 *   Title  ★ rating
 *   Location · price/mo · beds · baths · sqft
 */
// Build a tiny per-room collage (one photo per category) so the right-hand
// Dynamically builds the collage using the actual room photos uploaded by the user.
const mobBuildCollage = (property) => {
  const cover = property.coverPhoto || property.img || (property.images || [])[0] || '';
  // One tile per unique room category (labelled), first-seen order.
  const tiles = [];
  const seen = new Set();
  if (Array.isArray(property.roomPhotos)) {
    for (const p of property.roomPhotos) {
      const url = p.url || p.preview;
      const r = (p.room || 'other').toLowerCase();
      if (url && !seen.has(r)) { tiles.push({ url, room: r }); seen.add(r); }
    }
  }
  // Prefer photos that DIFFER from the cover (so the strip isn't three copies
  // of the same building) but KEEP the labelled same-as-cover rooms as fillers
  // — so a commercial listing still reads "Workspace / Reception / Washroom"
  // instead of padding with duplicate cover photos.
  const distinct    = tiles.filter((tile) => tile.url && tile.url !== cover);
  const sameAsCover = tiles.filter((tile) => tile.url && tile.url === cover);
  const thumbs = [...distinct, ...sameAsCover];
  // Legacy listings with no room tags: backfill from the flat images list.
  if (thumbs.length < 3 && Array.isArray(property.images)) {
    for (const u of property.images) {
      if (thumbs.length >= 3) break;
      if (u && u !== cover && !thumbs.some((s) => s.url === u)) thumbs.push({ url: u, room: null });
    }
  }
  return { cover, thumbs: thumbs.slice(0, 3) };
};

const PropertyCardSkeleton = () => (
  <div className="mx-4 mb-4 bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm animate-pulse">
    <div className="w-full h-[200px] bg-gray-200" />
    <div className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="h-6 w-1/3 bg-gray-200 rounded-md" />
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
      </div>
      <div className="h-4 w-2/3 bg-gray-200 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-7 w-16 bg-gray-100 rounded-md" />
        <div className="h-7 w-16 bg-gray-100 rounded-md" />
        <div className="h-7 w-20 bg-gray-100 rounded-md" />
      </div>
    </div>
  </div>
);

const PropertyCard = ({ property, t, landlord }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [liked, setLiked] = useState(false);
  const { typeLabel, catLabel, intentLabel, intentKind } = cardLabels(property, t, language === 'বাংলা');

  const daysAgo = computeDaysAgo(property.date || property.createdAt);
  const ageLabel = daysAgo === 0
    ? t.mobNewToday
    : `${daysAgo} ${daysAgo === 1 ? t.mobDayAgo : t.mobDaysAgo}`;

  // Primary cover + one thumb per room category (max 3 thumbs). We DON'T pad
  // with the cover anymore — padding pushed empty '' strings into <img src>,
  // which painted broken-image icons for listings whose photos were stripped
  // (legacy base64). SafeImg renders a clean placeholder for any empty/dead
  // tile instead.
  const { cover: primary, thumbs: rawThumbs } = mobBuildCollage(property);
  // Fill the 3-slot layout. Pad with EMPTY tiles (SafeImg draws a clean
  // placeholder) — never with the cover, which used to make the strip look
  // like two or three duplicate cover photos.
  const padThumbs = [{ url: '', room: null }, { url: '', room: null }];
  const thumbs = [...rawThumbs, ...padThumbs].slice(0, 3);
  const extraImages = Array.isArray(property.images) ? property.images.length : 0;

  const go = () => navigate(`/property/${property.id}`);

  return (
    <article className="px-4 mb-5">
      <div
        onClick={go}
        className="bg-white rounded-[26px] overflow-hidden shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] border border-gray-100 active:scale-[0.995] transition-transform cursor-pointer"
      >
        {/* IMAGE BLOCK — big image left, 3 thumbs right */}
        <div className="relative grid grid-cols-[1.7fr_1fr] gap-1 p-1 bg-white">
          {/* Primary image */}
          <div className="relative rounded-[20px] overflow-hidden bg-gray-100 aspect-[4/3.4]">
            <SafeImg
              src={primary}
              alt={property.title}
              className="w-full h-full object-cover"
            />

            {/* TOP-LEFT: vertical pill stack — VERIFIED + APARTMENT + FAMILY FLAT */}
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10">
              {property.verified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#ba0036] text-[10px] font-black uppercase tracking-wider shadow-md">
                  <ShieldCheck size={11} strokeWidth={2.6} />
                  {t.mobVerified}
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                {typeLabel}
              </span>
              {catLabel && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#ba0036] text-white text-[10px] font-black uppercase tracking-wider shadow-[0_6px_18px_-6px_rgba(186,0,54,0.55)]">
                  {catLabel}
                </span>
              )}
              {intentLabel && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-white text-[10px] font-black uppercase tracking-wider shadow-md ${
                  intentKind === 'sale' ? 'bg-blue-600' :
                  intentKind === 'commercial' ? 'bg-purple-600' :
                  'bg-green-600'
                }`}>
                  {intentLabel}
                </span>
              )}
            </div>

            {/* TOP-RIGHT: heart button */}
            <button
              onClick={(e) => { e.stopPropagation(); setLiked((v) => !v); }}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/85 backdrop-blur-md flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
              aria-label={liked ? 'Unlike' : 'Like'}
            >
              <Heart
                size={18}
                className={liked ? 'text-[#ba0036] fill-[#ba0036]' : 'text-gray-700'}
                strokeWidth={2.5}
              />
            </button>

            {/* BOTTOM-LEFT: posted age */}
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
              <Clock size={10} />
              {ageLabel}
            </div>
          </div>

          {/* Right column — 3 stacked thumbs */}
          <div className="grid grid-rows-3 gap-1">
            {thumbs.map((shot, i) => {
              // Convert shot string (fallback) to object just in case
              const s = typeof shot === 'string' ? { url: shot, room: null } : shot;
              return (
                <div key={i} className="relative rounded-[16px] overflow-hidden bg-gray-100">
                  <SafeImg
                    src={s?.url}
                    alt={s?.url ? `${property.title} ${i + 2}` : ''}
                    showIconOnError={false}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {s?.room && (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-[2px] rounded-md bg-black/60 text-white text-[8px] font-black uppercase tracking-wider shadow-sm z-10">
                      {roomLabel(s.room, language === 'বাংলা')}
                    </span>
                  )}
                  {i === 2 && extraImages > 4 && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center z-20">
                      <span className="text-white text-[12px] font-black">
                        +{extraImages - 4}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* INFO BLOCK */}
        <div className="px-4 pb-4 pt-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[15px] font-black text-gray-900 leading-tight line-clamp-1">
              {property.title}
            </h4>
            <div className="shrink-0 inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-black">
              <Star size={11} className="fill-amber-500 text-amber-500" />
              {property.rating}
            </div>
          </div>

          <div className="flex items-center gap-1 mt-0.5 text-gray-500 text-[12px] font-semibold">
            <MapPin size={11} />
            {friendlyArea(property.location)}
          </div>

          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-600 font-semibold">
            {(property.intent === 'commercial' || property.type === 'land' || (!property.beds && !property.baths)) ? (
              /* Commercial / land don't have beds & baths — showing "1 bed 1 bath"
                 on an office is exactly the confusion the user flagged. */
              <span className="inline-flex items-center gap-1">
                <Building2 size={12} /> {Number(property.sqft || 0).toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-BD')} sqft
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <Building2 size={12} /> {property.beds.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-BD')} {t.mobBed} · {property.baths.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-BD')} {t.mobBath}
                </span>
                <span className="text-gray-300">·</span>
                <span>{property.sqft.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-BD')} sqft</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              {landlord && (
                <SafeImg
                  src={landlord.avatar}
                  alt={landlord.name}
                  showIconOnError={false}
                  className="w-7 h-7 rounded-full object-cover border border-white shadow"
                />
              )}
              <span className="text-[11px] font-bold text-gray-700 truncate">
                {landlord?.name || ''}
              </span>
              <span className="text-[10px] text-gray-400 font-semibold shrink-0">
                · {property.reviews.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-BD')} {t.mobReviews}
              </span>
            </div>
            <div className="shrink-0 inline-flex items-baseline gap-1 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-2xl">
              <span className="text-[14px] font-black text-gray-900">
                ৳{property.price.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-BD')}
              </span>
              <span className="text-[10px] text-gray-500 font-semibold">/{t.mobMonth}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};


const CategoryPromptSheet = ({ open, locationName, onClose, onPickCategory, t }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end md:hidden bg-black/55 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-in slide-in-from-bottom-10 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 pb-3 flex flex-col">
          <h3 className="text-[14px] font-black uppercase tracking-widest text-gray-500 mb-1">
            {locationName}
          </h3>
          <h2 className="text-[20px] font-black text-gray-900 leading-tight">
            {t.mobWhatAreYouLookingFor || 'What are you looking for?'}
          </h2>
        </div>
        <div className="px-4 pb-4 grid gap-3">
          <button
            onClick={() => onPickCategory('rent')}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-200 hover:border-[#ba0036]/50 hover:bg-red-50/30 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#ba0036]">
                <HomeIcon size={20} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h4 className="text-[15px] font-black text-gray-900 group-hover:text-[#ba0036]">{t.rentMenu || 'Rent'}</h4>
                <p className="text-[11px] font-bold text-gray-500">{t.mobRentDesc || 'Apartments, sublets, bachelor flats'}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400 group-hover:text-[#ba0036]" />
          </button>

          <button
            onClick={() => onPickCategory('buy')}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-200 hover:border-blue-500/50 hover:bg-blue-50/30 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Wallet size={20} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h4 className="text-[15px] font-black text-gray-900 group-hover:text-blue-600">{t.buyMenu || 'Buy'}</h4>
                <p className="text-[11px] font-bold text-gray-500">{t.mobBuyDesc || 'Houses, flats, land'}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400 group-hover:text-blue-600" />
          </button>

          <button
            onClick={() => onPickCategory('commercial')}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-200 hover:border-amber-500/50 hover:bg-amber-50/30 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <Building2 size={20} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h4 className="text-[15px] font-black text-gray-900 group-hover:text-amber-600">{t.commercialMenu || 'Commercial'}</h4>
                <p className="text-[11px] font-bold text-gray-500">{t.mobCommercialDesc || 'Offices, shops, restaurants'}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400 group-hover:text-amber-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
const MobileHome = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const langKey = language === 'বাংলা' ? 'bn' : 'en';

  // ── Search-bar state ───────────────────────────────────────────────────
  // Listing mode is GLOBAL — shared with the navbar + desktop hero and
  // persisted across reloads (usePropertyStore.activeMode). MobileHome
  // historically used 'buy' for the sale mode, so we adapt at this single
  // boundary: the store holds the canonical 'sale', while every existing
  // `searchType === 'buy'` branch below keeps working unchanged.
  const activeMode    = usePropertyStore((s) => s.activeMode);
  const setActiveMode = usePropertyStore((s) => s.setActiveMode);
  const searchType    = activeMode === 'sale' ? 'buy' : activeMode;
  const setSearchType = (mode) => setActiveMode(mode === 'buy' ? 'sale' : mode);
  const [location,    setLocation]    = useState('');
  const [propType,    setPropType]    = useState(RESIDENTIAL_TYPES[0]);
  const [budget,      setBudget]      = useState(BUDGET_RANGES[0]);

  // Property-type list depends on the current Rent / Buy / Commercial tab.
  const activePropertyTypes = useMemo(() => getPropertyTypesFor(searchType), [searchType]);
  useEffect(() => {
    // Reset to the first option whenever the purpose changes (same UX as
    // desktop hero).
    setPropType(activePropertyTypes[0]);
  }, [searchType, activePropertyTypes]);

  // ── Feed filter state ──────────────────────────────────────────────────
  const [activeArea, setActiveArea] = useState(null);

  // ── Live property feed (no demo data) ──────────────────────────────────
  // Re-fetches on mount and whenever a property is uploaded from another tab
  // (e.g. Add Property writes to localStorage → subscribeUserProperties fires).
  const [properties, setProperties] = useState([]);
  const [landlordsById, setLandlordsById] = useState({});
  const [isLoadingProps, setIsLoadingProps] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingProps(true);
      try {
        const list = await propertyService.getProperties({}, 'Newest Listings');
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setProperties(arr);
        // Resolve a landlord per unique landlordId so each card can show an
        // avatar + name without one fetch per card render.
        const ids = [...new Set(arr.map((p) => p.landlordId).filter(Boolean))];
        const entries = await Promise.all(ids.map(async (id) => [id, await propertyService.getLandlord(id)]));
        if (!cancelled) {
          setLandlordsById(Object.fromEntries(entries.filter(([, v]) => v)));
        }
      } catch {
        if (!cancelled) { setProperties([]); setLandlordsById({}); }
      } finally {
        if (!cancelled) setIsLoadingProps(false);
      }
    };
    load();
    const unsub = subscribeUserProperties(load);
    return () => { cancelled = true; unsub && unsub(); };
  }, []);

  // ── Location search modal ──────────────────────────────────────────────
  // The full-screen LocationSearchModal replaces the old inline autocomplete
  // dropdown. It owns the debounced live API search + static-suggestion merge;
  // we just receive the chosen location string back through onSelect.
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // ── Bottom-sheets ──────────────────────────────────────────────────────
  const [typeOpen,   setTypeOpen]   = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [openDivision, setOpenDivision] = useState(null);
  const [openArea, setOpenArea] = useState(null); // Popular-area → sub-zone sheet
  const [pendingLocation, setPendingLocation] = useState(null);
  const [isCategoryPromptOpen, setIsCategoryPromptOpen] = useState(false);

  const handleFinalNavigate = (purpose) => {
    setIsCategoryPromptOpen(false);
    navigate(buildSearchUrl({
      location: pendingLocation,
      purpose: purpose,
      categoryId: 'any',
      budgetId: 'any',
    }));
  };

  const handleDistrictPick = (districtName) => {
    setOpenDivision(null);
    setPendingLocation(districtName);
    setIsCategoryPromptOpen(true);
  };

  const handleAreaSubzonePick = (loc) => {
    setOpenArea(null);
    setPendingLocation(loc);
    setIsCategoryPromptOpen(true);
  };

  // Mirrors desktop HeroSection.handleSearch exactly.
  const handleSearch = () => {
    navigate(buildSearchUrl({
      location,
      purpose:  searchType,
      categoryId: propType.id,
      budgetId:   budget.id,
    }));
  };

  // ── Location-aware placeholder, matching desktop's logic ───────────────
  const locationPlaceholder = searchType === 'commercial'
    ? t.mobLocationPlaceholderCommercial
    : searchType === 'buy'
    ? t.mobLocationPlaceholderBuy
    : t.mobLocationPlaceholderRent;

  // ── Feed ───────────────────────────────────────────────────────────────
  // Show EVERY active property, sorted newest-first. The previous "last 2
  // days" window made the page look empty when only a handful of homes
  // were brand new — per the user's spec ("you can show the recently
  // released ones first and you can show all the ones that are active").
  const filteredFeed = useMemo(() => {
    const needle = (activeArea || '').trim().toLowerCase();
    return (properties || [])
      .map((p) => ({ ...p, _daysAgo: computeDaysAgo(p.date || p.createdAt) }))
      .filter((p) => {
        if (!needle) return true;
        // Bilingual (English↔Bengali) match against every location-ish field —
        // address line, area dropdown, district, division, GPS address, title —
        // so tapping an English area tile (e.g. "Dhanmondi") also surfaces
        // listings whose location was stored in Bengali.
        return locationQueryMatches(propertyLocationHaystack(p), needle);
      })
      .sort((a, b) => a._daysAgo - b._daysAgo);
  }, [properties, activeArea]);

  const sectionHeading = activeArea
    ? `${t.mobHomesIn} ${activeArea}`
    : t.mobRecentlyPosted;

  return (
    <div className="md:hidden bg-slate-50 min-h-screen pb-28">
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      {/* ───────── MARKETING BANNER ───────── */}
      <div className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-3xl aspect-[16/10] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]">
          <iframe
            src={`https://www.youtube.com/embed/${HERO_YOUTUBE_ID}?autoplay=1&mute=1&loop=1&playlist=${HERO_YOUTUBE_ID}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`}
            title="YouTube background"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full pointer-events-none scale-[1.35]"
          ></iframe>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/55" />
          
        </div>
      </div>

      {/* ───────── SEARCH PANEL (glassmorphism) ───────── */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="rounded-3xl shadow-[0_20px_50px_-20px_rgba(15,23,42,0.30)] p-3 bg-white/55 backdrop-blur-2xl backdrop-saturate-150 border border-white/70 ring-1 ring-white/40">
          {/* Rent / Buy / Commercial pill toggle */}
          <div className="flex items-center bg-gray-100 rounded-full p-1 mb-3">
            {SEARCH_TYPES.map((typ) => {
              const active = searchType === typ.id;
              return (
                <button
                  key={typ.id}
                  onClick={() => setSearchType(typ.id)}
                  className={`flex-1 py-2 text-[12px] font-black uppercase tracking-wider rounded-full transition-all ${
                    active
                      ? 'bg-[#ba0036] text-white shadow-[0_6px_16px_-6px_rgba(186,0,54,0.55)]'
                      : 'text-gray-600'
                  }`}
                >
                  {t[typ.labelKey]}
                </button>
              );
            })}
          </div>

          {/* Location trigger — opens the full-screen LocationSearchModal
              (replaces the old inline autocomplete dropdown). */}
          <div className="relative mb-2">
            <div className="w-full flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
              <span className="w-9 h-9 rounded-xl bg-red-50 text-[#ba0036] flex items-center justify-center shrink-0">
                <MapPin size={16} strokeWidth={2.5} />
              </span>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="block text-[9.5px] font-black text-gray-500 uppercase tracking-widest leading-tight">
                  {t.mobLocationLabel}
                </span>
                <span className={`block text-[13px] font-bold leading-tight truncate ${location ? 'text-gray-900' : 'text-gray-400'}`}>
                  {location || locationPlaceholder}
                </span>
              </button>
              {location && (
                <button
                  type="button"
                  onClick={() => setLocation('')}
                  aria-label="Clear"
                  className="text-gray-400 active:scale-90 transition-transform shrink-0"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Type + Budget row */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setTypeOpen(true)}
              className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 active:scale-[0.99] transition-transform text-left"
            >
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                {searchType === 'commercial' ? (
                  <Building2 size={15} strokeWidth={2.5} />
                ) : searchType === 'buy' ? (
                  <Wallet size={15} strokeWidth={2.5} />
                ) : (
                  <HomeIcon size={15} strokeWidth={2.5} />
                )}
              </span>
              <span className="flex-1 min-w-0 ml-1">
                <span className="block text-[9px] font-black text-gray-500 uppercase tracking-widest leading-tight">
                  {t.mobTypeLabel}
                </span>
                <span className="block text-[12px] font-black text-gray-900 leading-tight truncate">
                  {localizedLabel(propType, langKey)}
                </span>
              </span>
              <ChevronDown size={12} className="text-gray-400 shrink-0" />
            </button>

            <button
              onClick={() => setBudgetOpen(true)}
              className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 active:scale-[0.99] transition-transform text-left"
            >
              <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                <Wallet size={15} strokeWidth={2.5} />
              </span>
              <span className="flex-1 min-w-0 ml-1">
                <span className="block text-[9px] font-black text-gray-500 uppercase tracking-widest leading-tight">
                  {t.mobBudgetLabel}
                </span>
                <span className="block text-[12px] font-black text-gray-900 leading-tight truncate">
                  {localizedLabel(budget, langKey)}
                </span>
              </span>
              <ChevronDown size={12} className="text-gray-400 shrink-0" />
            </button>
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#ba0036] to-[#d4143a] text-white font-black uppercase tracking-widest text-[13px] py-3.5 rounded-2xl shadow-[0_10px_28px_-10px_rgba(186,0,54,0.6)] hover:scale-[1.02] hover:shadow-[0_14px_32px_-10px_rgba(186,0,54,0.7)] active:scale-[0.96] active:shadow-sm transition-all duration-300"
          >
            <Search size={16} strokeWidth={2.5} />
            {t.mobSearchProperties}
          </button>
        </div>
      </div>



      {/* ───────── DIVISIONS STRIP ───────── */}
      <DivisionsStrip onPick={setOpenDivision} t={t} />

      {/* ───────── POPULAR AREAS — FUTURISTIC BENTO ─────────
          Tapping a tile opens the sub-zone bottom-sheet (Dhanmondi 1, 2,
          3, Lalmatia, …) — the user then picks a sub-zone, which routes
          to the property listing page filtered by that sub-zone. */}
      <PopularAreasBento t={t} onPickArea={setOpenArea} properties={properties} />

      {/* ───────── FEED HEADER ───────── */}
      <div className="flex items-center justify-between px-4 mt-3 mb-1">
        <div className="min-w-0">
          <h3 className="text-[16px] font-black text-gray-900 tracking-tight truncate">
            {sectionHeading}
          </h3>
          <p className="text-[11px] text-gray-500 font-semibold inline-flex items-center gap-1">
            <Clock size={11} className="text-[#ba0036]" strokeWidth={2.5} />
            {filteredFeed.length.toLocaleString(language === 'বাংলা' ? 'bn-BD' : 'en-BD')}{' '}
            {filteredFeed.length === 1
              ? (t.mobActiveHomeShown || 'active home — newest first')
              : (t.mobActiveHomesShown || 'active homes — newest first')}
          </p>
        </div>
        {activeArea && (
          <button
            onClick={() => setActiveArea(null)}
            className="shrink-0 text-[11px] font-bold text-[#ba0036] inline-flex items-center gap-0.5 active:scale-95 transition-transform"
          >
            {t.mobClearFilters} <X size={11} />
          </button>
        )}
      </div>

      {/* ───────── FEED ───────── */}
      {isLoadingProps ? (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </>
      ) : filteredFeed.length === 0 ? (
        <div className="mx-4 my-6 p-6 bg-white rounded-3xl border border-gray-100 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#ba0036] mx-auto flex items-center justify-center mb-3">
            <Search size={20} />
          </div>
          <h4 className="text-[14px] font-black text-gray-900">
            {t.mobNoHomesYet}
          </h4>
          <p className="text-[11px] text-gray-500 font-semibold mt-1 max-w-[260px] mx-auto">
            {t.mobNoHomesDesc}
          </p>
          <button
            onClick={() => setActiveArea(null)}
            className="mt-4 inline-flex items-center gap-1.5 bg-[#ba0036] text-white text-[12px] font-black px-4 py-2 rounded-full active:scale-95 transition-transform"
          >
            {t.mobClearFilters} <ArrowRight size={13} />
          </button>
        </div>
      ) : (
        <>
          {filteredFeed.slice(0, 2).map((p) => (
            <PropertyCard key={p.id} property={p} t={t} landlord={landlordsById[p.landlordId]} />
          ))}
          <LandlordCTA t={t} />
          {filteredFeed.slice(2).map((p) => (
            <PropertyCard key={p.id} property={p} t={t} landlord={landlordsById[p.landlordId]} />
          ))}
        </>
      )}

      {/* ───────── FOOTER TAGLINE ───────── */}
      <div className="text-center pt-2 pb-6 px-6 mt-3">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
          <ShieldCheck size={12} className="text-[#ba0036]" />
          {t.mobEndToEndSecured}
        </div>
      </div>

      {/* ───────── BOTTOM SHEETS ───────── */}
      <PickerSheet
        open={typeOpen}
        title={t.mobTypeLabel}
        options={activePropertyTypes}
        value={propType}
        onPick={setPropType}
        onClose={() => setTypeOpen(false)}
        langKey={langKey}
      />
      <PickerSheet
        open={budgetOpen}
        title={t.mobBudgetLabel}
        options={BUDGET_RANGES}
        value={budget}
        onPick={setBudget}
        onClose={() => setBudgetOpen(false)}
        langKey={langKey}
      />
      <DivisionDistrictsSheet
        division={openDivision}
        onClose={() => setOpenDivision(null)}
        onPickDistrict={handleDistrictPick}
        t={t}
      />
      <AreaSubzonesSheet
        area={openArea}
        onClose={() => setOpenArea(null)}
        onPickLocation={handleAreaSubzonePick}
        t={t}
      />
      {/* ───────── POPUPS / BOTTOM SHEETS ───────── */}
      <CategoryPromptSheet
        open={isCategoryPromptOpen}
        locationName={pendingLocation}
        onClose={() => setIsCategoryPromptOpen(false)}
        onPickCategory={handleFinalNavigate}
        t={t}
      />

      {/* Full-screen location search (replaces the old inline dropdown) */}
      <LocationSearchModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelect={(loc) => { setLocation(loc); setIsLocationModalOpen(false); }}
        initialValue={location}
        language={language}
      />
    </div>
  );
};

export default MobileHome;