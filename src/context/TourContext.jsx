import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export const TourProvider = ({ children }) => {
  const { user, activeRole } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTour, setActiveTour] = useState(null);
  const [driverInstance, setDriverInstance] = useState(null);

  const isBn = language === 'বাংলা';

  // Cleanup driver on unmount
  useEffect(() => {
    return () => {
      if (driverInstance) {
        driverInstance.destroy();
      }
    };
  }, [driverInstance]);

  const hasTourCompleted = useCallback((tourId) => {
    const completed = getCompletedTours();
    return !!completed[tourId];
  }, []);

  const startTenantTour = useCallback(() => {
    if (hasTourCompleted('tenant')) return;

    const steps = [
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
    ];

    const driverObj = driver({
      showProgress: true,
      steps,
      nextBtnText: isBn ? 'পরবর্তী' : 'Next',
      prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
      doneBtnText: isBn ? 'শেষ' : 'Done',
      progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
      onDestroyed: () => {
        markTourCompleted('tenant');
        setActiveTour(null);
        setDriverInstance(null);
      },
    });

    setActiveTour('tenant');
    setDriverInstance(driverObj);
    driverObj.drive();
  }, [isBn, hasTourCompleted]);

  const startHostTour = useCallback(() => {
    if (hasTourCompleted('host')) return;

    const steps = [
      {
        element: '[data-tour="host-dashboard-link"]',
        popover: {
          title: isBn ? 'হোস্ট ড্যাশবোর্ড' : 'Host Dashboard',
          description: isBn
            ? 'আপনার সকল প্রপার্টি এবং ভাড়াটিয়া পরিচালনা করতে ড্যাশবোর্ডে প্রবেশ করুন।'
            : 'Access your dashboard to manage all your properties and tenants.',
          side: 'bottom',
          align: 'start',
        },
        waitForElement: 3000,
      },
      {
        popover: {
          title: isBn ? 'স্বাগতম!' : 'Welcome!',
          description: isBn
            ? 'এখন আমরা হোস্ট ড্যাশবোর্ডে যাচ্ছি। একটু অপেক্ষা করুন...'
            : 'Now we are navigating to the Host Dashboard. Please wait...',
          side: 'top',
          align: 'center',
        },
        onHighlighted: () => {
          // Navigate to host dashboard
          navigate('/host-dashboard');
        },
      },
    ];

    const driverObj = driver({
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
  }, [isBn, hasTourCompleted, navigate]);

  const startHostDashboardTour = useCallback(() => {
    if (hasTourCompleted('host-dashboard')) return;

    const steps = [
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
      },
    ];

    const driverObj = driver({
      showProgress: true,
      steps,
      nextBtnText: isBn ? 'পরবর্তী' : 'Next',
      prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
      doneBtnText: isBn ? 'শেষ' : 'Done',
      progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
      onDestroyed: () => {
        markTourCompleted('host-dashboard');
        setActiveTour(null);
        setDriverInstance(null);
      },
    });

    setActiveTour('host-dashboard');
    setDriverInstance(driverObj);
    driverObj.drive();
  }, [isBn, hasTourCompleted]);

  const startAddPropertyTour = useCallback(() => {
    if (hasTourCompleted('add-property')) return;

    const steps = [
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
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
        waitForElement: 3000,
      },
    ];

    const driverObj = driver({
      showProgress: true,
      steps,
      nextBtnText: isBn ? 'পরবর্তী' : 'Next',
      prevBtnText: isBn ? 'পূর্ববর্তী' : 'Previous',
      doneBtnText: isBn ? 'শেষ' : 'Done',
      progressText: isBn ? '{{current}} এর {{total}}' : '{{current}} of {{total}}',
      onDestroyed: () => {
        markTourCompleted('add-property');
        setActiveTour(null);
        setDriverInstance(null);
      },
    });

    setActiveTour('add-property');
    setDriverInstance(driverObj);
    driverObj.drive();
  }, [isBn, hasTourCompleted]);

  // Auto-start tours on first signup
  useEffect(() => {
    // Listen for signup welcome event
    const handleSignupWelcome = (event) => {
      const { role } = event.detail || {};

      // Wait a bit for the navigation to complete
      setTimeout(() => {
        if (role === 'tenant') {
          startTenantTour();
        } else if (role === 'landlord' || role === 'host') {
          startHostTour();
        }
      }, 1500);
    };

    window.addEventListener('triggerWelcomeRobot', handleSignupWelcome);
    return () => window.removeEventListener('triggerWelcomeRobot', handleSignupWelcome);
  }, [startTenantTour, startHostTour]);

  // Auto-start host dashboard tour when arriving at /host-dashboard after host tour completes
  useEffect(() => {
    if (
      location.pathname === '/host-dashboard' &&
      hasTourCompleted('host') &&
      !hasTourCompleted('host-dashboard') &&
      activeTour === null
    ) {
      // Small delay to let the dashboard render
      setTimeout(() => {
        startHostDashboardTour();
      }, 800);
    }
  }, [location.pathname, hasTourCompleted, activeTour, startHostDashboardTour]);

  // Auto-start add property tour when arriving at /list-property
  useEffect(() => {
    if (
      location.pathname === '/list-property' &&
      !hasTourCompleted('add-property') &&
      activeTour === null
    ) {
      // Small delay to let the form render
      setTimeout(() => {
        startAddPropertyTour();
      }, 800);
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
