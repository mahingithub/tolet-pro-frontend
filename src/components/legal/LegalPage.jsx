// LegalPage.jsx — shared layout for Privacy / Terms / Refund pages. [Phase 7]
// ───────────────────────────────────────────────────────────────────────────
// A self-contained wrapper so the three legal pages look consistent and each
// gets its own EN/BN toggle WITHOUT depending on the app's LanguageContext
// (keeps these pages safe to drop in — nothing global to wire up).
//
// Usage:
//   <LegalPage titleEn="Privacy Policy" titleBn="গোপনীয়তা নীতি"
//              lastUpdated="May 2026" lang={lang} setLang={setLang}>
//     ...sections...
//   </LegalPage>
//
// The page passes `lang` ('en' | 'bn') down; section components read it to
// pick which text to show.
//
// ► TO CHANGE: brand colour (#ba0036) + logo glyph are inline below.

import React from 'react';
import useGoBack from '../../hooks/useGoBack';
import { Home } from 'lucide-react';

export default function LegalPage({ titleEn, titleBn, lastUpdated, lang, setLang, children }) {
  const goBack = useGoBack('/');
  const isBn = lang === 'bn';

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid #f0f0f0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          zIndex: 10,
        }}
      >
        {/* Back */}
        <button
          onClick={goBack}
          aria-label="Back"
          style={{
            background: '#f3f4f6', border: 'none', borderRadius: '10px',
            width: '38px', height: '38px', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', color: '#374151',
          }}
        >
          ‹
        </button>

        {/* Original Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: '#ba0036', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Home size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: '18px', color: '#1f2937', letterSpacing: '-0.5px' }}>
            TO-LET <span style={{ color: '#ba0036' }}>PRO</span>
          </h1>
        </a>

        {/* EN / BN toggle */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', flexShrink: 0 }}>
          {['en', 'bn'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                border: 'none', borderRadius: '8px', padding: '6px 12px',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: lang === l ? '#ba0036' : 'transparent',
                color: lang === l ? '#fff' : '#6b7280',
              }}
            >
              {l === 'en' ? 'EN' : 'বাং'}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 20px 80px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#1f2937', marginBottom: '6px' }}>
          {isBn ? titleBn : titleEn}
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500, marginBottom: '28px' }}>
          {isBn ? 'সর্বশেষ হালনাগাদ: ' : 'Last updated: '}{lastUpdated}
        </p>
        {children}
      </div>
    </div>
  );
}

// Small helper components the pages use for consistent section styling.
export function Section({ children }) {
  return <div style={{ marginBottom: '26px' }}>{children}</div>;
}

export function H2({ children }) {
  return (
    <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#1f2937', marginBottom: '10px' }}>
      {children}
    </h2>
  );
}

export function P({ children }) {
  return (
    <p style={{ fontSize: '14.5px', lineHeight: 1.7, color: '#374151', marginBottom: '12px' }}>
      {children}
    </p>
  );
}

export function LI({ children }) {
  return (
    <li style={{ fontSize: '14.5px', lineHeight: 1.7, color: '#374151', marginBottom: '8px' }}>
      {children}
    </li>
  );
}
