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
        },
        {
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
    startingRef.current = true;
    if (!(await waitForAnchor('[data-tour="dashboard-tab"]'))) {
      startingRef.current = false;
      return;
    }

    try {
      const steps = resolveSteps([
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
      ]);

      // Premium tabs are hidden on some plans and the sidebar collapses on
      // mobile; resolveSteps has already dropped anchors that are not visible.
      if (!steps.length) {
        startingRef.current = false;
        return;
      }

      const driverObj = driver({
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
      setDriverInstance(driverObj);
      driverObj.drive();
    } catch (error) {
      console.error('Failed to start host dashboard tour:', error);
      startingRef.current = false;
      setActiveTour(null);
      setDriverInstance(null);
    }
  }, [isBn, hasTourCompleted]);

  // The landlord tour is a single leg: signup already routes to
  // /host-dashboard, and the navbar "Host Dashboard" entry lives inside a
  // closed dropdown (so it cannot be highlighted). Go straight to the tabs.
  const startHostTour = useCallback(async () => {
    if (hasTourCompleted('host-dashboard')) return;
    if (window.location.pathname !== '/host-dashboard') {
      navigate('/host-dashboard');
    }
    await startHostDashboardTour();
  }, [hasTourCompleted, navigate, startHostDashboardTour]);

  const startAddPropertyTour = useCallback(async () => {
    if (hasTourCompleted('add-property') || startingRef.current) return;
    startingRef.current = true;
    if (!(await waitForAnchor('[data-tour="property-intent"]'))) {
      startingRef.current = false;
      return;
    }

    try {
      const steps = resolveSteps([
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
          element: '[data-tour="property-pricing"]',
          popover: {
            title: isBn ? 'মূল্য' : 'Pricing',
            description: isBn
              ? 'আপনার প্রপার্টির ভাড়া বা মূল্য এখানে লিখুন।'
              : 'Enter the rent or price for your property here.',
            side: 'top',
            align: 'start',
          },
        },
      ]);

      // Pricing lives on a later wizard page, so its anchor is not visible while
      // the user is still on page 1 — resolveSteps drops it rather than showing
      // an unanchored popover.
      if (!steps.length) {
        startingRef.current = false;
        return;
      }

      const driverObj = driver({
        showProgress: true,
        steps,
        nextBtnText: isBn ? 'পরবর্তী' : 'Next',
        prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
        doneBtnText: isBn ? 'শেষ' : 'Done',
        progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
        onDestroyed: () => {
          markTourCompleted('add-property');
          startingRef.current = false;
          setActiveTour(null);
          setDriverInstance(null);
        },
      });

      setActiveTour('add-property');
      setDriverInstance(driverObj);
      driverObj.drive();
    } catch (error) {
      console.error('Failed to start add property tour:', error);
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

  // Auto-start add property tour when arriving at the listing form
  useEffect(() => {
    if (
      location.pathname === '/list-property' &&
      !hasTourCompleted('add-property') &&
      activeTour === null
    ) {
      startAddPropertyTour();
    }
  }, [location.pathname, hasTourCompleted, activeTour, startAddPropertyTour]);

  const value = {
    activeTour,
    startTenantTour,
    startHostTour,
    startHostDashboardTour,
    startAddPropertyTour,
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
