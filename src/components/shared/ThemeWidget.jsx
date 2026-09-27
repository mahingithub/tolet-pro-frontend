import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Home } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext.jsx';
import HomeSurfacePicker from './HomeSurfacePicker';

const ThemeWidget = () => {
  const { settings, update } = useSettings();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const bn = language === 'বাংলা';
  const [isOpen, setIsOpen] = useState(false);
  // "Which screen does the app open on?" — a personal preference like the
  // theme, so it lives in the same flyout rather than costing a header slot.
  const [isHomePickerOpen, setIsHomePickerOpen] = useState(false);
  const widgetRef = useRef(null);

  const theme = settings.theme || 'system';

  // Close when clicking outside. Suspended while the home picker is up: that
  // popup is portalled to <body>, so every tap inside it counts as "outside"
  // this widget and would collapse the flyout behind it.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen && !isHomePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isHomePickerOpen]);

  const handleThemeChange = (newTheme) => {
    update({ theme: newTheme });
    setIsOpen(false);
  };

  const options = [
    { value: 'light', label: bn ? 'লাইট' : 'Light', icon: Sun },
    { value: 'dark', label: bn ? 'ডার্ক' : 'Dark', icon: Moon },
    { value: 'system', label: bn ? 'সিস্টেম' : 'System', icon: Monitor },
  ];

  return (
    <div 
      ref={widgetRef}
      /* Pinned to the right edge at the vertical centre, on every screen size.
         See the closed-tab button below for how it earns that space on a phone
         without covering what is underneath it. */
      className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] flex items-center"
    >
      <div 
        className={`
          flex items-center bg-white dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 
          shadow-[0_8px_30px_-15px_rgba(0,0,0,0.3)]
          transition-all duration-300 ease-in-out
          ${isOpen ? 'rounded-l-2xl p-2 translate-x-0' : 'rounded-l-xl p-0 translate-x-full'}
        `}
      >
        {isOpen && (
          <div className="flex flex-col gap-1.5 mr-2">
            {options.map(({ value, label, icon: Icon }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all active:scale-[0.96]
                    ${isActive
                      ? 'bg-[#ba0036] text-white shadow-[0_6px_16px_-6px_rgba(186,0,54,0.6)]'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={label}
                >
                  <Icon size={16} />
                  <span className="md:block hidden whitespace-nowrap">{label}</span>
                </button>
              );
            })}

            {/* Which screen the app opens on. Only for a signed-in account —
                there is nothing to remember for a visitor, and the preference
                would have nowhere to be saved. */}
            {isAuthenticated && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-0.5" />
                <button
                  onClick={() => setIsHomePickerOpen(true)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-[0.96]"
                  title={bn ? 'অ্যাপ খুললে যা দেখব' : 'Open the app on'}
                >
                  <Home size={16} />
                  <span className="md:block hidden whitespace-nowrap">{bn ? 'ডিফল্ট' : 'Default'}</span>
                </button>
              </>
            )}
          </div>
        )}
        

      </div>

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          /* SMALLER ON A PHONE, and sized to what it does rather than to the
             desktop tab it grew from.

             The closed tab lives at the right edge, vertically centred — which
             on a phone is the middle of the content column. At 40×48 it sat on
             top of real, tappable things: the "See all" link on the landlord
             dashboard, the unread badge on Smart Alerts, a select's chevron,
             the corner of the outstanding-rent card.

             28×36 keeps it plainly visible and still comfortably tappable (the
             OS hit-slop around a 28px control reaches the ~44px people actually
             need) while giving back about half the width it was stealing.
             Desktop keeps the original size, where there is room to spare and a
             pointer to hover it with.

             Moving it instead was tried and does not work: the bottom-right
             corner is the AI assistant's, and on a phone that button already
             sits just above the rail. */
          className={`
            absolute right-0 flex items-center justify-center
            w-7 h-9 md:w-10 md:h-12 bg-white dark:bg-gray-800
            border border-r-0 border-gray-200 dark:border-gray-700 shadow-md
            rounded-l-lg md:rounded-l-xl text-gray-700 dark:text-gray-200 hover:text-[#ba0036] dark:hover:text-[#ba0036]
            transition-colors
          `}
          aria-label={bn ? 'থিম পরিবর্তন' : 'Toggle Theme'}
        >
          {/* 15px on a phone so the glyph still reads inside the smaller tab —
              scaling the box without the icon leaves it looking cramped. */}
          {theme === 'light' && <Sun className="w-[15px] h-[15px] md:w-5 md:h-5" />}
          {theme === 'dark' && <Moon className="w-[15px] h-[15px] md:w-5 md:h-5" />}
          {theme === 'system' && <Monitor className="w-[15px] h-[15px] md:w-5 md:h-5" />}
        </button>
      )}

      <HomeSurfacePicker
        open={isHomePickerOpen}
        onClose={() => { setIsHomePickerOpen(false); setIsOpen(false); }}
      />
    </div>
  );
};

export default ThemeWidget;
