import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Send, Inbox, Eye, MessageCircle, CheckCircle2, Building2, MapPin, 
  Hourglass, ThumbsUp, ThumbsDown, ChevronDown, Clock, Trash2, 
  RefreshCw, Phone, Share2, MessageSquare 
} from 'lucide-react';
import InquiryStatusTimeline from '../InquiryStatusTimeline';
import { isInquiryUnread, markInquirySeen } from '../../utils/inquiryUnread';

const ApplicationsTab = ({
  myInquiries,
  expandedInquiryId,
  setExpandedInquiryId,
  inqSeen,
  setInqSeen,
  language,
  handleDeleteInquiry,
  deletingInquiryId,
  handleShareProperty,
  navigate,
  toast,
  openInquiry
}) => {
  // Each stage has an `en` (short pill label), `sub` (one-line
  // explainer shown under the active stage), and a Bengali parity.
  const stages = [
    { id: 'sent',      icon: Send,          en: 'Sent',       bn: 'পাঠানো',         subEn: 'Inquiry on its way',      subBn: 'ইনকোয়ারি যাচ্ছে' },
    { id: 'delivered', icon: Inbox,         en: 'Delivered',  bn: 'পৌঁছেছে',         subEn: 'Landlord notified',       subBn: 'মালিককে জানানো হয়েছে' },
    { id: 'viewed',    icon: Eye,           en: 'Viewed',     bn: 'দেখেছেন',         subEn: 'Landlord opened it',      subBn: 'মালিক দেখেছেন' },
    { id: 'replied',   icon: MessageCircle, en: 'Replied',    bn: 'রিপ্লাই',          subEn: 'Conversation started',    subBn: 'কথা শুরু হয়েছে' },
    { id: 'decision',  icon: CheckCircle2,  en: 'Decision',   bn: 'সিদ্ধান্ত',        subEn: 'Tour or final answer',    subBn: 'ভিজিট অথবা চূড়ান্ত উত্তর' },
  ];
  // Map the backend Inquiry record onto the 5-stage UI:
  const stageOf = (status) => {
    switch (status) {
      case 'delivered': return 1;
      case 'viewed':    return 2;
      case 'replied':   return 3;
      case 'accepted':
      case 'rejected':  return 4;
      case 'sent':
      default:          return 0;
    }
  };
  const outcomeOf = (status) => {
    if (status === 'accepted') return 'approved';
    if (status === 'rejected') return 'declined';
    return 'pending';
  };
  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return '—'; }
  };
  const relTime = (iso) => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 'just now';
    const m = Math.floor(ms / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  };
  const sampleApps = myInquiries.map((inq) => ({
    id:            inq.id || inq._id,
    propertyId:    inq.propertyId,
    landlordId:    inq.propertyOwnerId || inq.landlordId || inq.ownerUserId || inq.receiverId,
    landlordPhone: inq.landlordPhone || inq.ownerPhone || '',
    landlordName:  inq.landlordName || inq.ownerName || '',
    landlordAvatar: inq.landlordAvatar || inq.ownerAvatar || '',
    title:         inq.propTitle || 'Property',
    location:      inq.propLocation || '',
    price:         (inq.propPrice ?? '') === '' ? '' : Number(inq.propPrice).toLocaleString('en-IN'),
    msg:           inq.msg || '',
    stageIdx:      stageOf(inq.status),
    outcome:       outcomeOf(inq.status),
    sentAt:        fmtDate(inq.createdAt),
    lastUpdate:    relTime(inq.updatedAt || inq.createdAt),
    // Raw timestamps drive the "unread until opened" highlight: the card
    // stays flagged while updatedAt (landlord activity) is newer than the
    // signature the tenant last saw.
    createdAt:     inq.createdAt,
    updatedAt:     inq.updatedAt,
    img:           inq.propCover || '',
  }));
  if (sampleApps.length === 0) {
    return (
      <div className="text-center py-24 bg-white/40 backdrop-blur-md rounded-[3rem] border border-white shadow-sm flex flex-col items-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
          <Inbox className="text-emerald-400" size={36} />
        </div>
        <h3 className="text-xl font-black text-gray-500 mb-2">
          {language === 'বাংলা' ? 'কোনো ইনকোয়ারি নেই' : 'No inquiries yet'}
        </h3>
        <p className="text-sm font-bold text-gray-400 mb-6 max-w-md">
          {language === 'বাংলা'
            ? 'কোনো প্রপার্টিতে ইনকোয়ারি পাঠালে সেটার স্ট্যাটাস এখানে দেখাবে।'
            : 'When you inquire about a property, it will appear here with live status.'}
        </p>
        <Link to="/properties/all" className="bg-gradient-to-r from-[#ba0036] to-[#d11147] text-white px-8 py-3 rounded-xl text-sm font-black active:scale-95 transition-transform shadow-[0_8px_20px_rgba(186,0,54,0.25)] hover:shadow-[0_12px_30px_rgba(186,0,54,0.4)]">
          {language === 'বাংলা' ? 'প্রপার্টি ব্রাউজ করুন' : 'Browse properties'}
        </Link>
      </div>
    );
  }
  return (
    <div className="animate-in fade-in duration-500 space-y-4 md:space-y-5">
      {/* Counts strip — compact tiles */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4 mb-1">
        {[
          { en: 'Total',     bn: 'মোট',       count: sampleApps.length,                                 cls: 'bg-gray-50 text-gray-700 border-gray-100' },
          { en: 'In review', bn: 'রিভিউ',    count: sampleApps.filter((a) => a.outcome === 'pending').length, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
          { en: 'Approved',  bn: 'অ্যাপ্রুভড', count: sampleApps.filter((a) => a.outcome === 'approved').length, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
          { en: 'Declined',  bn: 'বাতিল',    count: sampleApps.filter((a) => a.outcome === 'declined').length, cls: 'hidden md:flex bg-red-50 text-red-700 border-red-100' },
        ].map((s, i) => (
          <div key={i} className={`px-3 py-2.5 md:p-4 rounded-xl md:rounded-2xl border flex flex-col gap-0.5 ${s.cls}`}>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">{language === 'বাংলা' ? s.bn : s.en}</span>
            <span className="text-lg md:text-3xl font-black tabular-nums leading-none">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Inquiry cards — compact by default (thumbnail · property ·
          landlord · status). Tap a card to reveal its full status
          timeline + your message + actions, so several inquiries fit on
          one mobile screen without endless scrolling. */}
      {sampleApps.map((app) => {
        const isOpen = expandedInquiryId === app.id;
        // Highlight until opened — the landlord acted (accept / reply / visit) since the tenant last looked.
        const unread = isInquiryUnread(app, 'tenant', inqSeen);
        const openApp = () => {
          const opening = !isOpen;
          setExpandedInquiryId(isOpen ? null : app.id);
          if (opening) setInqSeen((prev) => markInquirySeen('tenant', app, prev));
        };
        const lordName = app.landlordName || (language === 'বাংলা' ? 'বাড়িওয়ালা' : 'Landlord');
        const lordInit = (lordName.trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('') || 'L').toUpperCase();
        const outCls = app.outcome === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : app.outcome === 'declined' ? 'bg-red-50 text-red-700 border-red-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';
        const outLabel = app.outcome === 'approved' ? (language === 'বাংলা' ? 'অ্যাপ্রুভড' : 'Approved')
          : app.outcome === 'declined' ? (language === 'বাংলা' ? 'বাতিল' : 'Declined')
          : (language === 'বাংলা' ? 'রিভিউ' : 'In review');
        const OutIcon = app.outcome === 'approved' ? ThumbsUp : app.outcome === 'declined' ? ThumbsDown : Hourglass;
        return (
          <div id={`application-${app.id}`} key={app.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${isOpen ? 'border-[#ba0036]/20 shadow-[0_8px_28px_rgba(0,0,0,0.07)]' : 'border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)]'} ${unread ? 'ring-2 ring-[#ba0036]/40' : ''}`}>

            {/* Compact header — always visible, tap to expand */}
            <button
              type="button"
              onClick={openApp}
              className={`w-full flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 text-left ${unread ? 'bg-[#ba0036]/[0.035]' : ''}`}
            >
              {/* Property thumbnail */}
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gray-100 shrink-0 overflow-hidden relative">
                {app.img ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${app.img})` }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300"><Building2 size={20} strokeWidth={1.5} /></div>
                )}
              </div>

              {/* Property + price + landlord */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] md:text-sm font-black text-gray-900 truncate leading-tight">{app.title}</h4>
                <p className="text-[10px] md:text-[11px] font-bold text-gray-500 truncate flex items-center gap-1 mt-0.5">
                  {app.location ? (<><MapPin size={10} className="text-gray-400 shrink-0" /> <span className="truncate">{app.location}</span></>) : null}
                  {app.price ? (<><span className="text-gray-300">·</span> <span className="tabular-nums shrink-0">৳{app.price}</span></>) : null}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {app.landlordAvatar ? (
                    <img src={app.landlordAvatar} alt={lordName} className="w-4 h-4 md:w-5 md:h-5 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#ba0036]/10 text-[#ba0036] text-[7px] md:text-[8px] font-black flex items-center justify-center shrink-0">{lordInit}</span>
                  )}
                  <span className="text-[10px] md:text-[11px] font-bold text-gray-600 truncate">{lordName}</span>
                </div>
              </div>

              {/* Status pill + chevron (with unread dot) */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider border ${outCls}`}>
                  <OutIcon size={10} /> {outLabel}
                </span>
                <div className="flex items-center gap-1.5">
                  {unread && (
                    <span className="flex h-2.5 w-2.5 relative" aria-label={language === 'বাংলা' ? 'নতুন / দেখা হয়নি' : 'Unread'} title={language === 'বাংলা' ? 'নতুন / দেখা হয়নি' : 'Unread'}>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba0036] opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba0036]" />
                    </span>
                  )}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            {/* Expanded body — full status + message + actions */}
            {isOpen && (
              <div className="border-t border-gray-100 p-3 md:p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                    <Clock size={11} className="text-gray-400" /> {language === 'বাংলা' ? 'পাঠানো:' : 'Sent:'} {app.sentAt}
                  </p>
                  <button
                    onClick={() => handleDeleteInquiry(app)}
                    disabled={deletingInquiryId === app.id}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {deletingInquiryId === app.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    {language === 'বাংলা' ? 'মুছুন' : 'Withdraw'}
                  </button>
                </div>

                <InquiryStatusTimeline
                  inquiry={myInquiries.find((i) => String(i.id || i._id) === String(app.id))}
                  onCancelVisit={() => handleDeleteInquiry(app)}
                />

                {app.msg ? (
                  <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{language === 'বাংলা' ? 'আপনার মেসেজ' : 'Your message'}</p>
                    <p className="text-[12px] font-semibold text-gray-600 line-clamp-2">{app.msg}</p>
                  </div>
                ) : null}

                {/* Actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {app.landlordPhone ? (
                      <a href={`tel:${app.landlordPhone}`} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2.5 rounded-xl text-[11px] font-black active:scale-95 transition-all flex items-center justify-center gap-1.5">
                        <Phone size={13} /> {language === 'বাংলা' ? 'কল' : 'Call'}
                      </a>
                    ) : null}
                    <button onClick={() => handleShareProperty(app)} className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 py-2.5 rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5">
                      <Share2 size={13} /> {language === 'বাংলা' ? 'শেয়ার' : 'Share'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const pid = app.propertyId;
                        if (!pid) { toast.error(language === 'বাংলা' ? 'এই ইনকোয়ারির প্রপার্টি আইডি পাওয়া যায়নি' : 'Property ID not found for this inquiry'); return; }
                        navigate(`/property/${pid}`);
                      }}
                      className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2.5 rounded-xl text-[11px] font-bold transition-all border border-gray-200 active:scale-95"
                    >
                      {language === 'বাংলা' ? 'প্রপার্টি' : 'Property'}
                    </button>
                    <button onClick={() => openInquiry(app)} className="flex-1 bg-white text-[#ba0036] border border-[#ba0036]/20 hover:bg-[#ba0036] hover:text-white hover:border-[#ba0036] py-2.5 rounded-xl text-[11px] font-black active:scale-95 transition-all flex items-center justify-center gap-1.5">
                      <MessageCircle size={13} /> {language === 'বাংলা' ? 'রি-ইনকোয়ারি' : 'Re-inquire'}
                    </button>
                    <button
                      onClick={() => {
                        if (!app.landlordId) { toast.error('Unable to open chat. Landlord info missing.'); return; }
                        navigate('/messages', { state: { peerUserId: app.landlordId, propertyId: app.propertyId } });
                      }}
                      className="flex-1 bg-gradient-to-r from-[#ba0036] to-[#d11147] text-white py-2.5 rounded-xl text-[11px] font-black shadow-[0_6px_18px_rgba(186,0,54,0.25)] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare size={13} /> {language === 'বাংলা' ? 'চ্যাট' : 'Chat'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Live data — refreshes automatically every 30 seconds. */}
    </div>
  );
};

export default ApplicationsTab;
