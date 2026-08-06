import React from 'react';
import { RefreshCw, AlertCircle, Search, ArrowUpDown, ArrowUpRight, Lock, Building2, MapPin, Edit3, Settings, PlayCircle, PauseCircle, TrendingUp, Sparkles, Megaphone, MoreVertical, BadgeCheck, CheckCircle2, Clock, Bed, Bath, Maximize2, Sofa, Zap, FileText, Trash2 } from 'lucide-react';

export default function PropertiesTab({
  activeTab, t, language, properties, isPropertiesLoading, propertyLoadError, retryLoadProperties,
  filteredPropertiesByStatus, propertyFilter, setPropertyFilter, showToast, handleBoost,
  togglePropertyStatus, handleDeleteProperty, openModal, setActiveTab, navigate, isRecent,
  rentedDaysLeft, getRoomTypes, firstRoomTypeId, formatBDT, formatDate, roomLabel, userData,
  showBoostButton, boostStatus, boostingId
}) {
  return (
<div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6 mt-2">
               <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                 {t?.allProperties || (language === 'বাংলা' ? 'সকল প্রপার্টি' : 'All Properties')}
                 <span className="ml-2 text-[13px] font-bold text-gray-400">({filteredPropertiesByStatus.length})</span>
               </h3>
               <div className="flex items-center gap-2 w-full sm:w-auto">
                 <div className="flex bg-white p-1 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] gap-0.5 flex-1 sm:flex-none overflow-x-auto">
                   {[
                     { key: 'all', label: language === 'বাংলা' ? 'সকল' : 'All' },
                     { key: 'active', label: language === 'বাংলা' ? 'অ্যাক্টিভ' : 'Active' },
                     { key: 'paused', label: language === 'বাংলা' ? 'পজড' : 'Paused' },
                     { key: 'rented', label: language === 'বাংলা' ? 'ভাড়া হয়েছে' : 'Rented' },
                   ].map(f => (
                     <button key={f.key} onClick={() => setPropertyFilter(f.key)} className={`px-3 py-2 rounded-lg text-[10px] font-black capitalize transition-all whitespace-nowrap ${propertyFilter === f.key ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                       {f.label}
                     </button>
                   ))}
                 </div>
                 <button onClick={() => showToast(language === 'বাংলা' ? 'সর্ট হচ্ছে!' : 'Sorted!')} className="flex items-center gap-1.5 px-3 py-2.5 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] text-[10px] font-black text-gray-600 transition-all hover:bg-gray-50 shrink-0"><ArrowUpDown size={13} /> {t?.sort || (language === 'বাংলা' ? 'সর্ট' : 'Sort')}</button>
               </div>
            </div>

	            {isPropertiesLoading && properties.length === 0 ? (
	              <div className="text-center py-20 bg-white rounded-[2rem] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
	                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
	                  <RefreshCw className="text-[#ba0036] animate-spin" size={32} />
	                </div>
	                <h3 className="text-lg font-black text-gray-900">
	                  {language === 'বাংলা' ? 'আপনার বাসাগুলো লোড হচ্ছে...' : 'Loading your properties...'}
	                </h3>
	                <p className="text-xs font-bold text-gray-500 mt-2">
	                  {language === 'বাংলা' ? 'সার্ভার জেগে উঠলে এগুলো এখানে দেখা যাবে।' : 'This can take a moment if the server is waking up.'}
	                </p>
	              </div>
	            ) : propertyLoadError && properties.length === 0 ? (
	              <div className="text-center py-20 bg-white rounded-[2rem] border border-red-100 shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
	                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
	                  <AlertCircle className="text-[#ba0036]" size={32} />
	                </div>
	                <h3 className="text-lg font-black text-gray-900">
	                  {language === 'বাংলা' ? 'প্রপার্টি লোড করা যায়নি' : 'Could not load properties'}
	                </h3>
	                <p className="text-xs font-bold text-gray-500 mt-2 max-w-md mx-auto">{propertyLoadError}</p>
	                <button
	                  onClick={retryLoadProperties}
	                  className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#ba0036] text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
	                >
	                  <RefreshCw size={13} />
	                  {language === 'বাংলা' ? 'আবার চেষ্টা করুন' : 'Retry'}
	                </button>
	              </div>
	            ) : filteredPropertiesByStatus.length === 0 ? (
	              <div className="text-center py-20 bg-white rounded-[2rem] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
	                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5"><Search className="text-gray-300" size={32} /></div>
	                <h3 className="text-lg font-black text-gray-900">{t?.noPropsFound || (language === 'বাংলা' ? 'কোনো বাসা পাওয়া যায়নি।' : 'No properties found.')}</h3>
              </div>
            ) : (
              // Single-column on mobile so each card reads like a homepage
              // listing card. 2-up from sm:, 3-up from lg:.
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-8">
                {filteredPropertiesByStatus.map((prop) => {
                  const CATEGORY_LABELS = {
                    family: { en: 'Family Flat', bn: 'ফ্যামিলি ফ্ল্যাট' },
                    bachelor_male: { en: 'Bachelor (Male)', bn: 'ব্যাচেলর (পুরুষ)' },
                    bachelor_female: { en: 'Bachelor (Female)', bn: 'ব্যাচেলর (মহিলা)' },
                    sublet: { en: 'Sublet / Room', bn: 'সাবলেট / রুম' },
                    student_male: { en: 'Student (Male)', bn: 'ছাত্র' },
                    student_female: { en: 'Student (Female)', bn: 'ছাত্রী' },
                    working_professional: { en: 'Working Professional', bn: 'চাকরিজীবী' },
                    hostel: { en: 'Hostel', bn: 'হোস্টেল' },
                    apartment: { en: 'Apartment', bn: 'অ্যাপার্টমেন্ট' },
                    duplex: { en: 'Duplex', bn: 'ডুপ্লেক্স' },
                    triplex: { en: 'Triplex', bn: 'ট্রিপ্লেক্স' },
                    plot: { en: 'Plot / Land', bn: 'প্লট / জমি' },
                    building: { en: 'Building', bn: 'পুরো বিল্ডিং' },
                    commercial_space: { en: 'Commercial Space', bn: 'কমার্শিয়াল স্পেস' },
                    office: { en: 'Office Space', bn: 'অফিস স্পেস' },
                    co_working: { en: 'Co-working Space', bn: 'কো-ওয়ার্কিং স্পেস' },
                    shop: { en: 'Shop', bn: 'দোকান' },
                    showroom: { en: 'Showroom', bn: 'শোরুম' },
                    restaurant: { en: 'Restaurant', bn: 'রেস্টুরেন্ট' },
                    fast_food: { en: 'Fast Food', bn: 'ফাস্ট ফুড' },
                    warehouse: { en: 'Warehouse', bn: 'গুদামঘর' },
                    garage: { en: 'Garage', bn: 'গ্যারেজ' },
                    student: { en: 'Student', bn: 'ছাত্র' },
                    other: { en: 'Others', bn: 'অন্যান্য' }
                  };
                  const catDict = CATEGORY_LABELS[prop.rentalCategory];
                  const catLabel = catDict ? (language === 'বাংলা' ? catDict.bn : catDict.en) : (prop.rentalCategory || "Others");

                  // Property TYPE label (Office / Shop / Showroom / Restaurant /
                  // Hostel / House / Single Room / Apartment / Land …) so the host
                  // card clearly states WHAT the property is, alongside its
                  // category (= business category for commercial) + intent.
                  const TYPE_LABELS_HD = {
                    flat: { en: 'Apartment', bn: 'অ্যাপার্টমেন্ট' }, apartment: { en: 'Apartment', bn: 'অ্যাপার্টমেন্ট' },
                    house: { en: 'House', bn: 'বাড়ি' }, independent: { en: 'House', bn: 'বাড়ি' },
                    duplex: { en: 'Duplex', bn: 'ডুপ্লেক্স' }, studio: { en: 'Studio', bn: 'স্টুডিও' }, penthouse: { en: 'Penthouse', bn: 'পেন্টহাউস' },
                    sublet: { en: 'Sublet', bn: 'সাবলেট' }, hostel: { en: 'Hostel', bn: 'হোস্টেল' }, single_room: { en: 'Single Room', bn: 'সিঙ্গেল রুম' }, building: { en: 'Building', bn: 'বিল্ডিং' },
                    office: { en: 'Office', bn: 'অফিস' }, shop: { en: 'Shop', bn: 'দোকান' }, showroom: { en: 'Showroom', bn: 'শোরুম' }, restaurant: { en: 'Restaurant', bn: 'রেস্টুরেন্ট' }, land: { en: 'Land', bn: 'জমি' },
                  };
                  const tlDict = TYPE_LABELS_HD[prop.type];
                  const typeLabel = tlDict
                    ? (language === 'বাংলা' ? tlDict.bn : tlDict.en)
                    : (prop.type ? String(prop.type).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
                  // Hide the type pill when it would just duplicate the category
                  // pill (e.g. a showroom whose category is also "Showroom").
                  const showTypePill = typeLabel && String(typeLabel).toLowerCase() !== String(catLabel).toLowerCase();

                  const uniqueRoomShots = [];
                  const usedRooms = new Set();
                  const hasRoomPhotos = Array.isArray(prop.roomPhotos) && prop.roomPhotos.length > 0;
                  if (hasRoomPhotos) {
                    for (const p of prop.roomPhotos) {
                      const roomKey = (p.room || "other").toLowerCase();
                      const url = p.url || p.preview;
                      if (url && !usedRooms.has(roomKey)) {
                        uniqueRoomShots.push({ url, room: roomKey });
                        usedRooms.add(roomKey);
                      }
                    }
                  }
                  
                  const coverImg = prop.coverPhoto || prop.img || (uniqueRoomShots[0]?.url) || (prop.images || [])[0] || '';
                  // Show up to 3 room thumbnails (→ 4 images incl. the cover),
                  // drawn from the uploaded set. Prefer photos that DIFFER from
                  // the cover, but KEEP the labelled same-as-cover rooms so a
                  // commercial listing still shows Workspace / Reception /
                  // Washroom instead of empty slots.
                  let thumbs = [
                    ...uniqueRoomShots.filter(s => s.url && s.url !== coverImg),
                    ...uniqueRoomShots.filter(s => s.url && s.url === coverImg),
                  ].slice(0, 3);
                  if (thumbs.length < 3 && Array.isArray(prop.images)) {
                    for (const u of prop.images) {
                      if (thumbs.length >= 3) break;
                      if (u && u !== coverImg && !thumbs.some(s => s.url === u)) thumbs.push({ url: u, room: null });
                    }
                  }
                  
                  if (!thumbs.length && !hasRoomPhotos && Array.isArray(prop.images)) {
                    thumbs = prop.images.filter(u => u && u !== coverImg).slice(0, 3).map(u => ({ url: u, room: null }));
                  }
                  
                  const extraRoomCount = Math.max(0, uniqueRoomShots.length - 1 - thumbs.length);

                  const hasSpecs = prop.beds || prop.baths || prop.sqft || prop.furnishing;
                  const ownerLabel = prop.ownerName || userData.fullName;
                  const ownerAvatar = prop.hostAvatar || userData?.avatar;
                  const ownerInitials = (ownerLabel || 'H')
                    .split(' ')
                    .map(s => s.charAt(0))
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                  <div
                    key={prop.id}
                    data-property-id={prop.id}
                    onClick={() => navigate(`/property/${prop.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/property/${prop.id}`); }}
                    className="bg-white rounded-[1.5rem] md:rounded-[2rem] p-3 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.06)] transition-all duration-500 group flex flex-col cursor-pointer" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                    {/* Cover + side-thumbnail strip (listing-card style) */}
                    <div className="relative h-52 sm:h-56 lg:h-64 overflow-hidden bg-gray-100 rounded-[1.2rem] md:rounded-[1.5rem]">
                      {thumbs.length > 0 ? (
                        <div className="absolute inset-0 flex gap-1.5">
                          <div className="relative w-[72%] h-full overflow-hidden">
                            <img
                              src={coverImg}
                              alt={prop.title}
                              className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-105"
                            />
                          </div>
                          <div className="w-[28%] h-full flex flex-col gap-1.5">
                            {thumbs.map((shot, i) => (
                              <div key={i} className="relative flex-1 overflow-hidden bg-gray-200">
                                <img src={shot.url} alt="" className="w-full h-full object-cover" />
                                {shot.room && (
                                  <span className="absolute bottom-1 left-1 px-1.5 py-[2px] rounded-md bg-black/55 text-white text-[8px] font-black uppercase tracking-wider z-10">
                                    {roomLabel(shot.room, language === 'বাংলা')}
                                  </span>
                                )}
                                {i === 2 && extraRoomCount > 0 && (
                                  <div className="absolute inset-0 bg-[#ba0036]/85 backdrop-blur-sm flex items-center justify-center text-white text-xs font-black z-20">
                                    +{extraRoomCount}
                                  </div>
                                )}
                              </div>
                            ))}
                            {Array.from({ length: Math.max(0, 3 - thumbs.length) }, (_, i) => (
                              <div key={`pad-${i}`} className="flex-1 bg-gray-100" />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-[2s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-105"
                          style={{ backgroundImage: `url(${coverImg})` }}
                        />
                      )}
                      <div className="absolute top-3 left-3 flex gap-2 z-10">
                        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5">
                          {prop.status === 'active' ? (
                            <span className="text-green-600 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>{t?.activeStatus || (language === 'বাংলা' ? 'অ্যাক্টিভ' : 'ACTIVE')}</span>
                          ) : prop.status === 'paused' ? (
                            <span className="text-orange-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>{t?.pausedStatus || (language === 'বাংলা' ? 'পজড' : 'PAUSED')}</span>
                          ) : (
                            <span className="text-gray-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>{t?.rentedStatus || (language === 'বাংলা' ? 'ভাড়া হয়েছে' : 'RENTED')}</span>
                          )}
                        </div>
                        {prop.status === 'rented' && (
                          <div
                            className="bg-amber-500/95 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm text-white flex items-center gap-1.5"
                            title={language === 'বাংলা'
                              ? 'ভাড়া হওয়া লিস্টিং কয়েক দিন পর স্বয়ংক্রিয়ভাবে মুছে ফেলা হয়'
                              : 'Rented listings are automatically removed after a few days'}
                          >
                            <Clock size={11} />
                            {rentedDaysLeft(prop.rentedAt) > 0
                              ? (language === 'বাংলা'
                                  ? `${rentedDaysLeft(prop.rentedAt)} দিন পর মুছে যাবে`
                                  : `Deletes in ${rentedDaysLeft(prop.rentedAt)}d`)
                              : (language === 'বাংলা' ? 'মুছে ফেলা হচ্ছে…' : 'Removing…')}
                          </div>
                        )}
                        {isRecent(prop.addedDate) && (
                          <div className="bg-[#ba0036] px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm text-white flex items-center animate-pulse">
                            {language === 'বাংলা' ? 'নতুন' : 'NEW'}
                          </div>
                        )}
                      </div>
                      {/* ── Category & Intent badges (PropertyListing style) ── */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2 items-end z-10">
                        {showTypePill && (
                          <span className="bg-gray-900/90 backdrop-blur-md text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg shadow-sm">
                            {typeLabel}
                          </span>
                        )}
                        <span className="bg-[#ba0036]/90 backdrop-blur-md text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg shadow-sm">
                          {catLabel}
                        </span>
                        {prop.intent && (
                          <div className={`backdrop-blur-md px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm ${
                            prop.intent === 'sale' ? 'bg-blue-600/90 text-white' :
                            prop.intent === 'commercial' ? 'bg-purple-600/90 text-white' :
                            'bg-green-600/90 text-white'
                          }`}>
                            {prop.intent === 'sale' ? (language === 'বাংলা' ? 'বিক্রির জন্য' : 'For Sale') :
                             prop.intent === 'commercial' ? (language === 'বাংলা' ? 'কমার্শিয়াল' : 'Commercial') :
                             (language === 'বাংলা' ? 'ভাড়ার জন্য' : 'For Rent')}
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-3 right-3 bg-gray-900/90 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-[1rem] md:rounded-[1.2rem] font-black text-white shadow-lg text-sm md:text-[15px] z-10">
                        ৳ {prop.price}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-3 md:px-4 py-4 md:py-5 flex-1 flex flex-col">
                      <h4 className="text-base md:text-[19px] font-black text-gray-900 mb-1.5 leading-tight group-hover:text-[#ba0036] transition-colors line-clamp-1">{prop.title}</h4>
                      <p className="text-[11px] md:text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-3"><MapPin size={12} className="text-[#ba0036]" /> {prop.location}</p>

                      {hasSpecs && (
                        <div className="flex items-center flex-wrap gap-1.5 md:gap-2 mb-3">
                          {prop.beds ? (
                            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full text-[10px] font-black text-gray-700">
                              <Bed size={11} className="text-[#ba0036]"/> {prop.beds} {language === 'বাংলা' ? 'বেড' : 'Beds'}
                            </span>
                          ) : null}
                          {prop.baths ? (
                            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full text-[10px] font-black text-gray-700">
                              <Bath size={11} className="text-[#ba0036]"/> {prop.baths} {language === 'বাংলা' ? 'বাথ' : 'Baths'}
                            </span>
                          ) : null}
                          {prop.sqft ? (
                            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full text-[10px] font-black text-gray-700">
                              <Maximize2 size={11} className="text-[#ba0036]"/> {Number(prop.sqft).toLocaleString('en-IN')} {language === 'বাংলা' ? 'বর্গফুট' : 'sqft'}
                            </span>
                          ) : null}
                          {prop.furnishing ? (
                            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full text-[10px] font-black text-gray-700">
                              <Sofa size={11} className="text-[#ba0036]"/> {prop.furnishing}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Landlord row */}
                      <div className="flex items-center gap-2 mb-4 pt-3 border-t border-gray-50">
                        {ownerAvatar ? (
                          <img src={ownerAvatar} alt={ownerLabel} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center font-black text-[11px] shrink-0">
                            {ownerInitials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-gray-900 truncate">{ownerLabel}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'হোস্ট' : 'Listed by host'}</p>
                        </div>
                      </div>

                      {/* Action row — stop card-click propagation so these
                          buttons don't also open the property details page. */}
                      <div className="mt-auto flex flex-wrap lg:flex-nowrap gap-2" onClick={(e) => e.stopPropagation()}>
                         <button onClick={() => openModal('edit', prop)} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"><Edit3 size={12} /> {t?.editBtn || (language === 'বাংলা' ? 'এডিট' : 'Edit')}</button>
                         {prop.status !== 'rented' ? (
                           <>
                             <button onClick={() => togglePropertyStatus(prop.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${prop.status === 'paused' ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/20' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}>
                               {prop.status === 'paused' ? <><PlayCircle size={12}/> {t?.resumeBtn || (language === 'বাংলা' ? 'চালু' : 'Resume')}</> : <><PauseCircle size={12}/> {t?.pauseBtn || (language === 'বাংলা' ? 'পজ' : 'Pause')}</>}
                             </button>
                             {/* Boost — Plus only. Pro already ranks top, free has no credits. */}
                             {showBoostButton && (() => {
                               const isBoosted = prop.boostedUntil && new Date(prop.boostedUntil) > new Date();
                               const credits = boostStatus?.creditsRemaining ?? 0;
                               const busy = boostingId === prop.id;
                               const disabled = busy || isBoosted || credits === 0;
                               return (
                                 <button
                                   onClick={() => handleBoost(prop)}
                                   disabled={disabled}
                                   title={
                                     isBoosted
                                       ? (language === 'বাংলা' ? 'এই প্রপার্টি এখন বুস্ট করা আছে' : 'Already boosted')
                                       : credits === 0
                                         ? (language === 'বাংলা' ? 'এই মাসের বুস্ট শেষ — পরের মাসে আবার পাবেন' : 'No boosts left — resets next month')
                                         : (language === 'বাংলা' ? '২৪ ঘণ্টা সার্চের উপরে রাখুন' : 'Pin to top of search for 24 hours')
                                   }
                                   className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all ${
                                     isBoosted
                                       ? 'bg-amber-100 text-amber-700 cursor-default'
                                       : disabled
                                         ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                         : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/25 hover:from-amber-600 hover:to-yellow-600 active:scale-95'
                                   }`}
                                 >
                                   <Zap size={12} className={isBoosted ? 'fill-amber-700' : ''} />
                                   {busy
                                     ? (language === 'বাংলা' ? 'হচ্ছে…' : 'Boosting…')
                                     : isBoosted
                                       ? (language === 'বাংলা' ? 'বুস্টেড' : 'Boosted')
                                       : `${language === 'বাংলা' ? 'বুস্ট' : 'Boost'} (${credits})`}
                                 </button>
                               );
                             })()}
                             <button onClick={() => setActiveTab('inquiries')} className="w-full lg:flex-1 flex items-center justify-center gap-1.5 bg-[#ba0036] hover:bg-[#90002a] text-white py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all relative shadow-[0_6px_15px_rgba(186,0,54,0.25)] active:scale-95">
                               {t?.inquiriesBtn || (language === 'বাংলা' ? 'যোগাযোগ' : 'Inquiries')}
                               {prop.inquiries > 0 && <span className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white text-[8px] md:text-[9px] w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full shadow-sm border-2 border-white">{prop.inquiries}</span>}
                             </button>
                           </>
                         ) : (
                           <button onClick={() => openModal('lease', prop)} className="flex-[2] flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"><FileText size={12} /> {t?.viewLeaseBtn || (language === 'বাংলা' ? 'লিজ দেখুন' : 'View Lease')}</button>
                         )}
                         <button
                           onClick={() => handleDeleteProperty(prop)}
                           aria-label={language === 'বাংলা' ? `${prop.title} মুছুন` : `Delete ${prop.title}`}
                           className="flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 py-2.5 md:py-3 px-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0036]"
                           title={language === 'বাংলা' ? 'প্রপার্টি মুছুন' : 'Delete property'}
                         >
                           <Trash2 size={13} />
                         </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
      </div>
            )}
          </div>
  );
}
