import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Search, Trash2, MapPin, MessageCircle } from 'lucide-react';

const SavedTab = ({
  filteredSavedProps,
  t,
  language,
  navigate,
  handleUnsave,
  openInquiry
}) => {
  return (
    <div className="animate-in fade-in duration-500">
      {filteredSavedProps.length === 0 ? (
        <div className="text-center py-20 md:py-24 bg-white/40 backdrop-blur-md rounded-[2rem] md:rounded-[3rem] border border-white shadow-sm flex flex-col items-center px-6">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4">
            <Heart className="text-[#ba0036]" size={36} />
          </div>
          <h3 className="text-xl font-black text-gray-700 mb-2">{t.noSavedProps || (language === 'বাংলা' ? 'কোনো প্রপার্টি সেভ করা নেই।' : 'No saved properties yet.')}</h3>
          <p className="text-sm font-bold text-gray-400 mb-6 max-w-md leading-relaxed">{t.saveFavoriteHomes || (language === 'বাংলা' ? 'প্রপার্টি কার্ডের ❤ আইকনে ক্লিক করলে সেগুলো এখানে সেভ হবে — পরে এক ক্লিকে আবার দেখতে পারবেন।' : 'Tap the heart on any property card to save it here — pick up where you left off in one click later.')}</p>
          <Link to="/properties/all" className="bg-[#ba0036] text-white px-8 py-3 rounded-xl text-sm font-black active:scale-95 transition-transform shadow-md hover:bg-[#90002a] inline-flex items-center gap-2">
            <Search size={14} /> {t.exploreRentals || (language === 'বাংলা' ? 'প্রপার্টি খুঁজুন' : 'Explore properties')}
          </Link>
        </div>
      ) : (
        <>
          {/* Count + browse-more strip */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-[#ba0036] shadow-sm">
                <Heart size={20} fill="currentColor" />
              </div>
              <div>
                <p className="text-base font-black text-gray-900">
                  {filteredSavedProps.length} {language === 'বাংলা' ? 'সেভ করা প্রপার্টি' : `saved propert${filteredSavedProps.length === 1 ? 'y' : 'ies'}`}
                </p>
                <p className="text-[11px] font-bold text-gray-500">
                  {language === 'বাংলা' ? 'বাড়িওয়ালার সাথে সরাসরি কথা বলতে যেকোনো কার্ডে ইনকোয়ারি দিন।' : 'Inquire on any card to start a conversation with the landlord.'}
                </p>
              </div>
            </div>
            <Link
              to="/properties/all"
              className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-[#ba0036] hover:text-[#ba0036] text-gray-600 rounded-xl text-[11px] font-black shadow-sm transition-all"
            >
              <Search size={12} /> {language === 'বাংলা' ? 'আরও খুঁজুন' : 'Find more'}
            </Link>
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 auto-rows-fr">
          {filteredSavedProps.map((prop) => (
            <div key={prop.id} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group">
              <div className="relative h-56 overflow-hidden bg-gray-900 cursor-pointer" onClick={() => navigate(`/property/${prop.id}`)}>
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[2s] group-hover:scale-110 opacity-90 group-hover:opacity-100" style={{ backgroundImage: `url(${prop.img || prop.images?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=500'})` }}></div>
                
                <button onClick={(e) => { e.stopPropagation(); handleUnsave(prop.id); }} className="absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-sm hover:bg-white hover:scale-110 active:scale-95 transition-all z-10">
                   <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
                </button>

                <div className="absolute -bottom-1 right-4 bg-white/95 backdrop-blur-xl px-4 py-2 rounded-t-xl font-black text-base text-gray-900 shadow-sm border border-white/50 border-b-0">
                  ৳ {prop.price}
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h4 className="text-lg font-black text-gray-900 mb-2 leading-tight group-hover:text-[#ba0036] transition-colors cursor-pointer" onClick={() => navigate(`/property/${prop.id}`)}>{prop.title}</h4>
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-6"><MapPin size={14} className="text-gray-400" /> {prop.location}</p>
                
                <div className="mt-auto flex gap-2 pt-4 border-t border-gray-100">
                   <button onClick={() => navigate(`/property/${prop.id}`)} className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 rounded-xl text-xs font-bold transition-all border border-gray-200 active:scale-95">
                     {t.viewDetails || (language === 'বাংলা' ? 'বিস্তারিত' : 'View Details')}
                   </button>
                   <button onClick={() => openInquiry(prop)} className="flex-1 bg-gradient-to-r from-[#ba0036] to-[#d11147] text-white py-3 rounded-xl text-xs font-black shadow-[0_6px_18px_rgba(186,0,54,0.25)] hover:shadow-[0_10px_24px_rgba(186,0,54,0.4)] active:scale-95 transition-all flex items-center justify-center gap-1.5">
                     <MessageCircle size={13} /> {t.inquire || (language === 'বাংলা' ? 'ইনকোয়ারি' : 'Inquire')}
                   </button>
                </div>
              </div>
            </div>
          ))}
          {/* When fewer than 3 saved on lg, fill remaining grid slots with
              a dashed-border "discover more" prompt so the page never
              looks half-empty. Hidden on mobile (single column) where
              every card already takes a full row. */}
          {filteredSavedProps.length < 3 && Array.from({ length: 3 - filteredSavedProps.length }).map((_, i) => (
            <Link
              key={`fill-${i}`}
              to="/properties/all"
              className="hidden lg:flex flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-gray-200 hover:border-[#ba0036]/40 bg-white/30 hover:bg-white/60 transition-all duration-300 p-8 text-center group min-h-[24rem]"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#ba0036] group-hover:border-[#ba0036]/30 group-hover:scale-110 transition-all">
                <Search size={22} />
              </div>
              <p className="text-sm font-black text-gray-500 group-hover:text-[#ba0036] transition-colors">
                {language === 'বাংলা' ? 'আরও প্রপার্টি ব্রাউজ করুন' : 'Browse more properties'}
              </p>
              <p className="text-xs font-bold text-gray-400 max-w-[14rem] leading-relaxed">
                {language === 'বাংলা' ? 'পছন্দ হলে ❤ আইকনে ক্লিক করুন — এখানে সেভ হবে।' : 'Tap the heart on any listing — it lands right here.'}
              </p>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  );
};

export default SavedTab;
