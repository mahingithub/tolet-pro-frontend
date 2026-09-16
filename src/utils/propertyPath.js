/**
 * propertyPath.js — the one URL a listing lives at.
 * ──────────────────────────────────────────────────────────────────────────
 * The readable slug ("ma-bhila-8fc902") when the listing has one, and the id
 * otherwise. The model builds a slug on save, so every live listing has one;
 * the id fallback is for anything older or anything a caller built by hand.
 *
 * The API resolves either form (findIdOrSlug in the backend's
 * property.service.js), so links already shared with an id keep working — and
 * the listing page's canonical names this path, so search engines fold both
 * into one URL instead of splitting a listing's ranking across two.
 */
export const propertyPath = (p) =>
  `/property/${encodeURIComponent(p?.slug || p?.id || p?._id || '')}`;
