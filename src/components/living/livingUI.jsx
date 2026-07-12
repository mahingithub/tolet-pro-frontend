/**
 * ui — shared, presentational building blocks for the Living tab. Everything
 * here is theme-agnostic: it leans on the standard Tailwind utilities that the
 * app's dark retrofit (index.css) already remaps, so light & dark both work
 * with zero per-component `dark:` variants. Charts are hand-rolled SVG/CSS to
 * avoid pulling in a charting dependency.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus } from 'lucide-react';
import { initials } from './livingUtils';

export const cx = (...c) => c.filter(Boolean).join(' ');

// ── Card ─────────────────────────────────────────────────────────────────────
export const Card = ({ className = '', children, as: Tag = 'div', ...rest }) => (
  <Tag
    className={cx(
      'bg-white rounded-3xl border border-gray-100 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.18)]',
      className
    )}
    {...rest}
  >
    {children}
  </Tag>
);

// ── Section header ───────────────────────────────────────────────────────────
export const SectionHeader = ({ title, subtitle, right }) => (
  <div className="flex items-end justify-between gap-3 mb-3">
    <div>
      <h3 className="text-[15px] font-black text-gray-900 tracking-tight leading-tight">{title}</h3>
      {subtitle && <p className="text-[11px] font-semibold text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);

// ── Icon badge ───────────────────────────────────────────────────────────────
export const IconBadge = ({ icon: Icon, tint = 'bg-gray-100', text = 'text-gray-600', size = 40, iconSize = 18, className = '' }) => (
  <span
    className={cx('shrink-0 flex items-center justify-center rounded-2xl', tint, text, className)}
    style={{ width: size, height: size }}
  >
    <Icon size={iconSize} strokeWidth={2.2} />
  </span>
);

// ── Avatar ───────────────────────────────────────────────────────────────────
export const Avatar = ({ roommate, size = 34, ring = true, className = '' }) => {
  const label = initials(roommate?.name);
  return (
    <span
      className={cx('inline-flex items-center justify-center rounded-full font-black text-white select-none', ring && 'ring-2 ring-white', className)}
      style={{ width: size, height: size, background: roommate?.color || '#64748b', fontSize: size * 0.4 }}
      title={roommate?.name}
    >
      {label}
    </span>
  );
};

export const AvatarStack = ({ roommates, ids, max = 4, size = 26 }) => {
  const list = (ids || roommates.map((r) => r.id))
    .map((id) => roommates.find((r) => r.id === id))
    .filter(Boolean);
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((r, idx) => (
        <span key={r.id} style={{ marginLeft: idx === 0 ? 0 : -size * 0.32, zIndex: 10 - idx }}>
          <Avatar roommate={r} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-black ring-2 ring-white"
          style={{ width: size, height: size, marginLeft: -size * 0.32, fontSize: size * 0.36 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
};

// ── Chip / pill ────────────────────────────────────────────────────────────────
export const Chip = ({ children, tint = 'bg-gray-100', text = 'text-gray-600', className = '' }) => (
  <span className={cx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider', tint, text, className)}>
    {children}
  </span>
);

// ── Progress bar ─────────────────────────────────────────────────────────────────
export const ProgressBar = ({ value = 0, max = 100, color = '#ba0036', className = '' }) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cx('h-2 rounded-full bg-gray-100 overflow-hidden', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

// ── Stepper ───────────────────────────────────────────────────────────────────────
export const Stepper = ({ value = 0, onChange, min = 0, max = 9 }) => (
  <div className="inline-flex items-center gap-1 bg-gray-50 rounded-full p-1 border border-gray-100">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - 1))}
      className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:scale-90 transition disabled:opacity-40"
      disabled={value <= min}
      aria-label="decrease"
    >
      <Minus size={13} />
    </button>
    <span className="w-5 text-center text-[13px] font-black text-gray-900 tabular-nums">{value}</span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:scale-90 transition disabled:opacity-40"
      disabled={value >= max}
      aria-label="increase"
    >
      <Plus size={13} />
    </button>
  </div>
);

// ── Segmented control ─────────────────────────────────────────────────────────────
export const SegmentedControl = ({ options, value, onChange, className = '' }) => (
  <div className={cx('flex items-center gap-1 p-1 bg-gray-100 rounded-2xl', className)}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 px-3 py-2 rounded-xl text-[12px] font-black tracking-tight transition-all',
            active ? 'bg-white text-[#ba0036] shadow-sm' : 'text-gray-500 hover:text-gray-800'
          )}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// ── Toggle switch ───────────────────────────────────────────────────────────────────
export const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cx('relative w-11 h-6 rounded-full transition-colors shrink-0', checked ? 'bg-[#ba0036]' : 'bg-gray-300')}
  >
    <span className={cx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
  </button>
);

// ── Form primitives ─────────────────────────────────────────────────────────────────
export const Field = ({ label, hint, children, className = '' }) => (
  <label className={cx('block', className)}>
    {label && <span className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>}
    {children}
    {hint && <span className="block text-[11px] font-semibold text-gray-400 mt-1">{hint}</span>}
  </label>
);

const inputBase =
  'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30 focus:border-[#ba0036]/40 transition';

export const TextInput = ({ className = '', ...rest }) => <input className={cx(inputBase, className)} {...rest} />;
export const TextArea = ({ className = '', ...rest }) => <textarea className={cx(inputBase, 'resize-none', className)} {...rest} />;
export const Select = ({ className = '', children, ...rest }) => (
  <select className={cx(inputBase, 'appearance-none', className)} {...rest}>
    {children}
  </select>
);

export const MoneyInput = ({ className = '', ...rest }) => (
  <div className="relative">
    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">৳</span>
    <input type="number" inputMode="decimal" className={cx(inputBase, 'pl-8', className)} {...rest} />
  </div>
);

// ── Buttons ───────────────────────────────────────────────────────────────────────────
export const PrimaryButton = ({ className = '', children, ...rest }) => (
  <button
    className={cx(
      'relative overflow-hidden bg-gradient-to-r from-[#ba0036] via-[#d11147] to-[#ff4d6d] text-white rounded-2xl px-5 py-3.5 font-black text-sm shadow-[0_10px_24px_-8px_rgba(186,0,54,0.5)] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100',
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

export const GhostButton = ({ className = '', children, ...rest }) => (
  <button
    className={cx(
      'bg-gray-100 text-gray-700 rounded-2xl px-5 py-3.5 font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition hover:bg-gray-200',
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

// ── Empty state ─────────────────────────────────────────────────────────────────────────
export const EmptyState = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6">
    {Icon && (
      <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
        <Icon size={26} strokeWidth={2} />
      </div>
    )}
    <p className="text-sm font-black text-gray-800">{title}</p>
    {subtitle && <p className="text-[12px] font-semibold text-gray-400 mt-1 max-w-[240px]">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ── Bottom sheet / modal ─────────────────────────────────────────────────────────────────
export const Sheet = ({ open, onClose, title, subtitle, children, footer, maxWidth = 'max-w-md' }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-[80] bg-gray-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          key="panel"
          className="fixed inset-x-0 bottom-0 sm:inset-0 z-[90] flex sm:items-center justify-center sm:p-4 pointer-events-none"
        >
          <motion.div
            className={cx(
              'pointer-events-auto w-full bg-white rounded-t-[2rem] sm:rounded-[2rem] border border-gray-100 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[86vh]',
              maxWidth
            )}
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            {/* drag handle */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <span className="w-10 h-1.5 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-3 sm:pt-5">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight leading-tight">{title}</h3>
                {subtitle && <p className="text-[12px] font-semibold text-gray-500 mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-1 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition active:scale-90"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 overflow-y-auto flex-1 pb-2">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-gray-100 bg-white sticky bottom-0 rounded-b-[2rem]">{footer}</div>}
          </motion.div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────────────────
export const DonutChart = ({ data = [], size = 168, thickness = 22, centerTop, centerMain, centerSub }) => {
  const total = data.reduce((s, d) => s + (d.value > 0 ? d.value : 0), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={thickness} />
        {total > 0 &&
          data.map((d, i) => {
            const val = d.value > 0 ? d.value : 0;
            const len = (val / total) * c;
            const seg = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap={len > 4 ? 'round' : 'butt'}
              />
            );
            offset += len;
            return seg;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        {centerTop && <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{centerTop}</span>}
        {centerMain && <span className="text-xl font-black text-gray-900 tracking-tight leading-tight">{centerMain}</span>}
        {centerSub && <span className="text-[11px] font-bold text-gray-500 mt-0.5">{centerSub}</span>}
      </div>
    </div>
  );
};

// ── Horizontal bar row ────────────────────────────────────────────────────────────────────────
export const HBar = ({ label, value, max, color = '#ba0036', right, icon: Icon }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-gray-700">
          {Icon && <Icon size={13} style={{ color }} />}
          {label}
        </span>
        <span className="text-[12px] font-black text-gray-900 tabular-nums">{right}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

// ── Vertical bar chart (trend) ────────────────────────────────────────────────────────────────────
export const BarChart = ({ data = [], height = 120, formatter = (v) => v }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * (height - 26));
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 group">
            <span className="text-[9px] font-black text-gray-500 opacity-0 group-hover:opacity-100 transition tabular-nums">{formatter(d.value)}</span>
            <div
              className="w-full rounded-t-lg transition-all duration-700"
              style={{ height: h, background: d.color || 'linear-gradient(to top,#ba0036,#ff4d6d)', minHeight: 4 }}
            />
            <span className="text-[9px] font-bold text-gray-400 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};
