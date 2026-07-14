import React, { useState, useEffect, useCallback } from 'react';
import useGoBack from '../hooks/useGoBack';
import {
  ArrowLeft, Zap, TrendingUp, TrendingDown, BarChart2,
  MapPin, Home, DollarSign, Target, RefreshCw, Star,
  CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight,
  Building, Users, Calendar, Activity, Eye, Lightbulb,
  ChevronRight, ShieldCheck, Clock, Camera, ImageIcon, FileWarning, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fetchHostInsights } from '../services/insightsService';

// ─── Tag style config ───────────────────────────────────────────────────────
const tagConfig = {
  underpriced: { label: 'Underpriced', color: 'text-green-400', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.25)' },
  overpriced:  { label: 'Above Market', color: 'text-amber-400', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.25)' },
  optimized:   { label: 'Optimized', color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.25)' },
};

// ─── Quick Win icon/color mapping ───────────────────────────────────────────
const quickWinConfig = {
  missing_cover_photo:  { icon: Camera,        color: 'text-yellow-300', bg: 'rgba(253,224,71,0.12)' },
  missing_room_photos:  { icon: ImageIcon,     color: 'text-yellow-300', bg: 'rgba(253,224,71,0.12)' },
  lease_expiring:       { icon: Calendar,      color: 'text-amber-400',  bg: 'rgba(251,191,36,0.12)' },
  zero_inquiries:       { icon: AlertTriangle, color: 'text-red-400',    bg: 'rgba(239,68,68,0.12)' },
  low_response_rate:    { icon: Activity,      color: 'text-sky-400',    bg: 'rgba(56,189,248,0.12)' },
};

// ─── Skeleton loader component ──────────────────────────────────────────────
function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', ...style }}
    />
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 md:h-28" />
      ))}
    </div>
  );
}

function CardsSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-20 md:h-24" />
      ))}
    </div>
  );
}

// ─── Number formatting ──────────────────────────────────────────────────────
function formatCurrency(n) {
  if (n == null) return '৳0';
  return '৳' + Number(n).toLocaleString('en-IN');
}

export default function AIInsightsPage() {
  const goBack = useGoBack('/');
  const { language = 'English' } = useLanguage() || {};
  const bn = language === 'বাংলা';

  const [expandedId, setExpandedId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [activeSection, setActiveSection] = useState('opportunities');

  // Live data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // Fetch insights from API
  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHostInsights();
      setData(result);
    } catch (err) {
      console.error('[AIInsights] Failed to load:', err);
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Destructure data for easier access
  const performanceMetrics = data?.performanceMetrics || {};
  const marketOpportunities = data?.marketOpportunities || [];
  const demandSignals = data?.demandSignals || [];
  const quickWins = data?.quickWins || [];

  // Build performance metric cards from live data
  const metricCards = [
    {
      label: bn ? 'অকুপ্যান্সি রেট' : 'Occupancy Rate',
      value: `${performanceMetrics.occupancyRate || 0}%`,
      sub: bn ? 'সক্রিয় লিস্টিং জুড়ে' : 'Across active listings',
      trend: `${performanceMetrics.totalActiveProperties || 0} ${bn ? 'টি সক্রিয় প্রপার্টি' : 'active properties'}`,
      up: (performanceMetrics.occupancyRate || 0) > 50,
    },
    {
      label: bn ? 'ইনকোয়ারি কনভার্সন' : 'Inquiry Conversion',
      value: `${performanceMetrics.inquiryConversion || 0}%`,
      sub: `${performanceMetrics.totalBookings || 0} / ${performanceMetrics.totalInquiries || 0}`,
      trend: bn ? 'বুকিং / ইনকোয়ারি' : 'bookings / inquiries',
      up: (performanceMetrics.inquiryConversion || 0) > 15,
    },
    {
      label: bn ? 'এই মাসের রাজস্ব' : 'Revenue This Month',
      value: formatCurrency(performanceMetrics.revenueThisMonth?.value),
      sub: `${performanceMetrics.revenueThisMonth?.activeBookings || 0} ${bn ? 'টি সক্রিয় বুকিং' : 'active bookings'}`,
      trend: (() => {
        const pct = performanceMetrics.revenueThisMonth?.changePercent || 0;
        const arrow = pct >= 0 ? '↑' : '↓';
        return `${arrow} ${Math.abs(pct)}% ${bn ? 'গত মাসের তুলনায়' : 'vs last month'}`;
      })(),
      up: (performanceMetrics.revenueThisMonth?.changePercent || 0) >= 0,
    },
    {
      label: bn ? 'মোট বুকিং' : 'Total Bookings',
      value: `${performanceMetrics.totalBookings || 0}`,
      sub: bn ? 'সর্বমোট বুকিং' : 'All time bookings',
      trend: `${performanceMetrics.totalInquiries || 0} ${bn ? 'টি ইনকোয়ারি' : 'total inquiries'}`,
      up: true,
    },
  ];

  const SECTIONS = [
    { id: 'opportunities', label: bn ? 'সুযোগ' : 'Opportunities' },
    { id: 'demand', label: bn ? 'চাহিদা' : 'Demand' },
    { id: 'performance', label: bn ? 'পারফরম্যান্স' : 'Performance' },
    { id: 'wins', label: bn ? 'কুইক উইন' : 'Quick Wins' },
  ];

  // ─── Error state ──────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div
        className="min-h-screen font-sans text-white flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #080818 0%, #0b1130 45%, #0e0820 100%)' }}
      >
        <div className="text-center px-6 py-12 max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">
            {bn ? 'ইনসাইটস লোড হয়নি' : 'Failed to load insights'}
          </h2>
          <p className="text-sm font-medium mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {error}
          </p>
          <button
            onClick={loadInsights}
            className="px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}
          >
            {bn ? 'আবার চেষ্টা করুন' : 'Retry'}
          </button>
          <button
            onClick={goBack}
            className="block mx-auto mt-3 text-xs font-bold transition-all"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {bn ? 'পিছনে যান' : 'Go Back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans text-white selection:bg-indigo-500 selection:text-white relative overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #080818 0%, #0b1130 45%, #0e0820 100%)' }}
    >
      {/* Ambient Orbs */}
      <div className="fixed top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[130px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full blur-[120px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 70%)' }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full blur-[200px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

      {/* Grid overlay */}
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none z-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(99,102,241,0.8) 40px, rgba(99,102,241,0.8) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(99,102,241,0.8) 40px, rgba(99,102,241,0.8) 41px)' }} />

      {/* Toast */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ${toastMsg ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
        <div className="bg-white/10 backdrop-blur-2xl text-white px-5 py-3 rounded-full shadow-xl border border-white/20 flex items-center gap-3">
          <CheckCircle2 size={14} className="text-green-400" />
          <span className="text-xs font-bold">{toastMsg}</span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[960px] mx-auto px-4 md:px-8 pt-6 pb-28">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft size={18} className="text-white/70" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', boxShadow: '0 0 16px rgba(99,102,241,0.5)' }}>
                <Zap size={14} className="text-white fill-white/30" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none text-white">
                {bn ? 'এআই ইনসাইটস' : 'AI Insights'}
              </h1>
              <span
                className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(236,72,153,0.4))', border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc' }}
              >
                LIVE
              </span>
            </div>
            <p className="text-xs font-medium mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {bn ? 'আপনার পোর্টফোলিওর জন্য রিয়েল-টাইম বাজার বিশ্লেষণ' : 'Real-time market intelligence for your portfolio'}
            </p>
          </div>
          <button
            onClick={() => { showToast(bn ? 'ডেটা আপডেট হচ্ছে...' : 'Refreshing data...'); loadInsights(); }}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* ── Performance Summary Strip ── */}
        {loading ? (
          <MetricsSkeleton />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {metricCards.map((m, i) => (
              <div
                key={i}
                className="rounded-2xl p-3 md:p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(165,180,252,0.7)' }}>{m.label}</p>
                <p className="text-lg md:text-2xl font-black text-white leading-none">{m.value}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  {m.up ? <ArrowUpRight size={10} className="text-green-400 shrink-0" /> : <ArrowDownRight size={10} className="text-red-400 shrink-0" />}
                  <p className="text-[9px] font-bold" style={{ color: m.up ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)' }}>{m.trend}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Section Tabs ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className="shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all"
              style={activeSection === s.id
                ? { background: 'linear-gradient(135deg, #6366f1, #ec4899)', color: '#fff', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }
                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── SECTION: Market Opportunities ── */}
        {activeSection === 'opportunities' && (
          loading ? <CardsSkeleton count={4} /> : (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-3" style={{ color: 'rgba(165,180,252,0.6)' }}>
                {bn ? `${marketOpportunities.length}টি প্রপার্টি বিশ্লেষণ` : `${marketOpportunities.length} properties analysed`}
              </p>

              {marketOpportunities.length === 0 && (
                <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <BarChart2 size={28} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {bn ? 'পর্যাপ্ত তুলনামূলক ডেটা নেই' : 'Not enough comparable data yet'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {bn ? 'আপনার এলাকায় আরো লিস্টিং যোগ হলে বিশ্লেষণ দেখা যাবে' : 'Market analysis will appear as more listings are added in your areas'}
                  </p>
                </div>
              )}

              {marketOpportunities.map((opp, idx) => {
                const isExpanded = expandedId === (opp.propertyId || idx);
                const tag = tagConfig[opp.tag] || tagConfig.optimized;
                const priceRatio = opp.marketAvg > 0 ? Math.min(100, (opp.currentRent / opp.marketAvg) * 100) : 50;

                return (
                  <div
                    key={opp.propertyId || idx}
                    className="rounded-[1.5rem] overflow-hidden transition-all duration-300"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {/* Row */}
                    <div
                      className="p-4 md:p-5 flex items-start gap-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : (opp.propertyId || idx))}
                    >
                      {/* Comparables badge */}
                      <div className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                        <span className="text-[15px] font-black text-indigo-300 leading-none">{opp.comparables}</span>
                        <span className="text-[7px] font-black uppercase tracking-widest mt-0.5" style={{ color: 'rgba(165,180,252,0.6)' }}>comp</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[12px] font-black text-white leading-tight">{opp.property}</p>
                              <span className="text-[8px] font-black px-2 py-0.5 rounded-full" style={{ background: tag.bg, border: `1px solid ${tag.border}`, color: tag.color }}>
                                {tag.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin size={9} style={{ color: 'rgba(255,255,255,0.3)' }} />
                              <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{opp.area}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {opp.tag === 'underpriced' ? (
                              <p className="text-[13px] font-black text-green-400">+{formatCurrency(opp.potentialImpact)}/mo</p>
                            ) : opp.tag === 'overpriced' ? (
                              <p className="text-[13px] font-black text-amber-400">{bn ? 'হ্রাস করুন' : 'Reduce'}</p>
                            ) : (
                              <p className="text-[11px] font-black" style={{ color: 'rgba(255,255,255,0.4)' }}>{bn ? 'অপ্টিমাইজড' : 'Optimized'}</p>
                            )}
                            <ChevronRight size={13} className={`ml-auto text-white/20 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {/* Rent comparison bar */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] font-bold shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatCurrency(opp.currentRent)}</span>
                          <div className="flex-1 h-1.5 rounded-full relative" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div
                              className="h-full rounded-full absolute left-0 top-0"
                              style={{
                                width: `${priceRatio}%`,
                                background: opp.tag === 'underpriced' ? 'linear-gradient(90deg, #6366f1, #10b981)' : opp.tag === 'overpriced' ? 'linear-gradient(90deg, #6366f1, #f59e0b)' : 'linear-gradient(90deg, #6366f1, #ec4899)',
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-bold shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>Avg {formatCurrency(opp.marketAvg)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div className="px-4 md:px-5 pb-5 pt-2" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {opp.tag === 'underpriced' && (
                          <>
                            <p className="text-[11px] font-medium leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                              {bn
                                ? `এই প্রপার্টির বর্তমান ভাড়া ${opp.area} এলাকার বাজার গড় থেকে কম। ভাড়া ${opp.increasePercent}% বাড়ালে মাসে +${formatCurrency(opp.potentialImpact)} অতিরিক্ত আয় সম্ভব।`
                                : `Your property is priced below the ${opp.area} market average. A ${opp.increasePercent}% increase could yield +${formatCurrency(opp.potentialImpact)}/mo additional revenue.`
                              }
                            </p>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              {[
                                { label: bn ? 'বর্তমান ভাড়া' : 'Current Rent', value: formatCurrency(opp.currentRent) },
                                { label: bn ? 'বাজার গড়' : 'Market Avg', value: formatCurrency(opp.marketAvg) },
                                { label: bn ? 'পরামর্শ' : 'Suggested', value: formatCurrency(opp.suggestedRent), highlight: true },
                              ].map((item, i) => (
                                <div key={i} className="rounded-xl p-2.5 text-center" style={{ background: item.highlight ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: item.highlight ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
                                  <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: item.highlight ? '#a5b4fc' : 'rgba(255,255,255,0.3)' }}>{item.label}</p>
                                  <p className={`text-[12px] font-black ${item.highlight ? 'text-indigo-300' : 'text-white/70'}`}>{item.value}</p>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {opp.tag === 'overpriced' && (
                          <p className="text-[11px] font-medium leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {bn
                              ? `আপনার ভাড়া ${opp.area} এলাকার বাজার গড়ের চেয়ে বেশি। দীর্ঘ শূন্যতা এড়াতে মূল্য পর্যালোচনা বিবেচনা করুন।`
                              : `Your pricing is above the ${opp.area} market average. Consider reviewing to avoid extended vacancies.`
                            }
                          </p>
                        )}

                        {opp.tag === 'optimized' && (
                          <p className="text-[11px] font-medium leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {bn
                              ? 'আপনার ভাড়া বাজার গড়ের কাছাকাছি। বর্তমান মূল্য ধরে রাখুন।'
                              : 'Your pricing is well-aligned with the market average. Hold current pricing to maintain competitive attractiveness.'
                            }
                          </p>
                        )}

                        <button
                          onClick={() => showToast(bn ? 'পরিকল্পনা সেভ হয়েছে!' : 'Action plan saved!')}
                          className="w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95"
                          style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
                        >
                          {bn ? 'অ্যাকশন প্ল্যানে যোগ করুন' : 'Add to Action Plan'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── SECTION: Demand Signals ── */}
        {activeSection === 'demand' && (
          loading ? <CardsSkeleton count={6} /> : (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-3" style={{ color: 'rgba(165,180,252,0.6)' }}>
                {bn ? 'প্ল্যাটফর্ম জুড়ে চাহিদা সিগন্যাল' : 'Demand signals across platform areas'}
              </p>

              {demandSignals.length === 0 && (
                <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <MapPin size={28} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {bn ? 'চাহিদা ডেটা পাওয়া যায়নি' : 'No demand data available yet'}
                  </p>
                </div>
              )}

              {demandSignals.map((d, i) => {
                const TrendIcon = d.trend === 'up' ? TrendingUp : d.trend === 'down' ? TrendingDown : Activity;
                const trendColor = d.trend === 'up' ? 'text-green-400' : d.trend === 'down' ? 'text-red-400' : 'text-blue-400';
                const iconBg = d.trend === 'up' ? 'rgba(34,197,94,0.12)' : d.trend === 'down' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.10)';
                const barColor = d.demand >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : d.demand >= 60 ? 'linear-gradient(90deg, #6366f1, #818cf8)' : d.demand >= 40 ? 'linear-gradient(90deg, #f59e0b, #fcd34d)' : 'linear-gradient(90deg, #ef4444, #f87171)';
                const numberColor = d.demand >= 80 ? '#4ade80' : d.demand >= 60 ? '#a5b4fc' : d.demand >= 40 ? '#fcd34d' : '#f87171';

                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4 md:p-5 flex items-center gap-4"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                      <TrendIcon size={18} className={trendColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[13px] font-black text-white">{d.area}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>{d.totalInquiries} {bn ? 'ইনকো.' : 'inq.'}</span>
                          <span className={`text-[9px] font-black ${trendColor}`}>{d.label}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full w-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${d.demand}%`, background: barColor }}
                        />
                      </div>
                    </div>
                    <span className="text-xl font-black shrink-0" style={{ color: numberColor }}>
                      {d.demand}
                    </span>
                  </div>
                );
              })}

              {demandSignals.length > 0 && (
                <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#a5b4fc' }}>
                    {bn ? 'ইনসাইট' : 'Insight'}
                  </p>
                  <p className="text-[12px] font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {demandSignals.length > 0
                      ? (bn
                          ? `${demandSignals[0].area} সর্বোচ্চ চাহিদা দেখাচ্ছে (${demandSignals[0].totalInquiries} ইনকোয়ারি)। এই এলাকায় ভাড়া অপ্টিমাইজেশনের সুযোগ সবচেয়ে বেশি।`
                          : `${demandSignals[0].area} shows the strongest demand (${demandSignals[0].totalInquiries} inquiries). This area presents the highest opportunity for rent optimization with minimal vacancy risk.`)
                      : ''
                    }
                  </p>
                </div>
              )}
            </div>
          )
        )}

        {/* ── SECTION: Performance ── */}
        {activeSection === 'performance' && (
          loading ? <CardsSkeleton count={4} /> : (
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-3" style={{ color: 'rgba(165,180,252,0.6)' }}>
                {bn ? 'আপনার পোর্টফোলিও পারফরম্যান্স' : 'Your portfolio performance metrics'}
              </p>

              {[
                {
                  label: bn ? 'অকুপ্যান্সি রেট' : 'Occupancy Rate',
                  yours: performanceMetrics.occupancyRate || 0,
                  unit: '%',
                  color: '#10b981',
                  detail: `${performanceMetrics.totalActiveProperties || 0} ${bn ? 'টি প্রপার্টি' : 'properties'}`,
                },
                {
                  label: bn ? 'ইনকোয়ারি কনভার্সন' : 'Inquiry Conversion',
                  yours: performanceMetrics.inquiryConversion || 0,
                  unit: '%',
                  color: '#ec4899',
                  detail: `${performanceMetrics.totalBookings || 0} / ${performanceMetrics.totalInquiries || 0}`,
                },
                {
                  label: bn ? 'এই মাসের রাজস্ব' : 'Monthly Revenue',
                  yours: performanceMetrics.revenueThisMonth?.value || 0,
                  unit: '',
                  color: '#f59e0b',
                  detail: formatCurrency(performanceMetrics.revenueThisMonth?.value),
                  isRevenue: true,
                },
                {
                  label: bn ? 'সক্রিয় বুকিং' : 'Active Bookings',
                  yours: performanceMetrics.revenueThisMonth?.activeBookings || 0,
                  unit: '',
                  color: '#a5b4fc',
                  detail: `${performanceMetrics.totalBookings || 0} ${bn ? 'মোট' : 'total'}`,
                },
              ].map((m, i) => (
                <div key={i} className="rounded-2xl p-4 md:p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-black text-white">{m.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {m.detail}
                      </span>
                      <span className="text-[12px] font-black" style={{ color: m.color }}>
                        {m.isRevenue ? formatCurrency(m.yours) : `${m.yours}${m.unit}`}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase tracking-widest w-14 shrink-0" style={{ color: m.color }}>{bn ? 'আপনি' : 'You'}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(m.isRevenue ? 100 : m.yours, 100)}%`, background: m.color }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Revenue trend card */}
              {performanceMetrics.revenueThisMonth && (
                <div className="rounded-2xl p-4 md:p-5" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(236,72,153,0.08))', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a5b4fc' }}>
                    {bn ? 'রাজস্ব প্রবণতা' : 'Revenue Trend'}
                  </p>
                  <div className="flex items-end gap-3">
                    <div>
                      <p className="text-2xl font-black text-white">{formatCurrency(performanceMetrics.revenueThisMonth.value)}</p>
                      <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {bn ? 'মোট মাসিক আয়' : 'Total monthly revenue'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 pb-1">
                      {performanceMetrics.revenueThisMonth.changePercent >= 0
                        ? <ArrowUpRight size={14} className="text-green-400" />
                        : <ArrowDownRight size={14} className="text-red-400" />
                      }
                      <span
                        className="text-sm font-black"
                        style={{ color: performanceMetrics.revenueThisMonth.changePercent >= 0 ? '#4ade80' : '#f87171' }}
                      >
                        {performanceMetrics.revenueThisMonth.changePercent >= 0 ? '+' : ''}{performanceMetrics.revenueThisMonth.changePercent}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── SECTION: Quick Wins ── */}
        {activeSection === 'wins' && (
          loading ? <CardsSkeleton count={4} /> : (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-3" style={{ color: 'rgba(165,180,252,0.6)' }}>
                {bn ? 'সহজ পদক্ষেপ যা বড় ফলাফল দেবে' : 'Simple actions that can drive meaningful impact'}
              </p>

              {quickWins.length === 0 && (
                <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <CheckCircle2 size={28} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.5)' }} />
                  <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {bn ? 'কোনো তাৎক্ষণিক পদক্ষেপ নেই — দারুণ কাজ!' : 'No quick wins needed — great job!'}
                  </p>
                </div>
              )}

              {quickWins.map((w, i) => {
                const cfg = quickWinConfig[w.type] || { icon: Lightbulb, color: 'text-indigo-400', bg: 'rgba(99,102,241,0.15)' };
                const IconComp = cfg.icon;

                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4 md:p-5 flex items-start gap-4 transition-all hover:scale-[1.01] cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={() => showToast(bn ? 'অ্যাকশন প্ল্যানে যোগ হয়েছে!' : 'Added to your action plan!')}
                  >
                    <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: cfg.bg }}>
                      <IconComp size={18} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white leading-tight">{w.title}</p>
                      <p className="text-[10px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{w.detail}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Clock size={9} style={{ color: 'rgba(165,180,252,0.6)' }} />
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(165,180,252,0.6)' }}>{w.urgency}</span>
                        {w.priority === 'high' && (
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                            {bn ? 'জরুরি' : 'URGENT'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
                      <ArrowUpRight size={13} style={{ color: '#a5b4fc' }} />
                    </div>
                  </div>
                );
              })}

              {/* Total potential uplift */}
              {marketOpportunities.filter(o => o.tag === 'underpriced').length > 0 && (
                <div className="mt-2 rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.10))', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#a5b4fc' }}>
                    {bn ? 'মোট সম্ভাব্য আয় বৃদ্ধি' : 'Total Potential Revenue Uplift'}
                  </p>
                  <p className="text-2xl font-black text-white">
                    +{formatCurrency(marketOpportunities.filter(o => o.tag === 'underpriced').reduce((sum, o) => sum + (o.potentialImpact || 0), 0) * 12)}
                  </p>
                  <p className="text-[11px] font-medium mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {bn ? 'প্রতি বছর, যদি সব পরামর্শ বাস্তবায়ন হয়' : 'per year if all rent recommendations are implemented'}
                  </p>
                </div>
              )}
            </div>
          )
        )}

      </div>
    </div>
  );
}