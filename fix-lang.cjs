const fs = require('fs');
let content = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');

// Fix typos
content = content.replace(/"বাড়িত্তয়ালা ড্যাশবোর্ড"/g, '"বাড়িওয়ালা ড্যাশবোর্ড"');
content = content.replace(/"বাড়িত্তয়ালা মোডে যান"/g, '"বাড়িওয়ালা মোডে যান"');

// Simplify inquiry words
content = content.replace(/inquiryModalTitle: "ইনকোয়ারি পাঠান"/g, 'inquiryModalTitle: "মেসেজ পাঠান"');
content = content.replace(/inquiryLandlordTitle: "আপনি এখন ল্যান্ডলর্ড মোডে আছেন"/g, 'inquiryLandlordTitle: "আপনি এখন মালিক মোডে আছেন"');
content = content.replace(/inquiryLandlordDesc: "ইনকোয়ারি পাঠান মূলত ভাড়া খুঁজছেন এমন ভাড়াটিয়ারা। ল্যান্ডলর্ড মোডে থাকা অবস্থায় ইনকোয়ারি পাঠানো যাবে না। এই প্রপার্টি সম্পর্কে জানতে অনুগ্রহ করে ভাড়াটিয়া মোডে যান — অথবা ল্যান্ডলর্ড হিসেবে আপনি নিজের প্রপার্টি ভাড়ার জন্য পোস্ট করতে পারেন।"/g, 'inquiryLandlordDesc: "যারা বাসা খুঁজছেন, তারাই শুধু মেসেজ দিতে পারবেন। আপনি এখন মালিক (ল্যান্ডলর্ড) মোডে আছেন, তাই মেসেজ পাঠানো যাবে না। এই বাসা সম্পর্কে জানতে চাইলে \'ভাড়াটিয়া মোডে যান\' — অথবা মালিক হিসেবে আপনি নিজের বাসাও ভাড়ার জন্য পোস্ট করতে পারেন।"');

content = content.replace(/inquiryLandlordSwitching: "পরিবর্তন হচ্ছে..."/g, 'inquiryLandlordSwitching: "মোড পরিবর্তন হচ্ছে..."');
content = content.replace(/inquirySentTitle: "ইনকোয়ারি পাঠানো হয়েছে!"/g, 'inquirySentTitle: "মেসেজ পাঠানো হয়েছে!"');
content = content.replace(/তারা শীঘ্রই আপনাকে কল বা টেক্সট করবে/g, 'তারা শীঘ্রই আপনাকে কল বা মেসেজ করবে');
content = content.replace(/প্রপার্টি ভিজিট শিডিউল করবেন/g, 'বাসা দেখার শিডিউল করবেন');
content = content.replace(/প্রপার্টিতে ফিরে যান/g, 'বাসায় ফিরে যান');
content = content.replace(/inquiryLoginError: "Inquiry পাঠাতে আগে লগইন করুন।"/g, 'inquiryLoginError: "মেসেজ পাঠাতে আগে লগইন করুন।"');
content = content.replace(/inquiryFailError: "Inquiry পাঠাতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।"/g, 'inquiryFailError: "মেসেজ পাঠাতে সমস্যা হয়েছে। একটু পর আবার চেষ্টা করুন।"');
content = content.replace(/menuMyInquiries: "আমার যোগাযোগ"/g, 'menuMyInquiries: "আমার মেসেজ সমূহ"');
content = content.replace(/inquiriesMenu: "যোগাযোগ"/g, 'inquiriesMenu: "মেসেজ সমূহ"');
content = content.replace(/Inquiries: "যোগাযোগ সমূহ"/g, 'Inquiries: "মেসেজ সমূহ"');
content = content.replace(/inquiriesToday: "আজকের যোগাযোগ"/g, 'inquiriesToday: "আজকের মেসেজ"');
content = content.replace(/totalInquiries: "মোট যোগাযোগ"/g, 'totalInquiries: "মোট মেসেজ"');

content = content.replace(/submitInquiry: "যোগাযোগ জমা দিন"/g, 'submitInquiry: "মেসেজ পাঠান"');
content = content.replace(/sendInquiry: "যোগাযোগ পাঠান"/g, 'sendInquiry: "মেসেজ পাঠান"');
content = content.replace(/inquireTitle: "এই বাড়ি সম্পর্কে যোগাযোগ করুন"/g, 'inquireTitle: "এই বাসা সম্পর্কে জানতে মেসেজ দিন"');
content = content.replace(/inquireSubtitle: "আপনার তথ্য এজেন্টকে পাঠান।"/g, 'inquireSubtitle: "আপনার তথ্য মালিক বা এজেন্টকে পাঠান।"');

content = content.replace(/locSearchPlaceholderBuy: "শহর, এলাকা বা প্রপার্টি…"/g, 'locSearchPlaceholderBuy: "শহর, এলাকা বা বাসার নাম লিখুন…"');
content = content.replace(/locSearchPlaceholderCommercial: "এলাকা, ভবন বা ল্যান্ডমার্ক…"/g, 'locSearchPlaceholderCommercial: "এলাকা, ভবন বা ল্যান্ডমার্কের নাম লিখুন…"');
content = content.replace(/searchProperties: "বাড়ি খুঁজুন"/g, 'searchProperties: "বাসা খুঁজুন"');

// some additional standardizations
content = content.replace(/propertiesCommercial: "বাণিজ্যিক স্থান"/g, 'propertiesCommercial: "কমার্শিয়াল স্পেস"');
content = content.replace(/propertiesForSale: "বিক্রয়ের প্রপার্টি"/g, 'propertiesForSale: "বিক্রয়ের বাসা বা জমি"');
content = content.replace(/requestDetails: "রিকোয়েস্ট ডিটেইলস"/g, 'requestDetails: "বিস্তারিত জানুন"');
content = content.replace(/priceSummary: "ভাড়ার বিবরণ"/g, 'priceSummary: "ভাড়ার হিসাব"');
content = content.replace(/baseRent: "মূল ভাড়া"/g, 'baseRent: "আসল ভাড়া"');
content = content.replace(/promoDiscount: "প্রোমোশনাল ছাড়"/g, 'promoDiscount: "বিশেষ ছাড়"');

fs.writeFileSync('src/context/LanguageContext.jsx', content);
console.log("Replacements done");
