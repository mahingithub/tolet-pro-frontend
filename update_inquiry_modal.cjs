const fs = require('fs');
let code = fs.readFileSync('src/components/InquiryModal.jsx', 'utf8');

// 1. Add import
code = code.replace(
  "import { getCurrentUser, getCurrentToken } from '../services/authService.js';",
  "import { getCurrentUser, getCurrentToken } from '../services/authService.js';\nimport { useLanguage } from '../context/LanguageContext';"
);

// 2. Update useAiSuggestions hook
code = code.replace(
  "const useAiSuggestions = (property) => {",
  "const useAiSuggestions = (property, language = 'en') => {\n\tconst isBn = language === 'bn';"
);

// 3. Update variables inside useAiSuggestions
code = code.replace(
  "const priceFmt = property.price ? `৳${Number(property.price).toLocaleString('en-IN')}` : 'the listed rent';",
  "const priceFmt = property.price ? `৳${Number(property.price).toLocaleString('en-IN')}` : (isBn ? 'উল্লেখিত ভাড়া' : 'the listed rent');"
);
code = code.replace(
  "const location = property.location || 'this area';",
  "const location = property.location || (isBn ? 'এই এলাকা' : 'this area');"
);

// 4. Update chips in useAiSuggestions
const newChips = `
		const chips = [
			{
				id: 'rent',
				icon: BadgePercent,
				label: isBn ? 'ভাড়া কমানোর অনুরোধ' : 'Negotiate rent',
				message: isBn
					? \`নমস্কার! আমি আপনার প্রপার্টিটিতে আগ্রহী। \${priceFmt} ভাড়া কি কিছুটা কমানো সম্ভব, বিশেষ করে যদি আমি দীর্ঘমেয়াদী চুক্তিতে থাকি?\`
					: \`Hi! I'm interested in your property. Is there any flexibility on the monthly rent of \${priceFmt}, especially if I sign for a longer-term lease?\`,
			},
			{
				id: 'facilities',
				icon: Wrench,
				label: isBn ? 'সুবিধাগুলো নিশ্চিত করুন' : 'Confirm facilities',
				message: isBn
					? \`অনুগ্রহ করে নিশ্চিত করবেন কি প্রপার্টিটিতে গ্যাস, জল, পার্কিং, লিফট, জেনারেটর এবং ইন্টারনেট সুবিধা আছে কিনা? ইউটিলিটি বিল কি ভাড়ার সাথে অন্তর্ভুক্ত নাকি আলাদা?\`
					: \`Could you confirm what's included with the property — gas, water, parking, lift, generator and internet? Are utility bills part of the rent or paid separately?\`,
			},
			{
				id: 'location',
				icon: MapPin,
				label: isBn ? 'অবস্থান ও যাতায়াত' : 'Location & access',
				message: isBn
					? \`\${location} যাতায়াতের সুবিধা কেমন? আমি জানতে চাই প্রপার্টিটি থেকে নিকটস্থ বাসস্ট্যান্ড, স্কুল এবং বাজার কতটা দূরে, এবং রাতে এলাকার পরিবেশ কেমন থাকে।\`
					: \`How accessible is \${location}? I'd like to know roughly how far the property is from the nearest bus stop, school and grocery market, and how the area feels at night.\`,
			},
			{
				id: 'visit',
				icon: CalendarClock,
				label: isBn ? 'ভিজিটের সময় নির্ধারণ' : 'Schedule a visit',
				message: isBn
					? \`আমি কি এই সপ্তাহে প্রপার্টিটি দেখতে আসতে পারি? আমি সপ্তাহের দিনগুলোতে সন্ধ্যায় বা ছুটির দিনে সকালে আসতে পারব — অনুগ্রহ করে আপনার সুবিধামতো একটি সময় জানান।\`
					: \`When could I come by for a tour this week? I'm flexible on weekday evenings and weekend mornings — please share a slot that works for you.\`,
			},
			{
				id: 'move-in',
				icon: KeyRound,
				label: isBn ? 'ওঠার তারিখ ও চুক্তি' : 'Move-in & lease',
				message: isBn
					? \`সবচেয়ে তাড়াতাড়ি কবে ওঠা যাবে এবং সর্বনিম্ন চুক্তির মেয়াদ কত? এছাড়াও — সিকিউরিটি ডিপোজিট এবং অগ্রিম ভাড়ার বিষয়ে বিস্তারিত জানাবেন।\`
					: \`What's the earliest move-in date, and what's the minimum lease length? Also — security deposit and advance rent expectations, please.\`,
			},
		];
`;
code = code.replace(/const chips = \[\s*\{\s*id: 'rent'[\s\S]*?\];/m, newChips.trim());

// 5. Update spec chip
const specReplacement = `
		if (beds || baths || sqft) {
			const parts = [];
			if (beds) parts.push(isBn ? \`\${beds} বেড\` : \`\${beds} bed\`);
			if (baths) parts.push(isBn ? \`\${baths} বাথ\` : \`\${baths} bath\`);
			if (sqft) parts.push(isBn ? \`\${sqft} স্কয়ার ফিট\` : \`\${sqft} sqft\`);
			chips.push({
				id: 'spec',
				icon: Sparkles,
				label: isBn ? 'স্পেসিফিকেশন নিশ্চিত করুন' : 'Confirm spec',
				message: isBn
					? \`নিশ্চিত করার জন্য — লিস্টিং-এ বলা হয়েছে \${parts.join(', ')}। আমি ভিজিট করার আগে আপনি কি রুমগুলোর ছবি বা ছোট ভিডিও পাঠাতে পারবেন?\`
					: \`Just to confirm — the listing says \${parts.join(', ')}. Could you also share photos or a quick video walkthrough of the rooms before I visit?\`,
			});
		}
`;
code = code.replace(/if \(beds \|\| baths \|\| sqft\) \{[\s\S]*?\}\n/m, specReplacement.trim() + '\n');

// 6. Update InquiryModal signature
code = code.replace(
  "const InquiryModal = ({ isOpen, onClose, property, landlord }) => {",
  "const InquiryModal = ({ isOpen, onClose, property, landlord }) => {\n\tconst { language } = useLanguage();\n\tconst isBn = language === 'bn';"
);

// 7. Update useAiSuggestions call
code = code.replace(
  "const aiSuggestions = useAiSuggestions(displayProperty);",
  "const aiSuggestions = useAiSuggestions(displayProperty, language);"
);

// 8. Safely replace specific UI strings using exact lines
const replacements = [
  // Header
  ['<h3 className="text-xl font-black text-gray-900 leading-tight">Send Inquiry</h3>', '<h3 className="text-xl font-black text-gray-900 leading-tight">{isBn ? "ইনকোয়ারি পাঠান" : "Send Inquiry"}</h3>'],
  ['to <span', '{isBn ? "প্রতি " : "to "}<span'],
  ['<span className="text-gray-400 font-bold text-xs">/mo</span>', '<span className="text-gray-400 font-bold text-xs">{isBn ? "/মাস" : "/mo"}</span>'],
  
  // Phone
  ['<Phone size={10} /> Your Phone Number', '<Phone size={10} /> {isBn ? "আপনার মোবাইল নম্বর" : "Your Phone Number"}'],
  ['Looks short — please enter a full mobile number.', '{isBn ? "নম্বরটি ছোট মনে হচ্ছে — অনুগ্রহ করে সম্পূর্ণ নম্বর দিন।" : "Looks short — please enter a full mobile number."}'],
  
  // AI Suggestions Header
  ['AI Suggestions\n\t\t\t\t\t\t\t\t\t\t\t\t\t</p>', '{isBn ? "এআই সাজেশন" : "AI Suggestions"}\n\t\t\t\t\t\t\t\t\t\t\t\t\t</p>'],
  ['{suggestionCount}/3 added', '{isBn ? `${suggestionCount}/৩ যোগ করা হয়েছে` : `${suggestionCount}/3 added`}'],
  
  // Recommendations blurb
  ['Tap to add ready-made questions to your message. We recommend at least\n\t\t\t\t\t\t\t\t\t\t\t\t<span className="text-gray-800"> three</span> so the landlord can answer in one go.',
   '{isBn ? "আপনার বার্তায় প্রস্তুত করা প্রশ্ন যোগ করতে ট্যাপ করুন। আমরা অন্তত" : "Tap to add ready-made questions to your message. We recommend at least"}\n\t\t\t\t\t\t\t\t\t\t\t\t<span className="text-gray-800"> {isBn ? "৩টি" : "three"}</span> {isBn ? "সুপারিশ করছি যাতে মালিক একবারে উত্তর দিতে পারেন।" : "so the landlord can answer in one go."}'],
  
  // Message area
  ['Your Message\n\t\t\t\t\t\t\t\t\t\t\t\t</p>', '{isBn ? "আপনার বার্তা" : "Your Message"}\n\t\t\t\t\t\t\t\t\t\t\t\t</p>'],
  ['{finalMessage.length} chars', '{finalMessage.length} {isBn ? "অক্ষর" : "chars"}'],
  ['placeholder="Optional — add your own note. AI questions you tap above will be appended automatically."', 'placeholder={isBn ? "ঐচ্ছিক — আপনার নিজস্ব নোট যোগ করুন। উপরে ট্যাপ করা এআই প্রশ্নগুলো স্বয়ংক্রিয়ভাবে যুক্ত হবে।" : "Optional — add your own note. AI questions you tap above will be appended automatically."}'],
  
  // Submit block
  ['typically responds in', '{isBn ? "সাধারণত উত্তর দেন " : "typically responds in "}'],
  ["err?.message || 'Inquiry পাঠাতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।'", "err?.message || (isBn ? 'Inquiry পাঠাতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।' : 'Failed to send inquiry. Please try again later.')"],
  ["setSubmitError('Inquiry পাঠাতে আগে লগইন করুন।');", "setSubmitError(isBn ? 'Inquiry পাঠাতে আগে লগইন করুন।' : 'Please login first to send an inquiry.');"],
  ['Sending...\n\t\t\t\t\t\t\t\t\t\t\t\t</>', '{isBn ? "পাঠানো হচ্ছে..." : "Sending..."}\n\t\t\t\t\t\t\t\t\t\t\t\t</>'],
  ['<Send size={16} /> Send Inquiry\n\t\t\t\t\t\t\t\t\t\t\t\t</>', '<Send size={16} /> {isBn ? "ইনকোয়ারি পাঠান" : "Send Inquiry"}\n\t\t\t\t\t\t\t\t\t\t\t\t</>'],
  
  // Success state
  ['Inquiry sent!\n\t\t\t\t\t\t\t\t\t\t</h3>', '{isBn ? "ইনকোয়ারি পাঠানো হয়েছে!" : "Inquiry sent!"}\n\t\t\t\t\t\t\t\t\t\t</h3>'],
  ["We've shared your message with", "{isBn ? 'আমরা আপনার বার্তা শেয়ার করেছি' : \"We've shared your message with \"}"],
  ["<br />\n\t\t\t\t\t\t\t\t\t\t\tThey'll call or text <span className=\"text-gray-800\">{maskPhone(phone)}</span> shortly.",
   "{isBn ? ' এর সাথে।' : '.'}<br />\n\t\t\t\t\t\t\t\t\t\t\t{isBn ? 'তারা শীঘ্রই আপনাকে কল বা টেক্সট করবে ' : \"They'll call or text \"}<span className=\"text-gray-800\">{maskPhone(phone)}</span> {isBn ? 'নম্বরে।' : 'shortly.'}"],
  ["What happens next", "{isBn ? 'এরপর কী হবে' : 'What happens next'}"],
  ["text: `${displayLandlord.name} reviews your message`", "text: isBn ? `${displayLandlord.name} আপনার বার্তা দেখবেন` : `${displayLandlord.name} reviews your message`"],
  ["text: `They reach out on ${maskPhone(phone)}`", "text: isBn ? `তারা যোগাযোগ করবেন ${maskPhone(phone)} নম্বরে` : `They reach out on ${maskPhone(phone)}`"],
  ["text: 'Schedule a property visit'", "text: isBn ? 'প্রপার্টি ভিজিট শিডিউল করবেন' : 'Schedule a property visit'"],
  ["<Sparkles size={15} /> Done\n\t\t\t\t\t\t\t\t\t\t</button>", "<Sparkles size={15} /> {isBn ? 'সম্পন্ন' : 'Done'}\n\t\t\t\t\t\t\t\t\t\t</button>"],
  ["Back to property\n\t\t\t\t\t\t\t\t\t\t</button>", "{isBn ? 'প্রপার্টিতে ফিরে যান' : 'Back to property'}\n\t\t\t\t\t\t\t\t\t\t</button>"]
];

replacements.forEach(([search, replacement]) => {
  if (code.includes(search)) {
    code = code.replace(search, replacement);
  } else {
    console.warn("Could not find:", search);
  }
});

fs.writeFileSync('src/components/InquiryModal.jsx', code);
console.log('Update complete');
