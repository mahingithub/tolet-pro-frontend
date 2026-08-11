// TrustSafety.jsx — /trust-safety  [Phase 7]
// ───────────────────────────────────────────────────────────────────────────
// DRAFT legal text — a reasonable starting template for a Bangladesh rental
// app. NOT a substitute for review by a qualified lawyer.
//

import React, { useState } from 'react';
import LegalPage, { Section, H2, P, LI } from './LegalPage';

const CONTACT_EMAIL = 'support@toletpro.rent';

export default function TrustSafety() {
  const [lang, setLang] = useState('en');
  const isBn = lang === 'bn';
  const t = (en, bn) => (isBn ? bn : en);

  return (
    <LegalPage
      titleEn="Trust & Safety"
      titleBn="বিশ্বাস ও নিরাপত্তা"
      lastUpdated={t('May 2026', 'মে ২০২৬')}
      lang={lang}
      setLang={setLang}
    >
      <Section>
        <P>
          {t(
            'At TO-LET PRO, your safety is our top priority. We are committed to building a trusted community where landlords and tenants can connect with confidence. Please read our Trust & Safety guidelines to understand how we protect you.',
            'TO-LET PRO-তে আপনার নিরাপত্তা আমাদের সর্বোচ্চ অগ্রাধিকার। আমরা এমন একটি বিশ্বস্ত সম্প্রদায় গড়ে তুলতে প্রতিশ্রুতিবদ্ধ যেখানে বাড়িওয়ালা এবং ভাড়াটেরা আত্মবিশ্বাসের সাথে যুক্ত হতে পারে। আমরা কীভাবে আপনাকে সুরক্ষিত রাখি তা বুঝতে অনুগ্রহ করে আমাদের বিশ্বাস ও নিরাপত্তা নির্দেশিকা পড়ুন।'
          )}
        </P>
      </Section>

      <Section>
        <H2>{t('1. Verified Listings', '১. যাচাইকৃত তালিকা')}</H2>
        <P>
          {t(
            'We manually verify high-quality listings to ensure they meet our standards. Look for the "VERIFIED" badge on properties. This indicates that the host has provided additional documentation to prove their identity and ownership.',
            'সম্পত্তিগুলো আমাদের মানদণ্ড পূরণ করে কিনা তা নিশ্চিত করতে আমরা ম্যানুয়ালি যাচাই করি। সম্পত্তিতে "VERIFIED" ব্যাজটি খুঁজুন। এটি নির্দেশ করে যে হোস্ট তাদের পরিচয় এবং মালিকানা প্রমাণ করার জন্য অতিরিক্ত নথি প্রদান করেছেন।'
          )}
        </P>
      </Section>

      <Section>
        <H2>{t('2. Secure Communication', '২. নিরাপদ যোগাযোগ')}</H2>
        <ul style={{ paddingLeft: '20px' }}>
          <LI>{t('Always use our in-app messaging system to communicate. It protects your personal contact details.', 'যোগাযোগের জন্য সর্বদা আমাদের ইন-অ্যাপ মেসেজিং সিস্টেম ব্যবহার করুন। এটি আপনার ব্যক্তিগত যোগাযোগের বিবরণ সুরক্ষিত রাখে।')}</LI>
          <LI>{t('Never share sensitive information like your NID, bank details, or passwords through messages.', 'মেসেজের মাধ্যমে কখনো আপনার NID, ব্যাংক ডিটেইলস বা পাসওয়ার্ডের মতো সংবেদনশীল তথ্য শেয়ার করবেন না।')}</LI>
        </ul>
      </Section>

      <Section>
        <H2>{t('3. Safe Viewings', '৩. নিরাপদ পরিদর্শন')}</H2>
        <P>
          {t(
            'When scheduling a property visit, always meet in daylight hours and consider bringing a friend or family member with you. Let someone know where you are going.',
            'যখন কোনো সম্পত্তি পরিদর্শনের সময় নির্ধারণ করবেন, সর্বদা দিনের আলোতে দেখা করুন এবং সাথে কোনো বন্ধু বা পরিবারের সদস্যকে নিয়ে যাওয়ার কথা বিবেচনা করুন। আপনি কোথায় যাচ্ছেন তা কাউকে জানিয়ে রাখুন।'
          )}
        </P>
      </Section>

      <Section>
        <H2>{t('4. Payments & Scams', '৪. পেমেন্ট ও স্ক্যাম')}</H2>
        <P>{t('To protect yourself from financial fraud:', 'আর্থিক জালিয়াতি থেকে নিজেকে রক্ষা করতে:')}</P>
        <ul style={{ paddingLeft: '20px' }}>
          <LI>{t('Do not pay any advance rent or deposit before viewing the property and signing a written lease agreement.', 'সম্পত্তি পরিদর্শন এবং লিখিত ইজারা চুক্তিতে স্বাক্ষর করার আগে কোনো অগ্রিম ভাড়া বা জমা দেবেন না।')}</LI>
          <LI>{t('Be wary of landlords who insist on wire transfers or cryptocurrency payments.', 'যেসব বাড়িওয়ালা ওয়্যার ট্রান্সফার বা ক্রিপ্টোকারেন্সিতে পেমেন্ট করার জন্য জোর দেয় তাদের থেকে সতর্ক থাকুন।')}</LI>
          <LI>{t('If a deal seems too good to be true, it probably is.', 'যদি কোনো ডিল খুব বেশি আকর্ষণীয় মনে হয়, তবে সেটি সন্দেহজনক হতে পারে।')}</LI>
        </ul>
      </Section>

      <Section>
        <H2>{t('5. Reporting Suspicious Activity', '৫. সন্দেহজনক কার্যকলাপ রিপোর্ট করা')}</H2>
        <P>
          {t(
            'If you encounter a listing or a user that seems suspicious, please report them immediately using the "Report" button on their profile or listing, or contact our support team.',
            'আপনি যদি এমন কোনো তালিকা বা ব্যবহারকারীর সম্মুখীন হন যাকে সন্দেহজনক মনে হয়, অনুগ্রহ করে অবিলম্বে তাদের প্রোফাইল বা তালিকায় থাকা "রিপোর্ট" বোতামটি ব্যবহার করে রিপোর্ট করুন বা আমাদের সহায়তা দলের সাথে যোগাযোগ করুন।'
          )}
        </P>
      </Section>

      <Section>
        <H2>{t('6. Contact Us', '৬. যোগাযোগ করুন')}</H2>
        <P>
          {t(
            `Questions about Trust & Safety? Reach us at ${CONTACT_EMAIL}.`,
            `বিশ্বাস ও নিরাপত্তা সম্পর্কে প্রশ্ন? আমাদের সাথে যোগাযোগ করুন ${CONTACT_EMAIL}।`
          )}
        </P>
      </Section>
    </LegalPage>
  );
}
