/**
 * bdLocations.js — Comprehensive Bangladesh location index (Uber-style search)
 * ─────────────────────────────────────────────────────────────────────────
 * A self-contained, offline dataset of Bangladesh places so the location
 * search can surface ANY area — not just a tiny curated list. Coverage:
 *   • all 8 divisions            (bilingual)
 *   • all 64 districts           (bilingual)
 *   • EXHAUSTIVE Dhaka city areas / neighbourhoods (Gulshan, Dhanmondi 1-32,
 *     Uttara sectors, Mirpur 1-14, Mohammadpur, Old Dhaka, Savar, …)
 *   • key areas of the other metros (Chattogram, Sylhet, Khulna, Rajshahi, …)
 *
 * Every entry carries an English + Bengali name, so a query in EITHER language
 * matches. `searchBdLocations()` ranks results (exact → starts-with → contains
 * → token overlap) and returns ready-to-render suggestion rows.
 *
 * No API key, no billing, no network — this always works. It complements the
 * live `/properties/suggestions` API (areas that actually have listings), which
 * the modal shows FIRST; this index fills in every other area of the country.
 */

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnNum = (n) => String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

const DHK = 'Dhaka';
const DHK_BN = 'ঢাকা';

// entry: { en, bn, parent, parentBn, type }  type: division|district|thana|area
const A = (en, bn, parent = DHK, parentBn = DHK_BN, type = 'area') =>
  ({ en, bn, parent, parentBn, type });

// "Dhanmondi" + [1,2,3] → "Dhanmondi 1/2/3" (with Bengali digits on the bn side)
const numbered = (baseEn, baseBn, nums, parent = DHK, parentBn = DHK_BN, type = 'area') =>
  nums.map((n) => A(`${baseEn} ${n}`, `${baseBn} ${bnNum(n)}`, parent, parentBn, type));

// ─── DIVISIONS ───────────────────────────────────────────────────────────────
const DIVISIONS = [
  A('Dhaka', 'ঢাকা', 'Bangladesh', 'বাংলাদেশ', 'division'),
  A('Chattogram', 'চট্টগ্রাম', 'Bangladesh', 'বাংলাদেশ', 'division'),
  A('Sylhet', 'সিলেট', 'Bangladesh', 'বাংলাদেশ', 'division'),
  A('Rajshahi', 'রাজশাহী', 'Bangladesh', 'বাংলাদেশ', 'division'),
  A('Khulna', 'খুলনা', 'Bangladesh', 'বাংলাদেশ', 'division'),
  A('Barishal', 'বরিশাল', 'Bangladesh', 'বাংলাদেশ', 'division'),
  A('Rangpur', 'রংপুর', 'Bangladesh', 'বাংলাদেশ', 'division'),
  A('Mymensingh', 'ময়মনসিংহ', 'Bangladesh', 'বাংলাদেশ', 'division'),
];

// ─── DISTRICTS (all 64) ──────────────────────────────────────────────────────
const D = (en, bn, divEn, divBn) => A(en, bn, divEn, divBn, 'district');
const DISTRICTS = [
  // Dhaka division
  D('Dhaka', 'ঢাকা', 'Dhaka', 'ঢাকা'),
  D('Faridpur', 'ফরিদপুর', 'Dhaka', 'ঢাকা'),
  D('Gazipur', 'গাজীপুর', 'Dhaka', 'ঢাকা'),
  D('Gopalganj', 'গোপালগঞ্জ', 'Dhaka', 'ঢাকা'),
  D('Kishoreganj', 'কিশোরগঞ্জ', 'Dhaka', 'ঢাকা'),
  D('Madaripur', 'মাদারীপুর', 'Dhaka', 'ঢাকা'),
  D('Manikganj', 'মানিকগঞ্জ', 'Dhaka', 'ঢাকা'),
  D('Munshiganj', 'মুন্সীগঞ্জ', 'Dhaka', 'ঢাকা'),
  D('Narayanganj', 'নারায়ণগঞ্জ', 'Dhaka', 'ঢাকা'),
  D('Narsingdi', 'নরসিংদী', 'Dhaka', 'ঢাকা'),
  D('Rajbari', 'রাজবাড়ী', 'Dhaka', 'ঢাকা'),
  D('Shariatpur', 'শরীয়তপুর', 'Dhaka', 'ঢাকা'),
  D('Tangail', 'টাঙ্গাইল', 'Dhaka', 'ঢাকা'),
  // Chattogram division
  D('Chattogram', 'চট্টগ্রাম', 'Chattogram', 'চট্টগ্রাম'),
  D('Bandarban', 'বান্দরবান', 'Chattogram', 'চট্টগ্রাম'),
  D('Brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'Chattogram', 'চট্টগ্রাম'),
  D('Chandpur', 'চাঁদপুর', 'Chattogram', 'চট্টগ্রাম'),
  D('Comilla', 'কুমিল্লা', 'Chattogram', 'চট্টগ্রাম'),
  D("Cox's Bazar", 'কক্সবাজার', 'Chattogram', 'চট্টগ্রাম'),
  D('Feni', 'ফেনী', 'Chattogram', 'চট্টগ্রাম'),
  D('Khagrachari', 'খাগড়াছড়ি', 'Chattogram', 'চট্টগ্রাম'),
  D('Lakshmipur', 'লক্ষ্মীপুর', 'Chattogram', 'চট্টগ্রাম'),
  D('Noakhali', 'নোয়াখালী', 'Chattogram', 'চট্টগ্রাম'),
  D('Rangamati', 'রাঙ্গামাটি', 'Chattogram', 'চট্টগ্রাম'),
  // Sylhet division
  D('Sylhet', 'সিলেট', 'Sylhet', 'সিলেট'),
  D('Habiganj', 'হবিগঞ্জ', 'Sylhet', 'সিলেট'),
  D('Moulvibazar', 'মৌলভীবাজার', 'Sylhet', 'সিলেট'),
  D('Sunamganj', 'সুনামগঞ্জ', 'Sylhet', 'সিলেট'),
  // Rajshahi division
  D('Rajshahi', 'রাজশাহী', 'Rajshahi', 'রাজশাহী'),
  D('Bogura', 'বগুড়া', 'Rajshahi', 'রাজশাহী'),
  D('Chapainawabganj', 'চাঁপাইনবাবগঞ্জ', 'Rajshahi', 'রাজশাহী'),
  D('Joypurhat', 'জয়পুরহাট', 'Rajshahi', 'রাজশাহী'),
  D('Naogaon', 'নওগাঁ', 'Rajshahi', 'রাজশাহী'),
  D('Natore', 'নাটোর', 'Rajshahi', 'রাজশাহী'),
  D('Pabna', 'পাবনা', 'Rajshahi', 'রাজশাহী'),
  D('Sirajganj', 'সিরাজগঞ্জ', 'Rajshahi', 'রাজশাহী'),
  // Khulna division
  D('Khulna', 'খুলনা', 'Khulna', 'খুলনা'),
  D('Bagerhat', 'বাগেরহাট', 'Khulna', 'খুলনা'),
  D('Chuadanga', 'চুয়াডাঙ্গা', 'Khulna', 'খুলনা'),
  D('Jashore', 'যশোর', 'Khulna', 'খুলনা'),
  D('Jhenaidah', 'ঝিনাইদহ', 'Khulna', 'খুলনা'),
  D('Kushtia', 'কুষ্টিয়া', 'Khulna', 'খুলনা'),
  D('Magura', 'মাগুরা', 'Khulna', 'খুলনা'),
  D('Meherpur', 'মেহেরপুর', 'Khulna', 'খুলনা'),
  D('Narail', 'নড়াইল', 'Khulna', 'খুলনা'),
  D('Satkhira', 'সাতক্ষীরা', 'Khulna', 'খুলনা'),
  // Barishal division
  D('Barishal', 'বরিশাল', 'Barishal', 'বরিশাল'),
  D('Barguna', 'বরগুনা', 'Barishal', 'বরিশাল'),
  D('Bhola', 'ভোলা', 'Barishal', 'বরিশাল'),
  D('Jhalokati', 'ঝালকাঠি', 'Barishal', 'বরিশাল'),
  D('Patuakhali', 'পটুয়াখালী', 'Barishal', 'বরিশাল'),
  D('Pirojpur', 'পিরোজপুর', 'Barishal', 'বরিশাল'),
  // Rangpur division
  D('Rangpur', 'রংপুর', 'Rangpur', 'রংপুর'),
  D('Dinajpur', 'দিনাজপুর', 'Rangpur', 'রংপুর'),
  D('Gaibandha', 'গাইবান্ধা', 'Rangpur', 'রংপুর'),
  D('Kurigram', 'কুড়িগ্রাম', 'Rangpur', 'রংপুর'),
  D('Lalmonirhat', 'লালমনিরহাট', 'Rangpur', 'রংপুর'),
  D('Nilphamari', 'নীলফামারী', 'Rangpur', 'রংপুর'),
  D('Panchagarh', 'পঞ্চগড়', 'Rangpur', 'রংপুর'),
  D('Thakurgaon', 'ঠাকুরগাঁও', 'Rangpur', 'রংপুর'),
  // Mymensingh division
  D('Mymensingh', 'ময়মনসিংহ', 'Mymensingh', 'ময়মনসিংহ'),
  D('Jamalpur', 'জামালপুর', 'Mymensingh', 'ময়মনসিংহ'),
  D('Netrokona', 'নেত্রকোনা', 'Mymensingh', 'ময়মনসিংহ'),
  D('Sherpur', 'শেরপুর', 'Mymensingh', 'ময়মনসিংহ'),
];

// ─── DHAKA CITY — EXHAUSTIVE AREAS / NEIGHBOURHOODS ──────────────────────────
const DHAKA_AREAS = [
  // Gulshan / Banani / Baridhara belt
  A('Gulshan', 'গুলশান'),
  ...numbered('Gulshan', 'গুলশান', [1, 2]),
  A('Gulshan Avenue', 'গুলশান এভিনিউ'),
  A('Niketan', 'নিকেতন'),
  A('Banani', 'বনানী'),
  A('Banani DOHS', 'বনানী ডিওএইচএস'),
  A('Baridhara', 'বারিধারা'),
  A('Baridhara DOHS', 'বারিধারা ডিওএইচএস'),
  A('Mohakhali', 'মহাখালী'),
  A('Mohakhali DOHS', 'মহাখালী ডিওএইচএস'),
  A('Nadda', 'নদ্দা'),
  A('Notun Bazar', 'নতুন বাজার'),
  A('Kuril', 'কুড়িল'),
  A('Kuril Bishwa Road', 'কুড়িল বিশ্বরোড'),

  // Bashundhara / Badda
  A('Bashundhara R/A', 'বসুন্ধরা আবাসিক এলাকা'),
  A('Badda', 'বাড্ডা'),
  A('North Badda', 'উত্তর বাড্ডা'),
  A('South Badda', 'দক্ষিণ বাড্ডা'),
  A('Merul Badda', 'মেরুল বাড্ডা'),
  A('Aftabnagar', 'আফতাবনগর'),
  A('Banasree', 'বনশ্রী'),
  A('Meradia', 'মেরাদিয়া'),

  // Dhanmondi belt
  A('Dhanmondi', 'ধানমন্ডি'),
  ...numbered('Dhanmondi', 'ধানমন্ডি', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 27, 32]),
  A('Lalmatia', 'লালমাটিয়া'),
  A('Kalabagan', 'কলাবাগান'),
  A('Kathalbagan', 'কাঁঠালবাগান'),
  A('Green Road', 'গ্রিন রোড'),
  A('Panthapath', 'পান্থপথ'),
  A('Jigatola', 'জিগাতলা'),
  A('Sukrabad', 'শুক্রাবাদ'),
  A('Sobhanbagh', 'সোবহানবাগ'),
  A('Hatirpool', 'হাতিরপুল'),
  A('Science Lab', 'সায়েন্স ল্যাব'),
  A('Elephant Road', 'এলিফ্যান্ট রোড'),
  A('New Market', 'নিউ মার্কেট'),
  A('Nilkhet', 'নীলক্ষেত'),
  A('Azimpur', 'আজিমপুর'),

  // Mirpur belt
  A('Mirpur', 'মিরপুর'),
  ...numbered('Mirpur', 'মিরপুর', [1, 2, 6, 7, 10, 11, 12, 13, 14]),
  A('Mirpur DOHS', 'মিরপুর ডিওএইচএস'),
  A('Pallabi', 'পল্লবী'),
  A('Kazipara', 'কাজীপাড়া'),
  A('Shewrapara', 'শেওড়াপাড়া'),
  A('Kafrul', 'কাফরুল'),
  A('Monipur', 'মনিপুর'),
  A('Kalshi', 'কালশী'),
  A('Rupnagar', 'রূপনগর'),
  A('Senpara Parbata', 'সেনপাড়া পর্বতা'),
  A('Ibrahimpur', 'ইব্রাহিমপুর'),
  A('Kochukhet', 'কচুক্ষেত'),

  // Uttara belt
  A('Uttara', 'উত্তরা'),
  ...numbered('Uttara Sector', 'উত্তরা সেক্টর', [1, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]),
  A('Uttara DOHS', 'উত্তরা ডিওএইচএস'),
  A('Dakshinkhan', 'দক্ষিণখান'),
  A('Uttarkhan', 'উত্তরখান'),
  A('Abdullahpur', 'আব্দুল্লাহপুর'),
  A('Airport', 'বিমানবন্দর'),
  A('Nikunja', 'নিকুঞ্জ'),
  A('Khilkhet', 'খিলক্ষেত'),
  A('Turag', 'তুরাগ'),

  // Mohammadpur belt
  A('Mohammadpur', 'মোহাম্মদপুর'),
  A('Shyamoli', 'শ্যামলী'),
  A('Adabar', 'আদাবর'),
  A('Rayer Bazar', 'রায়ের বাজার'),
  A('Hazaribagh', 'হাজারীবাগ'),
  A('Katasur', 'কাটাসুর'),
  A('Bosila', 'বছিলা'),
  A('Tajmahal Road', 'তাজমহল রোড'),
  A('Iqbal Road', 'ইকবাল রোড'),
  A('Asad Avenue', 'আসাদ এভিনিউ'),
  A('Town Hall', 'টাউন হল'),
  A('Mohammadi Housing', 'মোহাম্মদী হাউজিং'),
  A('Pisciculture Housing', 'পিসিকালচার হাউজিং'),

  // Tejgaon / Farmgate / central
  A('Tejgaon', 'তেজগাঁও'),
  A('Tejgaon Industrial Area', 'তেজগাঁও শিল্প এলাকা'),
  A('Farmgate', 'ফার্মগেট'),
  A('Karwan Bazar', 'কারওয়ান বাজার'),
  A('Nakhalpara', 'নাখালপাড়া'),
  A('Tejkunipara', 'তেজকুনিপাড়া'),
  A('Bangla Motor', 'বাংলা মোটর'),
  A('Moghbazar', 'মগবাজার'),
  A('Eskaton', 'ইস্কাটন'),
  A('Ramna', 'রমনা'),
  A('Shahbagh', 'শাহবাগ'),

  // Motijheel / Paltan / Segunbagicha
  A('Motijheel', 'মতিঝিল'),
  A('Dilkusha', 'দিলকুশা'),
  A('Kamalapur', 'কমলাপুর'),
  A('Arambagh', 'আরামবাগ'),
  A('Fakirapool', 'ফকিরাপুল'),
  A('Paltan', 'পল্টন'),
  A('Purana Paltan', 'পুরানা পল্টন'),
  A('Bijoynagar', 'বিজয়নগর'),
  A('Kakrail', 'কাকরাইল'),
  A('Segunbagicha', 'সেগুনবাগিচা'),
  A('Shantinagar', 'শান্তিনগর'),
  A('Malibagh', 'মালিবাগ'),
  A('Mouchak', 'মৌচাক'),
  A('Rajarbagh', 'রাজারবাগ'),
  A('Shahjahanpur', 'শাহজাহানপুর'),
  A('Bailey Road', 'বেইলি রোড'),
  A('Gulistan', 'গুলিস্তান'),

  // Rampura / Khilgaon / Basabo
  A('Rampura', 'রামপুরা'),
  A('Khilgaon', 'খিলগাঁও'),
  A('Taltola', 'তালতলা'),
  A('Basabo', 'বাসাবো'),
  A('Mugda', 'মুগদা'),
  A('Manda', 'মান্ডা'),
  A('Sabujbagh', 'সবুজবাগ'),
  A('Goran', 'গোরান'),

  // Old Dhaka
  A('Old Dhaka', 'পুরান ঢাকা'),
  A('Wari', 'ওয়ারী'),
  A('Sutrapur', 'সূত্রাপুর'),
  A('Gendaria', 'গেন্ডারিয়া'),
  A('Narinda', 'নারিন্দা'),
  A('Tikatuli', 'টিকাটুলি'),
  A('Lalbagh', 'লালবাগ'),
  A('Chawkbazar', 'চকবাজার'),
  A('Bakshibazar', 'বকশীবাজার'),
  A('Nazira Bazar', 'নাজিরা বাজার'),
  A('Islampur', 'ইসলামপুর'),
  A('Sadarghat', 'সদরঘাট'),
  A('Kotwali', 'কোতোয়ালি'),
  A('Bangshal', 'বংশাল'),
  A('Armanitola', 'আরমানিটোলা'),

  // South Dhaka
  A('Jatrabari', 'যাত্রাবাড়ী'),
  A('Demra', 'ডেমরা'),
  A('Dhania', 'ধনিয়া'),
  A('Shanir Akhra', 'শনির আখড়া'),
  A('Kadamtali', 'কদমতলী'),
  A('Postogola', 'পোস্তগোলা'),
  A('Shyampur', 'শ্যামপুর'),
  A('Jurain', 'জুরাইন'),
  A('Matuail', 'মাতুয়াইল'),

  // Cantonment
  A('Dhaka Cantonment', 'ঢাকা সেনানিবাস'),
  A('Manikdi', 'মানিকদী'),
  A('Matikata', 'মাটিকাটা'),
  A('ECB Chattar', 'ইসিবি চত্বর'),

  // Purbachal
  A('Purbachal New Town', 'পূর্বাচল নিউ টাউন'),
];

// ─── DHAKA DISTRICT — SAVAR & OTHER UPAZILAS ─────────────────────────────────
const SAVAR = 'Savar';
const SAVAR_BN = 'সাভার';
const DHAKA_UPAZILA_AREAS = [
  A('Savar', 'সাভার', DHK, DHK_BN, 'thana'),
  A('Savar Bazar', 'সাভার বাজার', SAVAR, SAVAR_BN),
  A('Savar DOHS', 'সাভার ডিওএইচএস', SAVAR, SAVAR_BN),
  A('Hemayetpur', 'হেমায়েতপুর', SAVAR, SAVAR_BN),
  A('Amin Bazar', 'আমিন বাজার', SAVAR, SAVAR_BN),
  A('Bank Town', 'ব্যাংক টাউন', SAVAR, SAVAR_BN),
  A('Radio Colony', 'রেডিও কলোনি', SAVAR, SAVAR_BN),
  A('Dattapara', 'দত্তপাড়া', SAVAR, SAVAR_BN),
  A('Nabinagar', 'নবীনগর', SAVAR, SAVAR_BN),
  A('Jahangirnagar University', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', SAVAR, SAVAR_BN),
  A('Ashulia', 'আশুলিয়া', DHK, DHK_BN, 'thana'),
  A('Baipail', 'বাইপাইল', 'Ashulia', 'আশুলিয়া'),
  A('Jamgora', 'জামগড়া', 'Ashulia', 'আশুলিয়া'),
  A('Gonokbari', 'গণকবাড়ী', 'Ashulia', 'আশুলিয়া'),
  A('Keraniganj', 'কেরানীগঞ্জ', DHK, DHK_BN, 'thana'),
  A('Dhamrai', 'ধামরাই', DHK, DHK_BN, 'thana'),
  A('Nawabganj', 'নবাবগঞ্জ', DHK, DHK_BN, 'thana'),
  A('Dohar', 'দোহার', DHK, DHK_BN, 'thana'),
];

// ─── ADJACENT CITIES (Dhaka division) ────────────────────────────────────────
const DHAKA_ADJACENT = [
  A('Tongi', 'টঙ্গী', 'Gazipur', 'গাজীপুর', 'thana'),
  A('Board Bazar', 'বোর্ড বাজার', 'Gazipur', 'গাজীপুর'),
  A('Gazipur Sadar', 'গাজীপুর সদর', 'Gazipur', 'গাজীপুর', 'thana'),
  A('Sreepur', 'শ্রীপুর', 'Gazipur', 'গাজীপুর', 'thana'),
  A('Narayanganj Sadar', 'নারায়ণগঞ্জ সদর', 'Narayanganj', 'নারায়ণগঞ্জ', 'thana'),
  A('Fatullah', 'ফতুল্লা', 'Narayanganj', 'নারায়ণগঞ্জ', 'thana'),
  A('Siddhirganj', 'সিদ্ধিরগঞ্জ', 'Narayanganj', 'নারায়ণগঞ্জ', 'thana'),
];

// ─── OTHER METRO AREAS (lighter coverage) ────────────────────────────────────
const CTG = 'Chattogram';
const CTG_BN = 'চট্টগ্রাম';
const CHATTOGRAM_AREAS = [
  A('Agrabad', 'আগ্রাবাদ', CTG, CTG_BN),
  A('GEC Circle', 'জিইসি মোড়', CTG, CTG_BN),
  A('Nasirabad', 'নাসিরাবাদ', CTG, CTG_BN),
  A('Khulshi', 'খুলশী', CTG, CTG_BN),
  A('Halishahar', 'হালিশহর', CTG, CTG_BN),
  A('Panchlaish', 'পাঁচলাইশ', CTG, CTG_BN),
  A('Chawkbazar', 'চকবাজার', CTG, CTG_BN),
  A('Pahartali', 'পাহাড়তলী', CTG, CTG_BN),
  A('Bakalia', 'বাকলিয়া', CTG, CTG_BN),
  A('Patenga', 'পতেঙ্গা', CTG, CTG_BN),
  A('Muradpur', 'মুরাদপুর', CTG, CTG_BN),
  A('Oxygen', 'অক্সিজেন', CTG, CTG_BN),
  A('Bahaddarhat', 'বহদ্দারহাট', CTG, CTG_BN),
  A('Kotwali', 'কোতোয়ালি', CTG, CTG_BN),
];

const SYL = 'Sylhet';
const SYL_BN = 'সিলেট';
const SYLHET_AREAS = [
  A('Zindabazar', 'জিন্দাবাজার', SYL, SYL_BN),
  A('Amberkhana', 'আম্বরখানা', SYL, SYL_BN),
  A('Subid Bazar', 'সুবিদ বাজার', SYL, SYL_BN),
  A('Uposhohor', 'উপশহর', SYL, SYL_BN),
  A('Shahjalal Uposhohor', 'শাহজালাল উপশহর', SYL, SYL_BN),
  A('Tilagarh', 'টিলাগড়', SYL, SYL_BN),
  A('Bandar Bazar', 'বন্দর বাজার', SYL, SYL_BN),
  A('Mirabazar', 'মিরাবাজার', SYL, SYL_BN),
];

const OTHER_METRO_AREAS = [
  // Khulna
  A('Khalishpur', 'খালিশপুর', 'Khulna', 'খুলনা'),
  A('Sonadanga', 'সোনাডাঙ্গা', 'Khulna', 'খুলনা'),
  A('Daulatpur', 'দৌলতপুর', 'Khulna', 'খুলনা'),
  A('Boyra', 'বয়রা', 'Khulna', 'খুলনা'),
  A('Nirala', 'নিরালা', 'Khulna', 'খুলনা'),
  // Rajshahi
  A('Shaheb Bazar', 'সাহেব বাজার', 'Rajshahi', 'রাজশাহী'),
  A('Uposhohor', 'উপশহর', 'Rajshahi', 'রাজশাহী'),
  A('Kazla', 'কাজলা', 'Rajshahi', 'রাজশাহী'),
  A('Motihar', 'মতিহার', 'Rajshahi', 'রাজশাহী'),
  A('Boalia', 'বোয়ালিয়া', 'Rajshahi', 'রাজশাহী'),
  // Barishal
  A('Sadar Road', 'সদর রোড', 'Barishal', 'বরিশাল'),
  A('Nathullabad', 'নথুল্লাবাদ', 'Barishal', 'বরিশাল'),
  A('Rupatoli', 'রূপাতলী', 'Barishal', 'বরিশাল'),
  // Rangpur
  A('Jahaj Company More', 'জাহাজ কোম্পানি মোড়', 'Rangpur', 'রংপুর'),
  A('Dhap', 'ধাপ', 'Rangpur', 'রংপুর'),
  A('Modern More', 'মডার্ন মোড়', 'Rangpur', 'রংপুর'),
  // Mymensingh
  A('Ganginarpar', 'গাঙ্গিনারপাড়', 'Mymensingh', 'ময়মনসিংহ'),
  A('Charpara', 'চরপাড়া', 'Mymensingh', 'ময়মনসিংহ'),
  A('Kachari', 'কাচারি', 'Mymensingh', 'ময়মনসিংহ'),
  // Cox's Bazar
  A('Kolatoli', 'কলাতলী', "Cox's Bazar", 'কক্সবাজার'),
  A('Sugandha Point', 'সুগন্ধা পয়েন্ট', "Cox's Bazar", 'কক্সবাজার'),
];

// ─── FLATTENED INDEX ─────────────────────────────────────────────────────────
// Order matters for stable ranking among equal scores: areas people search most
// (Dhaka) come first.
const RAW = [
  ...DHAKA_AREAS,
  ...DHAKA_UPAZILA_AREAS,
  ...DHAKA_ADJACENT,
  ...CHATTOGRAM_AREAS,
  ...SYLHET_AREAS,
  ...OTHER_METRO_AREAS,
  ...DISTRICTS,
  ...DIVISIONS,
];

// Precompute a lowercased search blob per entry (matching is done against this
// once, not rebuilt per keystroke).
export const BD_LOCATIONS = RAW.map((e, i) => ({
  ...e,
  _id: `geo-${i}`,
  _enl: e.en.toLowerCase(),
  _bnl: e.bn.toLowerCase(),
  _hay: `${e.en} ${e.bn} ${e.parent} ${e.parentBn}`.toLowerCase(),
}));

// Short bilingual label for the type pill on the right of a suggestion row.
const TYPE_LABEL = {
  division: { en: 'Division', bn: 'বিভাগ' },
  district: { en: 'District', bn: 'জেলা' },
  thana:    { en: 'Thana',    bn: 'থানা' },
  area:     { en: 'Area',     bn: 'এলাকা' },
};

const QUERY_TOKENS = (q) =>
  q.toLowerCase().split(/[\s,;]+/).map((t) => t.trim()).filter((t) => t.length > 0);

/**
 * Rank-search the Bangladesh location index.
 *
 * @param {string} query
 * @param {{limit?:number, isBn?:boolean}} [opts]
 * @returns {Array<{id,title,type,category}>}  ready-to-render suggestion rows
 */
export function searchBdLocations(query, { limit = 20, isBn = false } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const tokens = QUERY_TOKENS(q);

  const scored = [];
  for (const e of BD_LOCATIONS) {
    let score = 0;
    if (e._enl === q || e._bnl === q) {
      score = 1000;                                   // exact name
    } else if (e._enl.startsWith(q) || e._bnl.startsWith(q)) {
      score = 600;                                    // name starts with query
    } else if (e._hay.includes(q)) {
      score = 300;                                    // full query is a substring
    } else {
      // token overlap — handles "savar dattapara" / partial multi-word input
      const hit = tokens.filter((tok) => e._hay.includes(tok)).length;
      if (hit > 0) score = 60 * hit;
    }
    if (score === 0) continue;

    // Type priority: neighbourhoods first (people search areas most), then
    // thanas, districts, divisions.
    score += e.type === 'area' ? 30 : e.type === 'thana' ? 22 : e.type === 'district' ? 14 : 8;
    // Prefer shorter, more specific names on ties.
    score -= Math.min(e.en.length, 40) * 0.15;

    scored.push({ e, score });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ e }) => {
    const name = isBn ? e.bn : e.en;
    const parent = isBn ? e.parentBn : e.parent;
    // Divisions/districts read as a single place; areas/thanas get their parent
    // appended for disambiguation ("Dhanmondi, Dhaka").
    const title =
      e.type === 'division' || e.type === 'district'
        ? name
        : `${name}, ${parent}`;
    return {
      id: e._id,
      title,
      type: (TYPE_LABEL[e.type] || TYPE_LABEL.area)[isBn ? 'bn' : 'en'],
      // Icon vocabulary: division/district → building (blue); area/thana → pin.
      category: e.type === 'division' || e.type === 'district' ? 'city' : 'area',
    };
  });
}
