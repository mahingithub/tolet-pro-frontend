// src/constants/geoCentroids.js
//
// ─── APPROXIMATE MAP COORDINATES ─────────────────────────────────────────────
// Many listings are created without precise GPS (the "use my location" step in
// Add Property is optional), so `gpsLat/gpsLng` come back empty. The map only
// plots listings that have coordinates, which meant those listings were
// invisible on the map even though they showed fine in the list.
//
// This module provides a graceful fallback: given a listing's location
// hierarchy (area / thana / district / division) we resolve an APPROXIMATE
// coordinate from a small centroid table so the listing still appears on the
// map near where it actually is. A tiny, deterministic per-listing jitter keeps
// multiple coordinate-less listings in the same area from stacking on the exact
// same pixel (so supercluster can still separate them as you zoom in).
//
// These are intentionally coarse "good enough to show a pin" centroids, not
// survey-grade coordinates. A listing WITH real GPS always uses its real
// coordinates — this table is only a fallback.

export const DIVISION_CENTROIDS = {
	dhaka:      { lat: 23.8103, lng: 90.4125 },
	chittagong: { lat: 22.3569, lng: 91.7832 },
	chattogram: { lat: 22.3569, lng: 91.7832 },
	sylhet:     { lat: 24.8949, lng: 91.8687 },
	rajshahi:   { lat: 24.3745, lng: 88.6042 },
	khulna:     { lat: 22.8456, lng: 89.5403 },
	barishal:   { lat: 22.7010, lng: 90.3535 },
	barisal:    { lat: 22.7010, lng: 90.3535 },
	rangpur:    { lat: 25.7439, lng: 89.2752 },
	mymensingh: { lat: 24.7471, lng: 90.4203 },
};

// Well-known area / thana centroids (mostly Dhaka, plus a few major cities).
// Keys are lowercase and matched by substring against the listing's
// area/thana/location, so "Dhanmondi 9A" still resolves via "dhanmondi".
export const AREA_CENTROIDS = {
	// ── Dhaka ──
	dhanmondi:    { lat: 23.7461, lng: 90.3742 },
	gulshan:      { lat: 23.7925, lng: 90.4078 },
	banani:       { lat: 23.7936, lng: 90.4043 },
	baridhara:    { lat: 23.8103, lng: 90.4256 },
	bashundhara:  { lat: 23.8203, lng: 90.4370 },
	uttara:       { lat: 23.8759, lng: 90.3795 },
	mirpur:       { lat: 23.8223, lng: 90.3654 },
	mohammadpur:  { lat: 23.7660, lng: 90.3585 },
	motijheel:    { lat: 23.7330, lng: 90.4172 },
	tejgaon:      { lat: 23.7639, lng: 90.3927 },
	badda:        { lat: 23.7807, lng: 90.4266 },
	rampura:      { lat: 23.7615, lng: 90.4185 },
	khilgaon:     { lat: 23.7508, lng: 90.4256 },
	mohakhali:    { lat: 23.7783, lng: 90.4051 },
	shyamoli:     { lat: 23.7726, lng: 90.3597 },
	lalmatia:     { lat: 23.7570, lng: 90.3665 },
	farmgate:     { lat: 23.7583, lng: 90.3899 },
	wari:         { lat: 23.7186, lng: 90.4207 },
	lalbagh:      { lat: 23.7190, lng: 90.3880 },
	mugda:        { lat: 23.7375, lng: 90.4330 },
	jatrabari:    { lat: 23.7104, lng: 90.4340 },
	savar:        { lat: 23.8583, lng: 90.2667 },
	'old dhaka':  { lat: 23.7104, lng: 90.4074 },
	// ── Chattogram ──
	agrabad:      { lat: 22.3269, lng: 91.8100 },
	nasirabad:    { lat: 22.3600, lng: 91.8200 },
	khulshi:      { lat: 22.3600, lng: 91.8100 },
	// ── Sylhet ──
	zindabazar:   { lat: 24.8975, lng: 91.8712 },
};

// Districts whose centroid differs usefully from their division centroid.
// (Districts that share a division's name fall through to DIVISION_CENTROIDS.)
export const DISTRICT_CENTROIDS = {
	gazipur:      { lat: 23.9999, lng: 90.4203 },
	narayanganj:  { lat: 23.6238, lng: 90.5000 },
	comilla:      { lat: 23.4607, lng: 91.1809 },
	'cox\'s bazar': { lat: 21.4272, lng: 92.0058 },
	coxs_bazar:   { lat: 21.4272, lng: 92.0058 },
	bogura:       { lat: 24.8465, lng: 89.3773 },
	jessore:      { lat: 23.1667, lng: 89.2081 },
};

// Deterministic ±~0.005° (~500m) jitter derived from a stable id, so several
// coordinate-less listings in the same area spread out instead of overlapping.
function jitterFromId(seed) {
	const s = String(seed || '');
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	h = h >>> 0;
	const jx = (((h & 0xffff) / 0xffff) - 0.5) * 0.010;        // lng
	const jy = ((((h >>> 16) & 0xffff) / 0xffff) - 0.5) * 0.010; // lat
	return { jx, jy };
}

const norm = (v) => String(v || '').toLowerCase().trim();

/**
 * How specific the resolved centroid actually is. Callers that only need a pin
 * on a cluster map can ignore this, but anything that makes a factual CLAIM
 * about the surroundings must check it: an `area` match is a real neighbourhood
 * and its surroundings are genuinely the listing's surroundings, whereas a
 * `division` match can be 100 km away and says nothing useful.
 *
 * Ordered loosest-last.
 */
export const PRECISION = {
	EXACT: 'exact',       // the listing's own GPS
	AREA: 'area',         // matched a known area/thana centroid (~1-2 km)
	DISTRICT: 'district', // matched a district centroid (~10-20 km)
	DIVISION: 'division', // matched only a division centroid (can be 100 km+)
	NONE: 'none',         // nothing matched; Dhaka as a last resort
};

/** Precision levels close enough to describe a listing's actual surroundings. */
export const USABLE_FOR_SURROUNDINGS = new Set([PRECISION.EXACT, PRECISION.AREA, PRECISION.DISTRICT]);

/**
 * Resolve an approximate coordinate for a listing that has no precise GPS.
 * Priority: known area/thana → known district → division → Dhaka (last resort).
 * Returns null only when given nothing at all.
 *
 * @returns {{lat:number, lng:number, approximate:true, precision:string,
 *            centroid:{lat:number,lng:number}}}
 *   `lat`/`lng` carry the deterministic jitter, for spreading pins on a map.
 *   `centroid` is the UN-jittered centre — use that for anything cacheable or
 *   analytical, since jitter would scatter identical areas across different
 *   cache cells for no benefit.
 */
export function resolveApproxCoords(property) {
	if (!property) return null;

	const haystack = [property.area, property.thana, property.location, property.address]
		.map(norm)
		.join(' ');

	let base = null;
	let precision = PRECISION.NONE;

	// 1) Area / thana (substring match so "dhanmondi 9a" → "dhanmondi").
	if (haystack) {
		for (const key of Object.keys(AREA_CENTROIDS)) {
			if (haystack.includes(key)) { base = AREA_CENTROIDS[key]; precision = PRECISION.AREA; break; }
		}
	}

	// 2) District (exact-ish).
	if (!base) {
		const d = norm(property.district);
		if (d) {
			base = DISTRICT_CENTROIDS[d] || AREA_CENTROIDS[d] || null;
			if (base) precision = PRECISION.DISTRICT;
			else if (DIVISION_CENTROIDS[d]) { base = DIVISION_CENTROIDS[d]; precision = PRECISION.DIVISION; }
		}
	}

	// 3) Division.
	if (!base) {
		const div = norm(property.division);
		if (div && DIVISION_CENTROIDS[div]) { base = DIVISION_CENTROIDS[div]; precision = PRECISION.DIVISION; }
	}

	// 4) Last resort: centre of Dhaka so the pin is at least visible.
	if (!base) { base = DIVISION_CENTROIDS.dhaka; precision = PRECISION.NONE; }

	const { jx, jy } = jitterFromId(property.id || property._id || haystack);
	return {
		lat: base.lat + jy,
		lng: base.lng + jx,
		approximate: true,
		precision,
		centroid: { lat: base.lat, lng: base.lng },
	};
}

/**
 * Effective map coordinate for a listing: its real GPS when present, otherwise
 * the approximate fallback. Returns { lat, lng, approximate, precision } or null.
 */
export function effectiveCoords(property) {
	if (!property) return null;
	const lat = Number(property.lat);
	const lng = Number(property.lng);
	if (property.lat != null && property.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
		return { lat, lng, approximate: false, precision: PRECISION.EXACT, centroid: { lat, lng } };
	}
	return resolveApproxCoords(property);
}
