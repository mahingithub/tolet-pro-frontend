import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import useGoBack from "../hooks/useGoBack";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Search, MapPin, BedDouble, Bath, Square, Heart, Star, X, ChevronRight, ShieldCheck, ChevronDown, ChevronUp, Filter, Ruler, Navigation, CheckCircle2, Flame, Building, Wifi, Map, List, LayoutGrid, Home, Users, User, BookOpen, Share2, MessageCircle, ArrowLeft, SlidersHorizontal, ArrowUpDown, Camera, Layers, Crosshair, Loader2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
// ─── SHARED INQUIRY MODAL (single source of truth for the inquiry flow) ───────
import InquiryModal from "./InquiryModal";
// ─── DATA SOURCE: live properties (API + user uploads). NO demo data. ─────────
import { propertyService, subscribeUserProperties, propertyLocationHaystack } from "../services/Propertyservice.js";
import usePropertyStore from "../store/usePropertyStore";
import { normaliseIntent, SALE_INTENT_ENABLED } from "../constants/listingIntents";
import { roomLabel } from "../constants/roomCategories";
// Beds/baths only apply to residential listings — commercial & land must not
// show phantom bed/bath chips (shared rule, same one the detail page uses).
import { hasBedsBaths } from "../constants/propertyFields";
// ─── INTENT-AWARE FILTER CONFIG (single source of truth for all filter data) ──
import {
	getFilterConfig,
	getSubCategories,
	getFilterDefaults,
	formatBudget,
	propertyMatchesFilters,
	resolveSections,
	isPillActive,
} from "../constants/filterConfig";

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  GOOGLE MAPS                                                            ║
// ║                                                                         ║
// ║  Install once at the project root:                                      ║
// ║      npm i @react-google-maps/api                                       ║
// ║                                                                         ║
// ║  Add a Maps JavaScript API key to .env (depending on your bundler):     ║
// ║      Vite : VITE_GOOGLE_MAPS_API_KEY=AIza...                            ║
// ║      CRA  : REACT_APP_GOOGLE_MAPS_API_KEY=AIza...                       ║
// ║                                                                         ║
// ║  Behaviour:                                                             ║
// ║    • If the key is present → interactive Google Map with custom price   ║
// ║      chip markers and click → MapMiniCard popup (matches the design     ║
// ║      reference videos for desktop & mobile).                            ║
// ║    • If the key is missing → graceful iframe fallback so dev work isn't ║
// ║      blocked. This uses the public /maps embed (no key required).       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import useSupercluster from "use-supercluster";
// ─── MODERNISED MAP UI (clustering + animated markers + bottom sheet) ─────────
import MapMarker from "./MapMarker";
import ClusterMarker from "./ClusterMarker";
import BottomSheetCard from "./BottomSheetCard";

// Pull the API key from whichever bundler the host project uses. Comment the
// line that does NOT match your build tool — the other line stays.
const GOOGLE_MAPS_API_KEY =
	(typeof import.meta !== "undefined" && import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY) ||
	(typeof process !== "undefined" && process?.env?.REACT_APP_GOOGLE_MAPS_API_KEY) ||
	"AIzaSyC9xWNjjSPhxy2aUWLubPqHR7N6KZWmKlg";

// Google Maps libraries. MUST be a stable reference AND identical to every other
// useJsApiLoader call that shares the "tlp-google-map-script" id. PropertyDetails
// and AddProperty both pass `[]`, so we match them exactly:
// @react-google-maps/api keeps ONE Loader per id and THROWS "Loader must not be
// called again with different options" if a later call passes a different
// `libraries` value. Omitting the prop defaults it to ['maps'], which mismatches
// `[]` and crashed the app when navigating between the map and a property page.
const GOOGLE_MAPS_LIBRARIES = [];

// Default centre — middle of Dhaka. Override via the prop on <MapView />.
const DEFAULT_MAP_CENTER = { lat: 23.7652, lng: 90.3893 };
const DEFAULT_MAP_ZOOM = 12;

// Light, Voyager-like map styling that mirrors the reference screenshots.
const MAP_STYLES = [
	{ featureType: "poi.business", stylers: [{ visibility: "off" }] },
	{ featureType: "poi.attraction", elementType: "labels", stylers: [{ visibility: "off" }] },
	{ featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

// ─── DATA SOURCE ──────────────────────────────────────────────────────────────
// Listings now come from propertyService. No demo / hard-coded properties live
// in this file anymore — the only properties that ever render are:
//   • whatever the API returns  ← preferred when backend is reachable
//   • whatever real hosts have uploaded through the Add Property wizard
//     (persisted to localStorage[`properties:user`])
// Empty array = no host has uploaded yet, which is exactly the "fresh install"
// state we want to show new users.

// ─── RENTAL CATEGORY CONFIG ──────────────────────────────────────────────────
// ⚠️  IDs must match `rentalCategory` values in demo data + propertyService.js
//     AND the category IDs used by HeroSection / Navbar dropdowns.
// Each category exposes a translation key (`tKey`) that the UI resolves at
// render time via `t[cat.tKey]`. The English fallback (`label`) is also used
// directly inside the OYO map mini-card where translation isn't available.
const RENTAL_CATEGORIES = [
	{ id: "family",          label: "Family Flat",       tKey: "catFamilyFlat",     icon: Home },
	{ id: "bachelor_male",   label: "Bachelor (Male)",   tKey: "catBachelorMale",   icon: User },
	{ id: "bachelor_female", label: "Bachelor (Female)", tKey: "catBachelorFemale", icon: Users },
	{ id: "sublet",          label: "Sublet / Room",     tKey: "catSubletRoom",     icon: Share2 },
	{ id: "student",         label: "Student",           tKey: "catStudent",        icon: BookOpen },
];

// ─── MAP FILTER CHIPS (floating bar over the map) ─────────────────────────────
// Horizontally-scrolling tenant-type chips shown over the map. Each chip drives
// the SAME `selectedCategories` filter state the sidebar "Who's moving in?"
// section uses (matched against `prop.rentalCategory` by propertyMatchesFilters),
// so the floating bar and the full filter panel stay in sync. "All" clears the
// category filter. Single-select: tapping a chip replaces the selection; tapping
// the active chip clears it back to "All".
const MAP_FILTER_CHIPS = [
	{ id: "all", labelBn: "সব", labelEn: "All", categories: [] },
	{ id: "student", labelBn: "স্টুডেন্ট", labelEn: "Student", categories: ["student_male", "student_female"] },
	{ id: "family", labelBn: "ফ্যামিলি", labelEn: "Family", categories: ["family"] },
	{ id: "professional", labelBn: "প্রফেশনাল", labelEn: "Professional", categories: ["working_professional"] },
];

// ─── ICON MAP (string key → lucide component) ─────────────────────────────────
// filterConfig.js stores category icons as UI-agnostic string keys ("home",
// "user", …) so it never imports a UI library. We resolve them to lucide
// components here, at the presentation layer.
const ICON_MAP = { home: Home, user: User, users: Users, book: BookOpen };

// ─── INTENT TABS (Filter_Panel header) ────────────────────────────────────────
const INTENT_TABS = [
	{ intent: "rent",       labelBn: "আবাসিক" },
	{ intent: "sale",       labelBn: "ক্রয়" },
	{ intent: "commercial", labelBn: "বাণিজ্যিক" },
	// Buying/selling is handled off-platform for now — drop the "ক্রয়" (Buy) tab
	// while SALE_INTENT_ENABLED is false. See constants/listingIntents.js.
].filter((tab) => tab.intent !== "sale" || SALE_INTENT_ENABLED);

// Three-up tab row at the very top of the filter panel (shown in BOTH the
// desktop sidebar and the mobile bottom-sheet). The tab matching the active
// intent is visually selected and carries aria-selected for accessibility.
// (Requirement 2)
const IntentTabBar = ({ activeIntent, onChange }) => (
	<div role="tablist" aria-label="Listing intent" className={`grid ${INTENT_TABS.length === 2 ? "grid-cols-2" : "grid-cols-3"} gap-2 mb-6`}>
		{INTENT_TABS.map((tab) => {
			const active = activeIntent === tab.intent;
			return (
				<button
					key={tab.intent}
					type="button"
					role="tab"
					aria-selected={active}
					onClick={() => onChange(tab.intent)}
					className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${
						active
							? "bg-gray-900 text-white border-gray-900 shadow-[2px_2px_0_0_#ba0036]"
							: "bg-white text-gray-700 border-gray-200 hover:border-gray-900"
					}`}
				>
					{tab.labelBn}
				</button>
			);
		})}
	</div>
);

// ─── VALID DIVISIONS (To catch custom area searches) ──────────────────────────
const validDivisions = ["dhaka", "chittagong", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh"];

// Room labels come from the shared source of truth (roomLabel from
// constants/roomCategories) so cards, the dashboard and the photo tour all read
// categories identically — no per-file duplication that can drift.

// Human-readable property TYPE label so a card clearly says WHAT it is —
// Office / Shop / Restaurant / Hostel / House / Single Room / Apartment / Land.
const PROPERTY_TYPE_LABELS = {
	flat: { en: 'Apartment', bn: 'অ্যাপার্টমেন্ট' },
	apartment: { en: 'Apartment', bn: 'অ্যাপার্টমেন্ট' },
	house: { en: 'House', bn: 'বাড়ি' },
	independent: { en: 'House', bn: 'বাড়ি' },
	duplex: { en: 'Duplex', bn: 'ডুপ্লেক্স' },
	studio: { en: 'Studio', bn: 'স্টুডিও' },
	penthouse: { en: 'Penthouse', bn: 'পেন্টহাউস' },
	sublet: { en: 'Sublet', bn: 'সাবলেট' },
	hostel: { en: 'Hostel', bn: 'হোস্টেল' },
	single_room: { en: 'Single Room', bn: 'সিঙ্গেল রুম' },
	building: { en: 'Building', bn: 'বিল্ডিং' },
	office: { en: 'Office', bn: 'অফিস' },
	shop: { en: 'Shop', bn: 'দোকান' },
	showroom: { en: 'Showroom', bn: 'শোরুম' },
	restaurant: { en: 'Restaurant', bn: 'রেস্টুরেন্ট' },
	land: { en: 'Land', bn: 'জমি' },
};
const propertyTypeLabel = (type, isBn) => {
	const tl = PROPERTY_TYPE_LABELS[type];
	if (tl) return isBn ? tl.bn : tl.en;
	return type
		? String(type).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
		: (isBn ? 'প্রপার্টি' : 'Property');
};

// ─── ROOM COLLAGE HELPER ──────────────────────────────────────────────────────
// Dynamically builds the listing-card collage using the actual room photos uploaded by the user.
// It extracts up to 3 unique room categories (e.g. workspace, meeting, cabin, bedroom).
function buildRoomCollage(property) {
	const uniqueRoomShots = [];
	const usedRooms = new Set();
	const hasRoomPhotos = Array.isArray(property.roomPhotos) && property.roomPhotos.length > 0;

	if (hasRoomPhotos) {
		for (const p of property.roomPhotos) {
			const roomKey = (p.room || "other").toLowerCase();
			const url = p.url || p.preview;
			if (url && !usedRooms.has(roomKey)) {
				uniqueRoomShots.push({ url, room: roomKey });
				usedRooms.add(roomKey);
			}
		}
	}

	const cover = property.coverPhoto || property.img || (uniqueRoomShots[0]?.url) || (property.images || [])[0] || "";
	// Prefer photos that DIFFER from the cover, then keep the labelled
	// same-as-cover rooms so a commercial listing shows Workspace / Reception /
	// Washroom instead of a single stray thumbnail beside the cover.
	const distinctShots = uniqueRoomShots.filter(s => s.url && s.url !== cover);
	const sameAsCoverShots = uniqueRoomShots.filter(s => s.url && s.url === cover);
	const thumbs = [...distinctShots, ...sameAsCoverShots].slice(0, 3);

	// If we have no real per-room photos at all, fall back to the flat `images` array
	if (!thumbs.length && !hasRoomPhotos && Array.isArray(property.images)) {
		const extras = property.images
			.filter(u => u && u !== cover)
			.slice(0, 3)
			.map(u => ({ url: u, room: null }));
		return { cover, thumbs: extras, totalRoomCategories: 0 };
	}

	return { cover, thumbs, totalRoomCategories: uniqueRoomShots.length };
}

// ─── PROPERTY CARD ────────────────────────────────────────────────────────────
const PropertyCard = ({ property, navigate, t, showToast, isHighlighted, onHover, onHoverEnd, onInquire }) => {
	const [isSaved, setIsSaved] = useState(false);

	const { cover: coverImg, thumbs: collageThumbs, totalRoomCategories } = useMemo(
		() => buildRoomCollage(property),
		[property],
	);

	useEffect(() => {
		const savedProps = JSON.parse(localStorage.getItem("savedProperties") || "[]");
		setIsSaved(savedProps.some((p) => p.id === property.id));
	}, [property.id]);

	const handleSave = (e) => {
		e.preventDefault();
		e.stopPropagation();
		let savedProps = JSON.parse(localStorage.getItem("savedProperties") || "[]");
		const isCurrentlySaved = savedProps.some((p) => p.id === property.id);
		if (isCurrentlySaved) {
			savedProps = savedProps.filter((p) => p.id !== property.id);
			setIsSaved(false);
			showToast("Removed from Saved");
		} else {
			savedProps.push({ id: property.id, title: property.title, location: property.location, price: String(property.price ?? ""), beds: property.beds, baths: property.baths, img: coverImg });
			setIsSaved(true);
			showToast("Property Saved Successfully!");
		}
		localStorage.setItem("savedProperties", JSON.stringify(savedProps));
	};

	const discountPercent = property.originalPrice && property.originalPrice > property.price
		? Math.round(((property.originalPrice - property.price) / property.originalPrice) * 100)
		: 0;

	const CATEGORY_LABELS = {
		family: { en: 'Family Flat', bn: 'ফ্যামিলি ফ্ল্যাট' },
		bachelor_male: { en: 'Bachelor (Male)', bn: 'ব্যাচেলর (পুরুষ)' },
		bachelor_female: { en: 'Bachelor (Female)', bn: 'ব্যাচেলর (মহিলা)' },
		sublet: { en: 'Sublet / Room', bn: 'সাবলেট / রুম' },
		student_male: { en: 'Student (Male)', bn: 'ছাত্র' },
		student_female: { en: 'Student (Female)', bn: 'ছাত্রী' },
		working_professional: { en: 'Working Professional', bn: 'চাকরিজীবী' },
		hostel: { en: 'Hostel', bn: 'হোস্টেল' },
		apartment: { en: 'Apartment', bn: 'অ্যাপার্টমেন্ট' },
		duplex: { en: 'Duplex', bn: 'ডুপ্লেক্স' },
		triplex: { en: 'Triplex', bn: 'ট্রিপ্লেক্স' },
		plot: { en: 'Plot / Land', bn: 'প্লট / জমি' },
		building: { en: 'Building', bn: 'পুরো বিল্ডিং' },
		commercial_space: { en: 'Commercial Space', bn: 'কমার্শিয়াল স্পেস' },
		office: { en: 'Office Space', bn: 'অফিস স্পেস' },
		co_working: { en: 'Co-working Space', bn: 'কো-ওয়ার্কিং স্পেস' },
		shop: { en: 'Shop', bn: 'দোকান' },
		showroom: { en: 'Showroom', bn: 'শোরুম' },
		restaurant: { en: 'Restaurant', bn: 'রেস্টুরেন্ট' },
		fast_food: { en: 'Fast Food', bn: 'ফাস্ট ফুড' },
		warehouse: { en: 'Warehouse', bn: 'গুদামঘর' },
		garage: { en: 'Garage', bn: 'গ্যারেজ' },
		student: { en: 'Student', bn: 'ছাত্র' },
		other: { en: 'Others', bn: 'অন্যান্য' }
	};
	const currentLang = typeof t?.language === 'string' ? t.language : 'en'; // Usually passed inside t or just fallback to en if not available.
	// We check if language object has it, wait, useLanguage returns { language, t } but PropertyCard only gets t.
	// Actually we can just check if t.forRent is in Bengali.
	const isBn = t?.forRent === 'ভাড়ার জন্য';
	const catDict = CATEGORY_LABELS[property.rentalCategory];
	const catLabel = catDict ? (isBn ? catDict.bn : catDict.en) : (property.rentalCategory || "Others");

	const extraRoomCount = Math.max(0, totalRoomCategories - 1 - collageThumbs.length);

	return (
		<div onMouseEnter={() => onHover && onHover(property.id)} onMouseLeave={() => onHoverEnd && onHoverEnd()} className={`bg-white rounded-3xl border overflow-hidden flex flex-col md:flex-row hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 group ${isHighlighted ? "border-brandRed shadow-[0_0_0_2px_rgba(186,0,54,0.3)]" : "border-gray-100"} ${property.availabilityStatus === 'rented' ? 'opacity-60 grayscale-[50%]' : ''}`}>
			<div className="w-full md:w-[280px] lg:w-[300px] h-[190px] md:h-auto p-2.5 shrink-0">
				<div className="relative w-full h-full rounded-2xl overflow-hidden flex gap-1.5 bg-gray-100">
					<div className="relative w-[75%] h-full overflow-hidden cursor-pointer" onClick={() => navigate(`/property/${property.id}`)}>
						{coverImg ? (
							<img src={coverImg} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" loading="lazy" decoding="async" />
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100">
								<Camera size={42} />
							</div>
						)}
                        {property.availabilityStatus === 'rented' && (
                            <div className="absolute inset-0 z-10 bg-brandRed/70 backdrop-blur-sm flex items-center justify-center">
                                <div className="bg-white px-4 py-2 rounded-xl shadow-xl text-sm font-black text-brandRed transform -rotate-12 border-2 border-white/50">
                                    {t.rentedBadge || "ভাড়া হয়ে গেছে"}
                                </div>
                            </div>
                        )}
						<div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
                            {property.availabilityStatus === 'rented' && (
                                <div className="absolute inset-0 z-10 bg-brandRed/80 backdrop-blur-[2px] flex items-center justify-center">
                                    <div className="bg-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xl text-sm font-black text-brandRed transform -rotate-12 border-2 border-brandRed/20">
                                        {t.rentedBadge || "ভাড়া হয়ে গেছে"}
                                    </div>
                                </div>
                            )}
							{property.verified && (
								<div className="bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm text-[10px] font-black text-brandRed">
									<ShieldCheck size={12} /> {t.verified || "Verified"}
								</div>
							)}
							<span className="bg-gray-900/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm">{propertyTypeLabel(property.type, isBn)}</span>
							<span className="bg-brandRed/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm">{catLabel}</span>
							{property.intent && (
								<span className={`backdrop-blur-md text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm ${
									property.intent === 'sale' ? 'bg-blue-600/90 text-white' :
									property.intent === 'commercial' ? 'bg-purple-600/90 text-white' :
									'bg-green-600/90 text-white'
								}`}>
									{property.intent === 'sale' ? (t.forSale || 'বিক্রির জন্য') :
									 property.intent === 'commercial' ? (t.commercial || 'কমার্শিয়াল') :
									 (t.forRent || 'ভাড়ার জন্য')}
								</span>
							)}
						</div>
						<button onClick={handleSave} className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-md rounded-full hover:bg-white hover:scale-110 active:scale-95 transition-all z-20 shadow-sm">
							<Heart size={16} className={isSaved ? "fill-brandRed text-brandRed" : "text-gray-700"} />
						</button>
					</div>
					{/* ── ROOM COLLAGE STRIP ──────────────────────────────────────────
					    Renders ONE thumbnail per requested room category (bedroom /
					    bathroom / living / kitchen / other) instead of downloading the whole gallery.
					    Falls back to the flat images list only for older records that
					    did not tag photos by room. */}
					<div className="w-[25%] flex flex-col gap-1.5 h-full">
						{collageThumbs.map((shot, idx) => (
							<div key={`${shot.room || "x"}-${idx}`} className="relative flex-1 overflow-hidden cursor-pointer bg-gray-200" onClick={() => navigate(`/property/${property.id}`)}>
								<img src={shot.url} className="w-full h-full object-cover hover:opacity-80 transition-opacity duration-300" alt={shot.room ? roomLabel(shot.room, isBn) : ""} loading="lazy" decoding="async" />
								{shot.room && (
									<span className="absolute bottom-1 left-1 px-1.5 py-[2px] rounded-md bg-black/55 text-white text-[8px] font-black uppercase tracking-wider">
										{roomLabel(shot.room, isBn)}
									</span>
								)}
								{idx === collageThumbs.length - 1 && extraRoomCount > 0 && (
									<div className="absolute inset-0 bg-brandRed/80 backdrop-blur-sm flex items-center justify-center text-white text-xs font-black">+{extraRoomCount}</div>
								)}
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="p-3.5 md:p-4 flex-1 flex flex-col justify-between">
				<div>
					<div className="flex justify-between items-start gap-4 mb-2">
						<div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/property/${property.id}`)}>
							<div className="bg-gray-900 text-white text-[11px] font-black px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
								<Star size={10} className="fill-yellow-400 text-yellow-400" /> {property.rating}
							</div>
							<span className="text-xs font-bold text-gray-400 hover:text-brandRed transition-colors">
								{property.reviews} {t.reviews || "Reviews"}
							</span>
						</div>
						<div className="hidden md:flex bg-red-50 px-2.5 py-1 rounded-lg items-center gap-1">
							<Flame size={12} className="fill-brandRed text-brandRed" />
							<span className="text-[10px] font-black text-brandRed uppercase tracking-widest">
								{property.inquiries} {t.inquiriesToday || "Inquiries Today"}
							</span>
						</div>
					</div>
					<h3 className="text-base md:text-lg font-black text-gray-900 leading-tight group-hover:text-brandRed transition-colors cursor-pointer mb-1" onClick={() => navigate(`/property/${property.id}`)}>
						{property.title}
					</h3>
					<p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2.5">
						<MapPin size={14} className="text-gray-400" /> {property.location}
					</p>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold text-gray-600 bg-gray-50 p-2.5 rounded-xl">
						{hasBedsBaths(property.intent, property.type) && (
							<>
								<span className="flex items-center gap-1.5">
									<BedDouble size={14} className="text-gray-400" /> {property.beds} {t.beds || "Beds"}
								</span>
								<span className="flex items-center gap-1.5">
									<Bath size={14} className="text-gray-400" /> {property.baths} {t.baths || "Baths"}
								</span>
							</>
						)}
						<span className="flex items-center gap-1.5">
							<Square size={14} className="text-gray-400" /> {property.sqft} {t.sqft || "sqft"}
						</span>
						<span className="flex items-center gap-1.5">
							<Layers size={14} className="text-gray-400" /> {(property.floor || property.floorNumber) ? `${t.floorLabel || "Floor"} ${property.floor || property.floorNumber}` : (t.groundFloor || "Ground")}
						</span>
						<span className="hidden sm:flex items-center gap-1.5">
							<Building size={14} className="text-gray-400" />
							{property.furnishing === "Furnished" ? t.furnished || "Furnished" : property.furnishing === "Semi-Furnished" ? t.semiFurnished || "Semi-Furnished" : t.unfurnished || "Unfurnished"}
						</span>
					</div>
				</div>
				<div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 pt-3 mt-3 border-t border-gray-100">
					<div className="w-full sm:w-auto flex flex-col cursor-pointer" onClick={() => navigate(`/property/${property.id}`)}>
						<div className="flex items-baseline gap-2">
							<span className="text-lg md:text-xl font-black text-gray-900 tracking-tighter">৳ {property.price.toLocaleString("en-IN")}</span>
							{property.originalPrice > property.price && (
								<div className="flex items-center gap-2">
									<span className="text-xs text-gray-400 line-through font-bold">৳ {property.originalPrice.toLocaleString("en-IN")}</span>
									<span className="bg-green-100 text-green-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
										{discountPercent}% {t.off || "Off"}
									</span>
								</div>
							)}
						</div>
						<p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
							{property.intent === 'sale' ? (t.totalPrice || 'মোট মূল্য') :
							 property.intent === 'commercial' ? (t.perMonth || 'প্রতি মাসে') :
							 (t.perMonth || 'প্রতি মাসে')}
						</p>
					</div>
					<div className="flex items-center gap-3 w-full sm:w-auto">
						<button onClick={() => navigate(`/property/${property.id}`)} className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-[11px] font-black text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all">
							{t.detailsBtn || "Details"}
						</button>
						{/* ── INQUIRY BUTTON: opens modal inline, no page navigation ── */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								onInquire(property);
							}}
							className="flex-1 sm:flex-none px-5 py-2 rounded-lg bg-brandRed hover:bg-[#a0002e] text-white text-[11px] font-black shadow-[0_8px_16px_rgba(186,0,54,0.18)] hover:shadow-[0_12px_24px_rgba(186,0,54,0.28)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-1.5">
							<MessageCircle size={13} />
							{t.inquireBtn || "Inquire"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

const PropertyCardSkeleton = () => (
	<div className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col md:flex-row shadow-sm animate-pulse">
		<div className="w-full md:w-[280px] lg:w-[300px] h-[190px] md:h-auto p-2.5 shrink-0">
			<div className="relative w-full h-full rounded-2xl overflow-hidden flex gap-1.5 bg-gray-100">
				<div className="w-[75%] h-full bg-gray-200" />
				<div className="w-[25%] flex flex-col gap-1.5 h-full">
					<div className="flex-1 bg-gray-200" />
					<div className="flex-1 bg-gray-200" />
					<div className="flex-1 bg-gray-200" />
				</div>
			</div>
		</div>
		<div className="p-3.5 md:p-4 flex-1 flex flex-col justify-between">
			<div>
				<div className="flex justify-between items-start gap-4 mb-3">
					<div className="h-6 w-28 rounded-lg bg-gray-200" />
					<div className="hidden md:block h-6 w-32 rounded-lg bg-gray-100" />
				</div>
				<div className="h-5 w-3/4 rounded bg-gray-200 mb-2" />
				<div className="h-4 w-1/2 rounded bg-gray-100 mb-3" />
				<div className="flex flex-wrap items-center gap-2 bg-gray-50 p-2.5 rounded-xl">
					<div className="h-4 w-16 rounded bg-gray-200" />
					<div className="h-4 w-16 rounded bg-gray-200" />
					<div className="h-4 w-20 rounded bg-gray-200" />
					<div className="h-4 w-20 rounded bg-gray-200" />
				</div>
			</div>
			<div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 pt-3 mt-3 border-t border-gray-100">
				<div className="w-full sm:w-auto">
					<div className="h-6 w-28 rounded bg-gray-200" />
					<div className="h-3 w-20 rounded bg-gray-100 mt-2" />
				</div>
				<div className="flex items-center gap-3 w-full sm:w-auto">
					<div className="h-9 flex-1 sm:w-20 rounded-lg bg-gray-100" />
					<div className="h-9 flex-1 sm:w-24 rounded-lg bg-gray-200" />
				</div>
			</div>
		</div>
	</div>
);

// ─── FILTER SECTION ──────────────────────────────────────────────────────────
const FilterSection = ({ title, children }) => (
	<div className="border-b border-gray-100 last:border-0 pb-6 mb-6">
		<h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-4">{title}</h3>
		{children}
	</div>
);

// ─── MAP VIEW (Google Maps + clustering) ─────────────────────────────────────
// Interactive Google Map that clusters nearby listings with supercluster and
// renders each one as either a price pill (MapMarker) or a grouped count bubble
// (ClusterMarker). A marker click bubbles up via `onMarkerClick(property)` after
// the camera smoothly pans to it; a cluster click zooms in to break it apart.
//
// `properties` is the already-filtered set from the parent — this component is
// presentational apart from the camera + clustering maths. `activeId` is the id
// of the currently-selected listing (drives the inverted pill), and
// `bottomSheetHeight` is the rendered height of the bottom sheet so the camera
// can keep the active marker centred in the area above the card.
const MapView = ({ properties, activeId, onMarkerClick, defaultCenter = DEFAULT_MAP_CENTER, defaultZoom = DEFAULT_MAP_ZOOM, bottomSheetHeight = 0 }) => {
	const [mapInstance, setMapInstance] = useState(null);
	// Viewport state feeding supercluster. `bounds` is a supercluster BBox
	// [westLng, southLat, eastLng, northLat]; `zoom` is the rounded map zoom.
	const [bounds, setBounds] = useState(null);
	const [zoom, setZoom] = useState(defaultZoom);

	// Keep the latest bottom-sheet height in a ref so the click handler reads the
	// current value without being re-created on every height change.
	const paddingRef = useRef(bottomSheetHeight);
	useEffect(() => {
		paddingRef.current = bottomSheetHeight;
	}, [bottomSheetHeight]);

	// Memoised options so GoogleMap doesn't re-init on every parent re-render.
	const mapOptions = useMemo(
		() => ({
			disableDefaultUI: false,
			mapTypeControl: false,
			streetViewControl: false,
			fullscreenControl: false,
			clickableIcons: false,
			gestureHandling: "greedy",
			styles: MAP_STYLES,
		}),
		[]
	);

	// Load the Maps JS SDK once per page (the loader de-duplicates internally).
	// `libraries` MUST match the other loaders that share this id (PropertyDetails
	// and AddProperty both pass GOOGLE_MAPS_LIBRARIES = []). If they differ, the
	// shared singleton Loader throws "must not be called again with different
	// options" when the user navigates between the map and a property page.
	const { isLoaded, loadError } = useJsApiLoader({
		id: "tlp-google-map-script",
		googleMapsApiKey: GOOGLE_MAPS_API_KEY,
		libraries: GOOGLE_MAPS_LIBRARIES,
	});

	// ── SUPERCLUSTER INPUT ──
	// One GeoJSON point per listing that has real coordinates. Each carries the
	// whole property on `properties.property` so a leaf marker can show its price.
	const points = useMemo(
		() =>
			(properties || [])
				.filter((p) => p.lat && p.lng)
				.map((p) => ({
					type: "Feature",
					properties: { cluster: false, propertyId: p.id, property: p },
					geometry: { type: "Point", coordinates: [Number(p.lng), Number(p.lat)] },
				})),
		[properties]
	);

	// The filter panel gates results to a single intent, so if any listing here
	// is commercial the whole view is commercial. Used to tint cluster bubbles
	// indigo to match the individual commercial pins (see MapMarker/ClusterMarker).
	const isCommercialView = useMemo(
		() => (properties || []).some((p) => p && p.intent === "commercial"),
		[properties]
	);

	const { clusters, supercluster } = useSupercluster({
		points,
		bounds,
		zoom,
		options: { radius: 60, maxZoom: 18 },
	});

	// Sync bounds + zoom from the map after every idle (pan/zoom has settled) so
	// supercluster re-groups for the current viewport.
	const syncBounds = useCallback(() => {
		if (!mapInstance) return;
		const z = mapInstance.getZoom();
		if (typeof z === "number") setZoom(Math.round(z));
		const b = mapInstance.getBounds();
		if (b) {
			const ne = b.getNorthEast();
			const sw = b.getSouthWest();
			setBounds([sw.lng(), sw.lat(), ne.lng(), ne.lat()]);
		}
	}, [mapInstance]);

	// When the property set changes, fit the map to the matches — but never while
	// a marker is selected, which would yank the camera away from the open card.
	// `activeId` is intentionally NOT a dependency: we only re-fit when the
	// results change, honouring whatever selection is active at that moment (so
	// selecting/deselecting a marker never triggers a re-fit on its own).
	useEffect(() => {
		if (!mapInstance || !window.google || activeId) return;
		const pts = (properties || []).filter((p) => p.lat && p.lng);
		if (pts.length === 0) return;
		if (pts.length === 1) {
			mapInstance.panTo({ lat: pts[0].lat, lng: pts[0].lng });
			mapInstance.setZoom(14);
			return;
		}
		const b = new window.google.maps.LatLngBounds();
		pts.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
		mapInstance.fitBounds(b, 64);
	}, [properties, mapInstance]);

	const onLoad = useCallback((map) => setMapInstance(map), []);
	const onUnmount = useCallback(() => setMapInstance(null), []);

	// ── DYNAMIC BOTTOM PADDING ──
	// GoogleMap exposes no native `padding` prop, so we emulate it: when a
	// listing is selected we pan the camera so the marker sits centred in the
	// area ABOVE the bottom sheet — shifting the target centre south by half the
	// sheet height (converted from screen pixels to world units at the current
	// zoom). This keeps the active marker visible and the Google logo unobscured.
	const panToWithPadding = useCallback((map, position) => {
		// Fall back to an estimate before the sheet has reported its real height
		// (e.g. the very first marker tap) so the marker still lifts above the card.
		const pad = paddingRef.current || 320;
		const proj = map.getProjection && map.getProjection();
		const z = map.getZoom();
		if (!proj || typeof z !== "number" || !window.google) {
			map.panTo(position);
			return;
		}
		const scale = Math.pow(2, z);
		const worldPoint = proj.fromLatLngToPoint(new window.google.maps.LatLng(position.lat, position.lng));
		const shifted = new window.google.maps.Point(worldPoint.x, worldPoint.y + pad / 2 / scale);
		map.panTo(proj.fromPointToLatLng(shifted));
	}, []);

	// Camera animation (Requirement 1.4): smooth pan to the marker, then tell the
	// parent to select it (which springs up the bottom sheet + inverts the pill).
	const handleMarkerClick = useCallback(
		(property) => {
			if (mapInstance) panToWithPadding(mapInstance, { lat: property.lat, lng: property.lng });
			onMarkerClick && onMarkerClick(property);
		},
		[mapInstance, onMarkerClick, panToWithPadding]
	);

	// Cluster click: zoom to the level that breaks the cluster apart, re-centred
	// on the cluster's coordinates (supercluster.getClusterExpansionZoom).
	const handleClusterClick = useCallback(
		(clusterId, lat, lng) => {
			if (!supercluster || !mapInstance) return;
			const expansionZoom = Math.min(supercluster.getClusterExpansionZoom(clusterId), 20);
			mapInstance.setZoom(expansionZoom);
			mapInstance.panTo({ lat, lng });
		},
		[supercluster, mapInstance]
	);

	// ── Fallback: no API key → public iframe embed (no key required) ──────────
	// Lets the page keep rendering before the key is provisioned.
	if (!GOOGLE_MAPS_API_KEY) {
		return (
			<div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gray-100">
				<iframe
					title="Properties map"
					src={`https://www.google.com/maps?q=${defaultCenter.lat},${defaultCenter.lng}&hl=en&z=${defaultZoom}&output=embed`}
					width="100%"
					height="100%"
					loading="lazy"
					referrerPolicy="no-referrer-when-downgrade"
					style={{ border: "none", minHeight: 400 }}
					allowFullScreen
				/>
				<div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-600 shadow-sm border border-gray-100">
					Add VITE_GOOGLE_MAPS_API_KEY to enable interactive markers
				</div>
			</div>
		);
	}

	if (loadError) {
		return (
			<div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gray-50 flex items-center justify-center" style={{ minHeight: 400 }}>
				<div className="text-center px-6">
					<div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
						<MapPin size={20} className="text-brandRed" />
					</div>
					<p className="text-sm font-black text-gray-900 mb-1">Couldn't load Google Maps</p>
					<p className="text-xs font-bold text-gray-500">Check the API key, billing status, and HTTP referrer restrictions.</p>
				</div>
			</div>
		);
	}

	if (!isLoaded) {
		return (
			<div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gray-50 flex items-center justify-center" style={{ minHeight: 400 }}>
				<div className="flex flex-col items-center gap-3">
					<div className="w-10 h-10 border-4 border-brandRed border-t-transparent rounded-full animate-spin" />
					<span className="text-sm font-bold text-gray-400">Loading map…</span>
				</div>
			</div>
		);
	}

	// Until the first idle sets `bounds`, supercluster returns nothing — fall back
	// to the raw points (same GeoJSON shape) so markers never flash empty on load.
	const renderItems = bounds ? clusters : points;

	return (
		<div className="relative w-full h-full overflow-hidden bg-gray-100">
			<GoogleMap
				mapContainerStyle={{ width: "100%", height: "100%" }}
				center={defaultCenter}
				zoom={defaultZoom}
				options={mapOptions}
				onLoad={onLoad}
				onUnmount={onUnmount}
				onIdle={syncBounds}
			>
				{renderItems.map((item) => {
					const [lng, lat] = item.geometry.coordinates;
					const { cluster: isCluster, point_count: pointCount } = item.properties;

					// Grouped listings → count bubble that zooms in on click.
					if (isCluster) {
						return (
							<ClusterMarker
								key={`cluster-${item.id}`}
								lat={lat}
								lng={lng}
								count={pointCount}
								totalPoints={points.length}
								isCommercial={isCommercialView}
								onClick={() => handleClusterClick(item.id, lat, lng)}
							/>
						);
					}

					// Individual listing → price pill.
					const prop = item.properties.property;
					return (
						<MapMarker
							key={prop.id}
							lat={lat}
							lng={lng}
							price={prop.price}
							title={prop.title}
							intent={prop.intent}
							isActive={activeId === prop.id}
							onClick={() => handleMarkerClick(prop)}
						/>
					);
				})}
			</GoogleMap>
		</div>
	);
};

// ─── (MAP MINI CARD removed) ─────────────────────────────────────────────────
// The old slim marker preview has been replaced by the floating BottomSheetCard
// (./BottomSheetCard.jsx) — a springed-up card with an image carousel, which the
// map overlay renders directly.

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const PropertyListing = () => {
	const navigate = useNavigate();
	const goBack = useGoBack("/");
	const { t, language } = useLanguage();
	const [searchParams, setSearchParams] = useSearchParams();
	const { scrollY } = useScroll();

    // ── NEW LOGIC TO PARSE THE URL SAFELY ──
	const { divisionName } = useParams();
	const routeParam = divisionName ? divisionName.toLowerCase() : "all";

	// Determine if the URL parameter is a known division, or a custom area search (like 'dhanmondi-dhaka')
	const isKnownDivision = validDivisions.includes(routeParam);
	const activeDivision = isKnownDivision ? routeParam : "all";
	// Extract the area name from the URL slug. Restore spaces from hyphens
	// so "/properties/dhanmondi-12" searches for "dhanmondi 12" (full phrase),
	// not just "dhanmondi". The downstream filter does case-insensitive
	// substring matching against every location-ish field on the property,
	// so this also matches a property where area="Dhanmondi" and the address
	// line has "Dhanmondi 12".
	const initialSearchAreaFromURL = searchParams.get("q") 
		? searchParams.get("q") 
		: (!isKnownDivision && routeParam !== "all")
			? routeParam.replace(/-/g, ' ')
			: "";

	const formattedDivision = (t.cities && t.cities[activeDivision]) || (t.districtNames && t.districtNames[activeDivision]) || (activeDivision === 'all' ? (t.allCities || "All") : activeDivision.charAt(0).toUpperCase() + activeDivision.slice(1));


	// ── INQUIRY MODAL STATE ─────────────────────────────────────────────────────
	// inquiryTarget: the property object the user wants to inquire about (null = modal closed)
	const [inquiryTarget, setInquiryTarget] = useState(null);
	const [inquiryLandlord, setInquiryLandlord] = useState(null);

	const openInquiry = (property) => setInquiryTarget(property);
	const closeInquiry = () => { setInquiryTarget(null); setInquiryLandlord(null); };

	// ── LIVE PROPERTY DATA ──────────────────────────────────────────────────────
	// Pulled from propertyService — backend first, localStorage fallback. No
	// demo data is merged in anywhere; an empty list is a legitimate state.
	const [properties, setProperties] = useState([]);
	const [isPropertiesLoading, setIsPropertiesLoading] = useState(true);
	const [propertyLoadError, setPropertyLoadError] = useState("");
	const [propertyRefreshTick, setPropertyRefreshTick] = useState(0);

	// ── UI STATES ───────────────────────────────────────────────────────────────
	const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState(null);
	const [isStickyFilter, setIsStickyFilter] = useState(false);
	const [isLocating, setIsLocating] = useState(false);
	const [viewMode, setViewMode] = useState("list");
	const [highlightedId, setHighlightedId] = useState(null);
	const [selectedMapProperty, setSelectedMapProperty] = useState(null);
	// Measured height of the floating bottom sheet → fed to MapView so the camera
	// keeps the active marker centred above the card (dynamic map padding).
	const [bottomSheetHeight, setBottomSheetHeight] = useState(0);
	const [openSections, setOpenSections] = useState([]);

	// ── FILTER STATES ───────────────────────────────────────────────────────────
	const [searchArea, setSearchArea] = useState(initialSearchAreaFromURL);
	// Debounced mirror of the search box → drives the server-side `q` fetch so
	// we don't hit the API on every keystroke. The header/input use `searchArea`
	// directly so typing still feels instant.
	const [debouncedSearch, setDebouncedSearch] = useState(initialSearchAreaFromURL);
	useEffect(() => {
		const id = setTimeout(() => setDebouncedSearch(searchArea), 300);
		return () => clearTimeout(id);
	}, [searchArea]);
	// Visibility of the location autocomplete dropdown.
	const [showSuggest, setShowSuggest] = useState(false);
	// Default to 0 so freshly-uploaded test listings priced below 5000 BDT
	// (very common in dev/QA — placeholder rents of 2000–3000) still show
	// up out of the box. Users can drag the slider up if they want a real
	// floor.
	const [minPrice, setMinPrice] = useState(0);
	const [maxPrice, setMaxPrice] = useState(300000);
	// Listing intent is now GLOBAL — the single source of truth is the store's
	// activeMode (shared with the navbar + hero, persisted, canonical
	// rent/sale/commercial). The URL param parser below writes INTO the store on
	// load, so a shared ?intent= link wins over the persisted mode.
	const selectedIntent = usePropertyStore((s) => s.activeMode);
	const setActiveMode  = usePropertyStore((s) => s.setActiveMode);
	const [selectedTypes, setSelectedTypes] = useState([]);
	const [selectedCategories, setSelectedCategories] = useState([]);
	// sale/commercial second-level option (e.g. ready_flat / duplex / corporate).
	const [selectedSubCategories, setSelectedSubCategories] = useState([]);
	const [selectedBeds, setSelectedBeds] = useState("any");
	const [selectedBaths, setSelectedBaths] = useState("any");
	const [maxSqft, setMaxSqft] = useState(4000);
	const [selectedFurnish, setSelectedFurnish] = useState("");
	const [selectedAmenities, setSelectedAmenities] = useState([]);
	// commercial-only fire-safety gate: '' (any) | 'yes' | 'no' (filters on 'yes').
	const [selectedFireSafety, setSelectedFireSafety] = useState("");
	const [selectedFloor, setSelectedFloor] = useState(t.anyFloor || "Any Floor");
	const [minRating, setMinRating] = useState(0);
	const [sortBy, setSortBy] = useState("Newest Listings");
	const [userLocation, setUserLocation] = useState(null);
	useMotionValueEvent(scrollY, "change", (latest) => {
		setIsStickyFilter(latest > 120);
	});

	// ── LOAD PROPERTIES (live, no demo merge) ───────────────────────────────────
	// Re-fetches whenever the route division changes and re-subscribes so a new
	// upload from another tab / from Add Property shows up immediately.
	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			if (!cancelled) {
				setIsPropertiesLoading(true);
				setPropertyLoadError("");
			}
			try {
				const list = await propertyService.getProperties(
					{ activeDivision, searchArea: debouncedSearch, nearMeLabel: t.nearMe || "Nearby Location", intent: selectedIntent, selectedCategories, selectedTypes, minPrice, maxPrice },
					sortBy,
				);
				if (!cancelled) setProperties(Array.isArray(list) ? list : []);
			} catch (err) {
				if (!cancelled) {
					setProperties([]);
					setPropertyLoadError(err?.message || "Could not load properties. Please try again.");
				}
			} finally {
				if (!cancelled) setIsPropertiesLoading(false);
			}
		};
		load();
		const unsub = subscribeUserProperties(load);
		return () => { cancelled = true; unsub && unsub(); };
	}, [activeDivision, debouncedSearch, selectedIntent, selectedCategories, selectedTypes, minPrice, maxPrice, propertyRefreshTick, sortBy, t.nearMe]);

	// ── RECONCILE SAVED FAVOURITES ──────────────────────────────────────────────
	// On mount, drop any saved listing the landlord/admin has since deleted from
	// the user's localStorage favourites. Safe by construction —
	// pruneSavedProperties only removes entries when the server request SUCCEEDS,
	// so a transient outage never wipes favourites. Runs once.
	useEffect(() => {
		propertyService.pruneSavedProperties("savedProperties").catch(() => {});
	}, []);

	// ── LANDLORD LOOKUP FOR INQUIRY ─────────────────────────────────────────────
	// Look up the landlord lazily when the inquiry modal opens so we don't issue
	// a request per card render. If no landlord record exists yet (host hasn't
	// uploaded), we still open the inquiry — the modal handles a null landlord.
	useEffect(() => {
		let cancelled = false;
		if (!inquiryTarget) { setInquiryLandlord(null); return; }
		(async () => {
			const ll = await propertyService.getLandlord(inquiryTarget.landlordId);
			if (!cancelled) setInquiryLandlord(ll);
		})();
		return () => { cancelled = true; };
	}, [inquiryTarget]);

	useEffect(() => {
		window.scrollTo(0, 0);

		// Sync searchArea from URL when route or divisionName changes
		const isKnownDivision = validDivisions.includes(routeParam);
		const newSearchArea = searchParams.get("q") 
			? searchParams.get("q") 
			: (!isKnownDivision && routeParam !== "all")
				? routeParam.replace(/-/g, ' ')
				: "";
		if (newSearchArea !== searchArea) {
			setSearchArea(newSearchArea);
		}

		// ── Budget ────────────────────────────────────────────────────────────────
		const initialBudget = searchParams.get("budget");
		if (initialBudget === "low") { setMinPrice(5000);   setMaxPrice(20000); }
		else if (initialBudget === "mid")     { setMinPrice(20000);  setMaxPrice(50000); }
		else if (initialBudget === "high")    { setMinPrice(50000);  setMaxPrice(100000); }
		else if (initialBudget === "premium") { setMinPrice(100000); setMaxPrice(300000); }
		else if (initialBudget && initialBudget.includes("-")) {
			const [mn, mx] = initialBudget.split("-").map(Number);
			if (!isNaN(mn) && !isNaN(mx)) { setMinPrice(mn); setMaxPrice(mx); }
		}

		// ── Intent / Purpose ──────────────────────────────────────────────────────
		const initialIntentParam = searchParams.get("intent") || searchParams.get("purpose");
		if (initialIntentParam) {
			// normaliseIntent maps legacy 'buy'→'sale' and unknown→default, then we
			// push it into the global store so the navbar + hero sync to the URL
			// (a shared ?intent= link wins over the persisted mode).
			setActiveMode(normaliseIntent(initialIntentParam));
		}

		// ── Property Type (prop.type: apartment / studio / duplex …) ─────────────
		// Comes from the sidebar "Property Type" checkboxes.
		const initialType = searchParams.get("type");
		if (initialType && initialType !== "any") setSelectedTypes([initialType]);

		// ── Rental Category (prop.rentalCategory: family / bachelor_male …) ──────
		// ⚠️  This is the FIX: Hero & Navbar both send ?category=… (NOT ?type=…)
		//     Routing 'category' to selectedCategories makes Family/Bachelor filters work.
		const initialCategory = searchParams.get("category");
		if (initialCategory && initialCategory !== "any" && initialCategory !== "any_commercial" && initialCategory !== "any_buy") {
			setSelectedCategories([initialCategory]);
		}

		// ── Location fallback from explicit ?location= param ─────────────────────
		const urlLocation = searchParams.get("location");
		if (urlLocation && !searchArea) {
			setSearchArea(urlLocation.split(",")[0]);
		}
	}, [searchParams, routeParam]);

	const handleNearestMe = () => {
		setIsLocating(true);
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setIsLocating(false);
					setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
					setSearchArea(t.nearMe || "Nearby Location");
					showToast("Live location applied!");
				},
				(err) => {
					console.warn(`Geolocation error (${err.code}): ${err.message}`);
					setIsLocating(false);
					showToast("Could not get live location.");
				},
				{ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
			);
		} else {
			setIsLocating(false);
			showToast("Geolocation not supported.");
		}
	};

	const showToast = (msg) => {
		setToastMessage(msg);
		setTimeout(() => setToastMessage(null), 3000);
	};

	// Apply a Filter_Defaults object (from getFilterDefaults) to every filter
	// setter at once. Shared by intent-tab switching AND Clear All so both paths
	// land on exactly the same reset state (Requirement 3).
	const applyFilterDefaults = (d) => {
		setMinPrice(d.minPrice);
		setMaxPrice(d.maxPrice);
		setMaxSqft(d.maxSqft);
		setSelectedTypes(d.selectedTypes);
		setSelectedCategories(d.selectedCategories);
		setSelectedSubCategories(d.selectedSubCategories);
		setSelectedBeds(d.selectedBeds);
		setSelectedBaths(d.selectedBaths);
		setSelectedFurnish(d.selectedFurnish);
		setSelectedAmenities(d.selectedAmenities);
		setSelectedFireSafety(d.selectedFireSafety);
	};

	// Requirement 2.3, 3.1–3.3 — user tapped a different intent tab: push the new
	// intent into the global store and reset every filter section to that
	// intent's defaults. No-op when already on the tab, so URL-driven filters
	// applied at mount aren't wiped by a redundant reset.
	const handleIntentChange = (nextIntent) => {
		const next = normaliseIntent(nextIntent);
		if (next === selectedIntent) return;
		setActiveMode(next);
		applyFilterDefaults(getFilterDefaults(next));
	};

	const handleClearAll = () => {
		setSearchArea("");
		setUserLocation(null);
		// Requirement 3.4 — reset all config-driven filters to the CURRENT intent's defaults.
		applyFilterDefaults(getFilterDefaults(selectedIntent));
		// Intent-neutral controls that live outside Filter_Defaults.
		setSelectedFloor(t.anyFloor || "Any Floor");
		setMinRating(0);
		setSortBy("Newest Listings");
		setSearchParams({});
		window.scrollTo({ top: 0, behavior: "smooth" });
        // Force redirect to /properties/all so the 'dhanmondi-dhaka' path is also wiped
		navigate("/properties/all");
	};

	const toggleSection = (section) => setOpenSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));
	const handleTypeToggle = (typeId) => setSelectedTypes((prev) => (prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]));
	const toggleArrayState = (setter, item) => setter((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

	// ── MAP FILTER CHIPS (floating bar) ──
	// A chip is active when its category set exactly equals the current selection
	// ("All" = nothing selected). Tapping toggles: the active chip clears back to
	// "All", any other chip replaces the selection. Uses the same
	// `selectedCategories` state as the sidebar so both stay in sync.
	const isMapChipActive = (chip) =>
		chip.categories.length === selectedCategories.length &&
		chip.categories.every((c) => selectedCategories.includes(c));
	const handleMapChipClick = (chip) => {
		// Changing the filter dismisses any open preview so the map can re-frame
		// to the new results without a stale sheet floating over a gone marker.
		setSelectedMapProperty(null);
		setBottomSheetHeight(0);
		setSelectedCategories(isMapChipActive(chip) ? [] : chip.categories);
	};

	const handleSave = (e, property) => {
		e.preventDefault();
		e.stopPropagation();
		let savedProps = JSON.parse(localStorage.getItem("savedProperties") || "[]");
		const isCurrentlySaved = savedProps.some((p) => p.id === property.id);
		if (isCurrentlySaved) {
			savedProps = savedProps.filter((p) => p.id !== property.id);
			showToast("Removed from Saved");
		} else {
			savedProps.push({ id: property.id, title: property.title, location: property.location, price: property.price.toString(), beds: property.beds, baths: property.baths, img: property.images[0] });
			showToast("Property Saved Successfully!");
		}
		localStorage.setItem("savedProperties", JSON.stringify(savedProps));
	};

    // ── FILTER + SORT (over the live properties state) ─────────────────────────
	// Same shape as the propertyService.applyFilters helper, just inlined so it
	// can read directly from the sidebar state without a serialisation step.
	const filteredProperties = useMemo(() => {
		// Text search is handled server-side now (the `q` param → $text + regex
		// over the rich haystack). We deliberately do NOT re-filter by the
		// search term here — that would undo the server's alias / multi-word
		// matches. Everything else (price/beds/sqft/floor/…) stays client-side.
		// Config-driven gate: intent + type(alias) + price + category/sub-category
		// + commercial fire-safety, all in one pure predicate (Requirement 12).
		const filterState = {
			intent: selectedIntent,
			selectedTypes,
			minPrice,
			maxPrice,
			selectedCategories,
			selectedSubCategories,
			selectedFireSafety,
		};
		const list = (properties || []).filter((prop) => {
			if (activeDivision !== "all" && prop.division !== activeDivision) return false;
			if (!propertyMatchesFilters(prop, filterState)) return false;
			// Remaining intent-neutral client-side conditions (unchanged behaviour).
			if (selectedBeds !== "any") {
				if (selectedBeds === "4+" && prop.beds < 4) return false;
				if (selectedBeds !== "4+" && prop.beds !== Number(selectedBeds)) return false;
			}
			if (selectedBaths !== "any") {
				if (selectedBaths === "3+" && prop.baths < 3) return false;
				if (selectedBaths !== "3+" && prop.baths !== Number(selectedBaths)) return false;
			}
			if ((prop.sqft || 0) > maxSqft) return false;
			if (selectedFurnish && prop.furnishing !== selectedFurnish) return false;
			if (minRating > 0 && (prop.rating || 0) < minRating) return false;
			if (selectedFloor && selectedFloor !== (t.anyFloor || "Any Floor")) {
				const fl = Number(prop.floor) || 0;
				if (selectedFloor === (t.groundFloor || "Ground Floor")) { if (fl !== 0) return false; }
				else if (selectedFloor === (t.floor1to3 || "1st to 3rd Floor")) { if (fl < 1 || fl > 3) return false; }
			}
			return true;
		});
		list.sort((a, b) => {
			if (userLocation && searchArea === (t.nearMe || "Nearby Location")) {
				const distA = Math.hypot((a.lat || 0) - userLocation.lat, (a.lng || 0) - userLocation.lng);
				const distB = Math.hypot((b.lat || 0) - userLocation.lat, (b.lng || 0) - userLocation.lng);
				return distA - distB;
			}
			if (sortBy === "Price: Low to High") return a.price - b.price;
			if (sortBy === "Price: High to Low") return b.price - a.price;
			if (sortBy === "Popular")            return (b.popularity || 0) - (a.popularity || 0);
			return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
		});
		return list;
	}, [properties, activeDivision, selectedIntent, minPrice, maxPrice, selectedTypes, selectedCategories, selectedSubCategories, selectedFireSafety, selectedBeds, selectedBaths, maxSqft, selectedFurnish, minRating, selectedFloor, sortBy, userLocation, searchArea, t.nearMe]);

	// If the active filters remove the currently-previewed listing from the map
	// (e.g. a sidebar filter change), dismiss the bottom sheet so it never floats
	// over a marker that's no longer there — and reset the map padding.
	useEffect(() => {
		if (selectedMapProperty && !filteredProperties.some((p) => p.id === selectedMapProperty.id)) {
			setSelectedMapProperty(null);
			setBottomSheetHeight(0);
		}
	}, [filteredProperties, selectedMapProperty]);

	// ── LOCATION AUTOCOMPLETE ────────────────────────────────────────────────
	// Distinct, human-readable place labels pulled from the loaded listings'
	// own `area` / `location` fields (the granular names hosts entered), each
	// tagged with its district for context. Lets a tenant jump straight to e.g.
	// "Lalmohan" instead of browsing the whole district.
	//
	// NOTE: We use a plain object instead of `new Map()` here because the
	// lucide-react `Map` icon is imported in this file and shadows the built-in
	// JavaScript Map class — causing a "Map is not a constructor" crash when
	// bundled/minified by Vite.
	const locationSuggestions = useMemo(() => {
		const seen = {};
		for (const p of properties || []) {
			for (const cand of [{ label: p.thana, sub: p.district || p.division }, { label: p.area, sub: p.district || p.division }, { label: p.location, sub: p.district || p.division }]) {
				const label = String(cand.label || "").trim();
				if (!label) continue;
				const key = label.toLowerCase();
				if (!seen[key]) seen[key] = { label, sub: String(cand.sub || "").trim() };
			}
		}
		return Object.values(seen);
	}, [properties]);

	const matchingSuggestions = useMemo(() => {
		const q = (searchArea || "").trim().toLowerCase();
		if (q.length < 1) return [];
		const out = locationSuggestions.filter((s) => {
			const l = s.label.toLowerCase();
			return l.includes(q) && l !== q;
		});
		out.sort((a, b) => {
			const aS = a.label.toLowerCase().startsWith(q) ? 0 : 1;
			const bS = b.label.toLowerCase().startsWith(q) ? 0 : 1;
			return aS - bS || a.label.localeCompare(b.label);
		});
		return out.slice(0, 6);
	}, [locationSuggestions, searchArea]);

	const isMapMode = viewMode === "map";
	const resultCountLabel = isPropertiesLoading ? "..." : filteredProperties.length;

	// ── CONFIG-DRIVEN FILTER PANEL (intent-aware) ──────────────────────────────
	// The whole Filter_Panel is derived from the active intent's config plus a
	// pure section-visibility resolver. `selectedType` is only meaningful when
	// exactly ONE type is chosen — that's when sub-categories and the sale→land
	// override apply (multi-select keeps the broader behaviour).
	const cfg = getFilterConfig(selectedIntent);
	const selectedType = selectedTypes.length === 1 ? selectedTypes[0] : null;
	const sections = resolveSections(selectedIntent, selectedType);
	const subCategories = getSubCategories(selectedIntent, selectedType);
	const sliderMin = cfg.budgetSlider.min;
	const sliderMax = cfg.budgetSlider.max;
	const sliderStep = cfg.budgetSlider.step;

	return (
		<div className="w-full bg-[#f8f9fa] min-h-screen font-sans pb-20 relative">
			{/* TOAST */}
			<AnimatePresence>
				{toastMessage && (
					<motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 text-sm font-bold whitespace-nowrap border border-gray-700">
						<CheckCircle2 size={20} className="text-[#1ab64f]" /> {toastMessage}
					</motion.div>
				)}
			</AnimatePresence>

			{/* STICKY TOP BAR (desktop) */}
			<motion.div initial={{ y: -100 }} animate={{ y: isStickyFilter ? 0 : -100 }} transition={{ duration: 0.3 }} className="fixed top-0 inset-x-0 z-40 bg-white border-b-2 border-gray-900 hidden lg:block">
				<div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="border-2 border-gray-900 text-gray-900 text-xs font-black px-4 py-1.5 rounded-lg flex items-center gap-1 uppercase tracking-wide shadow-[2px_2px_0_0_#ba0036]">
                            {searchArea ? searchArea.charAt(0).toUpperCase() + searchArea.slice(1) : formattedDivision}
                        </span>
						<span className="text-gray-500 font-bold text-sm">
							{t.showing || "Showing"} <strong className="text-gray-900">{resultCountLabel}</strong> {t.properties || "properties"}
						</span>
					</div>
					<button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-sm font-black text-gray-900 hover:text-[#ba0036] transition-colors flex items-center gap-2 uppercase tracking-wide border-b-2 border-gray-900 hover:border-[#ba0036] pb-0.5">
						<Filter size={14} /> {t.backToTop || "Back to Top"}
					</button>
				</div>
			</motion.div>

			{/* ═══════════════════════════════════════════════════════════════
			    MOBILE: Daraz-style immersive header — replaces global Navbar
			    ─────────────────────────────────────────────────────────────── */}
			<div className="md:hidden sticky top-0 z-40 bg-white shadow-sm">
				{/* Row 1: Back arrow · Search bar · Sort icon */}
				<div className="flex items-center gap-2 px-3 pt-3 pb-2">
					<button
						onClick={goBack}
						className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
						aria-label="Go back">
						<ArrowLeft size={18} className="text-gray-800" />
					</button>
					<div className="flex-1 relative">
						<input
							type="text"
							value={searchArea}
							onChange={(e) => setSearchArea(e.target.value)}
							placeholder={t.searchAreaPlaceholder || "Search area, location..."}
							className="w-full bg-gray-100 rounded-full py-2.5 pl-9 pr-8 text-[13px] font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brandRed/30 transition-all"
						/>
						<Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
						{searchArea && (
							<button
								onClick={() => setSearchArea("")}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-gray-300 text-white active:scale-90 transition-transform"
								aria-label="Clear search">
								<X size={12} />
							</button>
						)}
					</div>
					<button
						onClick={handleNearestMe}
						className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
						aria-label={t.nearMe || "Near Me"}>
						{isLocating ? <Loader2 size={16} className="text-brandRed animate-spin" /> : <Crosshair size={16} className="text-brandRed" />}
					</button>
				</div>

				{/* Row 2: Sort Dropdown, Filter, Map */}
				<div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white">
					{/* Sort Dropdown */}
					<div className="flex items-center gap-2 flex-1">
						<select 
							value={sortBy} 
							onChange={(e) => setSortBy(e.target.value)} 
							className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-gray-900 outline-none focus:border-brandRed cursor-pointer"
						>
							<option value="Newest Listings">{t.sortNewest || "Newest Listings"}</option>
							<option value="Price: Low to High">{t.sortPriceLowHigh || "Price: Low to High"}</option>
							<option value="Price: High to Low">{t.sortPriceHighLow || "Price: High to Low"}</option>
							<option value="Popular">{t.sortPopular || "Popular"}</option>
						</select>
					</div>
					
					<div className="flex items-center gap-2 shrink-0">
						{/* Filter button */}
						<button
							onClick={() => setIsMobileFilterOpen(true)}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-black border transition-all active:scale-95 ${
								(selectedCategories.length > 0 || selectedFurnish || selectedBeds !== "any" || minRating > 0)
									? "bg-brandRed text-white border-brandRed shadow-sm"
									: "bg-white text-gray-700 border-gray-200"
							}`}>
							<Filter size={14} />
							{t.filtersBtn || "Filters"}
						</button>

						{/* Map button */}
						<button
							onClick={() => setViewMode((v) => (v === "map" ? "list" : "map"))}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-black border transition-all active:scale-95 ${
								isMapMode
									? "bg-brandRed text-white border-brandRed shadow-sm"
									: "bg-white text-gray-700 border-gray-200"
							}`}>
							{isMapMode ? <List size={14} /> : <Map size={14} />}
							{isMapMode ? "List" : "Map"}
						</button>
					</div>
				</div>

				{/* Row 3: Results count + location context */}
				<div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/80">
					<span className="text-[11px] font-bold text-gray-500">
						<strong className="text-gray-900">{resultCountLabel}</strong> {t.properties || "প্রপার্টি"} · {searchArea ? searchArea.charAt(0).toUpperCase() + searchArea.slice(1) : formattedDivision}
					</span>
					{searchArea && (
						<button onClick={() => setSearchArea("")} className="text-[10px] font-black text-brandRed active:scale-95 transition-transform">
							{t.clearAll || "Clear"}
						</button>
					)}
				</div>
			</div>



			<div className="max-w-[1400px] mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
				{/* Backdrop. On mobile it shows whenever the filter sheet is open.
				    In map mode it ALSO shows on desktop because the filter renders as a
				    full sheet over the OYO map at every breakpoint. */}
				{isMobileFilterOpen && (
					<div
						className={`fixed inset-0 bg-black/50 transition-opacity ${
							isMapMode ? "z-[75]" : "z-40 lg:hidden"
						}`}
						onClick={() => setIsMobileFilterOpen(false)}
					/>
				)}

				{/* SIDEBAR FILTERS
				    Two render modes:
				      • Default (list view)  → desktop: in-flow sticky sidebar; mobile: bottom-sheet
				      • Map mode             → bottom-sheet on EVERY breakpoint so the Filter
				                                button in the map's bottom dock can open it on top
				                                of the full-screen map. */}
				<aside className={`bg-white max-h-[90vh] overflow-y-auto transition-transform duration-300 transform ${
					isMapMode
						? `fixed inset-x-0 bottom-0 z-[80] rounded-t-[2rem] ${isMobileFilterOpen ? "translate-y-0" : "translate-y-full"}`
						: `fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] lg:sticky lg:top-[90px] lg:z-10 lg:h-[calc(100vh-110px)] lg:block lg:rounded-[2rem] lg:border lg:border-gray-100 lg:shadow-sm lg:p-0 ${isMobileFilterOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"}`
				}`}>
					<div className={`sticky top-0 bg-white z-20 px-6 pt-4 pb-2 border-b border-gray-50 rounded-t-[2rem] ${isMapMode ? "" : "lg:hidden"}`}>
						<div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4"></div>
						<div className="flex justify-between items-center mb-2">
							<h2 className="text-xl font-black text-gray-900">{t.filtersBtn || "Filters"}</h2>
							<div className="flex items-center gap-2">
								<button onClick={handleClearAll} className="text-[11px] font-black text-[#ba0036] uppercase tracking-wider px-2 py-1 rounded-md hover:bg-red-50 transition-colors">
									{t.clearAll || "Clear All"}
								</button>
								<button onClick={() => setIsMobileFilterOpen(false)} aria-label="Close filters" className="p-2 bg-gray-100 rounded-full active:scale-95 transition-transform">
									<X size={18} />
								</button>
							</div>
						</div>
					</div>

					<div className="p-6 lg:p-6 lg:h-full lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
						<div className="hidden lg:flex justify-between items-center mb-8 border-b-2 border-gray-900 pb-4">
							<h2 className="text-xl font-black text-gray-900 uppercase tracking-wider">{t.filtersBtn || "Filters"}</h2>
							<button onClick={handleClearAll} className="text-xs font-black text-[#ba0036] hover:text-gray-900 uppercase tracking-widest transition-colors border-b-2 border-transparent hover:border-gray-900">
								{t.clearAll || "Clear All"}
							</button>
						</div>

						{/* Intent tabs — top of the shared filter panel (desktop + mobile). */}
						<IntentTabBar activeIntent={selectedIntent} onChange={handleIntentChange} />

						<FilterSection title={t.filterLocation || "Location"}>
							{/* Search input — desktop sidebar only.
							    On mobile the top bar search already handles this. */}
							<div className="hidden lg:block relative mb-4">
								<input type="text" value={searchArea} onChange={(e) => { setSearchArea(e.target.value); setShowSuggest(true); }} onFocus={() => setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 120)} placeholder={t.searchAreaPlaceholder || "Search area..."} className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-10 pr-24 text-xs font-bold focus:border-brandRed outline-none" />
								<Search size={14} className="absolute left-3.5 top-3.5 text-gray-400" />
								<button onClick={handleNearestMe} disabled={isLocating} className="absolute right-2 top-2 bg-white border border-gray-200 shadow-sm text-[9px] font-black uppercase text-brandRed px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-red-50 transition-colors">
									<Navigation size={10} className={isLocating ? "animate-spin" : ""} /> {isLocating ? t.locating || "Locating" : t.nearMe || "Near Me"}
								</button>
								{showSuggest && matchingSuggestions.length > 0 && (
									<div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-[0_12px_30px_rgba(0,0,0,0.10)] z-40 overflow-hidden">
										{matchingSuggestions.map((s, i) => (
											<button
												key={`${s.label}-${i}`}
												onMouseDown={(e) => { e.preventDefault(); setSearchArea(s.label); setShowSuggest(false); }}
												className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
												<MapPin size={13} className="text-brandRed shrink-0" />
												<span className="text-xs font-bold text-gray-900 truncate">{s.label}</span>
												{s.sub && <span className="text-[10px] font-bold text-gray-400 ml-auto uppercase tracking-wide shrink-0 capitalize">{s.sub}</span>}
											</button>
										))}
									</div>
								)}
							</div>
							<div className="flex flex-wrap gap-2">
								{[t.districtNames?.gulshan || "Gulshan", t.districtNames?.banani || "Banani", t.districtNames?.dhanmondi || "Dhanmondi", t.districtNames?.bashundhara || "Bashundhara"].map((area) => (
									<button key={area} onClick={() => setSearchArea(searchArea === area ? "" : area)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${searchArea === area ? "bg-brandRed text-white border-brandRed shadow-md" : "bg-gray-50 text-gray-600 border-transparent hover:border-brandRed hover:text-brandRed"}`}>
										{area}
									</button>
								))}
							</div>
						</FilterSection>

						<FilterSection title={t.filterPrice || "Price Range"}>
							<div className="px-2 pb-4">
								{/* Intent-specific price meaning (per month / total). */}
								<p className="text-[10px] font-black text-brandRed mb-3 uppercase tracking-wider">{cfg.priceLabel}</p>
								{/* Quick budget pills — one tap sets the min/max range (Requirement 4.1, 4.2, 4.7). */}
								<div className="mb-5">
									<p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-wider">{t.quickBudgetLabel || "Quick budget"}</p>
									<div className="flex flex-wrap gap-1.5">
										{cfg.budgetPills.map((pill) => {
											const active = isPillActive(pill, minPrice, maxPrice);
											return (
												<button
													key={pill.id}
													type="button"
													onClick={() => { setMinPrice(pill.min); setMaxPrice(pill.max); }}
													className={`px-2.5 py-1.5 rounded-full text-[11px] font-black border-2 transition-all ${
														active
															? "bg-gray-900 text-white border-gray-900"
															: "bg-white text-gray-700 border-gray-200 hover:border-gray-900"
													}`}
												>
													{pill.labelBn}
												</button>
											);
										})}
									</div>
								</div>
								{/* Selected range readout — lakh/crore aware (Requirement 5). */}
								<div className="flex items-center justify-between mb-2 text-xs font-black text-brandRed">
									<span>{formatBudget(minPrice, selectedIntent)}</span>
									<span>{formatBudget(maxPrice, selectedIntent)}</span>
								</div>
								<div className="relative h-2 bg-gray-200 rounded-full mb-10 mt-6 mx-2">
									<div className="absolute h-full bg-brandRed rounded-full z-10" style={{ left: `${((minPrice - sliderMin) / (sliderMax - sliderMin)) * 100}%`, right: `${((sliderMax - maxPrice) / (sliderMax - sliderMin)) * 100}%` }}></div>
									<input type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={minPrice} onChange={(e) => setMinPrice(Math.min(Number(e.target.value), maxPrice - sliderStep))} className="absolute w-full -top-3 h-8 appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-brandRed [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg cursor-pointer" />
									<input type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={maxPrice} onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), minPrice + sliderStep))} className="absolute w-full -top-3 h-8 appearance-none bg-transparent pointer-events-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-brandRed [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg cursor-pointer" />
								</div>
								<div className="flex gap-4">
									<div className="flex-1">
										<label className="text-[9px] font-black text-gray-400 uppercase">{t.minPrice || "Min Price"}</label>
										<input type="number" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-brandRed text-gray-700" />
									</div>
									<div className="flex-1">
										<label className="text-[9px] font-black text-gray-400 uppercase">{t.maxPrice || "Max Price"}</label>
										<input type="number" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-brandRed text-gray-700" />
									</div>
								</div>
							</div>
						</FilterSection>

						{/* Property Type — driven by the active intent's config (Requirement 6). */}
						<FilterSection title={t.filterPropType || "Property Type"}>
							<div className="grid grid-cols-1 gap-2">
								{cfg.propertyTypes.map((type) => (
									<label key={type.id} className={`flex items-center gap-3 cursor-pointer px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all ${selectedTypes.includes(type.id) ? 'border-gray-900 bg-gray-50' : 'border-transparent hover:border-gray-300'}`}>
										<input type="checkbox" checked={selectedTypes.includes(type.id)} onChange={() => handleTypeToggle(type.id)} className="w-4 h-4 rounded accent-gray-900" /> {type.labelBn}
									</label>
								))}
							</div>
						</FilterSection>

						{/* "Who lives" — rent only (Requirement 7.1, 8). */}
						{sections.showWhoLives && (
							<FilterSection title={t.filterWhoMovesIn || "Who's moving in?"}>
								{/* 2-column chip grid. Each chip toggles a category id — multi-select supported. */}
								<div className="grid grid-cols-2 gap-2">
									{cfg.categories.map((cat) => {
										const Icon = ICON_MAP[cat.icon] || Home;
										const active = selectedCategories.includes(cat.id);
										return (
											<button
												key={cat.id}
												type="button"
												onClick={() => toggleArrayState(setSelectedCategories, cat.id)}
												className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 text-[11px] font-black leading-tight text-center transition-all ${
													active
														? "bg-gray-900 text-white border-gray-900 shadow-[2px_2px_0_0_#ba0036]"
														: "bg-white text-gray-700 border-gray-200 hover:border-gray-900 hover:text-gray-900"
												}`}
											>
												<Icon size={18} className={active ? "text-white" : "text-brandRed"} />
												<span>{cat.labelBn}</span>
											</button>
										);
									})}
								</div>
							</FilterSection>
						)}

						{/* Sub-Category — sale/commercial, only when exactly one type is picked (Requirement 7.2–7.4). */}
						{subCategories.length > 0 && (
							<FilterSection title={t.filterSubCategory || "Sub-Category"}>
								<div className="grid grid-cols-2 gap-2">
									{subCategories.map((sub) => {
										const active = selectedSubCategories.includes(sub.id);
										return (
											<button
												key={sub.id}
												type="button"
												onClick={() => toggleArrayState(setSelectedSubCategories, sub.id)}
												className={`py-2.5 px-2 rounded-xl border-2 text-[11px] font-black leading-tight text-center transition-all ${
													active
														? "bg-gray-900 text-white border-gray-900 shadow-[2px_2px_0_0_#ba0036]"
														: "bg-white text-gray-700 border-gray-200 hover:border-gray-900 hover:text-gray-900"
												}`}
											>
												{sub.labelBn}
											</button>
										);
									})}
								</div>
							</FilterSection>
						)}

						{/* Bedrooms — hidden for commercial and for sale→land (Requirement 9). */}
						{sections.showBedBath && (
							<FilterSection title={t.bedrooms || "Bedrooms"}>
								<div className="flex gap-2">
									{[
										{ id: "any", text: t.any || "Any" },
										{ id: "1", text: "1" },
										{ id: "2", text: "2" },
										{ id: "3", text: "3" },
										{ id: "4+", text: "4+" },
									].map((num) => (
										<button key={num.id} onClick={() => setSelectedBeds(num.id)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${selectedBeds === num.id ? "bg-brandRed text-white border-brandRed" : "border-gray-100 text-gray-500 hover:border-brandRed"}`}>
											{num.text}
										</button>
									))}
								</div>
							</FilterSection>
						)}

						{/* Bathrooms — options any/1/2/3+ (Requirement 9.6). */}
						{sections.showBedBath && (
							<FilterSection title={t.bathrooms || "Bathrooms"}>
								<div className="flex gap-2">
									{[
										{ id: "any", text: t.any || "Any" },
										{ id: "1", text: "1" },
										{ id: "2", text: "2" },
										{ id: "3+", text: "3+" },
									].map((num) => (
										<button key={num.id} onClick={() => setSelectedBaths(num.id)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${selectedBaths === num.id ? "bg-brandRed text-white border-brandRed" : "border-gray-100 text-gray-500 hover:border-brandRed"}`}>
											{num.text}
										</button>
									))}
								</div>
							</FilterSection>
						)}

						{/* Furnishing — hidden for commercial and for sale→land (Requirement 9.2, 9.4). */}
						{sections.showFurnishing && (
							<FilterSection title={t.furnishing || "Furnishing"}>
								<div className="grid grid-cols-1 gap-2">
									{[
										{ id: "", label: t.any || "Any" },
										{ id: "Furnished", label: t.furnished || "Furnished" },
										{ id: "Semi-Furnished", label: t.semiFurnished || "Semi-Furnished" },
										{ id: "Unfurnished", label: t.unfurnished || "Unfurnished" },
									].map((f) => (
										<label key={f.id} className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
											<input type="radio" name="furnish" checked={selectedFurnish === f.id} onChange={() => setSelectedFurnish(f.id)} className="accent-brandRed w-4 h-4" /> {f.label}
										</label>
									))}
								</div>
							</FilterSection>
						)}

						{/* Fire Safety — commercial only (Requirement 10). */}
						{sections.showFireSafety && (
							<FilterSection title={t.fireSafety || "Fire Safety"}>
								<div className="flex gap-2">
									{[
										{ id: "", label: t.any || "Any" },
										{ id: "yes", label: t.yes || "Yes" },
										{ id: "no", label: t.no || "No" },
									].map((opt) => (
										<button key={opt.id || "any"} type="button" onClick={() => setSelectedFireSafety(opt.id)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${selectedFireSafety === opt.id ? "bg-brandRed text-white border-brandRed" : "border-gray-100 text-gray-500 hover:border-brandRed"}`}>
											{opt.label}
										</button>
									))}
								</div>
							</FilterSection>
						)}

						{/* Size (sqft) — slider bounds from the intent config (Requirement 11.1–11.4). */}
						<FilterSection title={t.filterSize || "Size (Area Sqft)"}>
							<div className="px-2">
								<div className="flex items-center justify-between mb-4 text-xs font-bold text-gray-600">
									<span className="flex items-center gap-2">
										<Ruler size={14} className="text-brandRed" /> {t.maxSize || "Max Size:"}
									</span>
									<span className="text-brandRed">{maxSqft} sqft</span>
								</div>
								<input type="range" min={cfg.sqftSlider.min} max={cfg.sqftSlider.max} step={cfg.sqftSlider.step} value={maxSqft} onChange={(e) => setMaxSqft(Number(e.target.value))} className="w-full accent-brandRed cursor-pointer" />
							</div>
						</FilterSection>

						{/* Amenities (config-driven) + Floor (hidden for sale→land) — Requirement 11.5–11.8. */}
						<FilterSection title={t.filterAmenities || "Amenities & Floor"}>
							<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.amenities || "Amenities"}</p>
							<div className="grid grid-cols-2 gap-3 mb-5">
								{cfg.amenities.map((a) => (
									<label key={a.id} className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
										<input type="checkbox" checked={selectedAmenities.includes(a.id)} onChange={() => toggleArrayState(setSelectedAmenities, a.id)} className="accent-brandRed w-4 h-4 rounded" /> {a.labelBn}
									</label>
								))}
							</div>
							{sections.showFloor && (
								<>
									<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.floorLevel || "Floor Level"}</p>
									<select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-brandRed">
										<option>{t.anyFloor || "Any Floor"}</option>
										<option>{t.groundFloor || "Ground Floor"}</option>
										<option>{t.floor1to3 || "1st to 3rd Floor"}</option>
									</select>
								</>
							)}
						</FilterSection>

						<FilterSection title={t.filterRating || "Property Rating"}>
							<div className="flex flex-col gap-3">
								{[
									{ val: 4, label: t.star4Above || "4.0 & Above" },
									{ val: 3, label: t.star3Above || "3.0 & Above" },
									{ val: 0, label: t.anyRating || "Any Rating" },
								].map((r) => (
									<label key={r.val} className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
										<input type="radio" name="rating" checked={minRating === r.val} onChange={() => setMinRating(r.val)} className="accent-brandRed w-4 h-4" />
										<Star size={14} className={r.val > 0 ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} /> {r.label}
									</label>
								))}
							</div>
						</FilterSection>

						<div className="pt-4 mt-6 lg:hidden">
							<button
								onClick={() => {
									setIsMobileFilterOpen(false);
									window.scrollTo({ top: 0, behavior: "smooth" });
								}}
								className="w-full bg-gray-900 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-transform">
								{t.applyFiltersBtn || "Apply Filters"}
							</button>
						</div>
					</div>
				</aside>

				{/* MAIN RIGHT CONTENT */}
				<main className="flex flex-col gap-2 lg:gap-3 min-h-screen">
					<div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
						<div>
							<p className="text-xs font-bold text-gray-500 flex items-center gap-2 mb-2">
								<Link to="/" className="hover:text-brandRed transition-colors">
									{t.home || "Home"}
								</Link>{" "}
								<ChevronRight size={12} />
								<Link to="/properties/all" className="hover:text-brandRed transition-colors">
									{t.bangladesh || "Bangladesh"}
								</Link>{" "}
								<ChevronRight size={12} />
								<span className={searchArea ? "hover:text-brandRed cursor-pointer transition-colors" : "text-gray-900"} onClick={() => setSearchArea("")}>
									{formattedDivision}
								</span>
								{searchArea && searchArea !== (t.nearMe || "Nearby Location") && (
									<>
										<ChevronRight size={12} />
										<span className="text-brandRed">{searchArea.charAt(0).toUpperCase() + searchArea.slice(1)}</span>
									</>
								)}
							</p>
							<h1 className="text-3xl font-black text-gray-900 tracking-tight">
								{searchArea && searchArea !== (t.nearMe || "Nearby Location") ? searchArea.charAt(0).toUpperCase() + searchArea.slice(1) : formattedDivision} {t.properties || "Properties"}
							</h1>
						</div>
						<div className="flex items-center gap-3">
							<div className="hidden md:flex items-center bg-gray-100 rounded-xl p-1 gap-1">
								<button onClick={() => setViewMode("list")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${!isMapMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
									<List size={14} /> List
								</button>
								<button onClick={() => setViewMode("map")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${isMapMode ? "bg-brandRed text-white shadow-sm" : "text-gray-500 hover:text-brandRed"}`}>
									<Map size={14} /> Map View
								</button>
							</div>
							<div className="hidden md:flex items-center gap-2">
								<span className="text-sm font-bold text-gray-500">{t.sortBy || "Sort by:"}</span>
								<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-brandRed cursor-pointer shadow-sm hover:shadow-md transition-shadow">
									<option value="Newest Listings">{t.sortNewest || "Newest Listings"}</option>
									<option value="Price: Low to High">{t.sortPriceLowHigh || "Price: Low to High"}</option>
									<option value="Price: High to Low">{t.sortPriceHighLow || "Price: High to Low"}</option>
									<option value="Popular">{t.sortPopular || "Popular"}</option>
								</select>
							</div>
						</div>
					</div>

					<AnimatePresence mode="wait">
						{isMapMode ? null : (
							<motion.div key="list-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-full">
								{isPropertiesLoading ? (
									Array.from({ length: 6 }, (_, idx) => (
										<div key={`property-skeleton-${idx}`} className="mb-4 md:mb-6">
											<PropertyCardSkeleton />
										</div>
									))
								) : filteredProperties.length > 0 ? (
									filteredProperties.map((property) => {
										return (
											<React.Fragment key={property.id}>
												{/* Unified PropertyCard for both Desktop and Mobile */}
												<div className="mb-4 md:mb-6">
													<PropertyCard property={property} navigate={navigate} t={t} showToast={showToast} isHighlighted={highlightedId === property.id} onHover={setHighlightedId} onHoverEnd={() => setHighlightedId(null)} onInquire={openInquiry} />
												</div>
											</React.Fragment>
										);
									})
								) : (
									<div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 flex flex-col items-center justify-center shadow-sm">
										<div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
											<Search className="text-brandRed" size={24} />
										</div>
										<h3 className="text-xl font-black text-gray-900 mb-2">{propertyLoadError ? "Could not load properties" : (t.noPropsFound || "No Properties Found")}</h3>
										<p className="text-sm font-bold text-gray-500 mb-6">{propertyLoadError || t.noPropsDesc || "Try adjusting your filters or search criteria."}</p>
										<button onClick={propertyLoadError ? () => setPropertyRefreshTick((tick) => tick + 1) : handleClearAll} className="bg-gray-900 text-white px-8 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-md hover:shadow-lg">
											{propertyLoadError ? "Retry" : (t.clearFilters || "Clear Filters")}
										</button>
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</main>
			</div>

			{/* ── OYO-STYLE FULL-SCREEN MAP (shared by mobile + desktop) ─────────────
			    Renders as a fixed overlay above the page when `viewMode === 'map'`.
			    Same component & state on every breakpoint — no mobile/desktop fork. */}
			<AnimatePresence>
				{isMapMode && (
					<motion.div
						key="oyo-map"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18 }}
						className="fixed inset-0 z-[60] bg-white flex flex-col"
						role="dialog"
						aria-label="Map view"
					>
						{/* ── FLOATING FILTER BAR (replaces the old breadcrumb/count header) ──
						    A sticky bar that floats over the map (absolute z-10) — it never
						    pushes the map container down. Row 1: back · search · Filters.
						    Row 2: horizontally-scrolling tenant-type chips wired to the same
						    `selectedCategories` filter state as the sidebar. */}
						<motion.div
							initial={{ y: -24, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							transition={{ type: "spring", damping: 26, stiffness: 260 }}
							className="absolute top-0 inset-x-0 z-10 px-3 pt-3 pb-1 pointer-events-none"
						>
							<div className="max-w-[640px] mx-auto flex flex-col gap-2">
								{/* Row 1 — back · search · filters */}
								<div className="bg-white rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.18)] flex items-center gap-1 px-2 py-1.5 pointer-events-auto border border-gray-100">
									<button
										onClick={() => setViewMode("list")}
										aria-label="Back to list"
										className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shrink-0">
										<ArrowLeft size={18} className="text-gray-800" />
									</button>
									<input
										type="text"
										value={searchArea}
										onChange={(e) => setSearchArea(e.target.value)}
										placeholder={searchArea ? "" : (t.searchAreaPlaceholder || "Search area...")}
										className="flex-1 min-w-0 outline-none bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400"
									/>
									{searchArea && (
										<button
											onClick={() => setSearchArea("")}
											aria-label="Clear search"
											className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shrink-0">
											<X size={16} className="text-gray-600" />
										</button>
									)}
									<button
										onClick={() => setIsMobileFilterOpen(true)}
										aria-label={t.filtersBtn || "Filters"}
										className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-[12px] font-black active:scale-95 transition-transform shrink-0">
										<SlidersHorizontal size={14} /> {t.filtersBtn || "Filters"}
									</button>
								</div>

								{/* Row 2 — horizontally-scrolling tenant-type chips.
								    Tenant categories only exist for RENT (mirrors the sidebar's
								    showWhoLives), so the chips are hidden for Buy / Commercial. */}
								{selectedIntent === "rent" && (
									<div className="flex gap-2 overflow-x-auto pb-1 pointer-events-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
										{MAP_FILTER_CHIPS.map((chip) => {
											const active = isMapChipActive(chip);
											return (
												<button
													key={chip.id}
													type="button"
													onClick={() => handleMapChipClick(chip)}
													aria-pressed={active}
													className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-[12px] font-black border transition-all active:scale-95 shadow-sm ${
														active
															? "bg-gray-900 text-white border-gray-900"
															: "bg-white text-gray-700 border-gray-200 hover:border-gray-900"
													}`}
												>
													{language === "বাংলা" ? chip.labelBn : chip.labelEn}
												</button>
											);
										})}
									</div>
								)}
							</div>
						</motion.div>

						{/* Map fills the whole screen */}
						<div className="absolute inset-0">
							<div className="w-full h-full">
								<MapView
									properties={filteredProperties}
									activeId={selectedMapProperty?.id}
									onMarkerClick={(prop) => setSelectedMapProperty(prop)}
									bottomSheetHeight={bottomSheetHeight}
								/>
							</div>
						</div>

						{/* ── FLOATING BOTTOM SHEET (springs up on marker tap) ──
						    Sits at the bottom with margins on every side. The map camera
						    pads its viewport by the card's measured height (onHeightChange)
						    so the active marker stays centred above the card. Closing it
						    deselects the marker (resets the inverted pill + padding). */}
						<div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
							<AnimatePresence>
								{selectedMapProperty && (
									<BottomSheetCard
										key="map-bottom-sheet"
										property={selectedMapProperty}
										onOpen={(p) => navigate(`/property/${p.id}`)}
										onClose={() => {
											setSelectedMapProperty(null);
											setBottomSheetHeight(0);
										}}
										onHeightChange={setBottomSheetHeight}
									/>
								)}
							</AnimatePresence>
						</div>

						{/* Floating "back to list" pill — hidden while the bottom sheet is up
						    so the card (and the map's Google attribution) stay clear. */}
						{!selectedMapProperty && (
							<button
								onClick={() => setViewMode("list")}
								aria-label={language === "বাংলা" ? "তালিকা দেখুন" : "Show list"}
								className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 bg-gray-900 text-white px-5 py-2.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex items-center gap-2 text-sm font-black active:scale-95 transition-transform">
								<List size={16} /> {language === "বাংলা" ? "তালিকা" : "List"}
							</button>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── INQUIRY MODAL (single instance, shown for whichever property was clicked) ── */}
			<InquiryModal isOpen={!!inquiryTarget} onClose={closeInquiry} property={inquiryTarget} landlord={inquiryLandlord} />
		</div>
	);
};

export default PropertyListing;