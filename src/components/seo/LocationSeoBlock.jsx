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

import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import { ALL_DISTRICTS, districtPath } from '../../seo/locationSeo';
import { FEATURE_PAGES } from '../../seo/featurePages';

const LocationSeoBlock = ({ seo }) => {
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  if (!seo) return null;

  const isDistrict = seo.kind === 'district';
  const placeName = bn ? seo.bn : seo.en;
  const otherName = bn ? seo.en : seo.bn;

  // Neighbours: the other districts of the same division. For a division page,
  // its own districts. Either way it is a short, relevant, crawlable list —
  // not a footer dump of all 64.
  const neighbours = (isDistrict
    ? ALL_DISTRICTS.filter((d) => d.divisionId === seo.divisionId && d.id !== seo.id)
    : (seo.districts || [])
  ).slice(0, 12);

  const areaList = bn
    ? (seo.areasBn?.length ? seo.areasBn : seo.areas)
    : seo.areas;

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
          {isDistrict
            ? (bn ? `${placeName} এ বাসা ভাড়া ও টু-লেট` : `House rent and to-let in ${placeName}`)
            : (bn ? `${placeName} বিভাগে বাসা ভাড়া` : `House rent across ${placeName} division`)}
        </h2>
        <p className="mt-1 text-[13px] font-bold text-gray-400">
          {isDistrict
            ? (bn ? `To-let & flat rent in ${otherName}` : `${otherName} — বাসা ভাড়া`)
            : (bn ? `To-let across ${otherName} division` : `${otherName} বিভাগ`)}
        </p>

        <p className="mt-4 max-w-4xl text-[13px] md:text-sm font-medium text-gray-600 leading-relaxed">
          {seo.description}
        </p>

        {/* ── Areas covered — the long-tail neighbourhood names ─────────── */}
        {areaList?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[13px] font-black text-gray-900 mb-2.5">
              {bn ? `${placeName} এর জনপ্রিয় এলাকা` : `Popular areas in ${placeName}`}
            </h3>
            <div className="flex flex-wrap gap-2">
              {areaList.slice(0, 10).map((area) => (
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

        {/* ── Neighbouring districts ────────────────────────────────────── */}
        {neighbours.length > 0 && (
          <div className="mt-9">
            <h3 className="text-[13px] font-black text-gray-900 mb-2.5">
              {isDistrict
                ? (bn ? `${seo.divisionBn || seo.divisionEn} বিভাগের অন্য জেলা` : `Other districts in ${seo.divisionEn}`)
                : (bn ? `${placeName} বিভাগের জেলাসমূহ` : `Districts of ${placeName}`)}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {neighbours.map((d) => (
                <li key={d.id}>
                  <Link
                    to={districtPath(d.id)}
                    className="inline-block px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-gray-600 hover:border-[#ba0036] hover:text-[#ba0036] transition-colors"
                    title={bn ? `${d.en} বাসা ভাড়া` : `House rent in ${d.en}`}
                  >
                    {bn ? d.bn : d.en}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/to-let"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ba0036] text-white text-[11px] font-black hover:bg-[#a1002f] transition-colors"
                >
                  {bn ? 'সব জেলা' : 'All districts'} <ChevronRight size={11} />
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
