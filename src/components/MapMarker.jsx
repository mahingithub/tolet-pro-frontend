import React from "react";
import { OverlayView, OverlayViewF } from "@react-google-maps/api";
import { Store } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { formatBdt } from "../utils/formatCurrency";

// ─── MAP MARKER (individual property price pill) ─────────────────────────────
// Rendered as a Google Maps overlay via OverlayViewF so it can be a real,
// styled DOM node instead of a raster pin.
//
//   • Residential/sale : white pill (→ black when active), bold price text.
//   • Commercial       : indigo-accented pill with a small storefront icon so
//                         commercial listings stand out from residential ones on
//                         the map (they used to be indistinguishable). Turns
//                         solid indigo when active, mirroring the black active
//                         state used for the other intents.
//
// The active swap runs on a ~200ms CSS transition (background + colour +
// transform), so selecting a marker reads as a smooth highlight, not a hard cut.
//
// The pill is anchored by its bottom-centre onto the marker coordinate (see
// getPixelPositionOffset), matching how a physical map pin points at a place.
const MapMarker = ({ lat, lng, price, title, intent, isActive = false, onClick }) => {
	const { language } = useLanguage();
	const label = formatBdt(price, language);
	const isCommercial = intent === "commercial";

	// Colour scheme per intent + selection state. Commercial gets its own indigo
	// identity; everything else keeps the original white/black scheme.
	let stateClasses;
	if (isCommercial) {
		stateClasses = isActive
			? "bg-indigo-600 text-white border-indigo-600 shadow-[0_8px_22px_rgba(79,70,229,0.5)] scale-110"
			: "bg-white text-indigo-700 border-indigo-500 shadow-[0_4px_14px_rgba(79,70,229,0.28)] hover:border-indigo-700";
	} else {
		stateClasses = isActive
			? "bg-gray-900 text-white border-gray-900 shadow-[0_8px_22px_rgba(17,24,39,0.45)] scale-110"
			: "bg-white text-gray-900 border-gray-200 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:border-gray-900";
	}

	return (
		<OverlayViewF
			position={{ lat, lng }}
			mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
			// Centre horizontally, sit the pill's bottom edge on the coordinate.
			getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height })}
		>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onClick && onClick();
				}}
				aria-label={`${title ? `${title} — ` : ""}${label}${isCommercial ? " (commercial)" : ""}`}
				aria-pressed={isActive}
				className={`inline-flex items-center gap-1 select-none whitespace-nowrap rounded-full border font-black leading-none transition-[background-color,color,transform,box-shadow] duration-200 ease-out active:scale-95 ${stateClasses}`}
				style={{
					padding: "6px 12px",
					fontSize: 12,
					cursor: "pointer",
					transformOrigin: "center bottom",
					// Keep the active pill above its neighbours so it's never clipped.
					// Commercial pins also sit slightly above residential ones so their
					// indicator is never hidden behind a neighbouring white pill.
					zIndex: isActive ? 30 : isCommercial ? 5 : 1,
				}}
			>
				{isCommercial && <Store size={11} strokeWidth={2.75} className="shrink-0" />}
				{label}
			</button>
		</OverlayViewF>
	);
};

export default MapMarker;
