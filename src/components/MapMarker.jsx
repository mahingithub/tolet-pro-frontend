import React from "react";
import { OverlayView, OverlayViewF } from "@react-google-maps/api";
import { useLanguage } from "../context/LanguageContext";
import { formatBdt } from "../utils/formatCurrency";

// ─── MAP MARKER (individual property price pill) ─────────────────────────────
// Rendered as a Google Maps overlay via OverlayViewF so it can be a real,
// styled DOM node instead of a raster pin.
//
//   • Default : white pill, subtle drop shadow, bold price text (e.g. ৳ ২৩,০০০).
//   • Active  : inverts to a solid black pill with white text. The swap runs on
//               a ~180ms CSS transition (background + colour + transform), so
//               selecting a marker reads as a smooth highlight, not a hard cut.
//
// The pill is anchored by its bottom-centre onto the marker coordinate (see
// getPixelPositionOffset), matching how a physical map pin points at a place.
const MapMarker = ({ lat, lng, price, title, isActive = false, onClick }) => {
	const { language } = useLanguage();
	const label = formatBdt(price, language);

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
				aria-label={title ? `${title} — ${label}` : label}
				aria-pressed={isActive}
				className={`select-none whitespace-nowrap rounded-full border font-black leading-none transition-[background-color,color,transform,box-shadow] duration-200 ease-out active:scale-95 ${
					isActive
						? "bg-gray-900 text-white border-gray-900 shadow-[0_8px_22px_rgba(17,24,39,0.45)] scale-110"
						: "bg-white text-gray-900 border-gray-200 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:border-gray-900"
				}`}
				style={{
					padding: "6px 12px",
					fontSize: 12,
					cursor: "pointer",
					transformOrigin: "center bottom",
					// Keep the active pill above its neighbours so it's never clipped.
					zIndex: isActive ? 30 : 1,
				}}
			>
				{label}
			</button>
		</OverlayViewF>
	);
};

export default MapMarker;
