import React, { useState } from 'react';
import { Check, X, Calendar, CheckCircle2, User, Phone, Home, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateInquiryStatus } from '../services/inquiryService';
import ScheduleVisitModal from './ScheduleVisitModal';

export default function InquiryCard({ inquiry, propertyStatus, onStatusChange, onChat, onCall, onDelete }) {
  const { language } = useAuth();
  const [loadingAction, setLoadingAction] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Safe fallbacks for inquiry details
  const tenantName = inquiry?.user || inquiry?.tenantName || 'Unknown Tenant';
  const tenantPhone = inquiry?.phone || inquiry?.tenantPhone || 'N/A';
  const tenantAvatar = inquiry?.userAvatar || inquiry?.tenantAvatar || '';
  const propertyTitle = inquiry?.propTitle || inquiry?.propertyName || 'Unknown Property';
  const status = inquiry?.status?.toLowerCase() || 'delivered';

  const handleAction = async (newStatus) => {
    setLoadingAction(newStatus);
    try {
      // API call to the backend route
      await updateInquiryStatus(inquiry.id || inquiry._id, newStatus);
      if (onStatusChange) {
        onStatusChange(inquiry.id || inquiry._id, newStatus);
      }
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setLoadingAction(null);
    }
  };

  const getStatusBadge = () => {
    if (propertyStatus === 'rented') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          {language === 'বাংলা' ? 'ভাড়া হয়ে গেছে' : 'Rented'}
        </span>
      );
    }

    switch (status) {
      case 'sent':
      case 'delivered':
      case 'new':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {language === 'বাংলা' ? 'ডেলিভার্ড' : 'Delivered'}
          </span>
        );
      case 'viewed':
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {language === 'বাংলা' ? 'দেখেছে' : 'Viewed'}
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            {language === 'বাংলা' ? 'গৃহীত' : 'Accepted'}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            {language === 'বাংলা' ? 'বাতিল' : 'Rejected'}
          </span>
        );
      case 'completed':
      case 'converted':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            {language === 'বাংলা' ? 'সম্পন্ন' : 'Completed'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 overflow-hidden shrink-0">
              {tenantAvatar ? (
                <img src={tenantAvatar} alt={tenantName} className="w-full h-full object-cover" />
              ) : (
                <User size={16} />
              )}
            </div>
            <h3 className="font-bold text-gray-900">{tenantName}</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2.5 ml-10">
            <Phone size={14} className="text-gray-400" />
            <span className="font-medium">{tenantPhone}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50/50 border border-blue-100 px-2.5 py-1.5 rounded-lg w-fit ml-10">
            <Home size={12} />
            <span>{propertyTitle}</span>
          </div>
          {inquiry?.dealType === 'commercial' && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg w-fit ml-10 mt-1.5 uppercase tracking-wider">
              🏢 {language === 'বাংলা' ? 'কমার্শিয়াল' : 'Commercial'}
            </div>
          )}
        </div>
        <div>
          {getStatusBadge()}
        </div>
      </div>

      {propertyStatus !== 'rented' && (
        <div className="mt-5 pt-4 border-t border-gray-50 flex flex-wrap gap-2.5">
          {(status === 'delivered' || status === 'viewed' || status === 'new' || status === 'active') && (
            <>
              <button
                onClick={() => handleAction('accepted')}
                disabled={loadingAction === 'accepted'}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2.5 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
              >
                {loadingAction === 'accepted' ? '...' : <><Check size={16} strokeWidth={3} /> Accept ✓</>}
              </button>
              <button
                onClick={() => handleAction('rejected')}
                disabled={loadingAction === 'rejected'}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
              >
                {loadingAction === 'rejected' ? '...' : <><X size={16} strokeWidth={3} /> Reject ✗</>}
              </button>
            </>
          )}

          {status === 'accepted' && (
            <>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 px-4 py-2.5 rounded-xl text-sm font-black transition-colors"
              >
                <Calendar size={16} strokeWidth={2.5} /> {language === 'বাংলা' ? 'ভিজিট শিডিউল করুন' : 'Schedule Visit'}
              </button>
              <button
                onClick={() => handleAction('completed')}
                disabled={loadingAction === 'completed'}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-black shadow-[0_4px_10px_rgba(22,163,74,0.2)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loadingAction === 'completed' ? '...' : <><CheckCircle2 size={16} strokeWidth={2.5} /> {language === 'বাংলা' ? 'ডিল নিশ্চিত করুন ✓' : 'Confirm Deal ✓'}</>}
              </button>
            </>
          )}
        </div>
      )}

      {(onChat || onCall || onDelete) && (
        <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-3">
            {onChat && (
              <button
                onClick={onChat}
                className="w-full bg-[#ba0036] hover:bg-[#90002a] text-white py-3 rounded-xl font-bold text-[11px] shadow-[0_4px_15px_rgba(186,0,54,0.2)] transition-all flex items-center justify-center gap-1.5"
              >
                <MessageSquare size={14} /> {language === 'বাংলা' ? 'মেসেজ' : 'Message'}
              </button>
            )}
            {onCall && (
              <button
                onClick={onCall}
                className="w-full bg-white text-gray-700 py-3 rounded-xl font-bold text-[11px] hover:bg-gray-50 border border-gray-200 transition-all flex items-center justify-center gap-1.5"
              >
                <Phone size={14} /> {language === 'বাংলা' ? 'কল' : 'Call'}
              </button>
            )}
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-full bg-white text-red-500 py-2 rounded-xl font-bold text-[11px] hover:bg-red-50 border border-red-100 transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} /> {language === 'বাংলা' ? 'পুরোপুরি মুছে ফেলুন' : 'Delete Completely'}
            </button>
          )}
        </div>
      )}

      {showScheduleModal && (
        <ScheduleVisitModal
          inquiry={inquiry}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={(scheduleData) => {
            setShowScheduleModal(false);
            // Handle schedule success if needed
          }}
        />
      )}
    </div>
  );
}
