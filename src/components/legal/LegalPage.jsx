import React, { useState, useEffect } from "react";
import useGoBack from "../../hooks/useGoBack";
import { ArrowLeft, Globe, ChevronRight } from "lucide-react";

export default function LegalPage({ 
	titleEn, 
	titleBn, 
	lastUpdated, 
	sections, 
	headerIcon: HeaderIcon 
}) {
	const goBack = useGoBack("/");
	const [lang, setLang] = useState("en");
	const isBn = lang === "bn";
	
	// Default to first section if available
	const [activeSection, setActiveSection] = useState(sections?.[0]?.id || "");

	// Setup intersection observer for scrolling spy
	useEffect(() => {
		const handleScroll = () => {
			const scrollPosition = window.scrollY + 100;
			
			for (const section of sections) {
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
	}, [sections]);

	const scrollToSection = (id) => {
		const element = document.getElementById(id);
		if (element) {
			const y = element.getBoundingClientRect().top + window.scrollY - 80;
			window.scrollTo({ top: y, behavior: 'smooth' });
		}
	};

	const formatText = (text) => {
		if (!text) return null;
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
									{HeaderIcon && <HeaderIcon className="w-4 h-4 text-white" strokeWidth={2.5} />}
								</div>
								<h1 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block tracking-tight">
									{isBn ? titleBn : titleEn}
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
								{sections.map((section) => (
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
												className: `w-4 h-4 ${activeSection === section.id ? 'text-rose-600 dark:text-rose-400' : 'opacity-70'}`
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
								{HeaderIcon && <HeaderIcon className="w-3.5 h-3.5" />}
								{isBn ? "নিরাপত্তা ও নীতিমালা" : "Trust & Safety"}
							</div>
							<h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
								{isBn ? titleBn : titleEn}
							</h1>
							<p className="text-slate-500 dark:text-slate-400 font-medium">
								{isBn ? "সর্বশেষ আপডেট: " : "Last updated: "}{lastUpdated}
							</p>
						</header>

						<div className="space-y-8 lg:space-y-12">
							{sections.map((section) => (
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

// Keep the old helper components exported in case other unknown pages rely on them,
// but they won't be used by the new premium pages.
export function Section({ children }) { return <div className="mb-6">{children}</div>; }
export function H2({ children }) { return <h2 className="text-lg font-bold text-gray-800 mb-2">{children}</h2>; }
export function P({ children }) { return <p className="text-[14.5px] leading-relaxed text-gray-700 mb-3">{children}</p>; }
export function LI({ children }) { return <li className="text-[14.5px] leading-relaxed text-gray-700 mb-2">{children}</li>; }
