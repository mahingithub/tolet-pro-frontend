/**
 * schema.js — JSON-LD builders (schema.org).
 * ─────────────────────────────────────────────────────────────────────────────
 * Structured data is how a listing earns a rich result — the price, the
 * bed/bath count and the star rating that make a TO-LET PRO row twice the
 * height of the plain blue links around it — and how Google learns that this
 * site is one organisation with a search box rather than a pile of URLs.
 *
 * Every builder returns a plain object. Pass one, or an array of them, to
 * `useSeo({ jsonLd })`. Node-side scripts import these too, so nothing here may
 * touch `window`.
 */

import {
  SITE_URL, BRAND, BRAND_BN, ORG_NAME, LOGO_URL, OG_IMAGE,
  CONTACT_PHONE, SOCIAL_PROFILES, PLAY_STORE_URL, ANDROID_APP_ID, absoluteUrl,
} from './siteConfig';

/** Strip undefined/empty keys — Google warns about empty properties. */
const clean = (obj) => {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' ) return;
    if (Array.isArray(v) && v.length === 0) return;
    out[k] = v;
  });
  return out;
};

/* ── site-wide (emitted once, from index.html) ───────────────────────────── */

export const organizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: ORG_NAME,
  alternateName: [BRAND_BN, 'ToLet Pro', 'Tolet Pro Bangladesh'],
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 512 },
  image: OG_IMAGE,
  description:
    'TO-LET PRO is a Bangladeshi house rent marketplace and house management app — '
    + 'find to-let flats, rooms, seats and mess in all 64 districts, and manage rent, '
    + 'tenants, meals and shared expenses in one place.',
  areaServed: { '@type': 'Country', name: 'Bangladesh' },
  address: { '@type': 'PostalAddress', addressCountry: 'BD' },
  contactPoint: [{
    '@type': 'ContactPoint',
    telephone: CONTACT_PHONE,
    contactType: 'customer support',
    areaServed: 'BD',
    availableLanguage: ['bn', 'en'],
  }],
  sameAs: SOCIAL_PROFILES,
});

/**
 * WebSite + SearchAction. If Google honours it, TO-LET PRO gets its own search
 * box directly in the results page — the sitelinks searchbox.
 */
export const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: BRAND,
  alternateName: BRAND_BN,
  inLanguage: ['bn-BD', 'en-BD'],
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/properties/all?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
});

/** The Android app — lets the Play Store listing and the site reinforce each other. */
export const appSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: BRAND,
  operatingSystem: 'Android',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Real Estate',
  installUrl: PLAY_STORE_URL,
  downloadUrl: PLAY_STORE_URL,
  identifier: ANDROID_APP_ID,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BDT' },
  description:
    'Find to-let houses across Bangladesh and manage rent, tenants, meals and '
    + 'roommate expenses from one app.',
});

/* ── per-page ────────────────────────────────────────────────────────────── */

/**
 * Breadcrumbs. Google renders these instead of the raw URL under the title,
 * which is the difference between "www.toletpro.rent › properties › dhaka"
 * and an unreadable slug.
 * @param {{name: string, path: string}[]} trail
 */
export const breadcrumbSchema = (trail = []) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((crumb, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: crumb.name,
    item: absoluteUrl(crumb.path),
  })),
});

/** @param {{q: string, a: string}[]} items */
export const faqSchema = (items = []) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

/**
 * A single rental listing. `Accommodation` + an `Offer` is the pairing Google
 * understands for a place you can rent (`RealEstateListing` alone carries no
 * price), so we emit both, joined by @id.
 */
export const propertySchema = (p, { url, images = [] } = {}) => {
  if (!p) return null;
  const pageUrl = absoluteUrl(url || `/property/${p.id || p._id || ''}`);
  const areaLabel = [p.area, p.thana, p.district, p.division]
    .filter(Boolean).join(', ');

  const accommodationType = {
    flat: 'Apartment', apartment: 'Apartment', room: 'Room',
    house: 'House', duplex: 'House', office: 'Accommodation',
  }[String(p.type || '').toLowerCase()] || 'Accommodation';

  return {
    '@context': 'https://schema.org',
    '@type': ['Product', accommodationType],
    '@id': `${pageUrl}#listing`,
    name: p.title,
    description: (p.description || '').slice(0, 500) || `${p.title} — ${areaLabel}`,
    url: pageUrl,
    image: images.length ? images : [p.coverPhoto || OG_IMAGE],
    ...clean({
      numberOfBedrooms: p.beds || undefined,
      numberOfBathroomsTotal: p.baths || undefined,
      floorSize: p.sqft
        ? { '@type': 'QuantitativeValue', value: p.sqft, unitCode: 'FTK' }
        : undefined,
      accommodationCategory: p.category || undefined,
      amenityFeature: (p.amenities || []).slice(0, 20).map((a) => ({
        '@type': 'LocationFeatureSpecification', name: a, value: true,
      })),
    }),
    address: clean({
      '@type': 'PostalAddress',
      streetAddress: p.address || p.location || undefined,
      addressLocality: p.thana || p.district || undefined,
      addressRegion: p.district || p.division || undefined,
      addressCountry: 'BD',
    }),
    ...(p.gps?.lat && p.gps?.lng ? {
      geo: { '@type': 'GeoCoordinates', latitude: p.gps.lat, longitude: p.gps.lng },
    } : {}),
    offers: clean({
      '@type': 'Offer',
      price: Number(p.price) || undefined,
      priceCurrency: 'BDT',
      availability: (p.status === 'rented' || p.status === 'sold')
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: pageUrl,
      // A rent price is per month; without this a crawler reads it as a sale price.
      ...(p.intent === 'sell' ? {} : {
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: Number(p.price) || 0,
          priceCurrency: 'BDT',
          unitCode: 'MON',
        },
      }),
    }),
    ...(Number(p.rating) > 0 && Number(p.reviews) > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(p.rating),
        reviewCount: Number(p.reviews),
      },
    } : {}),
  };
};

/**
 * A district/division results page as an ItemList. Gives Google the listing
 * order it would otherwise have to guess from the DOM.
 */
export const listingCollectionSchema = ({ name, description, url, items = [] }) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  description,
  url: absoluteUrl(url),
  isPartOf: { '@id': `${SITE_URL}/#website` },
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/property/${p.id || p._id}`),
      name: p.title,
    })),
  },
});

/** A feature landing page (meal manager, roommate wallet, …) as a Service. */
export const serviceSchema = ({ name, description, url, serviceType }) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name,
  description,
  serviceType,
  url: absoluteUrl(url),
  provider: { '@id': `${SITE_URL}/#organization` },
  areaServed: { '@type': 'Country', name: 'Bangladesh' },
  availableChannel: {
    '@type': 'ServiceChannel',
    serviceUrl: absoluteUrl(url),
    availableLanguage: ['bn', 'en'],
  },
});

/** Generic article/how-to style page. */
export const webPageSchema = ({ name, description, url, breadcrumb }) => clean({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name,
  description,
  url: absoluteUrl(url),
  isPartOf: { '@id': `${SITE_URL}/#website` },
  inLanguage: 'bn-BD',
  breadcrumb,
});
