/**
 * SoloPeople — দেনা-পাওনা. Every friend gets a profile, and every টাকা that
 * moved between us sits under that profile with a date on it.
 *
 * This is the part that replaces the argument at the end of the month: instead
 * of "I think I gave you five hundred sometime", the ledger shows the row, the
 * day, and what the running balance is right now.
 */
import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Pencil, Phone, Trash2, UserPlus, Users } from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { dateLabel, taka } from './livingUtils';
import { getEntryType, PERSON_SWATCHES } from './soloConfig';
import { personDetail, personRows } from './soloUtils';
import {
  Avatar, Card, Chip, ConfirmDialog, EmptyState, Field, PrimaryButton,
  SectionHeader, Sheet, TextArea, TextInput, cx,
} from './livingUI';
import SoloEntrySheet from './SoloEntrySheet';

// ── add / edit a friend ──────────────────────────────────────────────────────
const PersonSheet = ({ open, onClose, isBn, editing, onSave }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PERSON_SWATCHES[0]);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name || '');
    setColor(editing?.color || PERSON_SWATCHES[Math.floor(Math.random() * PERSON_SWATCHES.length)]);
    setPhone(editing?.phone || '');
    setNote(editing?.note || '');
  }, [open, editing]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? (isBn ? 'প্রোফাইল এডিট' : 'Edit profile') : isBn ? 'বন্ধু যোগ করুন' : 'Add a friend'}
      subtitle={isBn ? 'যার সাথে টাকার লেনদেন হয়' : 'Someone you lend to or borrow from'}
      footer={
        <PrimaryButton className="w-full" disabled={!name.trim()} onClick={() => { onSave({ name: name.trim(), color, phone: phone.trim(), note: note.trim() }); onClose(); }}>
          <Check size={17} /> {editing ? (isBn ? 'সেভ করুন' : 'Save') : isBn ? 'যোগ করুন' : 'Add friend'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full font-black text-white shrink-0" style={{ width: 48, height: 48, background: color, fontSize: 18 }}>
            {(name.trim()[0] || '?').toUpperCase()}
          </span>
          <div className="flex-1">
            <Field label={isBn ? 'নাম' : 'Name'}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={isBn ? 'যেমন: রোমান' : 'e.g. Roman'} autoFocus />
            </Field>
          </div>
        </div>

        <Field label={isBn ? 'রঙ' : 'Colour'}>
          <div className="flex flex-wrap gap-2.5">
            {PERSON_SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={cx('w-8 h-8 rounded-full transition active:scale-90', color === c ? 'ring-2 ring-offset-2 ring-gray-900' : '')} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </Field>

        <Field label={`${isBn ? 'ফোন' : 'Phone'} · ${isBn ? 'ইচ্ছা হলে' : 'optional'}`}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
        </Field>

        <Field label={`${isBn ? 'নোট' : 'Note'} · ${isBn ? 'ইচ্ছা হলে' : 'optional'}`}>
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={isBn ? 'যেমন: পাশের রুমের বন্ধু' : 'e.g. friend from next room'} />
        </Field>
      </div>
    </Sheet>
  );
};

// ── one friend's full history ────────────────────────────────────────────────
const PersonDetailSheet = ({ personId, onClose, isBn, language, onEditProfile, onDeleteProfile }) => {
  const solo = useLivingStore((s) => s.solo);
  const addSoloEntry = useLivingStore((s) => s.addSoloEntry);
  const [entryOpen, setEntryOpen] = useState(false);
  const [lockType, setLockType] = useState('lend');
  // The sheet keeps rendering the person it was CLOSED on, so it can slide out
  // with their name and balance still on it instead of vanishing mid-animation.
  const [lastPerson, setLastPerson] = useState(null);

  const selected = solo.people.find((p) => p.id === personId) || null;
  React.useEffect(() => {
    if (selected) setLastPerson(selected);
  }, [selected]);
  const person = selected || lastPerson;

  const { entries, net } = useMemo(() => personDetail(solo, person?.id), [solo, person]);

  if (!person) return null;

  const owed = net > 0; // they owe me
  const quick = ['lend', 'repay-in', 'borrow', 'repay-out'];

  // "Settle it all" writes the single repayment that zeroes the balance —
  // the moment when a friendship stops keeping accounts.
  const settle = () => {
    if (Math.abs(net) < 0.5) return;
    addSoloEntry({
      type: net > 0 ? 'repay-in' : 'repay-out',
      amount: Math.round(Math.abs(net)),
      personId: person.id,
      category: null,
      note: isBn ? 'সম্পূর্ণ শোধ' : 'Settled up',
    });
  };

  return (
    <>
      <Sheet
        open={!!personId && !entryOpen}
        onClose={onClose}
        title={person.name}
        subtitle={person.phone || (isBn ? 'লেনদেনের হিসাব' : 'Your running ledger')}
        footer={
          Math.abs(net) >= 0.5 ? (
            <PrimaryButton className="w-full" onClick={() => { settle(); onClose(); }}>
              <Check size={17} />
              {net > 0
                ? isBn ? `পুরো ${taka(net, language)} পেয়ে গেছি` : `Got the full ${taka(net, language)} back`
                : isBn ? `পুরো ${taka(-net, language)} শোধ করেছি` : `Paid back the full ${taka(-net, language)}`}
            </PrimaryButton>
          ) : null
        }
      >
        <div className="space-y-4 py-1">
          {/* balance */}
          <div className={cx('rounded-3xl p-4 border', Math.abs(net) < 0.5 ? 'bg-gray-50 border-gray-100' : owed ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100')}>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {Math.abs(net) < 0.5 ? (isBn ? 'হিসাব' : 'Balance') : owed ? (isBn ? 'আপনি পাবেন' : 'They owe you') : isBn ? 'আপনি দেবেন' : 'You owe them'}
            </p>
            <p className={cx('text-[30px] leading-none font-black tracking-tight mt-1.5', Math.abs(net) < 0.5 ? 'text-gray-500' : owed ? 'text-emerald-600' : 'text-red-600')}>
              {Math.abs(net) < 0.5 ? (isBn ? 'সব মেটানো' : 'All settled') : taka(Math.abs(net), language)}
            </p>
            {person.note && <p className="text-[11.5px] font-semibold text-gray-500 mt-2">{person.note}</p>}
          </div>

          {/* quick actions */}
          <div className="grid grid-cols-2 gap-2">
            {quick.map((type) => {
              const t = getEntryType(type);
              const Icon = t.icon;
              return (
                <button
                  key={type}
                  onClick={() => { setLockType(type); setEntryOpen(true); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-gray-50 border border-gray-100 active:scale-[0.97] transition"
                >
                  <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', t.tint, t.text)}>
                    <Icon size={16} strokeWidth={2.3} />
                  </span>
                  <span className="text-[11.5px] font-black text-gray-700 text-left leading-tight">{isBn ? t.bn : t.en}</span>
                </button>
              );
            })}
          </div>

          {/* history */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
              {isBn ? 'সব লেনদেন' : 'Every transaction'} ({entries.length})
            </p>
            {entries.length === 0 ? (
              <p className="text-[12px] font-semibold text-gray-400 py-4 text-center">
                {isBn ? 'এখনো কোনো লেনদেন হয়নি।' : 'Nothing has moved between you yet.'}
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {entries.map((e) => {
                  const t = getEntryType(e.type);
                  const Icon = t.icon;
                  return (
                    <div key={e.id} className="flex items-center gap-2.5 py-2.5">
                      <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', t.tint, t.text)}>
                        <Icon size={15} strokeWidth={2.3} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-black text-gray-900 truncate">{e.note?.trim() || (isBn ? t.bn : t.en)}</p>
                        <p className="text-[10.5px] font-semibold text-gray-400">{dateLabel(e.date, language)}</p>
                      </div>
                      <span className={cx('text-[13px] font-black tabular-nums', t.person > 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {t.person > 0 ? '+' : '−'}{taka(e.amount, language)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* profile actions */}
          <div className="flex gap-2 pt-1">
            {person.phone && (
              <a href={`tel:${person.phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-gray-100 text-gray-700 text-[12px] font-black active:scale-95 transition">
                <Phone size={14} /> {isBn ? 'কল' : 'Call'}
              </a>
            )}
            <button onClick={() => onEditProfile(person)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-gray-100 text-gray-700 text-[12px] font-black active:scale-95 transition">
              <Pencil size={14} /> {isBn ? 'এডিট' : 'Edit'}
            </button>
            <button onClick={() => onDeleteProfile(person, entries.length, net)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-rose-50 text-red-600 text-[12px] font-black active:scale-95 transition">
              <Trash2 size={14} /> {isBn ? 'মুছুন' : 'Delete'}
            </button>
          </div>
        </div>
      </Sheet>

      <SoloEntrySheet
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        flow={getEntryType(lockType).flow}
        lockType={lockType}
        lockPersonId={person.id}
        onSave={addSoloEntry}
      />
    </>
  );
};

// ── the module ───────────────────────────────────────────────────────────────
const SoloPeople = ({ language }) => {
  const isBn = language === 'বাংলা';
  const solo = useLivingStore((s) => s.solo);
  const addPerson = useLivingStore((s) => s.addPerson);
  const updatePerson = useLivingStore((s) => s.updatePerson);
  const removePerson = useLivingStore((s) => s.removePerson);

  const { rows, theyOweMe, iOwe } = useMemo(() => personRows(solo), [solo]);

  const [openId, setOpenId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const save = (data) => {
    if (editing) updatePerson(editing.id, data);
    else addPerson(data);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isBn ? 'দেনা-পাওনা' : 'Dues & Loans'}
        subtitle={isBn ? 'কার কাছে কত পাবেন, কাকে কত দেবেন' : 'Who owes you, and whom you owe'}
        right={
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="flex items-center gap-1 bg-[#ba0036] text-white pl-2.5 pr-3.5 py-2 rounded-xl text-[12px] font-black shadow-[0_8px_20px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition"
          >
            <UserPlus size={15} /> {isBn ? 'বন্ধু' : 'Friend'}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <ArrowDownLeft size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'মোট পাবেন' : 'You get back'}</span>
          </div>
          <p className="text-xl font-black text-emerald-600 tracking-tight mt-1.5">{taka(theyOweMe, language)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-red-600">
            <ArrowUpRight size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider">{isBn ? 'মোট দেবেন' : 'You owe'}</span>
          </div>
          <p className="text-xl font-black text-red-600 tracking-tight mt-1.5">{taka(iOwe, language)}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={isBn ? 'কোনো বন্ধু যোগ করা হয়নি' : 'No one added yet'}
            subtitle={
              isBn
                ? 'যাকে টাকা ধার দেন বা যার কাছ থেকে নেন, তার নাম একবার লিখে রাখুন — তারপর প্রতিটি লেনদেন তার নামেই জমা হবে।'
                : 'Add the people you lend to or borrow from once, and every transaction lands on their own line.'
            }
            action={
              <PrimaryButton onClick={() => { setEditing(null); setFormOpen(true); }}>
                <UserPlus size={16} /> {isBn ? 'বন্ধু যোগ করুন' : 'Add a friend'}
              </PrimaryButton>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((p) => {
            const settled = Math.abs(p.net) < 0.5;
            const owed = p.net > 0;
            return (
              <Card key={p.id} as="button" onClick={() => setOpenId(p.id)} className="w-full p-3.5 text-left active:scale-[0.99] transition">
                <div className="flex items-center gap-3">
                  <Avatar roommate={p} size={44} ring={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-black text-gray-900 truncate">{p.name}</p>
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                      {p.count > 0
                        ? `${p.count} ${isBn ? 'টি লেনদেন' : p.count === 1 ? 'transaction' : 'transactions'} · ${dateLabel(p.lastDate, language)}`
                        : isBn ? 'এখনো লেনদেন হয়নি' : 'No transactions yet'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {settled ? (
                      <Chip tint="bg-gray-100" text="text-gray-500">{isBn ? 'মেটানো' : 'Settled'}</Chip>
                    ) : (
                      <>
                        <p className={cx('text-[15px] font-black tabular-nums', owed ? 'text-emerald-600' : 'text-red-600')}>
                          {taka(Math.abs(p.net), language)}
                        </p>
                        <p className={cx('text-[10px] font-black uppercase tracking-wider', owed ? 'text-emerald-600' : 'text-red-600')}>
                          {owed ? (isBn ? 'পাবেন' : 'you get') : isBn ? 'দেবেন' : 'you owe'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PersonDetailSheet
        personId={openId}
        onClose={() => setOpenId(null)}
        isBn={isBn}
        language={language}
        onEditProfile={(p) => { setOpenId(null); setEditing(p); setFormOpen(true); }}
        onDeleteProfile={(p, count, net) => { setOpenId(null); setPendingDelete({ ...p, count, net }); }}
      />
      <PersonSheet open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} isBn={isBn} editing={editing} onSave={save} />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => removePerson(pendingDelete.id)}
        title={isBn ? 'প্রোফাইলটি মুছবেন?' : 'Delete this profile?'}
        message={
          pendingDelete
            ? isBn
              ? `${pendingDelete.name}-এর ${pendingDelete.count}টি লেনদেনও মুছে যাবে।${Math.abs(pendingDelete.net || 0) >= 0.5 ? ` এখনো ${taka(Math.abs(pendingDelete.net), language)} হিসাব বাকি আছে।` : ''}`
              : `${pendingDelete.count} transaction(s) with ${pendingDelete.name} will be removed too.${Math.abs(pendingDelete.net || 0) >= 0.5 ? ` ${taka(Math.abs(pendingDelete.net), language)} is still unsettled.` : ''}`
            : ''
        }
        confirmLabel={isBn ? 'মুছে ফেলুন' : 'Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
      />
    </div>
  );
};

export default SoloPeople;
