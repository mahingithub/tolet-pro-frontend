import React from "react";
import LegalPage from "./LegalPage";
import {
	ShieldAlert,
	Building,
	UserCheck,
	FileText,
	AlertTriangle,
	Handshake,
	BadgeCheck,
	Ban,
	Settings,
	Mail,
	Edit3
} from "lucide-react";

const CONTACT_EMAIL = "support@toletpro.rent";

const TERMS_SECTIONS = [
	{
		id: "introduction",
		icon: <FileText className="w-5 h-5" />,
		titleEn: "1. Introduction",
		titleBn: "১. পরিচিতি",
		contentEn: `Welcome to TO-LET PRO. By creating an account or using our service, you agree to these Terms. Please read them carefully.`,
		contentBn: `TO-LET PRO-তে স্বাগতম। অ্যাকাউন্ট তৈরি করে বা আমাদের সেবা ব্যবহার করে আপনি এই শর্তাবলীতে সম্মত হচ্ছেন। অনুগ্রহ করে মনোযোগ দিয়ে পড়ুন।`
	},
	{
		id: "what-we-are",
		icon: <Building className="w-5 h-5" />,
		titleEn: "2. What TO-LET PRO Is",
		titleBn: "২. TO-LET PRO কী",
		contentEn: `TO-LET PRO is a platform that connects tenants and landlords. We provide the tools to list, discover, and communicate about rental properties. We are not a party to any rental agreement and do not own, manage, or inspect the listed properties.`,
		contentBn: `TO-LET PRO একটি প্ল্যাটফর্ম যা ভাড়াটে ও বাড়িওয়ালাদের সংযুক্ত করে। আমরা ভাড়ার সম্পত্তি তালিকাভুক্ত করা, খুঁজে পাওয়া ও যোগাযোগের সরঞ্জাম প্রদান করি। আমরা কোনো ভাড়া চুক্তির পক্ষ নই এবং তালিকাভুক্ত সম্পত্তির মালিক, পরিচালক বা পরিদর্শক নই।`
	},
	{
		id: "eligibility",
		icon: <UserCheck className="w-5 h-5" />,
		titleEn: "3. Eligibility and Accounts",
		titleBn: "৩. যোগ্যতা ও অ্যাকাউন্ট",
		contentEn: `- You must be at least 18 years old to use TO-LET PRO.
- You are responsible for keeping your account and password secure.
- You must provide accurate information and keep it up to date.`,
		contentBn: `- TO-LET PRO ব্যবহার করতে আপনার বয়স কমপক্ষে ১৮ বছর হতে হবে।
- আপনার অ্যাকাউন্ট ও পাসওয়ার্ড সুরক্ষিত রাখার দায়িত্ব আপনার।
- আপনাকে সঠিক তথ্য দিতে হবে এবং তা হালনাগাদ রাখতে হবে।`
	},
	{
		id: "listings-content",
		icon: <Edit3 className="w-5 h-5" />,
		titleEn: "4. Listings and Content",
		titleBn: "৪. তালিকা ও কনটেন্ট",
		contentEn: `If you post a listing, you confirm that you have the right to rent the property and that your information is truthful. You are responsible for the content you upload. We may remove listings or content that violate these Terms or applicable law.`,
		contentBn: `আপনি যদি কোনো তালিকা পোস্ট করেন, আপনি নিশ্চিত করছেন যে সম্পত্তি ভাড়া দেওয়ার অধিকার আপনার আছে এবং আপনার তথ্য সত্য। আপনি যে কনটেন্ট আপলোড করেন তার দায়িত্ব আপনার। আমরা এই শর্তাবলী বা প্রযোজ্য আইন লঙ্ঘনকারী তালিকা বা কনটেন্ট সরিয়ে দিতে পারি।`
	},
	{
		id: "acceptable-use",
		icon: <Ban className="w-5 h-5" />,
		titleEn: "5. Acceptable Use",
		titleBn: "৫. গ্রহণযোগ্য ব্যবহার",
		contentEn: `You agree not to:
- Post false, misleading, fraudulent, or illegal listings.
- Harass, threaten, or abuse other users.
- Attempt to bypass security, scrape data, or disrupt the service.
- Use the platform for any unlawful purpose.`,
		contentBn: `আপনি সম্মত হচ্ছেন যে আপনি:
- মিথ্যা, বিভ্রান্তিকর, প্রতারণামূলক বা অবৈধ তালিকা পোস্ট করবেন না।
- অন্য ব্যবহারকারীদের হয়রানি, হুমকি বা নির্যাতন করবেন না।
- নিরাপত্তা এড়ানো, ডেটা স্ক্র্যাপ করা বা সেবা ব্যাহত করার চেষ্টা করবেন না।
- কোনো বেআইনি উদ্দেশ্যে প্ল্যাটফর্ম ব্যবহার করবেন না।`
	},
	{
		id: "rental-transactions",
		icon: <Handshake className="w-5 h-5" />,
		titleEn: "6. Rental Transactions",
		titleBn: "৬. ভাড়া লেনদেন",
		contentEn: `Any agreement, payment, or dispute regarding a rental is solely between the tenant and the landlord. We strongly encourage you to verify details, visit properties in person, and use written agreements. TO-LET PRO is not responsible for the conduct of any user or the condition of any property.`,
		contentBn: `ভাড়া সংক্রান্ত যেকোনো চুক্তি, অর্থপ্রদান বা বিরোধ সম্পূর্ণভাবে ভাড়াটে ও বাড়িওয়ালার মধ্যে। আমরা দৃঢ়ভাবে পরামর্শ দিই যে আপনি বিস্তারিত যাচাই করুন, সরাসরি সম্পত্তি পরিদর্শন করুন এবং লিখিত চুক্তি ব্যবহার করুন। কোনো ব্যবহারকারীর আচরণ বা কোনো সম্পত্তির অবস্থার জন্য TO-LET PRO দায়ী নয়।`
	},
	{
		id: "verification",
		icon: <BadgeCheck className="w-5 h-5" />,
		titleEn: "7. Verification",
		titleBn: "৭. যাচাইকরণ",
		contentEn: `We may offer verification badges based on documents users submit. Verification is a trust signal, not a guarantee. Always exercise your own judgment when dealing with other users.`,
		contentBn: `ব্যবহারকারীদের জমা দেওয়া নথির ভিত্তিতে আমরা যাচাইকরণ ব্যাজ দিতে পারি। যাচাইকরণ একটি আস্থার সংকেত, নিশ্চয়তা নয়। অন্য ব্যবহারকারীদের সাথে লেনদেনের সময় সর্বদা নিজের বিচারবুদ্ধি ব্যবহার করুন।`
	},
	{
		id: "disclaimer",
		icon: <AlertTriangle className="w-5 h-5" />,
		titleEn: "8. Disclaimer & Limitation of Liability",
		titleBn: "৮. দায় অস্বীকার ও সীমাবদ্ধতা",
		contentEn: `The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, TO-LET PRO is not liable for any indirect, incidental, or consequential damages arising from your use of the platform or any rental arrangement.`,
		contentBn: `সেবাটি কোনো ধরনের ওয়ারেন্টি ছাড়াই "যেমন আছে" ভিত্তিতে প্রদান করা হয়। আইন দ্বারা অনুমোদিত সর্বোচ্চ সীমা পর্যন্ত, প্ল্যাটফর্ম ব্যবহার বা কোনো ভাড়া ব্যবস্থা থেকে উদ্ভূত কোনো পরোক্ষ, আনুষঙ্গিক বা পারিণামিক ক্ষতির জন্য TO-LET PRO দায়ী নয়।`
	},
	{
		id: "suspension",
		icon: <ShieldAlert className="w-5 h-5" />,
		titleEn: "9. Suspension and Termination",
		titleBn: "৯. স্থগিতকরণ ও সমাপ্তি",
		contentEn: `We may suspend or terminate accounts that violate these Terms or that we reasonably believe pose a risk to other users or the platform.`,
		contentBn: `যেসব অ্যাকাউন্ট এই শর্তাবলী লঙ্ঘন করে বা যা অন্য ব্যবহারকারী বা প্ল্যাটফর্মের জন্য ঝুঁকিপূর্ণ বলে আমরা যুক্তিসঙ্গতভাবে বিশ্বাস করি, সেগুলো আমরা স্থগিত বা বন্ধ করতে পারি।`
	},
	{
		id: "changes",
		icon: <Settings className="w-5 h-5" />,
		titleEn: "10. Changes to These Terms",
		titleBn: "১০. শর্তাবলীর পরিবর্তন",
		contentEn: `We may update these Terms from time to time. Continued use after changes means you accept the updated Terms.`,
		contentBn: `আমরা সময়ে সময়ে এই শর্তাবলী হালনাগাদ করতে পারি। পরিবর্তনের পর ব্যবহার চালিয়ে যাওয়ার অর্থ আপনি হালনাগাদ শর্তাবলী গ্রহণ করছেন।`
	},
	{
		id: "contact",
		icon: <Mail className="w-5 h-5" />,
		titleEn: "11. Contact Us",
		titleBn: "১১. যোগাযোগ করুন",
		contentEn: `Questions about these Terms? Reach us at ${CONTACT_EMAIL}.`,
		contentBn: `এই শর্তাবলী সম্পর্কে প্রশ্ন? আমাদের সাথে যোগাযোগ করুন ${CONTACT_EMAIL}।`
	}
];

export default function TermsOfService() {
	return (
		<LegalPage 
			titleEn="Terms of Service"
			titleBn="ব্যবহারের শর্তাবলী"
			lastUpdated="August 2026"
			sections={TERMS_SECTIONS}
			headerIcon={ShieldAlert}
		/>
	);
}
