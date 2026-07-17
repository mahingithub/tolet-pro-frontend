import React from "react";
import { OverlayView, OverlayViewF } from "@react-google-maps/api";
import { useLanguage } from "../context/LanguageContext";
import { toLocalizedDigits } from "../utils/formatCurrency";

// ─── CLUSTER MARKER (grouped properties) ─────────────────────────────────────
// A solid circular bubble showing how many properties are grouped at this point
// (localized numeral). Clicking asks supercluster for the zoom level that breaks
// this cluster apart and re-centres the map on the cluster — the actual
// getClusterExpansionZoom + map.setZoom/panTo call lives in the parent (which
// owns the supercluster + map instances) and is passed in as `onClick`.
//
// The bubble grows a little with the cluster size so denser groups read as
// heavier without ever getting large enough to cover the map.
const ClusterMarker = ({ lat, lng, count, totalPoints = 1, isCommercial = false, onClick }) => {
	const { language } = useLanguage();

	// 40px base → up to +24px, scaled by this cluster's share of all points.
	const size = 40 + Math.min((count / Math.max(totalPoints, 1)) * 40, 24);

	// Commercial clusters take the indigo identity used by the individual
	// commercial pins so a group of commercial listings still reads as
	// commercial before you zoom in; everything else keeps the brand-red bubble.
	const colorClasses = isCommercial
		? "bg-indigo-600 shadow-[0_6px_20px_rgba(79,70,229,0.5)]"
		: "bg-brandRed shadow-[0_6px_20px_rgba(186,0,54,0.45)]";

	return (
		<OverlayViewF
			position={{ lat, lng }}
			mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
			// Centre the circle exactly on the coordinate.
			getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height / 2) })}
		>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onClick && onClick();
				}}
				aria-label={`${count} ${isCommercial ? "commercial " : ""}properties — zoom in`}
				className={`flex items-center justify-center rounded-full text-white font-black ring-4 ring-white/70 transition-transform duration-200 ease-out hover:scale-105 active:scale-95 ${colorClasses}`}
				style={{
					width: size,
					height: size,
					fontSize: size > 52 ? 15 : 13,
					cursor: "pointer",
				}}
			>
				{toLocalizedDigits(count, language)}
			</button>
		</OverlayViewF>
	);
};

export default ClusterMarker;
