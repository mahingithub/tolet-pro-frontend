import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import callProvider from '../services/callProvider';
import { Check, Clock, Eye, MessageSquare, Calendar, Flag, XCircle, CheckCircle2, MapPin } from 'lucide-react';

const STEPS = [
  { id: 'sent', bn: 'পাঠানো হয়েছে', en: 'Sent', icon: Clock },
  { id: 'delivered', bn: 'পৌঁছেছে', en: 'Delivered', icon: Check },
  { id: 'viewed', bn: 'দেখা হয়েছে', en: 'Viewed', icon: Eye },
  { id: 'answered', bn: 'উত্তর দেওয়া হয়েছে', en: 'Answered', icon: MessageSquare },
  { id: 'visit', bn: 'ভিজিট শিডিউল', en: 'Visit Scheduled', icon: Calendar, optional: true },
  { id: 'decision', bn: 'সিদ্ধান্ত', en: 'Decision', icon: Flag }
];

export default function InquiryStatusTimeline({ inquiry, onCancelVisit }) {
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const [currentStatus, setCurrentStatus] = useState(inquiry?.status || 'sent');
  const [visitDetails, setVisitDetails] = useState({
    date: inquiry?.scheduledDate || '',
    time: inquiry?.scheduledTime || '',
    location: inquiry?.location || ''
  });

  useEffect(() => {
    setCurrentStatus(inquiry?.status || 'sent');
    if (inquiry?.scheduledDate) {
      setVisitDetails({
        date: inquiry.scheduledDate,
        time: inquiry.scheduledTime,
        location: inquiry.location
      });
    }
  }, [inquiry]);

  useEffect(() => {
    const socket = callProvider.getSocket();
    if (!socket) return;

    const handleStatusUpdate = (data) => {
      // data.inquiryId could be returned from socket event
      if (data.inquiryId === inquiry?.id || data.inquiryId === inquiry?._id) {
        setCurrentStatus(data.status);
        if (data.visitDetails) {
          setVisitDetails(prev => ({ ...prev, ...data.visitDetails }));
        }
      }
    };

    socket.on('inquiry:status_updated', handleStatusUpdate);
    return () => {
      socket.off('inquiry:status_updated', handleStatusUpdate);
    };
  }, [inquiry]);

  const getStepIndex = (status) => {
    switch (status) {
      case 'sent': return 0;
      case 'delivered': return 1;
      case 'viewed': return 2;
      case 'accepted': 
      case 'rejected': return 3;
      case 'visit_scheduled': return 4;
      case 'final_booking': 
      case 'converted':
      case 'completed': return 5;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(currentStatus);
  const isRejected = currentStatus === 'rejected';

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
      {/* Timeline */}
      <div className="relative flex justify-between items-center mb-10 sm:mb-12 mt-4 px-2 sm:px-4">
        {/* Connecting lines */}
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-100 -translate-y-1/2 rounded-full z-0"></div>
        <div 
          className={`absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full z-0 transition-all duration-700 ease-in-out ${isRejected ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${(Math.min(currentIndex, 5) / 5) * 100}%` }}
        ></div>

        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;
          
          let iconBg = 'bg-gray-100 text-gray-400';
          let ring = '';
          
          if (isCompleted) {
            iconBg = isRejected && index >= 3 ? 'bg-gray-100 text-gray-300' : 'bg-blue-500 text-white';
          } else if (isCurrent) {
            if (isRejected && index === 3) {
              iconBg = 'bg-red-500 text-white';
              ring = 'ring-4 ring-red-100';
            } else if ((currentStatus === 'final_booking' || currentStatus === 'converted') && index === 5) {
               iconBg = 'bg-green-500 text-white';
               ring = 'ring-4 ring-green-100';
            } else {
              iconBg = 'bg-blue-600 text-white';
              ring = 'ring-4 ring-blue-100 animate-pulse';
            }
          }

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${iconBg} ${ring}`}>
                {(isRejected && index === 3) ? <XCircle size={isCurrent ? 24 : 16} className="sm:w-6 sm:h-6" /> : <Icon size={isCurrent ? 24 : 16} className="sm:w-6 sm:h-6" />}
              </div>
              <div className="absolute -bottom-8 w-24 flex flex-col items-center">
                <span className={`text-[9px] sm:text-[11px] font-black text-center leading-tight ${isCurrent || isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                  {isBn ? step.bn : step.en}
                </span>
                {step.optional && <span className="text-[8px] sm:text-[9px] block text-center font-bold text-gray-400">({isBn ? 'ঐচ্ছিক' : 'Optional'})</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 sm:mt-12">
        {currentStatus === 'accepted' && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 sm:p-5 flex items-start sm:items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CheckCircle2 className="text-green-600 shrink-0 mt-0.5 sm:mt-0" size={20} />
            <p className="text-green-800 font-bold text-sm leading-relaxed">
              {isBn ? 'ইনকোয়ারি গ্রহণ করা হয়েছে। মালিক শীঘ্রই আপনার সাথে যোগাযোগ করবেন বা ভিজিট শিডিউল করবেন।' : 'Inquiry accepted. The landlord will contact you or schedule a visit soon.'}
            </p>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 sm:p-5 flex items-start sm:items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <XCircle className="text-red-600 shrink-0 mt-0.5 sm:mt-0" size={20} />
            <p className="text-red-800 font-bold text-sm">
              {isBn ? 'ইনকোয়ারি প্রত্যাখ্যান করা হয়েছে।' : 'Inquiry rejected.'}
            </p>
          </div>
        )}

        {currentStatus === 'visit_scheduled' && (
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h4 className="font-black text-gray-900 mb-5 flex items-center gap-2">
              <Calendar className="text-blue-600" size={20} />
              {isBn ? 'ভিজিট শিডিউল করা হয়েছে' : 'Visit Scheduled'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3 hover:border-blue-200 transition-colors">
                 <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                   <Clock size={18} />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{isBn ? 'তারিখ ও সময়' : 'Date & Time'}</p>
                   <p className="text-sm font-bold text-gray-900">{visitDetails.date || 'TBD'} • {visitDetails.time || 'TBD'}</p>
                 </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3 hover:border-blue-200 transition-colors">
                 <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                   <MapPin size={18} />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{isBn ? 'ঠিকানা/লোকেশন' : 'Location'}</p>
                   <p className="text-sm font-bold text-gray-900">{visitDetails.location || inquiry?.propTitle || 'TBD'}</p>
                 </div>
              </div>
            </div>
            <button onClick={onCancelVisit} className="w-full sm:w-auto bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 px-6 py-2.5 rounded-xl text-sm font-black transition-all">
              {isBn ? 'বাতিল করার অনুরোধ' : 'Request Cancel'}
            </button>
          </div>
        )}

        {(currentStatus === 'final_booking' || currentStatus === 'converted' || currentStatus === 'completed') && (
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Decorative element */}
             <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
             
             <div className="relative z-10">
               <div className="flex items-center gap-3 sm:gap-4 mb-3">
                 <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
                   <Flag className="text-white" size={24} />
                 </div>
                 <h3 className="text-xl sm:text-2xl font-black tracking-tight">{isBn ? 'ডিল নিশ্চিত হয়েছে 🎉' : 'Deal Confirmed 🎉'}</h3>
               </div>
               <p className="text-purple-100 text-sm sm:text-base font-medium sm:ml-16 leading-relaxed">
                 {isBn ? 'অভিনন্দন! আপনি সফলভাবে প্রপার্টিটি ভাড়া নিয়েছেন:' : 'Congratulations! You have successfully rented:'} <strong className="text-white block mt-1 text-lg">{inquiry?.propTitle}</strong>
               </p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
