// src/constants/filterConfig.js
//
// ─── SINGLE SOURCE OF TRUTH FOR INTENT-AWARE FILTERS ─────────────────────────
// Every filter option the PropertyListing panel shows — budget pills/sliders,
// property types, "who lives" categories, sub-categories, amenities and the
// conditional-section flags — is defined here, per listing intent
// (rent / sale / commercial). PropertyListing.jsx reads this config and renders
// the UI; it owns NO filter data of its own. This keeps DATA (what to show)
// separate from PRESENTATION (how to show it) — the core goal of Requirement 1.
//
// The module is intentionally UI-agnostic: NO React, NO lucide imports. Category
// icons are stored as plain string keys (e.g. "home", "user") and mapped to
// lucide components inside PropertyListing.jsx via a small ICON_MAP. That lets
// this config be imported and unit/property-tested without a React renderer.
//
// Filter identifiers (type ids + `match` aliases, category ids, sub-category
// ids) are chosen to match the canonical values persisted on the backend
// Property model, so applying a filter actually narrows the result set
// (Requirement 12.5).

import { normaliseIntent } from './listingIntents';

// Numeric unit boundaries for Bangla money formatting.
const THOUSAND = 1000;
const LAKH = 100000; // ১,০০,০০০
const CRORE = 10000000; // ১,০০,০০,০০০

// ─── PER-INTENT FILTER CONFIG ────────────────────────────────────────────────
// Shape (see design "Data Models"):
//   {
//     intent, labelBn, priceLabel,
//     budgetPills:  [{ id, labelBn, min, max }],
//     budgetSlider: { min, max, step },
//     sqftSlider:   { min, max, step },
//     propertyTypes:[{ id, labelBn, match?, hideUnitDetails? }],
//     categories:   [{ id, labelBn, icon }],   // rent "who lives" only
//     subCategories:{ [type]: [{ id, labelBn }] },
//     amenities:    [{ id, labelBn }],
//     showWhoLives, showBedBath, showFurnishing, showFireSafety,
//   }
export const FILTER_CONFIG = {
	// ─── RENT (ভাড়া) ────────────────────────────────────────────────────────
	rent: {
		intent: 'rent',
		labelBn: 'ভাড়া',
		labelEn: 'Rent',
		priceLabel: 'প্রতি মাসে',
		priceLabelEn: 'Per Month',
		budgetSlider: { min: 0, max: 300000, step: 1000 },
		sqftSlider: { min: 500, max: 4000, step: 100 },
		budgetPills: [
			{ id: 'u5', labelBn: '৳৫,০০০-এর নিচে', labelEn: 'Under ৳5,000', min: 0, max: 5000 },
			{ id: '5_15', labelBn: '৳৫,০০০–৳১৫,০০০', labelEn: '৳5,000–৳15,000', min: 5000, max: 15000 },
			{ id: '15_25', labelBn: '৳১৫,০০০–৳২৫,০০০', labelEn: '৳15,000–৳25,000', min: 15000, max: 25000 },
			{ id: '25_40', labelBn: '৳২৫,০০০–৳৪০,০০০', labelEn: '৳25,000–৳40,000', min: 25000, max: 40000 },
			{ id: '40_60', labelBn: '৳৪০,০০০–৳৬০,০০০', labelEn: '৳40,000–৳60,000', min: 40000, max: 60000 },
			{ id: 'a60', labelBn: '৳৬০,০০০-এর উপরে', labelEn: 'Above ৳60,000', min: 60000, max: 300000 },
		],
		propertyTypes: [
			{ id: 'flat', labelBn: 'ফ্ল্যাট / অ্যাপার্টমেন্ট', labelEn: 'Flat / Apartment', match: ['flat', 'apartment'] },
			{ id: 'sublet', labelBn: 'সাবলেট / রুম', labelEn: 'Sublet / Room' },
			{ id: 'hostel', labelBn: 'হোস্টেল', labelEn: 'Hostel' },
			{ id: 'single_room', labelBn: 'সিঙ্গেল রুম', labelEn: 'Single Room' },
		],
		categories: [
			{ id: 'family', labelBn: 'ফ্যামিলি', labelEn: 'Family', icon: 'home' },
			{ id: 'bachelor_male', labelBn: 'ব্যাচেলর (পুরুষ)', labelEn: 'Bachelor (Male)', icon: 'user' },
			{ id: 'bachelor_female', labelBn: 'ব্যাচেলর (মহিলা)', labelEn: 'Bachelor (Female)', icon: 'users' },
			{ id: 'student_male', labelBn: 'ছাত্র', labelEn: 'Student (Male)', icon: 'book' },
			{ id: 'student_female', labelBn: 'ছাত্রী', labelEn: 'Student (Female)', icon: 'book' },
		],
		subCategories: {},
		amenities: [
			{ id: 'parking', labelBn: 'পার্কিং' },
			{ id: 'elevator', labelBn: 'লিফট' },
			{ id: 'cctv', labelBn: 'CCTV' },
			{ id: 'generator', labelBn: 'জেনারেটর' },
			{ id: 'ac', labelBn: 'AC' },
		],
		showWhoLives: true,
		showBedBath: true,
		showFurnishing: true,
		showFireSafety: false,
	},

	// ─── SALE (ক্রয়) ─────────────────────────────────────────────────────────
	sale: {
		intent: 'sale',
		labelBn: 'ক্রয়',
		labelEn: 'Buy',
		priceLabel: 'মোট মূল্য',
		priceLabelEn: 'Total Price',
		budgetSlider: { min: 0, max: 100000000, step: 100000 },
		sqftSlider: { min: 500, max: 10000, step: 100 },
		budgetPills: [
			{ id: 'u20L', labelBn: '৳২০ লাখের নিচে', labelEn: 'Under ৳20 Lakh', min: 0, max: 2000000 },
			{ id: '20_50L', labelBn: '৳২০–৳৫০ লাখ', labelEn: '৳20–৳50 Lakh', min: 2000000, max: 5000000 },
			{ id: '50L_1C', labelBn: '৳৫০ লাখ–৳১ কোটি', labelEn: '৳50 Lakh–৳1 Crore', min: 5000000, max: 10000000 },
			{ id: '1_3C', labelBn: '৳১–৳৩ কোটি', labelEn: '৳1–৳3 Crore', min: 10000000, max: 30000000 },
			{ id: 'a3C', labelBn: '৳৩ কোটির উপরে', labelEn: 'Above ৳3 Crore', min: 30000000, max: 100000000 },
		],
		propertyTypes: [
			{ id: 'flat', labelBn: 'ফ্ল্যাট / অ্যাপার্টমেন্ট', labelEn: 'Flat / Apartment', match: ['flat', 'apartment'] },
			{ id: 'house', labelBn: 'ইন্ডিপেন্ডেন্ট হাউজ', labelEn: 'Independent House', match: ['house', 'independent'] },
			{ id: 'land', labelBn: 'জমি / প্লট', labelEn: 'Land / Plot', hideUnitDetails: true },
			{ id: 'building', labelBn: 'বিল্ডিং', labelEn: 'Building' },
			{ id: 'shop', labelBn: 'দোকান', labelEn: 'Shop' },
			{ id: 'restaurant', labelBn: 'রেস্তোরাঁ', labelEn: 'Restaurant' },
		],
		categories: [],
		subCategories: {
			flat: [
				{ id: 'ready_flat', labelBn: 'রেডি', labelEn: 'Ready' },
				{ id: 'used', labelBn: 'ইউজড', labelEn: 'Used' },
				{ id: 'new_project', labelBn: 'নতুন প্রজেক্ট', labelEn: 'New Project' },
			],
			house: [
				{ id: 'duplex', labelBn: 'ডুপ্লেক্স', labelEn: 'Duplex' },
				{ id: 'triplex', labelBn: 'ট্রিপ্লেক্স', labelEn: 'Triplex' },
				{ id: 'single_story', labelBn: 'সিঙ্গেল', labelEn: 'Single Story' },
			],
			land: [
				{ id: 'residential', labelBn: 'আবাসিক', labelEn: 'Residential' },
				{ id: 'commercial', labelBn: 'বাণিজ্যিক', labelEn: 'Commercial' },
				{ id: 'agricultural', labelBn: 'কৃষি', labelEn: 'Agricultural' },
				{ id: 'road_side', labelBn: 'রাস্তার পাশে', labelEn: 'Road Side' },
			],
		},
		amenities: [
			{ id: 'parking', labelBn: 'পার্কিং' },
			{ id: 'elevator', labelBn: 'লিফট' },
			{ id: 'cctv', labelBn: 'CCTV' },
			{ id: 'generator', labelBn: 'জেনারেটর' },
			{ id: 'ac', labelBn: 'AC' },
		],
		showWhoLives: false,
		showBedBath: true,
		showFurnishing: true,
		showFireSafety: false,
	},

	// ─── COMMERCIAL (বাণিজ্যিক) ───────────────────────────────────────────────
	commercial: {
		intent: 'commercial',
		labelBn: 'বাণিজ্যিক',
		labelEn: 'Commercial',
		priceLabel: 'প্রতি মাসে',
		priceLabelEn: 'Per Month',
		budgetSlider: { min: 0, max: 1000000, step: 5000 },
		sqftSlider: { min: 200, max: 20000, step: 100 },
		budgetPills: [
			{ id: 'u15', labelBn: '৳১৫,০০০-এর নিচে', labelEn: 'Under ৳15,000', min: 0, max: 15000 },
			{ id: '15_50', labelBn: '৳১৫,০০০–৳৫০,০০০', labelEn: '৳15,000–৳50,000', min: 15000, max: 50000 },
			{ id: '50_1L', labelBn: '৳৫০,০০০–৳১,০০,০০০', labelEn: '৳50,000–৳1,00,000', min: 50000, max: 100000 },
			{ id: '1L_3L', labelBn: '৳১,০০,০০০–৳৩,০০,০০০', labelEn: '৳1,00,000–৳3,00,000', min: 100000, max: 300000 },
			{ id: 'a3L', labelBn: '৳৩,০০,০০০-এর উপরে', labelEn: 'Above ৳3,00,000', min: 300000, max: 1000000 },
		],
		propertyTypes: [
			{ id: 'office', labelBn: 'অফিস স্পেস', labelEn: 'Office Space' },
			{ id: 'shop', labelBn: 'দোকান / রিটেইল', labelEn: 'Shop / Retail' },
			{ id: 'showroom', labelBn: 'শোরুম', labelEn: 'Showroom' },
			{ id: 'restaurant', labelBn: 'রেস্তোরাঁ স্পেস', labelEn: 'Restaurant Space' },
			{ id: 'warehouse', labelBn: 'ওয়্যারহাউজ', labelEn: 'Warehouse' },
		],
		categories: [],
		subCategories: {
			office: [
				{ id: 'corporate', labelBn: 'কর্পোরেট', labelEn: 'Corporate' },
				{ id: 'startup', labelBn: 'স্টার্টআপ', labelEn: 'Startup' },
				{ id: 'co_working', labelBn: 'কো-ওয়ার্কিং', labelEn: 'Co-working' },
			],
			shop: [
				{ id: 'retail', labelBn: 'রিটেইল', labelEn: 'Retail' },
				{ id: 'wholesale', labelBn: 'হোলসেল', labelEn: 'Wholesale' },
				{ id: 'showroom', labelBn: 'শোরুম', labelEn: 'Showroom' },
			],
			restaurant: [
				{ id: 'fast_food', labelBn: 'ফাস্ট ফুড', labelEn: 'Fast Food' },
				{ id: 'dine_in', labelBn: 'ডাইন ইন', labelEn: 'Dine-in' },
				{ id: 'cafe', labelBn: 'ক্যাফে', labelEn: 'Cafe' },
			],
		},
		amenities: [
			{ id: 'parking', labelBn: 'পার্কিং' },
			{ id: 'elevator', labelBn: 'লিফট' },
			{ id: 'cctv', labelBn: 'CCTV' },
			{ id: 'generator', labelBn: 'জেনারেটর' },
			{ id: 'ac', labelBn: 'AC' },
			{ id: 'backup_power', labelBn: 'ব্যাকআপ পাওয়ার' },
		],
		showWhoLives: false,
		showBedBath: false,
		showFurnishing: false,
		showFireSafety: true,
	},
};

// ─── PUBLIC HELPERS (pure, UI-agnostic) ──────────────────────────────────────

// Requirement 1.3, 1.4 — a valid intent returns its full config; unknown/blank
// (and legacy aliases) fall back to `rent` via normaliseIntent, so the UI can
// never crash on an undefined config.
export function getFilterConfig(intent) {
	return FILTER_CONFIG[normaliseIntent(intent)];
}

// Requirement 1.5, 1.6, 7.2, 7.3, 7.4 — sub-category list for (intent, type).
// Always returns an array; empty when no sub-categories are defined for `type`.
export function getSubCategories(intent, type) {
	const cfg = getFilterConfig(intent);
	return (cfg.subCategories && cfg.subCategories[type]) || [];
}

// Requirement 3.1–3.4 — the initial filter state for an intent (Filter_Defaults).
// Both "switch intent tab" and "clear all" produce exactly this state.
export function getFilterDefaults(intent) {
	const cfg = getFilterConfig(intent);
	return {
		minPrice: cfg.budgetSlider.min,
		maxPrice: cfg.budgetSlider.max,
		maxSqft: cfg.sqftSlider.max,
		selectedTypes: [],
		selectedCategories: [],
		selectedSubCategories: [],
		selectedBeds: 'any',
		selectedBaths: 'any',
		selectedFurnish: '',
		selectedAmenities: [],
		selectedFireSafety: '',
	};
}

// Trim insignificant decimals for display: 2.50 → "2.5", 20.0 → "20", 2.567 → "2.57".
function trimNumber(n) {
	return parseFloat(Number(n).toFixed(2)).toString();
}

// Requirement 5.1–5.4 — format a number into a readable Bangla budget string.
//   sale:            ≥1 কোটি → "৳{n} কোটি"; ≥1 লাখ → "৳{n} লাখ"; else "৳{n}"
//   rent/commercial: ≥1 লাখ → "৳{n} লাখ";  ≥1000 → "৳{n}k";     else "৳{n}"
export function formatBudget(value, intent) {
	const v = Number(value) || 0;
	if (normaliseIntent(intent) === 'sale') {
		if (v >= CRORE) return `৳${trimNumber(v / CRORE)} কোটি`;
		if (v >= LAKH) return `৳${trimNumber(v / LAKH)} লাখ`;
		return `৳${trimNumber(v)}`;
	}
	if (v >= LAKH) return `৳${trimNumber(v / LAKH)} লাখ`;
	if (v >= THOUSAND) return `৳${trimNumber(v / THOUSAND)}k`;
	return `৳${trimNumber(v)}`;
}

// Requirement 4.7 — a Budget_Pill is active when its bounds equal the currently
// selected price range.
export function isPillActive(pill, minPrice, maxPrice) {
	return !!pill && pill.min === minPrice && pill.max === maxPrice;
}

// Requirement 8, 9, 10, 11.7, 11.8 — derive each conditional section's
// visibility from the intent config flags, applying the sale→land override that
// force-hides bed/bath, furnishing and floor (hideUnitDetails).
export function resolveSections(intent, selectedType) {
	const cfg = getFilterConfig(intent);
	const typeCfg = cfg.propertyTypes.find((t) => t.id === selectedType) || null;
	const hideUnitDetails = !!(typeCfg && typeCfg.hideUnitDetails);
	return {
		showWhoLives: cfg.showWhoLives,
		showBedBath: cfg.showBedBath && !hideUnitDetails,
		showFurnishing: cfg.showFurnishing && !hideUnitDetails,
		showFireSafety: cfg.showFireSafety,
		showFloor: !hideUnitDetails,
	};
}

// Requirement 12.1–12.5 — pure predicate: does a property satisfy the active
// filter state? Combines the intent guard, type-alias match, price range,
// category/sub-category membership and the commercial fire-safety gate. Uses
// safe access so a property missing a field is simply excluded (never throws).
export function propertyMatchesFilters(property, filterState) {
	if (!property || !filterState) return false;

	const {
		intent,
		selectedTypes = [],
		minPrice,
		maxPrice,
		selectedCategories = [],
		selectedSubCategories = [],
		selectedFireSafety = '',
	} = filterState;

	// Requirement 12.1 — intent guard (final client-side gate).
	if (property.intent !== intent) return false;

	// Requirement 12.2, 12.5 — type match via alias list (flat↔apartment, house↔independent).
	if (selectedTypes.length > 0) {
		const cfg = getFilterConfig(intent);
		const matched = selectedTypes.some((typeId) => {
			const typeCfg = cfg.propertyTypes.find((t) => t.id === typeId);
			const aliases = (typeCfg && typeCfg.match) || [typeId];
			return aliases.includes(property.type);
		});
		if (!matched) return false;
	}

	// Requirement 12.3 — price range.
	if (property.price < minPrice || property.price > maxPrice) return false;

	// Requirement 7 / 12.5 — rent "who lives" category (stored as rentalCategory).
	if (selectedCategories.length > 0 && !selectedCategories.includes(property.rentalCategory)) return false;

	// Requirement 7 / 12.5 — sale/commercial sub-category (also rentalCategory).
	if (selectedSubCategories.length > 0 && !selectedSubCategories.includes(property.rentalCategory)) return false;

	// Requirement 12.4 — commercial fire-safety gate (only when "yes" selected).
	if (intent === 'commercial' && selectedFireSafety === 'yes') {
		if (!(property.specificDetails && property.specificDetails.fireSafety === true)) return false;
	}

	return true;
}
