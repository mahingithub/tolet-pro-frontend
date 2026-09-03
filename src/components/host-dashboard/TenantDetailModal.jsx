/*
 * TenantDetailModal.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Reading back what was collected.
 *
 * WHY THIS EXISTS
 * The intake form captures eleven fields and a photo, and until now there was
 * nowhere in the host dashboard to see any of them again. A landlord would type
 * a father's name, an NID and an emergency contact, and the record would
 * effectively disappear — which makes the whole form pointless, because the one
 * moment those details matter is the moment something has gone wrong and you
 * need to reach somebody.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * Blank fields are shown as blank, not hidden and not nagged about. "No NID" is
 * a complete answer under the আছে/নেই rule, so an empty row here means the
 * question was answered, not that something is missing.
 */

import React from 'react';
import {
  X, Phone, Calendar, MapPin, Briefcase, IdCard, PhoneCall, User, Pencil, Download,
} from 'lucide-react';
import {
  tenantTypeLabel, tenantTypeById, GOVT_ID_TYPES, MARITAL_STATUSES, HAS_STATUS,
} from '../../utils/tenantFields';
import ModalPortal from '../shared/ModalPortal.jsx';

const fmtDate = (iso, isBn) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function TenantDetailModal({
  tenant,          // { name, phone, tenantProfile, seatLabel, moveInDate }
  unit,
  building,
  language,
  onClose,
  onEdit,          // optional — corrects THIS record (name, NID, emergency…)
  onDownload,      // optional — the tenant information form, as a file
}) {
  const isBn = language === 'বাংলা';
  const p = tenant?.tenantProfile || {};
  const type = tenantTypeById(p.tenantType);

  // One row. An empty value renders as a dash rather than vanishing, so the
  // reader can tell "not collected" from "not displayed".
  const Row = ({ label, value, Icon }) => (
    <div className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
      {Icon && <Icon size={13} className="text-gray-300 shrink-0 mt-0.5" />}
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-32 shrink-0 leading-relaxed">{label}</span>
      <span className="text-xs font-bold text-gray-900 flex-1 min-w-0 break-words leading-relaxed">
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  );

  const Section = ({ title, children }) => (
    <div className="rounded-2xl border border-gray-100 bg-white p-3.5">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
      {children}
    </div>
  );

  const marital = MARITAL_STATUSES.find((m) => m.id === p.maritalStatus);
  const govtType = GOVT_ID_TYPES.find((g) => g.id === p.govtIdType);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="p-5 sm:p-6 space-y-3">

          {/* Identity header — the landlord's intake photo when there is one,
              or the linked account's avatar once the tenant has joined. */}
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-gray-300">
              {p.photoUrl || tenant?.avatar
                ? <img src={p.photoUrl || tenant.avatar} alt={tenant?.name || ''} className="w-full h-full object-cover" />
                : <User size={22} />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-gray-900 leading-tight truncate">
                {tenant?.name || (isBn ? 'নামহীন' : 'Unnamed')}
              </h2>
              <p className="text-[11px] font-bold text-gray-500 mt-0.5 truncate">
                {building?.name}
                {unit?.roomNumber && <> · {unit.roomNumber}</>}
                {tenant?.seatLabel && <> · {tenant.seatLabel}</>}
              </p>
              {p.tenantType && (
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-wider">
                  {tenantTypeLabel(p, isBn)}
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              <X size={17} />
            </button>
          </div>

          <Section title={isBn ? 'যোগাযোগ' : 'Contact'}>
            <Row label={isBn ? 'মোবাইল' : 'Mobile'} value={tenant?.phone} Icon={Phone} />
            <Row label={isBn ? 'মুভ-ইন' : 'Move-in'} value={fmtDate(tenant?.moveInDate || tenant?.joinDate, isBn)} Icon={Calendar} />
            <Row label={isBn ? 'স্থায়ী ঠিকানা' : 'Permanent address'} value={p.permanentAddress} Icon={MapPin} />
          </Section>

          {/* Ownership has to be unmistakable here. With "Father's name" listed
              first, the date of birth and marital status underneath it read as
              the FATHER's — they are the tenant's. The tenant's own facts come
              first, and the father's name is labelled as the one borrowed
              field it is. */}
          <Section title={isBn ? 'ভাড়াটিয়ার ব্যক্তিগত তথ্য' : "Tenant's Personal Details"}>
            <Row label={isBn ? 'জন্ম তারিখ' : 'Date of birth'} value={fmtDate(p.dob, isBn)} />
            <Row label={isBn ? 'বৈবাহিক অবস্থা' : 'Marital status'} value={marital ? (isBn ? marital.bn : marital.en) : ''} />
            <Row label={isBn ? 'পিতার নাম' : "Father's name"} value={p.fatherName} />
          </Section>

          {/* Profession — the labels follow the tenant's own answer, so a
              shopkeeper's row reads "ব্যবসা", not "Institution". */}
          {p.tenantType && (
            <Section title={isBn ? 'পেশা' : 'Profession'}>
              <Row
                label={type ? (isBn ? type.orgLabel.bn : type.orgLabel.en) : (isBn ? 'প্রতিষ্ঠান' : 'Organization')}
                value={p.organization}
                Icon={Briefcase}
              />
              {type?.showDepartment && (
                <Row label={isBn ? 'ডিপার্টমেন্ট' : 'Department'} value={p.department} />
              )}
              <Row
                label={type ? (isBn ? type.idLabel.bn : type.idLabel.en) : (isBn ? 'আইডি' : 'ID')}
                // "নেই" is a real answer and is shown as one — an empty box
                // here would read as "we forgot to ask".
                value={p.professionalIdStatus === HAS_STATUS.NONE
                  ? <span className="text-gray-400 font-bold">{isBn ? 'নেই' : 'None'}</span>
                  : p.professionalIdNumber}
              />
            </Section>
          )}

          <Section title={isBn ? 'পরিচয়পত্র' : 'Identity Document'}>
            <Row
              label={isBn ? 'ধরন' : 'Type'}
              value={p.govtIdStatus === HAS_STATUS.NONE
                ? <span className="text-gray-400 font-bold">{isBn ? 'নেই' : 'None'}</span>
                : (govtType ? (isBn ? govtType.bn : govtType.en) : '')}
              Icon={IdCard}
            />
            {p.govtIdStatus === HAS_STATUS.HAS && (
              <Row label={isBn ? 'নম্বর' : 'Number'} value={p.govtIdNumber} />
            )}
          </Section>

          <Section title={isBn ? 'জরুরি যোগাযোগ' : 'Emergency Contact'}>
            <Row label={isBn ? 'নাম' : 'Name'} value={p.emergencyName} Icon={PhoneCall} />
            <Row label={isBn ? 'সম্পর্ক' : 'Relation'} value={p.emergencyRelation} />
            <Row label={isBn ? 'মোবাইল' : 'Mobile'} value={p.emergencyPhone} />
            <Row label={isBn ? 'ঠিকানা' : 'Address'} value={p.emergencyAddress} />
          </Section>

          {/* THIS CARD IS A READING SURFACE, and now a correcting one.
              Everything on it is about the person in front of you: ring them,
              fix what is wrong, or take the record away as a file.

              Move room and Replace used to sit here too, and they do not
              belong: both END this record — one moves the person out of the
              room the card is titled by, the other closes their tenancy
              altogether — and they sat one thumb-width from "Call" on a phone.
              They now live behind the "বদলান" button on the seat itself, which
              is the row the landlord touches when somebody is actually leaving.
              (See UnitsManager's seat menu.) */}
          <div className="flex items-center gap-2 pt-1">
            {tenant?.phone && (
              <a
                href={`tel:${tenant.phone}`}
                className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <Phone size={14} /> {isBn ? 'কল করুন' : 'Call'}
              </a>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="shrink-0 px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700 active:scale-95 transition-all inline-flex items-center gap-1.5"
                title={isBn ? 'এই ভাড়াটিয়ার তথ্য ঠিক করুন' : "Correct this tenant's details"}
              >
                <Pencil size={14} /> {isBn ? 'এডিট' : 'Edit'}
              </button>
            )}
            {/* One file, both devices. It is produced in the browser (jsPDF /
                CSV blob) and handed to whatever the device downloads with —
                the desktop's Downloads folder, the phone's own download
                handler — so there is nothing to install and no print dialog
                standing between the landlord and the paper. */}
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="shrink-0 px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:border-emerald-200 hover:text-emerald-700 active:scale-95 transition-all inline-flex items-center gap-1.5"
                title={isBn ? 'ভাড়াটিয়া তথ্য ফরম ডাউনলোড (PDF / Excel)' : 'Download the tenant information form (PDF / Excel)'}
              >
                <Download size={14} /> {isBn ? 'ডাউনলোড' : 'Download'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
