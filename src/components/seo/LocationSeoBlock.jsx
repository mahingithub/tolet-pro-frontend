/**
 * LocationSeoBlock.jsx — the readable half of a district/division page.
 * ─────────────────────────────────────────────────────────────────────────────
 * A grid of listing cards is not a page a search engine can rank. Card titles
 * are landlord-written, the prices are numbers, and none of it says which
 * district you are looking at or what renting there is like — so 71 location
 * pages all looked like the same page with different pictures.
 *
 * This block, rendered under the results, gives each one actual text: the
 * place named in both languages, the neighbourhoods it covers, four real
 * questions answered, and links to the districts next door. It is also what
 * makes the FAQPage schema on these pages legitimate — the markup describes
 * content the visitor can genuinely see, which is Google's requirement for it.
 *
 * Rendered only for slugs that resolve to a real division or district; ad-hoc
 * search slugs ("dhanmondi-dhaka") get nothing, because there is nothing
 * truthful to say about them and thin near-duplicates are worse than absent.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight, GraduationCap, Briefcase } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { ALL_DISTRICTS, districtPath } from '../../seo/locationSeo';
import { ALL_DHAKA_AREAS, areaPath } from '../../seo/areaSeo';
import { FEATURE_PAGES } from '../../seo/featurePages';

const LocationSeoBlock = ({ seo }) => {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  if (!seo) return null;

  const isDistrict = seo.kind === 'district';
  const placeName = bn ? seo.bn : seo.en;
  const otherName = bn ? seo.en : seo.bn;

  const isArea = seo.kind === 'area';

  // Neighbours — a short, relevant, crawlable list rather than a dump of all 64:
  //   area page      → other areas of Dhaka, siblings in the same thana first,
  //                    because "Mirpur didn't work out, what about Pallabi?" is
  //                    the actual next question
  //   district page  → the other districts of its division
  //   division page  → its own districts
  const neighbours = isArea
    ? [
      ...ALL_DHAKA_AREAS.filter((a) => a.slug !== seo.id && a.thana && a.thana === seo.thana),
      ...ALL_DHAKA_AREAS.filter((a) => a.slug !== seo.id && a.thana !== seo.thana),
    ].slice(0, 14).map((a) => ({ id: a.slug, en: a.en, bn: a.bn, path: areaPath(a.slug) }))
    : (isDistrict
      ? ALL_DISTRICTS.filter((d) => d.divisionId === seo.divisionId && d.id !== seo.id)
      : (seo.districts || [])
    ).slice(0, 12).map((d) => ({ id: d.id, en: d.en, bn: d.bn, path: districtPath(d.id) }));

  // Dhaka's own district/division page links out to every area of the city.
  // This is the crawl path into all 129 area pages, and it is also the most
  // useful thing that page can offer: nobody searching Dhaka wants "all of
  // Dhaka", they want their area.
  const showDhakaAreas = seo.id === 'dhaka';

  // Sub-area names for a Dhaka thana page (Kazipara inside Mirpur, Sheikhertek
  // inside Adabar, …). Fetched on demand rather than bundled: all 669 of them
  // with both languages weigh 51 KB, they only ever appear on one page type,
  // and they sit below the fold. Google's renderer executes this fetch, and the
  // prerendered HTML already contains them for crawlers that do not.
  const [subAreas, setSubAreas] = useState(null);
  useEffect(() => {
    if (seo?.kind !== 'area') { setSubAreas(null); return undefined; }
    let cancelled = false;
    import('../../seo/dhakaSubAreas.js')
      .then((m) => { if (!cancelled) setSubAreas(m.DHAKA_SUB_AREAS[seo.id] || []); })
      .catch(() => { /* chips are a nice-to-have; the page stands without them */ });
    return () => { cancelled = true; };
  }, [seo?.kind, seo?.id]);

  const areaList = seo.kind === 'area'
    ? (subAreas || []).map((s) => (bn ? (s.bn || s.en) : s.en))
    : (bn ? (seo.areasBn?.length ? seo.areasBn : seo.areas) : seo.areas);

  return (
    <section
      aria-labelledby="location-seo-heading"
      className="w-full bg-gray-50 border-t border-gray-100 mt-8"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-14">
        {/* ── Intro ─────────────────────────────────────────────────────── */}
        <h2
          id="location-seo-heading"
          className="text-xl md:text-2xl font-black text-gray-900 tracking-tight"
        >
          {isDistrict || isArea
            ? (bn ? `${placeName} এ বাসা ভাড়া ও টু-লেট` : `House rent and to-let in ${placeName}`)
            : (bn ? `${placeName} বিভাগে বাসা ভাড়া` : `House rent across ${placeName} division`)}
        </h2>
        <p className="mt-1 text-[13px] font-bold text-gray-400">
          {isDistrict || isArea
            ? (bn ? `To-let & flat rent in ${otherName}, Dhaka` : `${otherName} — বাসা ভাড়া`)
            : (bn ? `To-let across ${otherName} division` : `${otherName} বিভাগ`)}
        </p>

        {/* Campus / office context — the two reasons anyone picks a Dhaka area,
            and the phrases a student or a new job-holder actually types. */}
        {(seo.campuses?.length > 0 || seo.offices?.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(seo.campuses || []).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700">
                <GraduationCap size={12} /> {c}
              </span>
            ))}
            {(seo.offices || []).map((o) => (
              <span key={o} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-bold text-amber-700">
                <Briefcase size={12} /> {o}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 max-w-4xl text-[13px] md:text-sm font-medium text-gray-600 leading-relaxed">
          {seo.description}
        </p>

        {/* ── Areas covered — the long-tail neighbourhood names ─────────── */}
        {areaList?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[13px] font-black text-gray-900 mb-2.5">
              {isArea
                ? (bn ? `${placeName} এর ভেতরের এলাকা` : `Areas inside ${placeName}`)
                : (bn ? `${placeName} এর জনপ্রিয় এলাকা` : `Popular areas in ${placeName}`)}
            </h3>
            <div className="flex flex-wrap gap-2">
              {areaList.slice(0, isArea ? 24 : 10).map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] font-bold text-gray-600"
                >
                  <MapPin size={11} className="text-[#ba0036]" />
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Body copy ─────────────────────────────────────────────────
            Three sections woven with this district's own data. Without them
            these 65 pages are 65 identical result grids with a different noun
            in the heading, which is exactly the thing search engines collapse
            into one. Each paragraph appears in the reader's language first
            and the other language beneath, smaller — visible text, because a
            renter here genuinely searches in both. */}
        {seo.sections?.length > 0 && (
          <div className="mt-9 max-w-4xl">
            {seo.sections.map((sec, i) => (
              <article key={i} className="mb-8">
                <h3 className="text-base md:text-lg font-black text-gray-900 mb-0.5">
                  {bn ? sec.h2.bn : sec.h2.en}
                </h3>
                <p className="text-[11px] font-bold text-gray-400 mb-3">
                  {bn ? sec.h2.en : sec.h2.bn}
                </p>
                {sec.paragraphs.map((para, j) => (
                  <div key={j} className="mb-4">
                    <p className="text-[13px] md:text-sm font-medium text-gray-600 leading-[1.85]">
                      {bn ? para.bn : para.en}
                    </p>
                    <p className="mt-1.5 text-[11px] md:text-[12px] font-medium text-gray-400 leading-[1.7]">
                      {bn ? para.en : para.bn}
                    </p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}

        {/* ── FAQ — mirrored by the FAQPage schema on this route ────────── */}
        <div className="mt-9">
          <h3 className="text-base md:text-lg font-black text-gray-900 mb-4">
            {bn ? 'সাধারণ প্রশ্ন' : 'Frequently asked questions'}
          </h3>
          <div className="space-y-2.5 max-w-4xl">
            {seo.faq.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-gray-200 bg-white p-4"
                open={i === 0}
              >
                <summary className="cursor-pointer list-none text-[13px] md:text-sm font-black text-gray-900 flex items-start justify-between gap-4">
                  <span>{item.q}</span>
                  <span className="shrink-0 text-[#ba0036] transition-transform group-open:rotate-45 text-lg leading-none">+</span>
                </summary>
                <p className="mt-2.5 text-[12px] md:text-[13px] font-medium text-gray-600 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* ── Every area of Dhaka (Dhaka page only) ─────────────────────── */}
        {showDhakaAreas && (
          <div className="mt-9">
            <h3 className="text-[13px] font-black text-gray-900 mb-1">
              {bn ? 'ঢাকা শহরের সব এলাকা' : 'Every area of Dhaka city'}
            </h3>
            <p className="text-[11px] font-bold text-gray-400 mb-2.5">
              {bn
                ? `${ALL_DHAKA_AREAS.length}টি এলাকা — আপনার এলাকা বেছে নিন`
                : `${ALL_DHAKA_AREAS.length} areas — pick yours`}
            </p>
            <ul className="flex flex-wrap gap-2">
              {ALL_DHAKA_AREAS.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={areaPath(a.slug)}
                    className="inline-block px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-gray-600 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                    title={bn ? `${a.en} বাসা ভাড়া` : `House rent in ${a.en}`}
                  >
                    {bn ? a.bn : a.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Neighbouring areas / districts ────────────────────────────── */}
        {neighbours.length > 0 && (
          <div className="mt-9">
            <h3 className="text-[13px] font-black text-gray-900 mb-2.5">
              {isArea
                ? (bn ? 'ঢাকার আশপাশের এলাকা' : 'Other areas of Dhaka')
                : isDistrict
                  ? (bn ? `${seo.divisionBn || seo.divisionEn} বিভাগের অন্য জেলা` : `Other districts in ${seo.divisionEn}`)
                  : (bn ? `${placeName} বিভাগের জেলাসমূহ` : `Districts of ${placeName}`)}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {neighbours.map((d) => (
                <li key={d.id}>
                  <Link
                    to={d.path}
                    className="inline-block px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-gray-600 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                    title={bn ? `${d.en} বাসা ভাড়া` : `House rent in ${d.en}`}
                  >
                    {bn ? d.bn : d.en}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to={isArea ? '/properties/dhaka' : '/to-let'}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ba0036] text-white text-[11px] font-black hover:bg-[#a1002f] transition-colors"
                >
                  {isArea
                    ? (bn ? 'ঢাকার সব এলাকা' : 'All Dhaka areas')
                    : (bn ? 'সব জেলা' : 'All districts')}
                  <ChevronRight size={11} />
                </Link>
              </li>
            </ul>
          </div>
        )}

        {/* ── After you move in ────────────────────────────────────────── */}
        <div className="mt-9 pt-7 border-t border-gray-200">
          <h3 className="text-[13px] font-black text-gray-900 mb-2.5">
            {bn ? 'বাসা পাওয়ার পরে' : 'After you move in'}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {FEATURE_PAGES.map((p) => (
              <li key={p.slug}>
                <Link
                  to={p.slug}
                  className="inline-block px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-gray-600 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                >
                  {bn ? p.h1.bn : p.h1.en}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default LocationSeoBlock;
