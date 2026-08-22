import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronRight } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useLanguage } from '../../context/LanguageContext';

const ThemeWidget = () => {
  const { settings, update } = useSettings();
  const { language } = useLanguage();
  const bn = language === 'বাংলা';
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef(null);

  const theme = settings.theme || 'system';

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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
          </div>
        )}
        
        {isOpen && (
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`
            absolute right-0 flex items-center justify-center w-10 h-12 bg-white dark:bg-gray-800 
            border border-r-0 border-gray-200 dark:border-gray-700 shadow-md 
            rounded-l-xl text-gray-700 dark:text-gray-200 hover:text-[#ba0036] dark:hover:text-[#ba0036] 
            transition-colors
          `}
          aria-label={bn ? 'থিম পরিবর্তন' : 'Toggle Theme'}
        >
          {theme === 'light' && <Sun size={20} />}
          {theme === 'dark' && <Moon size={20} />}
          {theme === 'system' && <Monitor size={20} />}
        </button>
      )}
    </div>
  );
};

export default ThemeWidget;
