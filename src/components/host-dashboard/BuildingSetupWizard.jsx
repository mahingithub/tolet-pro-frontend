/*
 * BuildingSetupWizard.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Creating a building, in the order the landlord actually thinks about it:
 *
 *   1  Name + address
 *   2  Residential or Commercial
 *   3  Which residential type   (Flat · Hostel · Single Room)
 *   4  Let by room or by seat   (hostel / single room only)
 *   5  Default rent terms       (so rooms don't ask for them one by one)
 *
 * WHY THE TYPE MATTERS HERE AND NOWHERE ELSE
 * `rentedAs` is decided once, at creation, and it LOCKS the building: a seat
 * building only ever opens the seat flow. That is what stops a hostel owner
 * accidentally creating a whole-room tenancy over a room that already holds
 * four seats. It is deliberately not editable afterwards — flipping it would
 * orphan every seat already let.
 *
 * Family vs bachelor is NOT asked here. It is a property of each FLAT, chosen
 * when the flat is added, because one building routinely holds some of each.
 */

import React, { useState } from 'react';
import {
  Building2, Home, Users, BedDouble, ArrowLeft, ArrowRight, Check,
  MapPin, Loader2, X, Store,
} from 'lucide-react';
import { RESIDENTIAL_TYPES } from '../../utils/buildingTypes';
import { createBuilding } from '../../services/buildingService';
import { submitOnEnter } from '../../utils/submitOnEnter';
import ModalPortal from '../shared/ModalPortal.jsx';

const TYPE_ICONS = {
  flat:        Home,
  hostel:      BedDouble,
  single_room: Building2,
};

export default function BuildingSetupWizard({
  language,
  onCreated,          // (building) => void
  onCancel,
  showToast,
  // A landlord with no buildings at all can't dismiss this — it is the one
  // thing standing between them and an unusable dashboard.
  dismissible = true,
}) {
  const isBn = language === 'বাংলা';
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    category: 'residential',
    subCategory: 'flat',
    rentedAs: 'flat',
    defaultMonthlyRent: '',
    defaultServiceCharge: '',
    defaultRentDueDay: 5,
    defaultSeatCapacity: 1,
  });


  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const type = RESIDENTIAL_TYPES.find((t) => t.id === form.subCategory) || null;
  const isCommercial = form.category === 'commercial';
  // The seat/room question only exists for types that can be subdivided, so the
  // wizard is 4 steps for a flat and 5 for a hostel.
  const showRentedAsStep = !isCommercial && !!type?.canChooseRentedAs;
  const lastStep = showRentedAsStep ? 5 : 4;

  const labelCls = 'text-[10px] font-black text-gray-400 uppercase tracking-widest';
  const inputCls = 'w-full mt-1.5 p-3.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:shadow-[0_4px_15px_rgba(186,0,54,0.08)] border border-transparent focus:border-[#ba0036]/20 transition-all';

  // Step 2 is skipped for commercial (there is no residential type to pick) and
  // step 4 for whole-unit lets. `dir` keeps that logic in one place.
  const go = (dir) => {
    let next = step + dir;
    if (isCommercial && next === 3) next = dir > 0 ? 4 : 2;
    if (!showRentedAsStep && next === 4 && dir > 0) next = 5;
    if (!showRentedAsStep && next === 4 && dir < 0) next = 3;
    setStep(Math.max(1, Math.min(lastStep === 4 ? 5 : 5, next)));
  };

  const canAdvance = () => {
    if (step === 1) return !!form.name.trim();
    return true;
  };

  const submit = async () => {
    if (!form.name.trim()) { setStep(1); return; }
    setSaving(true);
    try {
      const building = await createBuilding({
        name: form.name.trim(),
        address: form.address.trim(),
        category: form.category,
        subCategory: isCommercial ? '' : form.subCategory,
        // Flats are always let whole; the server pins this too, but sending the
        // resolved value keeps the request honest about what was chosen.
        rentedAs: isCommercial ? 'flat' : (type?.canChooseRentedAs ? form.rentedAs : (type?.rentedAs || 'flat')),
        defaultMonthlyRent: Number(form.defaultMonthlyRent) || 0,
        defaultServiceCharge: Number(form.defaultServiceCharge) || 0,
        defaultRentDueDay: Number(form.defaultRentDueDay) || 5,
        defaultSeatCapacity: Number(form.defaultSeatCapacity) || 1,
      });

      onCreated?.(building);
    } catch (err) {
      showToast?.(err.message || (isBn ? 'বিল্ডিং তৈরি ব্যর্থ' : 'Could not create the building'));
    } finally {
      setSaving(false);
    }
  };

  const Choice = ({ active, onClick, Icon, title, hint }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.99] ${
        active ? 'border-[#ba0036] bg-red-50/70 shadow-[0_4px_14px_rgba(186,0,54,0.12)]' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-[#ba0036] text-white' : 'bg-gray-100 text-gray-500'}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-black leading-tight ${active ? 'text-[#ba0036]' : 'text-gray-900'}`}>{title}</p>
        <p className="text-[11px] font-bold text-gray-500 leading-tight mt-0.5">{hint}</p>
      </div>
      {active && <Check size={17} strokeWidth={3.5} className="text-[#ba0036] shrink-0" />}
    </button>
  );

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto"
        onKeyDown={submitOnEnter(
          () => (step < 5 ? (canAdvance() && go(1)) : submit()),
          { enabled: !saving },
        )}
      >
        <div className="p-5 sm:p-6">

          <div className="flex items-start gap-2 mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-gray-900 leading-tight">
                {isBn ? 'নতুন বিল্ডিং' : 'New Building'}
              </h2>
              <p className="text-[11px] font-bold text-gray-500 mt-0.5">
                {isBn ? `ধাপ ${step === 5 ? lastStep : (isCommercial && step > 2 ? step - 1 : step)}/${lastStep}` : `Step ${step === 5 ? lastStep : (isCommercial && step > 2 ? step - 1 : step)} of ${lastStep}`}
              </p>
            </div>
            {dismissible && (
              <button type="button" onClick={onCancel} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                <X size={17} />
              </button>
            )}
          </div>

          {/* ── 1 · Identity ── */}
          {step === 1 && (
            <div className="space-y-3.5 animate-in fade-in slide-in-from-right-2 duration-200">
              <div>
                <label className={labelCls}>{isBn ? 'বিল্ডিং / বাসার নাম' : 'Building / House Name'}</label>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder={isBn ? 'যেমন: স্কাই ভিউ টাওয়ার' : 'e.g. Sky View Tower'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`${labelCls} flex items-center gap-1`}>
                  <MapPin size={11} className="text-[#ba0036]" /> {isBn ? 'ঠিকানা' : 'Address'}
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                  placeholder={isBn ? 'যেমন: মিরপুর ১০, ঢাকা' : 'e.g. Mirpur 10, Dhaka'}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* ── 2 · Residential or commercial ── */}
          {step === 2 && (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-right-2 duration-200">
              <p className="text-[11px] font-bold text-gray-500 leading-relaxed mb-1">
                {isBn ? 'এই বিল্ডিংটি কী ধরনের?' : 'What kind of building is this?'}
              </p>
              <Choice
                active={form.category === 'residential'}
                onClick={() => set({ category: 'residential' })}
                Icon={Home}
                title={isBn ? 'আবাসিক' : 'Residential'}
                hint={isBn ? 'ফ্ল্যাট, হোস্টেল, সিঙ্গেল রুম' : 'Flats, hostel, single rooms'}
              />
              <Choice
                active={form.category === 'commercial'}
                onClick={() => set({ category: 'commercial' })}
                Icon={Store}
                title={isBn ? 'কমার্শিয়াল' : 'Commercial'}
                hint={isBn ? 'দোকান, অফিস' : 'Shops, offices'}
              />
              {isCommercial && (
                <p className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100 rounded-xl p-2.5 leading-relaxed">
                  {isBn
                    ? 'কমার্শিয়াল বিল্ডিং এখন পুরো ইউনিট হিসেবেই ভাড়া হবে — আলাদা কমার্শিয়াল ফরম পরে যোগ হবে।'
                    : 'Commercial buildings are let as whole units for now — the dedicated commercial form comes later.'}
                </p>
              )}
            </div>
          )}

          {/* ── 3 · Residential type (the four) ── */}
          {step === 3 && !isCommercial && (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-right-2 duration-200">
              <p className="text-[11px] font-bold text-gray-500 leading-relaxed mb-1">
                {isBn ? 'কোন ধরনের আবাসিক বিল্ডিং?' : 'Which kind of residential building?'}
              </p>
              {RESIDENTIAL_TYPES.map((t) => (
                <Choice
                  key={t.id}
                  active={form.subCategory === t.id}
                  onClick={() => set({ subCategory: t.id, rentedAs: t.rentedAs })}
                  Icon={TYPE_ICONS[t.id] || Home}
                  title={isBn ? t.bn : t.en}
                  hint={isBn ? t.hintBn : t.hintEn}
                />
              ))}
              <p className="text-[10px] font-bold text-gray-400 leading-relaxed pt-1">
                {isBn
                  ? 'ফ্ল্যাট বাছলে প্রতিটি ফ্ল্যাট তৈরির সময় ঠিক করবেন সেটি ফ্যামিলি, ব্যাচেলর নাকি উভয়ের জন্য।'
                  : 'With Flat, you choose Family / Bachelor / Both on each flat as you add it — one building can hold any mix.'}
              </p>
            </div>
          )}

          {/* ── 4 · Room or seat (subdividable types only) ── */}
          {step === 4 && showRentedAsStep && (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-right-2 duration-200">
              <p className="text-[11px] font-bold text-gray-500 leading-relaxed mb-1">
                {isBn ? 'ভাড়া কীভাবে দেন?' : 'How do you let it out?'}
              </p>
              <Choice
                active={form.rentedAs === 'seat'}
                onClick={() => set({ rentedAs: 'seat' })}
                Icon={Users}
                title={isBn ? 'সিট হিসেবে' : 'By seat'}
                hint={isBn ? 'এক রুমে কয়েকজন — প্রত্যেকের আলাদা ভাড়া ও লেজার' : 'Several people per room, each with their own rent and ledger'}
              />
              <Choice
                active={form.rentedAs === 'room'}
                onClick={() => set({ rentedAs: 'room' })}
                Icon={BedDouble}
                title={isBn ? 'পুরো রুম হিসেবে' : 'By whole room'}
                hint={isBn ? 'এক রুম = এক ভাড়াটিয়া' : 'One room, one tenant'}
              />
              <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2.5 leading-relaxed">
                {isBn
                  ? 'এটি পরে বদলানো যাবে না — সিট ভাড়া দেওয়া রুমগুলো তখন অকেজো হয়ে যেত। এই বিল্ডিংয়ে শুধু এই ফরমটিই খুলবে।'
                  : 'This can’t be changed later — it would orphan seats already let. This building will only ever open this one form.'}
              </p>
            </div>
          )}

          {/* ── 5 · Default terms ── */}
          {step === 5 && (
            <div className="space-y-3.5 animate-in fade-in slide-in-from-right-2 duration-200">
              <p className="text-[11px] font-bold text-gray-500 leading-relaxed">
                {isBn
                  ? 'প্রতিটি রুম এই হিসাব পাবে — রুম তৈরির সময় আলাদা করে বদলানো যাবে। এখন খালি রাখলেও চলবে।'
                  : 'Every room inherits these, and can override them. Leave blank if you’d rather set them per room.'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isBn ? 'ডিফল্ট ভাড়া (৳)' : 'Default Rent (৳)'}</label>
                  <input type="number" min="0" value={form.defaultMonthlyRent} onChange={(e) => set({ defaultMonthlyRent: e.target.value })} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{isBn ? 'সার্ভিস চার্জ (৳)' : 'Service Charge (৳)'}</label>
                  <input type="number" min="0" value={form.defaultServiceCharge} onChange={(e) => set({ defaultServiceCharge: e.target.value })} placeholder="0" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isBn ? 'প্রতি মাসের কত তারিখে ভাড়া?' : 'Rent Due Day'}</label>
                  <input type="number" min="1" max="28" value={form.defaultRentDueDay} onChange={(e) => set({ defaultRentDueDay: e.target.value })} className={inputCls} />
                </div>
                {form.rentedAs === 'seat' && (
                  <div>
                    <label className={labelCls}>{isBn ? 'রুম প্রতি ডিফল্ট সিট সংখ্যা' : 'Default Seats/Room'}</label>
                    <input type="number" min="1" max="60" value={form.defaultSeatCapacity} onChange={(e) => set({ defaultSeatCapacity: e.target.value })} className={inputCls} />
                  </div>
                )}
              </div>

              {/* What is about to be created, in one line. */}
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{isBn ? 'সারাংশ' : 'Summary'}</p>
                <p className="text-xs font-black text-gray-900 leading-relaxed">
                  {form.name || (isBn ? '(নাম নেই)' : '(no name)')}
                  {' · '}
                  {isCommercial
                    ? (isBn ? 'কমার্শিয়াল' : 'Commercial')
                    : (isBn ? (type?.bn || '') : (type?.en || ''))}
                  {!isCommercial && type?.canChooseRentedAs && (
                    <> · {form.rentedAs === 'seat' ? (isBn ? 'সিট ভিত্তিক' : 'by seat') : (isBn ? 'রুম ভিত্তিক' : 'by room')}</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* ── Nav ── */}
          <div className="pt-4 flex items-center gap-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => go(-1)}
                className="shrink-0 px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft size={15} /> {isBn ? 'পিছনে' : 'Back'}
              </button>
            ) : <span className="flex-1" />}

            {step < 5 ? (
              <button
                type="button"
                disabled={!canAdvance()}
                onClick={() => go(1)}
                className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-black shadow-[0_8px_15px_rgba(0,0,0,0.15)] hover:bg-black active:scale-[0.99] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBn ? 'পরবর্তী' : 'Next'} <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="flex-1 bg-[#ba0036] text-white py-3 rounded-xl font-black shadow-[0_8px_15px_rgba(186,0,54,0.25)] hover:bg-[#a0002f] active:scale-[0.99] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> {isBn ? 'তৈরি হচ্ছে' : 'Creating'}</>
                  : <><Check size={17} strokeWidth={3} /> {isBn ? 'বিল্ডিং তৈরি করুন' : 'Create Building'}</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
