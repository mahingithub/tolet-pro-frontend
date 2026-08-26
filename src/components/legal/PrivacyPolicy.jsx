import React, { useState, useEffect } from "react";
import useGoBack from "../../hooks/useGoBack";
import {
	ShieldCheck,
	Lock,
	Eye,
	Share2,
	Database,
	UserCircle,
	Cookie,
	Mail,
	ArrowLeft,
	Globe,
	ChevronRight,
	Activity
} from "lucide-react";

const CONTACT_EMAIL = "support@toletpro.rent";

const POLICY_SECTIONS = [
	{
		id: "introduction",
		icon: <ShieldCheck className="w-5 h-5" />,
		titleEn: "1. Introduction",
		titleBn: "১. পরিচিতি",
		contentEn: `Welcome to TO-LET PRO. We are committed to protecting your personal data and respecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website. Please read this policy carefully to understand our views and practices regarding your personal data.`,
		contentBn: `TO-LET PRO-তে আপনাকে স্বাগতম। আমরা আপনার ব্যক্তিগত তথ্য সুরক্ষা এবং গোপনীয়তার প্রতি শ্রদ্ধাশীল। আপনি যখন আমাদের মোবাইল অ্যাপ্লিকেশন এবং ওয়েবসাইট ব্যবহার করেন তখন আমরা কীভাবে আপনার তথ্য সংগ্রহ, ব্যবহার, প্রকাশ এবং সুরক্ষিত করি তা এই গোপনীয়তা নীতি ব্যাখ্যা করে।`
	},
	{
		id: "information-collection",
		icon: <Database className="w-5 h-5" />,
		titleEn: "2. Information We Collect",
		titleBn: "২. আমরা যে তথ্য সংগ্রহ করি",
		contentEn: `We collect several different types of information for various purposes to provide and improve our Service to you:
- **Personal Data**: While using our Service, we may ask you to provide us with certain personally identifiable information, including but not limited to your Name, Email address, Phone number, and National ID for verification.
- **Usage Data**: We automatically collect information on how the Service is accessed and used, such as your device's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, and the time spent on those pages.
- **Location Data**: We may use and store information about your location if you give us permission to do so, in order to provide features of our Service, like finding nearby rental properties.`,
		contentBn: `আপনাকে আমাদের সেবা প্রদান এবং উন্নত করার জন্য আমরা বিভিন্ন উদ্দেশ্যে বিভিন্ন ধরনের তথ্য সংগ্রহ করি:
- **ব্যক্তিগত তথ্য**: নাম, ইমেইল ঠিকানা, ফোন নম্বর, এবং যাচাইকরণের জন্য জাতীয় পরিচয়পত্র।
- **ব্যবহারের ডেটা**: আপনার ডিভাইসের আইপি ঠিকানা, ব্রাউজারের ধরন, আপনি আমাদের সেবার কোন পেজগুলো পরিদর্শন করেছেন, সময় এবং তারিখ।
- **অবস্থান ডেটা**: আশেপাশের ভাড়ার সম্পত্তি খোঁজার জন্য আপনার অনুমতি সাপেক্ষে আমরা আপনার অবস্থানের তথ্য ব্যবহার করতে পারি।`
	},
	{
		id: "use-of-data",
		icon: <Activity className="w-5 h-5" />,
		titleEn: "3. Use of Data",
		titleBn: "৩. তথ্যের ব্যবহার",
		contentEn: `TO-LET PRO uses the collected data for various purposes:
- To provide and maintain our Service.
- To notify you about changes to our Service.
- To allow you to participate in interactive features of our Service when you choose to do so (e.g., chat, calling).
- To provide customer support.
- To gather analysis or valuable information so that we can improve our Service.
- To monitor the usage of our Service and detect, prevent and address technical issues.`,
		contentBn: `TO-LET PRO সংগৃহীত ডেটা বিভিন্ন উদ্দেশ্যে ব্যবহার করে:
- আমাদের সেবা প্রদান এবং বজায় রাখতে।
- আমাদের সেবার পরিবর্তন সম্পর্কে আপনাকে জানাতে।
- চ্যাট বা কলিং এর মত ইন্টারেক্টিভ ফিচার প্রদান করতে।
- গ্রাহক সহায়তা প্রদান করতে।
- প্রযুক্তিগত সমস্যা সনাক্ত ও সমাধান করতে।`
	},
	{
		id: "sharing-disclosure",
		icon: <Share2 className="w-5 h-5" />,
		titleEn: "4. Sharing and Disclosure",
		titleBn: "৪. শেয়ারিং এবং প্রকাশ",
		contentEn: `We may share your personal information in the following situations:
- **With Service Providers**: We may share your personal information with Service Providers (like Firebase, MongoDB) to monitor and analyze the use of our Service, or to contact you.
- **For Business Transfers**: If TO-LET PRO is involved in a merger, acquisition or asset sale, your Personal Data may be transferred.
- **With Law Enforcement**: Under certain circumstances, we may be required to disclose your Personal Data if required to do so by law or in response to valid requests by public authorities.
- **With Other Users**: Your listings, public profile name, and reviews will be visible to other users of the platform to facilitate the rental process.`,
		contentBn: `আমরা নিচের পরিস্থিতিতে আপনার ব্যক্তিগত তথ্য শেয়ার করতে পারি:
- **সেবা প্রদানকারীদের সাথে**: আমাদের প্ল্যাটফর্ম পরিচালনার জন্য (যেমন Firebase, MongoDB)।
- **আইন প্রয়োগকারী সংস্থার সাথে**: আইনি প্রয়োজনে বা সরকারি কর্তৃপক্ষের বৈধ অনুরোধে।
- **অন্যান্য ব্যবহারকারীদের সাথে**: আপনার ভাড়ার তালিকা এবং পাবলিক প্রোফাইল অন্যান্য ব্যবহারকারীদের কাছে দৃশ্যমান হবে।`
	},
	{
		id: "data-security",
		icon: <Lock className="w-5 h-5" />,
		titleEn: "5. Data Security",
		titleBn: "৫. তথ্যের নিরাপত্তা",
		contentEn: `The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. We strive to use commercially acceptable means to protect your Personal Data, implementing advanced encryption, secure socket layers (SSL), and strict access controls. However, we cannot guarantee its absolute security.`,
		contentBn: `আপনার তথ্যের নিরাপত্তা আমাদের কাছে অত্যন্ত গুরুত্বপূর্ণ, তবে ইন্টারনেটে ট্রান্সমিশন বা ইলেকট্রনিক স্টোরেজের কোনো পদ্ধতিই ১০০% নিরাপদ নয়। আমরা আপনার তথ্য সুরক্ষিত রাখতে উন্নত এনক্রিপশন এবং কঠোর অ্যাক্সেস কন্ট্রোল ব্যবহার করি।`
	},
	{
		id: "your-rights",
		icon: <UserCircle className="w-5 h-5" />,
		titleEn: "6. Your Privacy Rights",
		titleBn: "৬. আপনার গোপনীয়তা অধিকার",
		contentEn: `Depending on your location, you may have the following rights regarding your personal data:
- **The right to access, update or to delete** the information we have on you.
- **The right of rectification**: You have the right to have your information rectified if that information is inaccurate or incomplete.
- **The right to object**: You have the right to object to our processing of your Personal Data.
- **The right to data portability**: You have the right to be provided with a copy of the information we have on you in a structured, machine-readable and commonly used format.
You can manage these settings directly in the TO-LET PRO Privacy Center within the app.`,
		contentBn: `আপনার ব্যক্তিগত তথ্যের ব্যাপারে আপনার নিম্নলিখিত অধিকার রয়েছে:
- আমাদের কাছে থাকা আপনার তথ্য দেখার, আপডেট করার বা মুছে ফেলার অধিকার।
- ভুল তথ্য সংশোধন করার অধিকার।
- আপনি অ্যাপের ভেতরের "প্রাইভেসি সেন্টার" থেকে এই অধিকারগুলো নিয়ন্ত্রণ করতে পারবেন।`
	},
	{
		id: "cookies",
		icon: <Cookie className="w-5 h-5" />,
		titleEn: "7. Cookies and Tracking",
		titleBn: "৭. কুকিজ এবং ট্র্যাকিং",
		contentEn: `We use cookies and similar tracking technologies to track the activity on our Service and hold certain information. Cookies are files with small amount of data which may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.`,
		contentBn: `আমরা আমাদের সেবার কার্যকলাপ ট্র্যাক করতে এবং কিছু নির্দিষ্ট তথ্য ধরে রাখতে কুকিজ এবং অনুরূপ ট্র্যাকিং প্রযুক্তি ব্যবহার করি। আপনি চাইলে ব্রাউজার থেকে কুকিজ বন্ধ করতে পারেন, তবে এতে কিছু ফিচার কাজ নাও করতে পারে।`
	},
	{
		id: "changes",
		icon: <Eye className="w-5 h-5" />,
		titleEn: "8. Changes to This Policy",
		titleBn: "৮. এই নীতির পরিবর্তন",
		contentEn: `We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.`,
		contentBn: `আমরা সময়ে সময়ে আমাদের গোপনীয়তা নীতি আপডেট করতে পারি। আমরা এই পেজে নতুন নীতি পোস্ট করে এবং "সর্বশেষ আপডেট" তারিখ পরিবর্তন করে আপনাকে জানাব।`
	},
	{
		id: "contact",
		icon: <Mail className="w-5 h-5" />,
		titleEn: "9. Contact Us",
		titleBn: "৯. যোগাযোগ করুন",
		contentEn: `If you have any questions about this Privacy Policy, please contact us by email at ${CONTACT_EMAIL}.`,
		contentBn: `এই গোপনীয়তা নীতি সম্পর্কে আপনার কোনো প্রশ্ন থাকলে, অনুগ্রহ করে ইমেইলের মাধ্যমে আমাদের সাথে যোগাযোগ করুন: ${CONTACT_EMAIL}`
	}
];

export default function PrivacyPolicy() {
	const goBack = useGoBack("/");
	const [lang, setLang] = useState("en");
	const isBn = lang === "bn";
	const [activeSection, setActiveSection] = useState(POLICY_SECTIONS[0].id);

	// Setup intersection observer for scrolling spy
	useEffect(() => {
		const handleScroll = () => {
			const scrollPosition = window.scrollY + 100;
			
			for (const section of POLICY_SECTIONS) {
				const element = document.getElementById(section.id);
				if (element) {
					const { offsetTop, offsetHeight } = element;
					if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
						setActiveSection(section.id);
						break;
					}
				}
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const scrollToSection = (id) => {
		const element = document.getElementById(id);
		if (element) {
			const y = element.getBoundingClientRect().top + window.scrollY - 80;
			window.scrollTo({ top: y, behavior: 'smooth' });
		}
	};

	const formatText = (text) => {
		return text.split("\n").map((line, idx) => {
			if (line.startsWith("- **")) {
				const parts = line.split("**");
				return (
					<li key={idx} className="mb-3 text-slate-600 dark:text-slate-300 leading-relaxed flex items-start">
						<span className="mr-3 text-rose-600 mt-1.5 opacity-80 flex-shrink-0">
							<ChevronRight className="w-4 h-4" />
						</span>
						<span>
							<strong className="text-slate-800 dark:text-slate-100 font-semibold">{parts[1]}</strong>
							{parts[2]}
						</span>
					</li>
				);
			} else if (line.startsWith("- ")) {
				return (
					<li key={idx} className="mb-3 text-slate-600 dark:text-slate-300 leading-relaxed flex items-start">
						<span className="mr-3 text-rose-600 mt-1.5 opacity-80 flex-shrink-0">
							<ChevronRight className="w-4 h-4" />
						</span>
						<span>{line.substring(2)}</span>
					</li>
				);
			}
			return <p key={idx} className="mb-5 text-slate-600 dark:text-slate-300 leading-relaxed text-[15px] sm:text-base">{line}</p>;
		});
	};

	return (
		<div className="min-h-screen bg-slate-50 dark:bg-slate-900 selection:bg-rose-500/30 font-inter">
			{/* Decorative Background Gradients (Glassmorphism base) */}
			<div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
				<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-500/10 dark:bg-rose-500/20 rounded-full blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[120px]" />
			</div>

			{/* Sticky Glass Navbar */}
			<nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center gap-4">
							<button
								onClick={goBack}
								className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-700 dark:text-slate-200 transition-all border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
								aria-label="Go back"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							<div className="flex items-center gap-2">
								<div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
									<ShieldCheck className="w-4 h-4 text-white" strokeWidth={2.5} />
								</div>
								<h1 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block tracking-tight">
									Privacy Policy
								</h1>
							</div>
						</div>
						
						{/* Language Toggle */}
						<div className="flex items-center p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl backdrop-blur-md border border-slate-300/30 dark:border-slate-700/30">
							<button
								onClick={() => setLang("en")}
								className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
									!isBn ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
								}`}
							>
								EN
							</button>
							<button
								onClick={() => setLang("bn")}
								className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
									isBn ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
								}`}
							>
								বাং
							</button>
						</div>
					</div>
				</div>
			</nav>

			{/* Main Content Area */}
			<main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
				<div className="flex flex-col lg:flex-row gap-10">
					
					{/* Sidebar Navigation (Table of Contents) */}
					<aside className="hidden lg:block w-72 flex-shrink-0">
						<div className="sticky top-28 bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl rounded-3xl p-6 border border-white/50 dark:border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
							<h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
								<Globe className="w-4 h-4" />
								{isBn ? "সূচিপত্র" : "On this page"}
							</h3>
							<nav className="flex flex-col gap-1.5">
								{POLICY_SECTIONS.map((section) => (
									<button
										key={section.id}
										onClick={() => scrollToSection(section.id)}
										className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
											activeSection === section.id
												? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
												: "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200"
										}`}
									>
										<div className={`p-1.5 rounded-lg ${activeSection === section.id ? 'bg-rose-500/20' : 'bg-transparent'}`}>
											{React.cloneElement(section.icon, { 
												className: \`w-4 h-4 \${activeSection === section.id ? 'text-rose-600 dark:text-rose-400' : 'opacity-70'}\`
											})}
										</div>
										<span className="truncate">{isBn ? section.titleBn : section.titleEn}</span>
									</button>
								))}
							</nav>
						</div>
					</aside>

					{/* Content Panels */}
					<div className="flex-1 max-w-4xl">
						<header className="mb-12">
							<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-100/50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-bold tracking-widest uppercase mb-4 border border-rose-200/50 dark:border-rose-800/30">
								<ShieldCheck className="w-3.5 h-3.5" />
								{isBn ? "নিরাপত্তা ও গোপনীয়তা" : "Trust & Safety"}
							</div>
							<h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
								{isBn ? "গোপনীয়তা নীতি" : "Privacy Policy"}
							</h1>
							<p className="text-slate-500 dark:text-slate-400 font-medium">
								{isBn ? "সর্বশেষ আপডেট: আগস্ট ২০২৬" : "Last updated: August 2026"}
							</p>
						</header>

						<div className="space-y-8 lg:space-y-12">
							{POLICY_SECTIONS.map((section) => (
								<section 
									key={section.id} 
									id={section.id} 
									className="scroll-mt-28 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 md:p-10 border border-white/50 dark:border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]"
								>
									<div className="flex items-center gap-4 mb-6">
										<div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50">
											{section.icon}
										</div>
										<h2 className="text-2xl font-bold text-slate-800 dark:text-white">
											{isBn ? section.titleBn : section.titleEn}
										</h2>
									</div>
									<div className="prose prose-slate dark:prose-invert max-w-none">
										<div className="text-slate-600 dark:text-slate-300 leading-relaxed">
											{formatText(isBn ? section.contentBn : section.contentEn)}
										</div>
									</div>
								</section>
							))}
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
