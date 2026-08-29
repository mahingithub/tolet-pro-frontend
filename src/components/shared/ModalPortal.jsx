import { createPortal } from 'react-dom';

/**
 * ModalPortal — renders a modal as a direct child of <body>.
 *
 * The dashboards wrap their content in `<main class="... relative z-10 ...">`
 * (HostDashboard.jsx). `relative` + `z-index` opens a stacking context, and a
 * stacking context is a ceiling: everything inside it is painted as one unit at
 * z-10, so a modal marked `z-[100]` still lands *below* the app chrome that
 * lives outside <main> — the sticky top navbar (z-[60], App.jsx) and
 * MobileBottomNav (z-40). Raising the modal's own z-index cannot fix that; the
 * number is only compared against its siblings inside <main>.
 *
 * That is why forms opened from the dashboard appeared to duck under the top
 * and bottom bars, with their action buttons stuck behind the mobile nav.
 *
 * Portalling to <body> lifts the modal out of that stacking context so its
 * z-index is finally weighed against the navbars directly. Font and base text
 * colour are re-applied here because they were inherited from the dashboard
 * wrapper (`font-sans text-gray-900`) that we just escaped.
 *
 * React portals keep the React tree intact, so events still bubble to the
 * component that rendered the modal and existing handlers are unaffected.
 */
export default function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="font-sans text-gray-900">{children}</div>,
    document.body
  );
}
