import React from "react";
import LegalPage from "./LegalPage";
import {
	CreditCard,
	Info,
	Clock,
	HelpCircle,
	Edit3,
	Mail
} from "lucide-react";

const CONTACT_EMAIL = "support@toletpro.rent";

const REFUND_SECTIONS = [
	{
		id: "introduction",
		icon: <Info className="w-5 h-5" />,
		titleEn: "Introduction",
		titleBn: "পরিচিতি",
		contentEn: `This Refund Policy explains how refunds work for any paid features on TO-LET PRO.`,
		contentBn: `এই রিফান্ড নীতিতে TO-LET PRO-এর যেকোনো পেইড ফিচারের জন্য রিফান্ড কীভাবে কাজ করে তা ব্যাখ্যা করা হয়েছে।`
	},
	{
		id: "current-status",
		icon: <CreditCard className="w-5 h-5" />,
		titleEn: "1. Current Status",
		titleBn: "১. বর্তমান অবস্থা",
		contentEn: `TO-LET PRO is currently free to use. There are no paid subscriptions or fees at this time, so no payments are collected and no refunds apply. This policy is provided in advance so our terms are clear if paid features are introduced later.`,
		contentBn: `TO-LET PRO বর্তমানে বিনামূল্যে ব্যবহারযোগ্য। এই মুহূর্তে কোনো পেইড সাবস্ক্রিপশন বা ফি নেই, তাই কোনো অর্থ সংগ্রহ করা হয় না এবং কোনো রিফান্ড প্রযোজ্য নয়। ভবিষ্যতে পেইড ফিচার চালু হলে আমাদের শর্ত যেন স্পষ্ট থাকে, সেজন্য এই নীতি আগেই দেওয়া হলো।`
	},
	{
		id: "future-features",
		icon: <Clock className="w-5 h-5" />,
		titleEn: "2. Future Paid Features",
		titleBn: "২. ভবিষ্যতের পেইড ফিচার",
		contentEn: `If we introduce paid features (for example, premium landlord subscriptions or promoted listings), the following principles will apply unless stated otherwise at the point of purchase:
- Subscription fees are generally non-refundable once a billing period has started.
- You can cancel an active subscription to stop future renewals; access continues until the end of the paid period.
- Refunds may be considered for duplicate charges or proven technical errors.`,
		contentBn: `আমরা যদি পেইড ফিচার চালু করি (যেমন প্রিমিয়াম বাড়িওয়ালা সাবস্ক্রিপশন বা প্রচারিত তালিকা), তাহলে ক্রয়ের সময় অন্যভাবে উল্লেখ না থাকলে নিম্নলিখিত নীতিগুলো প্রযোজ্য হবে:
- একটি বিলিং সময়কাল শুরু হয়ে গেলে সাবস্ক্রিপশন ফি সাধারণত ফেরতযোগ্য নয়।
- ভবিষ্যতের নবায়ন বন্ধ করতে আপনি একটি সক্রিয় সাবস্ক্রিপশন বাতিল করতে পারেন; পেইড সময়কালের শেষ পর্যন্ত অ্যাক্সেস চালু থাকে।
- ডুপ্লিকেট চার্জ বা প্রমাণিত কারিগরি ত্রুটির জন্য রিফান্ড বিবেচনা করা হতে পারে।`
	},
	{
		id: "how-to-request",
		icon: <HelpCircle className="w-5 h-5" />,
		titleEn: "3. How to Request a Refund",
		titleBn: "৩. কীভাবে রিফান্ডের অনুরোধ করবেন",
		contentEn: `When paid features are available, you will be able to request a refund by contacting us at ${CONTACT_EMAIL} with your account details and the reason for the request. We aim to respond within a reasonable time.`,
		contentBn: `পেইড ফিচার উপলব্ধ হলে, আপনি আপনার অ্যাকাউন্টের তথ্য ও অনুরোধের কারণসহ ${CONTACT_EMAIL}-এ যোগাযোগ করে রিফান্ডের অনুরোধ করতে পারবেন। আমরা যুক্তিসঙ্গত সময়ের মধ্যে সাড়া দেওয়ার চেষ্টা করি।`
	},
	{
		id: "changes",
		icon: <Edit3 className="w-5 h-5" />,
		titleEn: "4. Changes to This Policy",
		titleBn: "৪. এই নীতির পরিবর্তন",
		contentEn: `We will update this policy before launching any paid features, and the "last updated" date above will reflect the change.`,
		contentBn: `কোনো পেইড ফিচার চালু করার আগে আমরা এই নীতি হালনাগাদ করব, এবং উপরের "সর্বশেষ হালনাগাদ" তারিখ সেই পরিবর্তন প্রতিফলিত করবে।`
	},
	{
		id: "contact",
		icon: <Mail className="w-5 h-5" />,
		titleEn: "5. Contact Us",
		titleBn: "৫. যোগাযোগ করুন",
		contentEn: `Questions about refunds? Reach us at ${CONTACT_EMAIL}.`,
		contentBn: `রিফান্ড সম্পর্কে প্রশ্ন? আমাদের সাথে যোগাযোগ করুন ${CONTACT_EMAIL}।`
	}
];

export default function RefundPolicy() {
	return (
		<LegalPage 
			titleEn="Refund Policy"
			titleBn="রিফান্ড নীতি"
			lastUpdated="August 2026"
			sections={REFUND_SECTIONS}
			headerIcon={CreditCard}
		/>
	);
}
