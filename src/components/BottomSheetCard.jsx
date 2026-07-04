import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BedDouble, Bath, Square, X, MapPin, Star, Camera, ChevronLeft, ChevronRight, Navigation } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { formatBdt, toLocalizedDigits, isBengali } from "../utils/formatCurrency";

// Bilingual property-type labels for Row 1 ("Apartment in …"). Falls back to a
// title-cased version of the raw type when a mapping is missing.
const TYPE_LABELS = {
	flat: { en: "Apartment", bn: "অ্যাপার্টমেন্ট" },
	apartment: { en: "Apartment", bn: "অ্যাপার্টমেন্ট" },
	house: { en: "House", bn: "বাড়ি" },
	independent: { en: "House", bn: "বাড়ি" },
	duplex: { en: "Duplex", bn: "ডুপ্লেক্স" },
	triplex: { en: "Triplex", bn: "ট্রিপ্লেক্স" },
	studio: { en: "Studio", bn: "স্টুডিও" },
	sublet: { en: "Sublet", bn: "সাবলেট" },
	hostel: { en: "Hostel", bn: "হোস্টেল" },
	single_room: { en: "Room", bn: "রুম" },
	land: { en: "Land", bn: "জমি" },
	building: { en: "Building", bn: "বিল্ডিং" },
	shop: { en: "Shop", bn: "দোকান" },
	office: { en: "Office", bn: "অফিস" },
	showroom: { en: "Showroom", bn: "শোরুম" },
	restaurant: { en: "Restaurant", bn: "রেস্তোরাঁ" },
	warehouse: { en: "Warehouse", bn: "ওয়্যারহাউজ" },
	co_working: { en: "Co-working", bn: "কো-ওয়ার্কিং" },
};

const titleCase = (s) =>
	String(s || "")
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());

// ─── BOTTOM SHEET CARD ───────────────────────────────────────────────────────
// Floating preview card that springs up from the bottom when a map marker is
// selected. Not flush to the screen edges — it keeps margins on every side,
// rounded corners and a drop shadow so the map (and its Google attribution)
// stays visible around it.
//
// Layout:
//   • Image carousel — native horizontal scroll-snap (snap-x / snap-mandatory,
//     no extra carousel dependency) with animated pagination dots. Uses
//     property.images[] when present, otherwise a single fallback slide.
//   • Row 1 — property type + address ("Apartment in Savar, Dhaka").
//   • Row 2 — beds / baths / sq ft with lucide icons.
//   • Row 3 — bold price ("৳ ২৩,০০০ / month").
//   • Floating ✕ (top-right) dismisses the card and deselects the marker.
//
// `onHeightChange` reports the card's rendered height back to the map so it can
// pad the viewport and keep the active marker centred above the card.
const BottomSheetCard = ({ property, onClose, onOpen, onHeightChange }) => {
	const { t, language } = useLanguage();
	const bn = isBengali(language);

	const scrollRef = useRef(null);
	const cardRef = useRef(null);
	const [activeSlide, setActiveSlide] = useState(0);

	// Slides: prefer the real images array, else fall back to a single cover
	// image (property.image / img / coverPhoto), else an empty placeholder slide.
	const slides = useMemo(() => {
		const imgs = Array.isArray(property?.images) ? property.images.filter(Boolean) : [];
		if (imgs.length) return imgs;
		const single = property?.image || property?.img || property?.coverPhoto;
		return single ? [single] : [null];
	}, [property]);

	// Report height to the parent (for map padding) on mount + whenever the
	// content resizes (e.g. an image finishes loading and changes the height).
	useEffect(() => {
		if (!onHeightChange || !cardRef.current) return;
		const el = cardRef.current;
		const report = () => onHeightChange(el.offsetHeight);
		report();
		let ro;
		if (typeof ResizeObserver !== "undefined") {
			ro = new ResizeObserver(report);
			ro.observe(el);
		}
		return () => ro && ro.disconnect();
	}, [onHeightChange, property?.id]);

	// Reset the carousel to the first slide when a different property is shown.
	useEffect(() => {
		setActiveSlide(0);
		if (scrollRef.current) scrollRef.current.scrollLeft = 0;
	}, [property?.id]);

	if (!property) return null;

	const handleScroll = () => {
		const el = scrollRef.current;
		if (!el || el.clientWidth === 0) return;
		setActiveSlide(Math.round(el.scrollLeft / el.clientWidth));
	};

	const goToSlide = (i) => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
	};
	const goPrev = (e) => { e.stopPropagation(); goToSlide(Math.max(0, activeSlide - 1)); };
	const goNext = (e) => { e.stopPropagation(); goToSlide(Math.min(slides.length - 1, activeSlide + 1)); };

	// Row 1 — type + address, grammatical in both languages.
	const typeLabel =
		(TYPE_LABELS[property.type] && TYPE_LABELS[property.type][bn ? "bn" : "en"]) ||
		titleCase(property.type) ||
		(bn ? "প্রপার্টি" : "Property");
	const address =
		property.location ||
		[property.area, property.district || property.division].filter(Boolean).join(", ") ||
		"";
	const typeAddressLine = address
		? bn
			? `${typeLabel} · ${address}`
			: `${typeLabel} in ${address}`
		: typeLabel;

	// Location control — opens the listing's coordinates (or address) in Google
	// Maps in a new tab. Uses precise lat/lng when available, else the address.
	const hasLocation = (property.lat && property.lng) || !!address;
	const openLocation = (e) => {
		e.stopPropagation();
		const query = property.lat && property.lng ? `${property.lat},${property.lng}` : address || property.title || "";
		if (!query) return;
		window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
	};

	// Row 3 — price + per-month suffix (rent/commercial), nothing extra for sale.
	const priceSuffix = property.intent === "sale" ? "" : bn ? " / মাস" : " / month";
	const sqftUnit = bn ? "বর্গফুট" : "sqft";

	return (
		<motion.div
			ref={cardRef}
			initial={{ y: "110%", opacity: 0.4 }}
			animate={{ y: 0, opacity: 1 }}
			exit={{ y: "115%", opacity: 0 }}
			transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.9 }}
			className="pointer-events-auto relative mx-3 mb-3 max-w-[560px] sm:mx-auto bg-white rounded-3xl shadow-[0_18px_50px_rgba(0,0,0,0.25)] border border-gray-100 overflow-hidden"
			role="dialog"
			aria-label={`${property.title || typeLabel} preview`}
		>
			{/* ── IMAGE CAROUSEL (scroll-snap, no external carousel lib) ── */}
			<div className="relative">
				<div
					ref={scrollRef}
					onScroll={handleScroll}
					className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
				>
					{slides.map((src, i) => (
						<div
							key={i}
							className="relative w-full shrink-0 snap-center bg-gray-100 aspect-[16/10]"
							onClick={() => onOpen && onOpen(property)}
							role={onOpen ? "button" : undefined}
						>
							{src ? (
								<img
									src={src}
									alt={`${property.title || typeLabel} — ${i + 1}`}
									className="absolute inset-0 w-full h-full object-cover"
									loading="lazy"
									decoding="async"
								/>
							) : (
								<div className="absolute inset-0 flex items-center justify-center text-gray-300">
									<Camera size={40} />
								</div>
							)}
						</div>
					))}
				</div>

				{/* Carousel scroll arrows — prev/next (only with multiple images) */}
				{slides.length > 1 && (
					<>
						{activeSlide > 0 && (
							<button
								type="button"
								onClick={goPrev}
								aria-label="Previous image"
								className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur rounded-full shadow-md hover:bg-white active:scale-90 transition-all"
							>
								<ChevronLeft size={18} className="text-gray-800" />
							</button>
						)}
						{activeSlide < slides.length - 1 && (
							<button
								type="button"
								onClick={goNext}
								aria-label="Next image"
								className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur rounded-full shadow-md hover:bg-white active:scale-90 transition-all"
							>
								<ChevronRight size={18} className="text-gray-800" />
							</button>
						)}
					</>
				)}

				{/* Location tab — opens the property location in Google Maps */}
				{hasLocation && (
					<button
						type="button"
						onClick={openLocation}
						aria-label={bn ? "গুগল ম্যাপে লোকেশন দেখুন" : "View location on Google Maps"}
						className="absolute bottom-2.5 left-3 z-10 flex items-center gap-1 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-black text-gray-900 shadow-sm hover:bg-white active:scale-95 transition-all"
					>
						<Navigation size={11} className="text-brandRed" />
						{bn ? "লোকেশন" : "Location"}
					</button>
				)}

				{/* Rating pill (mirrors the listing cards) */}
				{property.rating != null && (
					<div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-black shadow-sm">
						<Star size={11} className="fill-yellow-400 text-yellow-400" />
						{toLocalizedDigits(property.rating, language)}
						{property.reviews != null && (
							<span className="text-gray-400 font-bold">
								({toLocalizedDigits(property.reviews, language)})
							</span>
						)}
					</div>
				)}

				{/* Pagination dots — animated width on the active slide (Framer Motion) */}
				{slides.length > 1 && (
					<div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
						{slides.map((_, i) => (
							<motion.button
								key={i}
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									goToSlide(i);
								}}
								aria-label={`Go to image ${i + 1}`}
								animate={{ width: i === activeSlide ? 18 : 6, opacity: i === activeSlide ? 1 : 0.65 }}
								transition={{ type: "spring", damping: 24, stiffness: 320 }}
								className="h-1.5 rounded-full bg-white shadow pointer-events-auto"
								style={{ width: 6 }}
							/>
						))}
					</div>
				)}
			</div>

			{/* ── CONTENT ── */}
			<div
				className="p-4 pr-10 cursor-pointer"
				onClick={() => onOpen && onOpen(property)}
			>
				{/* Row 1 — type + address */}
				<p className="text-[13px] sm:text-sm font-black text-gray-900 leading-snug flex items-start gap-1.5">
					<MapPin size={14} className="text-brandRed shrink-0 mt-0.5" />
					<span className="line-clamp-2">{typeAddressLine}</span>
				</p>

				{/* Row 2 — beds / baths / sqft */}
				<div className="mt-2.5 flex items-center gap-4 text-[12px] font-bold text-gray-600">
					<span className="flex items-center gap-1.5">
						<BedDouble size={15} className="text-gray-400" />
						{toLocalizedDigits(property.beds ?? 0, language)}
					</span>
					<span className="flex items-center gap-1.5">
						<Bath size={15} className="text-gray-400" />
						{toLocalizedDigits(property.baths ?? 0, language)}
					</span>
					<span className="flex items-center gap-1.5">
						<Square size={15} className="text-gray-400" />
						{toLocalizedDigits(property.sqft ?? 0, language)} {sqftUnit}
					</span>
				</div>

				{/* Row 3 — price */}
				<p className="mt-2.5 text-lg font-black text-gray-900 tracking-tight">
					{formatBdt(property.price, language)}
					{priceSuffix && (
						<span className="text-xs font-bold text-gray-400">{priceSuffix}</span>
					)}
				</p>
			</div>

			{/* Floating dismiss button */}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onClose && onClose();
				}}
				aria-label="Close preview"
				className="absolute top-3 right-3 z-10 p-1.5 bg-white/95 backdrop-blur rounded-full shadow-sm border border-gray-100 hover:bg-gray-100 active:scale-95 transition-all"
			>
				<X size={15} className="text-gray-700" />
			</button>
		</motion.div>
	);
};

export default BottomSheetCard;
