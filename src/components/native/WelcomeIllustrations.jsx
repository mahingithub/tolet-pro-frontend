import React from 'react';

// The artwork is cut out of its white matte (scripts/cutout-onboarding-art.mjs)
// so the carousel needs no surface of its own: the illustration sits straight on
// the page in both themes instead of inside a white box the dark theme can't
// recolour. It sizes to whatever height the welcome screen has left, so a short
// phone gives up illustration rather than pushing the form off the screen.
function Illustration({ title, file, priority = false }) {
  return (
    <img
      src={`/illustrations/onboarding/${file}.png`}
      alt={title}
      width="960"
      height="640"
      draggable={false}
      loading="eager"
      fetchpriority={priority ? 'high' : 'low'}
      decoding="async"
      className="mx-auto block h-full w-full object-contain"
    />
  );
}

export function FindHome({ title }) {
  return <Illustration title={title} file="find-home-v2" priority />;
}

export function CollectRent({ title }) {
  return <Illustration title={title} file="collect-rent-v3" />;
}

export function SharedLedger({ title }) {
  return <Illustration title={title} file="shared-ledger-v3" />;
}
