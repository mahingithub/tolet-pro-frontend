import React, { useEffect, useRef, useState } from 'react';

import { FindHome, CollectRent, SharedLedger } from './WelcomeIllustrations.jsx';

const SLIDES = [
  { id: 'find', Art: FindHome, bn: 'যাচাই করা বাসা খুঁজুন — মালিকের সাথে নিজেই কথা বলুন।', en: 'Find verified homes and talk to the owner yourself.' },
  { id: 'rent', Art: CollectRent, bn: 'প্রপার্টি, ভাড়াটিয়া আর ভাড়ার হিসাব — সব এক জায়গায়।', en: 'Properties, tenants and rent — all in one place.' },
  { id: 'ledger', Art: SharedLedger, bn: 'মেসের মিল, বাজার আর বিলের হিসাব রাখুন Living খাতায়।', en: 'Track meals, groceries and bills in the Living ledger.' },
];

const ROTATE_MS = 4800;
// How long a swipe or a dot tap owns the carousel before it starts moving by
// itself again. Taking the wheel back half a second later is the thing that
// makes an auto-rotating hero annoying — but never taking it back is worse: the
// hold used to last forever, so one swipe left the slides frozen for the rest
// of the screen, which is the "auto-scroll isn't working" people actually meet.
const RESUME_MS = 9000;

export default function WelcomeCarousel({ isBn }) {
  const [index, setIndex] = useState(0);
  // 0 while the carousel is driving itself; bumped on every manual move so a
  // second swipe during a hold restarts the clock instead of being swallowed.
  const [held, setHeld] = useState(0);
  const touch = useRef(null);

  useEffect(() => {
    if (held) return undefined;
    const id = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), ROTATE_MS);
    return () => clearTimeout(id);
  }, [held, index]);

  useEffect(() => {
    if (!held) return undefined;
    const id = setTimeout(() => setHeld(0), RESUME_MS);
    return () => clearTimeout(id);
  }, [held]);

  const goTo = (i) => {
    setHeld((h) => h + 1);
    setIndex((i + SLIDES.length) % SLIDES.length);
  };

  return (
    // Reduced motion is honoured by dropping the slide ANIMATION (the track
    // below, plus the page's global motion rule), not by freezing the carousel.
    // "Don't animate things" is not "never show me slides 2 and 3", and a phone
    // in battery saver reports reduced motion — checking it here used to leave a
    // dead carousel on a lot of otherwise ordinary devices.
    <div
      className="flex w-full flex-1 select-none flex-col"
      aria-roledescription="carousel"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const from = touch.current;
        touch.current = null;
        if (!from) return;
        const dx = e.changedTouches[0].clientX - from.x;
        const dy = e.changedTouches[0].clientY - from.y;
        // Scrolling the screen starts on the artwork as often as not, so a drag
        // only counts as a swipe when it is decidedly sideways.
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(index + (dx < 0 ? 1 : -1));
      }}
    >
      {/* The art is the one thing here allowed to give up height: it shrinks
          against the welcome screen's column, floored so it never becomes a
          smear, so a short phone loses illustration rather than pushing the form
          under the fold.

          flex-1 (so: flex-basis 0) rather than a plain height, because a flex
          item whose basis is a definite 224px reports 224 as its minimum
          contribution too — the column would then refuse to squeeze it and the
          screen scrolled instead. How far it may GROW is capped by the caller,
          so the leftover height of a tall phone never lands in this slot.

          The track is taken out of flow rather than laid out inside this box.
          In flow, the img's intrinsic 960×640 becomes this box's minimum height,
          with the same result. */}
      <div className="relative mx-auto min-h-[80px] w-full max-h-[224px] max-w-[360px] flex-1 overflow-hidden">
        <div
          className="absolute inset-0 flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map(({ id, Art, bn, en }, i) => (
            <div
              key={id}
              role="group"
              aria-label={`${i + 1} / ${SLIDES.length}`}
              aria-hidden={i !== index}
              className="h-full w-full shrink-0 px-3"
            >
              <Art title={isBn ? bn : en} />
            </div>
          ))}
        </div>
      </div>

      {/* The caption lives outside the sliding track: three lines of Bangla of
          differing length would otherwise make the track's height jump mid-slide. */}
      <p
        className="mx-auto mt-2 min-h-[40px] max-w-[340px] shrink-0 px-6 text-center text-[15px] font-semibold leading-snug text-gray-700 dark:text-gray-200"
        aria-live="polite"
      >
        {isBn ? SLIDES[index].bn : SLIDES[index].en}
      </p>

      <div className="flex shrink-0 items-center justify-center gap-1">
        {SLIDES.map(({ id }, i) => (
          <button
            key={id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={isBn ? `ছবি ${i + 1}` : `Slide ${i + 1}`}
            aria-current={i === index}
            // The dot is 6px but the tap target is 32 — a 6px button is not
            // something a thumb can hit.
            className="grid h-8 w-8 place-items-center"
          >
            <span
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-brandRed' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
