import React from "react";
import LegalPage from "./LegalPage";
import {
	ShieldAlert,
	BadgeCheck,
	MessageSquare,
	Eye,
	AlertOctagon,
	Flag,
	Mail,
	HeartHandshake
} from "lucide-react";

const CONTACT_EMAIL = "support@toletpro.rent";

const TRUST_SECTIONS = [
	{
		id: "introduction",
		icon: <HeartHandshake className="w-5 h-5" />,
		titleEn: "Introduction",
		titleBn: "পরিচিতি",
		contentEn: `At TO-LET PRO, your safety is our top priority. We are committed to building a trusted community where landlords and tenants can connect with confidence. Please read our Trust & Safety guidelines to understand how we protect you.`,
		contentBn: `TO-LET PRO-তে আপনার নিরাপত্তা আমাদের সর্বোচ্চ অগ্রাধিকার। আমরা এমন একটি বিশ্বস্ত সম্প্রদায় গড়ে তুলতে প্রতিশ্রুতিবদ্ধ যেখানে বাড়িওয়ালা এবং ভাড়াটেরা আত্মবিশ্বাসের সাথে যুক্ত হতে পারে। আমরা কীভাবে আপনাকে সুরক্ষিত রাখি তা বুঝতে অনুগ্রহ করে আমাদের বিশ্বাস ও নিরাপত্তা নির্দেশিকা পড়ুন।`
	},
	{
		id: "verified-listings",
		icon: <BadgeCheck className="w-5 h-5" />,
		titleEn: "1. Verified Listings",
		titleBn: "১. যাচাইকৃত তালিকা",
		contentEn: `We manually verify high-quality listings to ensure they meet our standards. Look for the "VERIFIED" badge on properties. This indicates that the host has provided additional documentation to prove their identity and ownership.`,
		contentBn: `সম্পত্তিগুলো আমাদের মানদণ্ড পূরণ করে কিনা তা নিশ্চিত করতে আমরা ম্যানুয়ালি যাচাই করি। সম্পত্তিতে "VERIFIED" ব্যাজটি খুঁজুন। এটি নির্দেশ করে যে হোস্ট তাদের পরিচয় এবং মালিকানা প্রমাণ করার জন্য অতিরিক্ত নথি প্রদান করেছেন।`
	},
	{
		id: "secure-communication",
		icon: <MessageSquare className="w-5 h-5" />,
		titleEn: "2. Secure Communication",
		titleBn: "২. নিরাপদ যোগাযোগ",
		contentEn: `- Always use our in-app messaging system to communicate. It protects your personal contact details.
- Never share sensitive information like your NID, bank details, or passwords through messages.`,
		contentBn: `- যোগাযোগের জন্য সর্বদা আমাদের ইন-অ্যাপ মেসেজিং সিস্টেম ব্যবহার করুন। এটি আপনার ব্যক্তিগত যোগাযোগের বিবরণ সুরক্ষিত রাখে।
- মেসেজের মাধ্যমে কখনো আপনার NID, ব্যাংক ডিটেইলস বা পাসওয়ার্ডের মতো সংবেদনশীল তথ্য শেয়ার করবেন না।`
	},
	{
		id: "safe-viewings",
		icon: <Eye className="w-5 h-5" />,
		titleEn: "3. Safe Viewings",
		titleBn: "৩. নিরাপদ পরিদর্শন",
		contentEn: `When scheduling a property visit, always meet in daylight hours and consider bringing a friend or family member with you. Let someone know where you are going.`,
		contentBn: `যখন কোনো সম্পত্তি পরিদর্শনের সময় নির্ধারণ করবেন, সর্বদা দিনের আলোতে দেখা করুন এবং সাথে কোনো বন্ধু বা পরিবারের সদস্যকে নিয়ে যাওয়ার কথা বিবেচনা করুন। আপনি কোথায় যাচ্ছেন তা কাউকে জানিয়ে রাখুন।`
	},
	{
		id: "payments-scams",
		icon: <AlertOctagon className="w-5 h-5" />,
		titleEn: "4. Payments & Scams",
		titleBn: "৪. পেমেন্ট ও স্ক্যাম",
		contentEn: `To protect yourself from financial fraud:
- Do not pay any advance rent or deposit before viewing the property and signing a written lease agreement.
- Be wary of landlords who insist on wire transfers or cryptocurrency payments.
- If a deal seems too good to be true, it probably is.`,
		contentBn: `আর্থিক জালিয়াতি থেকে নিজেকে রক্ষা করতে:
- সম্পত্তি পরিদর্শন এবং লিখিত ইজারা চুক্তিতে স্বাক্ষর করার আগে কোনো অগ্রিম ভাড়া বা জমা দেবেন না।
- যেসব বাড়িওয়ালা ওয়্যার ট্রান্সফার বা ক্রিপ্টোকারেন্সিতে পেমেন্ট করার জন্য জোর দেয় তাদের থেকে সতর্ক থাকুন।
- যদি কোনো ডিল খুব বেশি আকর্ষণীয় মনে হয়, তবে সেটি সন্দেহজনক হতে পারে।`
	},
	{
		id: "reporting",
		icon: <Flag className="w-5 h-5" />,
		titleEn: "5. Reporting Suspicious Activity",
		titleBn: "৫. সন্দেহজনক কার্যকলাপ রিপোর্ট করা",
		contentEn: `If you encounter a listing or a user that seems suspicious, please report them immediately using the "Report" button on their profile or listing, or contact our support team.`,
		contentBn: `আপনি যদি এমন কোনো তালিকা বা ব্যবহারকারীর সম্মুখীন হন যাকে সন্দেহজনক মনে হয়, অনুগ্রহ করে অবিলম্বে তাদের প্রোফাইল বা তালিকায় থাকা "রিপোর্ট" বোতামটি ব্যবহার করে রিপোর্ট করুন বা আমাদের সহায়তা দলের সাথে যোগাযোগ করুন।`
	},
	{
		id: "contact",
		icon: <Mail className="w-5 h-5" />,
		titleEn: "6. Contact Us",
		titleBn: "৬. যোগাযোগ করুন",
		contentEn: `Questions about Trust & Safety? Reach us at ${CONTACT_EMAIL}.`,
		contentBn: `বিশ্বাস ও নিরাপত্তা সম্পর্কে প্রশ্ন? আমাদের সাথে যোগাযোগ করুন ${CONTACT_EMAIL}।`
	}
];

export default function TrustSafety() {
	return (
		<LegalPage 
			titleEn="Trust & Safety"
			titleBn="বিশ্বাস ও নিরাপত্তা"
			lastUpdated="August 2026"
			sections={TRUST_SECTIONS}
			headerIcon={ShieldAlert}
		/>
	);
}
