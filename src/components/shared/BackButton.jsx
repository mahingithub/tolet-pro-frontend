import React from 'react';
import { ArrowLeft } from 'lucide-react';
import useGoBack from '../../hooks/useGoBack';

/**
 * BackButton — a small, reusable "Back" control that returns the user to the
 * actual previous page (see `useGoBack`), falling back to a sensible route
 * only when there is no in-app history.
 *
 * Pages that already ship their own bespoke back button just reuse the
 * `useGoBack` hook directly; this component is for pages that were missing a
 * back affordance entirely and want a ready-made one.
 *
 * @param {object}  props
 * @param {string} [props.fallback='/']   Route used only when there is no history.
 * @param {string} [props.label]          Optional text shown next to the arrow.
 * @param {string} [props.className]      Overrides the default styling completely.
 * @param {number} [props.size=18]        Icon size in px.
 * @param {string} [props.ariaLabel='Back'] Accessible label.
 */
export default function BackButton({
  fallback = '/',
  label,
  className,
  size = 18,
  ariaLabel = 'Back',
}) {
  const goBack = useGoBack(fallback);

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={ariaLabel}
      className={
        className ??
        'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 text-sm font-black text-gray-700 shadow-sm hover:bg-white hover:text-gray-900 active:scale-95 transition-all [-webkit-tap-highlight-color:transparent]'
      }
    >
      <ArrowLeft size={size} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
