import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';

const TourContext = createContext();

const TOUR_STORAGE_KEY = 'tolet_pro::tours_completed';

// Check localStorage for completed tours
const getCompletedTours = () => {
  try {
    const stored = window.localStorage.getItem(TOUR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Mark a tour as completed
const markTourCompleted = (tourId) => {
  try {
    const completed = getCompletedTours();
    completed[tourId] = true;
    window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(completed));
  } catch {
    // Ignore storage errors
  }
};

// Responsive layouts here keep both variants mounted and hide one with CSS
// (HomePage renders MobileHome *and* HeroSection; HeroSection itself ships a
// `flex lg:hidden` bar and a `hidden lg:flex` bar). A plain querySelector would
// return whichever comes first in the DOM even when it is display:none, and
// driver.js would spotlight a zero-size invisible box. Always pick the anchor
// the user can actually see.
const visibleAnchor = (selector) => {
  const matches = document.querySelectorAll(selector);
  for (const el of matches) {
    const rects = el.getClientRects();
    if (rects.length && rects[0].width > 0 && rects[0].height > 0) return el;
  }
  return null;
};

// driver.js has no built-in "wait for element" — a step whose anchor is not in
// the DOM yet renders as a centred popover with nothing highlighted. Tours here
// start right after a route change, so poll for the first anchor before driving
// and skip the tour entirely if the page never shows it.
const waitForAnchor = (selector, timeout = 5000) =>
  new Promise((resolve) => {
    const found = visibleAnchor(selector);
    if (found) {
      resolve(found);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const el = visibleAnchor(selector);
      if (el) {
        window.clearInterval(timer);
        resolve(el);
      } else if (Date.now() - started >= timeout) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 120);
  });

// Swap each step's selector for the visible element it resolves to, dropping
// steps with no visible anchor (premium tabs, later wizard pages). Steps with no
// `element` at all are intentional centred popovers and always survive.
const resolveSteps = (steps) =>
  steps
    .map((step) => {
      if (!step.element) return step;
      const el = visibleAnchor(step.element);
      return el ? { ...step, element: el } : null;
    })
    .filter(Boolean);

export const TourProvider = ({ children }) => {
  const { activeRole } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTour, setActiveTour] = useState(null);
  const [driverInstance, setDriverInstance] = useState(null);
  // `activeTour` is only set after the async element wait resolves, so a second
  // trigger arriving in that window would start a competing tour. This ref
  // flips synchronously and is the real mutual-exclusion guard.
  const startingRef = useRef(false);

  const isBn = language === 'বাংলা';

  // Tear the overlay down on unmount only. Depending on `driverInstance` here
  // would re-run the cleanup when a finished tour sets it back to null and call
  // destroy() a second time on an instance driver.js has already destroyed.
  const driverRef = useRef(null);
  driverRef.current = driverInstance;
  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  const hasTourCompleted = useCallback((tourId) => {
    const completed = getCompletedTours();
    return !!completed[tourId];
  }, []);

  const startTenantTour = useCallback(async () => {
    if (hasTourCompleted('tenant') || startingRef.current) return;
    startingRef.current = true;

    // The search bar only exists on the public home page, so make sure we are
    // there (post-signup lands on /tenant-dashboard) before highlighting it.
    if (window.location.pathname !== '/') {
      navigate('/');
    }
    if (!(await waitForAnchor('[data-tour="mode-switcher"]'))) {
      startingRef.current = false;
      return;
    }

    try {
      const steps = resolveSteps([
        {
          element: '[data-tour="mode-switcher"]',
          popover: {
            title: isBn ? 'ধাপ ১: ধরন বেছে নিন' : 'Step 1: Choose Mode',
            description: isBn
              ? 'প্রথমে বেছে নিন আবাসিক, বাণিজ্যিক নাকি ক্রয়।'
              : 'First, select whether you want Residential, Commercial, or Buy.',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: '[data-tour="location"]',
          popover: {
            title: isBn ? 'ধাপ ২: লোকেশন' : 'Step 2: Location',
            description: isBn
              ? 'কোথায় খুঁজছেন তা এখানে লিখুন বা বেছে নিন।'
              : 'Enter or select where you are looking for properties.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour="property-type"]',
          popover: {
            title: isBn ? 'ধাপ ৩: প্রপার্টির ধরন' : 'Step 3: Property Type',
            description: isBn
              ? 'আপনার পছন্দের ধরন নির্বাচন করুন (ফ্ল্যাট, বাসা, রুম ইত্যাদি)।'
              : 'Select your preferred property type (Flat, House, Room, etc.).',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour="budget"]',
          popover: {
            title: isBn ? 'ধাপ ৪: বাজেট' : 'Step 4: Budget',
            description: isBn
              ? 'আপনার বাজেট নির্ধারণ করুন।'
              : 'Set your budget range here.',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '[data-tour="search-button"]',
          popover: {
            title: isBn ? 'ধাপ ৫: খুঁজুন' : 'Step 5: Search',
            description: isBn
              ? 'সবার শেষে খুঁজুন বাটনে ক্লিক করুন এবং ফলাফল দেখুন।'
              : 'Finally, click the Search button to see available properties.',
            side: 'bottom',
            align: 'center',
          },
        }
      ]);

      if (!steps.length) {
        startingRef.current = false;
        return;
      }

      const driverObj = driver({
        allowClose: true,
        showProgress: true,
        steps,
        nextBtnText: isBn ? 'পরবর্তী' : 'Next',
        prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
        doneBtnText: isBn ? 'শেষ' : 'Done',
        progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
        onDestroyed: () => {
          markTourCompleted('tenant');
          startingRef.current = false;
          setActiveTour(null);
          setDriverInstance(null);
        },
      });

      setActiveTour('tenant');
      setDriverInstance(driverObj);
      driverObj.drive();
    } catch (error) {
      console.error('Failed to start tenant tour:', error);
      startingRef.current = false;
      setActiveTour(null);
      setDriverInstance(null);
    }
  }, [isBn, hasTourCompleted, navigate]);

  const startHostDashboardTour = useCallback(async () => {
    if (hasTourCompleted('host-dashboard') || startingRef.current) return;
    
    // Do not start if the welcome robot is currently active on screen
    if (document.getElementById('welcome-robot-overlay')) return;
    
    startingRef.current = true;
    
    if (!(await waitForAnchor('[data-tour="host-stats-grid"]'))) {
      startingRef.current = false;
      return;
    }

    try {
      let dashboardDriverObj = null;
      const resolvedSteps = resolveSteps([
        {
          element: '[data-tour="host-stats-grid"]',
          popover: {
            title: isBn ? 'ড্যাশবোর্ড সামারি' : 'Dashboard Summary',
            description: isBn
              ? 'এখানে আপনার প্রপার্টি এবং ইনকোয়ারির একটি দ্রুত ওভারভিউ দেখতে পাবেন।'
              : 'Get a quick overview of your properties and inquiries here.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour="host-quick-actions"]',
          popover: {
            title: isBn ? 'দ্রুত অ্যাকশন' : 'Quick Actions',
            description: isBn
              ? 'ভাড়াটিয়া যোগ করা, ভাড়া কালেকশন বা মেসেজ দেওয়ার মতো জরুরি কাজগুলো এখান থেকেই করতে পারবেন।'
              : 'Quickly add tenants, collect rent, or send messages right from here.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="host-shared-ledger"]',
          popover: {
            title: isBn ? 'ভাড়া লেজার ওভারভিউ' : 'Shared Ledger Overview',
            description: isBn
              ? 'আপনার মোট কত টাকা ভাড়া উঠেছে এবং কত বকেয়া আছে, তার হিসাব এখানে থাকবে।'
              : 'Track your total rent collection and outstanding dues at a glance.',
            side: 'top',
            align: 'start',
            onNextClick: () => {
              const btn = document.getElementById('host-more-actions-btn');
              const dropdown = document.getElementById('host-more-actions-dropdown');
              if (btn && !dropdown) {
                btn.click();
              }
              setTimeout(() => { dashboardDriverObj.moveNext(); }, 300);
            }
          },
        },
        {
          element: '[data-tour="host-more-actions"]',
          popover: {
            title: isBn ? 'আরও অ্যাকশন' : 'More Actions',
            description: isBn
              ? 'এখানে আপনি রিপোর্ট দেখা, নতুন চুক্তি তৈরি বা সবাইকে মেসেজ দেওয়ার মতো অতিরিক্ত অপশনগুলো পাবেন।'
              : 'Here you will find additional options like viewing reports, creating new leases, or messaging all tenants.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="host-header-add-property"]',
          popover: {
            title: isBn ? 'নতুন প্রপার্টি যোগ করুন' : 'Add New Property',
            description: isBn
              ? 'নতুন কোনো বাসা বা প্রপার্টি ভাড়া দিতে চাইলে এখানে ক্লিক করুন।'
              : 'Click here anytime to list a new property.',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '[data-tour="host-logo"]',
          popover: {
            title: isBn ? 'মেইন হোমে ফিরুন' : 'Return to Main Home',
            description: isBn
              ? 'লোগোতে ক্লিক করলে আপনি মেইন হোমে যাওয়ার অপশন পাবেন।'
              : 'Click the logo to see options for returning to the main home.',
            side: 'bottom',
            align: 'start',
            onNextClick: () => {
              window.dispatchEvent(new Event('open-home-choice-modal'));
              setTimeout(() => {
                if (dashboardDriverObj) dashboardDriverObj.moveNext();
              }, 400);
            }
          }
        }
      ]);

      const modalSteps = [
        {
          element: '[data-tour="host-home-option"]',
          popover: {
            title: isBn ? 'পাবলিক সাইটে যান' : 'Go to Public Site',
            description: isBn
              ? 'এখানে ক্লিক করলে আপনি পাবলিক TO-LET PRO সাইটে ফিরে যাবেন।'
              : 'Click here to return to the public TO-LET PRO site.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="host-dashboard-option"]',
          popover: {
            title: isBn ? 'ড্যাশবোর্ডেই থাকুন' : 'Stay on Dashboard',
            description: isBn
              ? 'আর এখানে ক্লিক করলে আপনি ড্যাশবোর্ডেই থাকবেন।'
              : 'And click here if you want to stay on your dashboard.',
            side: 'right',
            align: 'start',
            onNextClick: () => {
              window.dispatchEvent(new Event('close-home-choice-modal'));
              setTimeout(() => {
                if (dashboardDriverObj) dashboardDriverObj.moveNext();
              }, 400);
            }
          },
        }
      ];

      const resolvedProfileMenu = resolveSteps([
        {
          element: '[data-tour="host-profile-menu"]',
          popover: {
            title: isBn ? 'মেইন মেনু' : 'Main Menu',
            description: isBn
              ? 'আপনার প্রোফাইল, ড্যাশবোর্ডের সব ট্যাব এবং সেটিংস পেতে এই মেনুটিতে ক্লিক করুন।'
              : 'Click here to open the menu and access all your dashboard tabs, settings, and more.',
            side: 'bottom',
            align: 'end',
            onNextClick: () => {
              window.dispatchEvent(new Event('open-host-drawer'));
              setTimeout(() => {
                if (dashboardDriverObj) dashboardDriverObj.moveNext();
              }, 400);
            }
          },
        },
      ]);

      const sidebarSteps = [
        {
          element: '[data-tour="dashboard-tab"]',
          popover: {
            title: isBn ? 'ড্যাশবোর্ড' : 'Dashboard',
            description: isBn
              ? 'আপনার সকল প্রপার্টির সামারি এখানে দেখতে পাবেন।'
              : 'View a summary of all your properties here.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="documents-tab"]',
          popover: {
            title: isBn ? 'ডকুমেন্ট ও অ্যানালিটিক্স' : 'Documents & Analytics',
            description: isBn
              ? 'আপনার প্রপার্টির ডকুমেন্টস এবং আয়ের এনালাইটিক্স এখানে দেখুন।'
              : 'View your property documents and income analytics here.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="inquiries-tab"]',
          popover: {
            title: isBn ? 'ইনকোয়ারি' : 'Inquiries',
            description: isBn
              ? 'ভাড়াটিয়াদের সকল ইনকোয়ারি এখানে আসবে।'
              : 'All tenant inquiries will appear here.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="bookings-tab"]',
          popover: {
            title: isBn ? 'ভাড়াটিয়া ও রেন্ট' : 'Tenants & Rent',
            description: isBn
              ? 'আপনার বর্তমান ভাড়াটিয়াদের লিস্ট এবং ভাড়া কালেকশনের হিসাব এখানে রাখুন।'
              : 'Manage your current tenants list and rent collection here.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="payments-tab"]',
          popover: {
            title: isBn ? 'পেমেন্ট সেটিংস' : 'Payment Settings',
            description: isBn
              ? 'অনলাইনে ভাড়া রিসিভ করার জন্য পেমেন্ট মেথড যুক্ত করুন।'
              : 'Add payment methods to receive rent online.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="smart-alerts-tab"]',
          popover: {
            title: isBn ? 'স্মার্ট অ্যালার্টস' : 'Smart Alerts',
            description: isBn
              ? 'গুরুত্বপূর্ণ নোটিফিকেশনগুলো এখানে পাবেন।'
              : 'Find important notifications here.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="ai-insights-tab"]',
          popover: {
            title: isBn ? 'এআই ইনসাইটস' : 'AI Insights',
            description: isBn
              ? 'ভাড়া ও প্রপার্টি সম্পর্কিত এআই পরামর্শগুলো এখানে দেখুন।'
              : 'Get AI-powered insights about rent and properties here.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="add-property-button"]',
          popover: {
            title: isBn ? 'নতুন প্রপার্টি যোগ করুন' : 'Add New Property',
            description: isBn
              ? 'নতুন বাড়ি বা প্রপার্টি যুক্ত করতে এখানে ক্লিক করুন।'
              : 'Click here to add a new property listing.',
            side: 'right',
            align: 'start',
          },
        },
      ];

      const steps = [...resolvedSteps, ...modalSteps, ...resolvedProfileMenu, ...sidebarSteps];

      if (!steps.length) {
        startingRef.current = false;
        return;
      }

      dashboardDriverObj = driver({
        allowClose: true,
        showProgress: true,
        steps,
        nextBtnText: isBn ? 'পরবর্তী' : 'Next',
        prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
        doneBtnText: isBn ? 'শেষ' : 'Done',
        progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
        onDestroyed: () => {
          markTourCompleted('host-dashboard');
          startingRef.current = false;
          setActiveTour(null);
          setDriverInstance(null);
        },
      });

      setActiveTour('host-dashboard');
      setDriverInstance(dashboardDriverObj);
      dashboardDriverObj.drive();
    } catch (error) {
      console.error('Failed to start host dashboard tour:', error);
      startingRef.current = false;
      setActiveTour(null);
      setDriverInstance(null);
    }
  }, [isBn, hasTourCompleted]);

  const startHostTour = useCallback(async () => {
    if (hasTourCompleted('host')) return;

    if (window.location.pathname === '/') {
      let driverObj = null;

      const isMobile = window.innerWidth < 768;
      
      const steps = isMobile ? [
        {
          element: '[data-tour="mobile-nav-home"]',
          popover: {
            title: isBn ? 'হোস্ট ড্যাশবোর্ড' : 'Host Dashboard',
            description: isBn
              ? 'আপনার সকল প্রপার্টি এবং ভাড়াটিয়া পরিচালনা করতে ড্যাশবোর্ডে প্রবেশ করুন।'
              : 'Access your dashboard to manage all your properties and tenants.',
            side: 'top',
            align: 'center',
            onNextClick: () => {
              if (driverObj) driverObj.destroy();
              navigate('/host-dashboard');
            }
          },
        }
      ] : [
        {
          element: '[data-tour="navbar-profile"]',
          popover: {
            title: isBn ? 'মেইন মেনু' : 'Main Menu',
            description: isBn
              ? 'ড্যাশবোর্ডে যেতে প্রথমে এখানে ক্লিক করে মেনু ওপেন করুন।'
              : 'Click here to open the menu and go to your dashboard.',
            side: 'bottom',
            align: 'end',
            onNextClick: () => {
              window.dispatchEvent(new Event('open-navbar-profile'));
              setTimeout(() => {
                if (driverObj) driverObj.moveNext();
              }, 300);
            }
          },
        },
        {
          element: '[data-tour="host-dashboard-link"]',
          popover: {
            title: isBn ? 'হোস্ট ড্যাশবোর্ড' : 'Host Dashboard',
            description: isBn
              ? 'আপনার সকল প্রপার্টি এবং ভাড়াটিয়া পরিচালনা করতে ড্যাশবোর্ডে প্রবেশ করুন।'
              : 'Access your dashboard to manage all your properties and tenants.',
            side: 'left',
            align: 'start',
            onNextClick: () => {
              if (driverObj) driverObj.destroy();
              navigate('/host-dashboard');
            }
          },
        }
      ];

      driverObj = driver({
        allowClose: true,
        showProgress: true,
        steps,
        nextBtnText: isBn ? 'পরবর্তী' : 'Next',
        prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
        doneBtnText: isBn ? 'শেষ' : 'Done',
        progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
        onDestroyed: () => {
          markTourCompleted('host');
          setActiveTour(null);
          setDriverInstance(null);
        },
      });

      setActiveTour('host');
      setDriverInstance(driverObj);
      driverObj.drive();
    } else {
      if (window.location.pathname !== '/host-dashboard') {
        navigate('/host-dashboard');
      }
      await startHostDashboardTour();
    }
  }, [hasTourCompleted, navigate, isBn, startHostDashboardTour]);

  const startAddPropertyTour = useCallback(async (stepIndex = 1) => {
    const tourId = `add-property-step-${stepIndex}`;
    if (hasTourCompleted(tourId) || startingRef.current) return;
    startingRef.current = true;
    
    let rawSteps = [];
    if (stepIndex === 1) {
      if (!(await waitForAnchor('[data-tour="property-intent"]'))) {
        startingRef.current = false;
        return;
      }
      rawSteps = [
        {
          element: '[data-tour="property-intent"]',
          popover: {
            title: isBn ? 'উদ্দেশ্য' : 'Listing Intent',
            description: isBn
              ? 'প্রথমে বেছে নিন আপনি ভাড়া দিতে চাচ্ছেন, বিক্রয় করতে চাচ্ছেন নাকি বাণিজ্যিক।'
              : 'First, select whether you want to Rent, Sell, or list Commercial property.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="property-title"]',
          popover: {
            title: isBn ? 'শিরোনাম' : 'Property Title',
            description: isBn
              ? 'আকর্ষণীয় এবং পরিষ্কার শিরোনাম দিন।'
              : 'Give a clear and attractive title for your listing.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="property-location"]',
          popover: {
            title: isBn ? 'লোকেশন' : 'Location',
            description: isBn
              ? 'বিভাগ, জেলা, থানা এবং সম্পূর্ণ ঠিকানা দিন।'
              : 'Provide division, district, thana, and full address.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="property-gps"]',
          popover: {
            title: isBn ? 'GPS লোকেশন' : 'GPS Location',
            description: isBn
              ? 'ঐচ্ছিক\nGPS বাটন চাপলে আপনার বর্তমান অবস্থান স্বয়ংক্রিয়ভাবে সেট হবে এবং মানচিত্রে দেখাবে।'
              : 'Optional\nClicking the GPS button will automatically set your current location and show it on the map.',
            side: 'top',
            align: 'start',
          },
        }
      ];
    } else if (stepIndex === 2) {
      if (!(await waitForAnchor('[data-tour="property-details"]'))) {
        startingRef.current = false;
        return;
      }
      rawSteps = [
        {
          element: '[data-tour="property-details"]',
          popover: {
            title: isBn ? 'বিবরণ' : 'Details',
            description: isBn
              ? 'বেডরুম, বাথরুম এবং অন্যান্য বিবরণ এখানে দিন।'
              : 'Enter bedrooms, bathrooms, and other details here.',
            side: 'top',
            align: 'start',
          },
        }
      ];
    } else if (stepIndex === 3) {
      if (!(await waitForAnchor('[data-tour="property-amenities"]'))) {
        startingRef.current = false;
        return;
      }
      rawSteps = [
        {
          element: '[data-tour="property-amenities"]',
          popover: {
            title: isBn ? 'সুযোগ-সুবিধা' : 'Amenities',
            description: isBn
              ? 'যেসব সুযোগ-সুবিধা আছে সেগুলো সিলেক্ট করুন।'
              : 'Select the available amenities.',
            side: 'top',
            align: 'start',
          },
        }
      ];
    } else if (stepIndex === 4) {
      if (!(await waitForAnchor('[data-tour="property-media"]'))) {
        startingRef.current = false;
        return;
      }
      rawSteps = [
        {
          element: '[data-tour="property-media"]',
          popover: {
            title: isBn ? 'ছবি ও ভিডিও' : 'Photos & Videos',
            description: isBn
              ? 'প্রপার্টির সুন্দর ছবি এবং ভিডিও আপলোড করুন।'
              : 'Upload beautiful photos and videos of the property.',
            side: 'top',
            align: 'start',
          },
        }
      ];
    } else if (stepIndex === 5) {
      if (!(await waitForAnchor('[data-tour="property-pricing"]'))) {
        startingRef.current = false;
        return;
      }
      rawSteps = [
        {
          element: '[data-tour="property-pricing"]',
          popover: {
            title: isBn ? 'মূল্য নির্ধারণ' : 'Pricing',
            description: isBn
              ? 'আপনার প্রপার্টির ভাড়া বা মূল্য এখানে লিখুন।'
              : 'Enter the rent or price for your property here.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="property-description"]',
          popover: {
            title: isBn ? 'বিস্তারিত বিবরণ' : 'Detailed Description',
            description: isBn
              ? 'আপনার প্রপার্টি সম্পর্কে বিস্তারিত লিখুন, অথবা AI ব্যবহার করে লিখিয়ে নিন।'
              : 'Write detailed information about your property, or let AI generate it for you.',
            side: 'top',
            align: 'start',
          },
        }
      ];
    }

    try {
      const steps = resolveSteps(rawSteps);
      if (!steps.length) {
        startingRef.current = false;
        return;
      }

      const driverObj = driver({
        allowClose: true,
        showProgress: true,
        steps,
        nextBtnText: isBn ? 'পরবর্তী' : 'Next',
        prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
        doneBtnText: isBn ? 'শেষ' : 'Done',
        progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
        onDestroyed: () => {
          markTourCompleted(tourId);
          startingRef.current = false;
          setActiveTour(null);
          setDriverInstance(null);
        },
      });

      setActiveTour(tourId);
      setDriverInstance(driverObj);
      driverObj.drive();
    } catch (error) {
      console.error('Failed to start add property tour:', error);
      startingRef.current = false;
      setActiveTour(null);
      setDriverInstance(null);
    }
  }, [isBn, hasTourCompleted]);

  const startLivingTour = useCallback(async () => {
    if (hasTourCompleted('living') || startingRef.current) return;
    startingRef.current = true;
    if (!(await waitForAnchor('[data-tour="living-header"]'))) {
      startingRef.current = false;
      return;
    }

    try {
      const isMobile = window.innerWidth < 1024;
      const steps = resolveSteps([
        {
          element: '[data-tour="living-header"]',
          popover: {
            title: isBn ? 'রুমমেট ওয়ালেট' : 'Roommate Wallet',
            description: isBn
              ? 'এখানে আপনি আপনার মেস বা ফ্ল্যাটের সব খরচ, মিলস এবং বিল ম্যানেজ করতে পারবেন।'
              : 'Manage all your shared expenses, meals, and bills for your flat or mess here.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: isMobile ? '[data-tour="living-mobile-nav"]' : '[data-tour="living-desktop-nav"]',
          popover: {
            title: isBn ? 'নেভিগেশন মেনু' : 'Navigation Menu',
            description: isBn
              ? 'এখান থেকে আপনি খরচ, মিলস, বিলস এবং ব্যালেন্সের মাঝে নেভিগেট করতে পারবেন।'
              : 'Navigate between Expenses, Meals, Bills, and Balances from here.',
            side: isMobile ? 'top' : 'right',
            align: 'center',
          },
        },
        {
          element: '[data-tour="living-content"]',
          popover: {
            title: isBn ? 'ওভারভিউ' : 'Overview',
            description: isBn
              ? 'আপনার মেসের বর্তমান খরচের একটি সারসংক্ষেপ এখানে দেখতে পাবেন।'
              : 'See a quick summary of your current shared expenses here.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '[data-tour="living-reminders"]',
          popover: {
            title: isBn ? 'রিমাইন্ডার' : 'Reminders',
            description: isBn
              ? 'যেকোনো বকেয়া বিল বা নোটিফিকেশন এখানে দেখতে পাবেন।'
              : 'Check any due bills or notifications here.',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '[data-tour="living-add-roommate"]',
          popover: {
            title: isBn ? 'লোকাল রুমমেট যোগ করুন' : 'Add Local Roommate',
            description: isBn
              ? 'ম্যানুয়ালি রুমমেট যোগ করতে এখানে ক্লিক করুন (শুধু আপনার ফোনে হিসেব রাখার জন্য)।'
              : 'Click here to manually add a roommate (for local tracking on your phone).',
            side: 'top',
            align: 'end',
          },
        },
        {
          element: '[data-tour="living-connect-roommates"]',
          popover: {
            title: isBn ? 'রুমমেট কানেক্ট বা জয়েন করুন' : 'Connect or Join Roommates',
            description: isBn
              ? 'নতুন শেয়ার্ড ওয়ালেট তৈরি করতে অথবা ইনভাইট কোড দিয়ে অন্য কারো ওয়ালেটে জয়েন করতে এখানে ক্লিক করুন।'
              : 'Click here to create a shared wallet or join an existing one using an invite code.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '[data-tour="living-profile"]',
          popover: {
            title: isBn ? 'প্রোফাইল' : 'Profile',
            description: isBn
              ? 'আপনার প্রোফাইল দেখতে বা এডিট করতে এখানে ক্লিক করুন।'
              : 'Click here to view or edit your profile.',
            side: 'bottom',
            align: 'end',
          },
        },
      ]);

      if (!steps.length) {
        startingRef.current = false;
        return;
      }

      const driverObj = driver({
        allowClose: true,
        showProgress: true,
        steps,
        nextBtnText: isBn ? 'পরবর্তী' : 'Next',
        prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
        doneBtnText: isBn ? 'শেষ' : 'Done',
        progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
        onDestroyed: () => {
          markTourCompleted('living');
          startingRef.current = false;
          setActiveTour(null);
          setDriverInstance(null);
        },
      });

      setActiveTour('living');
      setDriverInstance(driverObj);
      driverObj.drive();
    } catch (error) {
      console.error('Failed to start living tour:', error);
      startingRef.current = false;
      setActiveTour(null);
      setDriverInstance(null);
    }
  }, [isBn, hasTourCompleted]);

  // Store the role when welcome robot is triggered
  const [pendingTourRole, setPendingTourRole] = useState(null);

  useEffect(() => {
    const handleSignupWelcome = (event) => {
      const { role } = event.detail || {};
      if (role) {
        setPendingTourRole(role);
      }
    };

    const handleRobotFinish = () => {
      // Use pendingTourRole if available, fallback to activeRole
      const roleToTour = pendingTourRole || activeRole;
      
      // Small delay just to ensure the UI has settled after robot is closed
      setTimeout(() => {
        if (roleToTour === 'tenant') {
          startTenantTour();
        } else if (roleToTour === 'landlord' || roleToTour === 'host') {
          startHostTour();
        }
        setPendingTourRole(null);
      }, 500);
    };

    window.addEventListener('triggerWelcomeRobot', handleSignupWelcome);
    window.addEventListener('welcomeRobotFinished', handleRobotFinish);
    
    return () => {
      window.removeEventListener('triggerWelcomeRobot', handleSignupWelcome);
      window.removeEventListener('welcomeRobotFinished', handleRobotFinish);
    };
  }, [startTenantTour, startHostTour, pendingTourRole, activeRole]);

  // Auto-start the hero section tour if the host goes back to the home page
  useEffect(() => {
    if (
      location.pathname === '/' &&
      (activeRole === 'landlord' || activeRole === 'host') &&
      !hasTourCompleted('host') &&
      activeTour === null
    ) {
      startHostTour();
    }
  }, [location.pathname, activeRole, hasTourCompleted, activeTour, startHostTour]);

  // Resume the dashboard tour if the landlord reaches /host-dashboard without
  // having seen it (e.g. they dismissed the welcome robot before it fired).
  useEffect(() => {
    if (
      location.pathname === '/host-dashboard' &&
      !hasTourCompleted('host-dashboard') &&
      activeTour === null
    ) {
      startHostDashboardTour();
    }
  }, [location.pathname, hasTourCompleted, activeTour, startHostDashboardTour]);

  // Auto-start living tour for tenants arriving at /living
  useEffect(() => {
    if (
      location.pathname === '/living' &&
      !hasTourCompleted('living') &&
      activeTour === null
    ) {
      startLivingTour();
    }
  }, [location.pathname, hasTourCompleted, activeTour, startLivingTour]);

  const startSearchTour = useCallback(async () => {
    if (hasTourCompleted('search') || startingRef.current) return;
    startingRef.current = true;
    if (!(await waitForAnchor('[data-tour="inquiry-button"]'))) {
      startingRef.current = false;
      return;
    }

    try {
      const steps = resolveSteps([
        {
          element: '[data-tour="inquiry-button"]',
          popover: {
            title: isBn ? 'যোগাযোগ করুন' : 'Contact Landlord',
            description: isBn
              ? 'যেকোনো প্রপার্টি কার্ডে "Inquiry" বাটনে ক্লিক করে মালিকের সাথে সরাসরি যোগাযোগ করতে পারবেন।'
              : 'You can contact the landlord directly by clicking the "Inquiry" button on any property card.',
            side: 'top',
            align: 'center',
          },
        },
      ]);

      if (!steps.length) {
        startingRef.current = false;
        return;
      }

      const driverObj = driver({
        allowClose: true,
        showProgress: false,
        steps,
        nextBtnText: isBn ? 'পরবর্তী' : 'Next',
        prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
        doneBtnText: isBn ? 'শেষ' : 'Done',
        onDestroyed: () => {
          markTourCompleted('search');
          startingRef.current = false;
          setActiveTour(null);
          setDriverInstance(null);
        },
      });

      setActiveTour('search');
      setDriverInstance(driverObj);
      driverObj.drive();
    } catch (error) {
      console.error('Failed to start search tour:', error);
      startingRef.current = false;
      setActiveTour(null);
      setDriverInstance(null);
    }
  }, [isBn, hasTourCompleted]);

  // Auto-start search tour for users arriving at /properties
  useEffect(() => {
    if (
      location.pathname.startsWith('/properties') &&
      !hasTourCompleted('search') &&
      activeTour === null
    ) {
      startSearchTour();
    }
  }, [location.pathname, hasTourCompleted, activeTour, startSearchTour]);

  const value = {
    activeTour,
    startTenantTour,
    startHostTour,
    startHostDashboardTour,
    startAddPropertyTour,
    startLivingTour,
    startSearchTour,
    hasTourCompleted,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};
