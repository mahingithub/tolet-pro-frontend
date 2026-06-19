import React, { forwardRef } from 'react';
import { CheckCheck, Hourglass, MapPin, Calendar, Phone, Hash } from 'lucide-react';

const PdfReceiptTemplate = forwardRef(({ receipt, language = 'en' }, ref) => {
  if (!receipt) return null;

  const isPaid = receipt.status === 'full' || receipt.balance <= 0;
  const bn = language === 'বাংলা';

  return (
    <div
      ref={ref}
      className="bg-white"
      style={{
        width: '800px',
        padding: '40px',
        fontFamily: "'Inter', sans-serif",
        color: '#111827',
      }}
    >
      {/* Header section with styling */}
      <div className={`p-8 rounded-3xl text-white relative overflow-hidden mb-8 ${isPaid ? 'bg-blue-600 bg-gradient-to-br from-blue-600 to-indigo-800' : 'bg-amber-600 bg-gradient-to-br from-amber-500 to-orange-700'}`}>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full"></div>
        <div className="flex justify-between items-start relative z-10">
          <div className="w-2/3">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-5 border border-white/30 shadow-lg">
              {isPaid ? <CheckCheck size={32} strokeWidth={3} /> : <Hourglass size={32} strokeWidth={2.5} />}
            </div>
            <p className="text-xs font-black text-white/70 uppercase tracking-widest mb-2">
              {bn ? 'পেমেন্ট রিসিট' : 'PAYMENT RECEIPT'}
            </p>
            <h2 className="text-4xl font-black tracking-tight mb-2">
              {bn ? '৳ ' : '৳'} {(receipt.totalPaid || 0).toLocaleString(bn ? 'bn-BD' : 'en-IN')}
            </h2>
            <p className="text-sm font-bold text-white/90">
              {isPaid ? (bn ? 'পূর্ণ পেমেন্ট সম্পন্ন হয়েছে' : 'Full payment confirmed') : (bn ? 'আংশিক পেমেন্ট রেকর্ড করা হয়েছে' : 'Partial payment recorded')}
            </p>
          </div>
          <div className="text-right w-1/3 max-w-[30%]">
            <h1 className="text-2xl font-black mb-1">TO-LET PRO</h1>
            <p className="text-sm text-white/70 font-medium">{bn ? 'পেমেন্ট রিসিট' : 'Payment Receipt'}</p>
            <p className="text-xs text-white/70 mt-4 font-mono break-all">{bn ? 'আইডি:' : 'ID:'} {receipt.id}</p>
            <p className="text-xs text-white/70 font-mono">{bn ? 'তারিখ:' : 'Date:'} {receipt.date}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-8">
        {/* Left Col: Property & Image */}
        <div className="w-1/2 flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-black text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <MapPin size={18} className="text-[#ba0036]" /> {bn ? 'প্রপার্টি' : 'Property Details'}
            </h3>
            <p className="text-xl font-black text-gray-800 leading-tight mb-4 break-words">
              {receipt.propertyTitle}
            </p>
            {/* Big Property Image */}
            {receipt.propertyImage ? (
              <div className="w-full h-48 rounded-2xl overflow-hidden shadow-md">
                <img src={receipt.propertyImage} alt="Property" className="w-full h-full object-cover" crossOrigin="anonymous" />
              </div>
            ) : (
              <div className="w-full h-48 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 font-medium">
                {bn ? 'কোনো ছবি নেই' : 'No image available'}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-black text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <Phone size={18} className="text-[#ba0036]" /> {bn ? 'ল্যান্ডলর্ড' : 'Landlord'}
            </h3>
            <p className="text-base font-bold text-gray-800">{receipt.landlordName || 'N/A'}</p>
            <p className="text-sm font-medium text-gray-600 mt-1">{receipt.landlordPhone || 'N/A'}</p>
          </div>
        </div>

        {/* Right Col: Breakdown */}
        <div className="w-1/2 flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-black text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <Calendar size={18} className="text-[#ba0036]" /> {bn ? 'পেমেন্ট ইনফো' : 'Payment Summary'}
            </h3>
            
            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">{bn ? 'মাস' : 'Billing Month'}</span>
                <span className="text-base font-black text-gray-900">{receipt.monthLabel || receipt.monthKey}</span>
              </div>
              
              {(receipt.monthlyRent > 0 || receipt.serviceCharge > 0) && <hr className="border-gray-200" />}

              {receipt.monthlyRent > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-500">{bn ? 'বেস ভাড়া' : 'Base Rent'}</span>
                  <span className="text-sm font-black text-gray-700">৳ {(receipt.monthlyRent || 0).toLocaleString(bn ? 'bn-BD' : 'en-IN')}</span>
                </div>
              )}
              
              {receipt.serviceCharge > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-500">{bn ? 'সার্ভিস চার্জ' : 'Service Charge'}</span>
                  <span className="text-sm font-black text-gray-700">৳ {(receipt.serviceCharge || 0).toLocaleString(bn ? 'bn-BD' : 'en-IN')}</span>
                </div>
              )}

              <hr className="border-gray-200" />

              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600">{bn ? 'মোট বিল' : 'Total Bill'}</span>
                <span className="text-base font-black text-gray-900">৳ {(receipt.totalDue || 0).toLocaleString(bn ? 'bn-BD' : 'en-IN')}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600">{bn ? 'মোট পেমেন্ট' : 'Total Paid'}</span>
                <span className="text-base font-black text-green-600">৳ {(receipt.totalPaid || 0).toLocaleString(bn ? 'bn-BD' : 'en-IN')}</span>
              </div>

              <hr className="border-gray-200 border-dashed" />

              <div className="flex justify-between items-center">
                <span className="text-base font-black text-gray-900">{bn ? 'বর্তমান বাকি' : 'Balance Due'}</span>
                <span className={`text-lg font-black ${receipt.balance > 0 ? 'text-[#ba0036]' : 'text-green-600'}`}>
                  {receipt.balance > 0 ? `৳ ${receipt.balance.toLocaleString(bn ? 'bn-BD' : 'en-IN')}` : (bn ? 'ক্লিয়ার' : 'Clean / Paid')}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-black text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <Hash size={18} className="text-[#ba0036]" /> {bn ? 'পেমেন্ট মেথড' : 'Method'}
            </h3>
            <p className="text-base font-bold text-gray-800 capitalize">{receipt.method || (bn ? 'ক্যাশ / ম্যানুয়াল' : 'Cash / Manual')}</p>
            {receipt.txnId && <p className="text-sm font-medium text-gray-600 mt-1">{bn ? 'ট্রানজেকশন আইডি:' : 'Txn ID:'} {receipt.txnId}</p>}
          </div>

        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200 text-center">
        <p className="text-xs font-medium text-gray-400">
          {bn ? 'TO-LET PRO সিস্টেম দ্বারা স্বয়ংক্রিয়ভাবে জেনারেট করা একটি বৈধ রিসিট।' : 'Generated automatically by TO-LET PRO system. This is a valid digital receipt.'}
        </p>
      </div>
    </div>
  );
});

export default PdfReceiptTemplate;
