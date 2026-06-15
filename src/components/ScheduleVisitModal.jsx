import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ScheduleVisitModal({ inquiry, onClose, onSchedule }) {
  const { language } = useAuth();
  const [form, setForm] = useState({
    scheduledDate: '',
    scheduledTime: '',
    location: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.scheduledDate || !form.scheduledTime) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/visit-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          ...form
        })
      });
      
      if (!res.ok) throw new Error('Failed to schedule visit');
      
      const data = await res.json();
      onSchedule(data.schedule);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-[2rem] w-full max-w-md relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} />
            {language === 'বাংলা' ? 'ভিজিট শিডিউল করুন' : 'Schedule Visit'}
          </h2>
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="mb-6 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{language === 'বাংলা' ? 'ভাড়াটিয়া' : 'Tenant'}</p>
            <p className="text-sm font-bold text-gray-900">{inquiry.user}</p>
            <p className="text-xs font-bold text-gray-500 mt-0.5">{inquiry.propTitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <Calendar size={14} /> {language === 'বাংলা' ? 'তারিখ' : 'Date'}
              </label>
              <input 
                type="date" 
                required
                value={form.scheduledDate}
                onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <Clock size={14} /> {language === 'বাংলা' ? 'সময়' : 'Time'}
              </label>
              <input 
                type="time" 
                required
                value={form.scheduledTime}
                onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <MapPin size={14} /> {language === 'বাংলা' ? 'ঠিকানা/লোকেশন' : 'Location'}
              </label>
              <input 
                type="text" 
                placeholder={language === 'বাংলা' ? 'যেমন: প্রপার্টির ঠিকানা' : 'e.g. Property Address'}
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(37,99,235,0.08)] border border-transparent focus:border-blue-500/20 transition-all"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white py-4 rounded-xl font-black text-sm shadow-[0_8px_15px_rgba(37,99,235,0.2)] hover:-translate-y-0.5 transition-all"
            >
              {loading ? '...' : (language === 'বাংলা' ? 'শিডিউল সেভ করুন' : 'Confirm Schedule')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
