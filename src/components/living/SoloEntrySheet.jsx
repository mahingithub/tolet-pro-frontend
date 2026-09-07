/**
 * SoloEntrySheet — the one form that writes every row of the solo খাতা.
 *
 * A single sheet handles all six entry types (spent / received / lent /
 * borrowed / got back / paid back) because they only differ in three things:
 * which side of the pocket they sit on, whether they need a category, and
 * whether they need a person. Two forms would have meant two places to get the
 * accounting wrong.
 *
 * A friend can be created inline from the person picker: the whole point of
 * this screen is that it gets filled in while standing at the shop, so it must
 * never dead-end into "go to another tab and add them first".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Tag, UserPlus, X } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
import useLivingStore from '../../store/useLivingStore';
import { taka } from './livingUtils';
import { METHOD_ORDER, PAYMENT_METHODS } from './livingConfig';
import {
  SPEND_CATEGORIES, SPEND_ORDER, INCOME_CATEGORIES, INCOME_ORDER,
  CUSTOM_NAME_MAX, cleanCategoryName, customCategoryKey, getEntryType,
  getIncomeCategory, getSpendCategory, isCustomCategory, matchDefaultCategory,
  OUT_TYPES, IN_TYPES, PERSON_SWATCHES,
} from './soloConfig';
import { toDateInput, fromDateInput, customCategoriesUsed, recentNotes } from './soloUtils';
import { Avatar, Field, MoneyInput, PrimaryButton, Sheet, TextArea, TextInput, cx } from './livingUI';

const dateInputClass =
  'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba0036]/30';

const SoloEntrySheet = ({
  open,
  onClose,
  flow = 'out',
  editing = null,
  lockType = null, // open straight into one type (quick actions, person sheet)
  lockPersonId = null, // pre-pick the friend (opened from their profile)
  presetCategory = null, // opened from inside a খাত — start in that folder
  onSave,
}) => {
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const people = useLivingStore((s) => s.solo.people);
  const entries = useLivingStore((s) => s.solo.entries);
  const addPerson = useLivingStore((s) => s.addPerson);

  const typeOptions = flow === 'in' ? IN_TYPES : OUT_TYPES;
  const [type, setType] = useState(lockType || typeOptions[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(flow === 'in' ? 'salary' : 'food');
  const [personId, setPersonId] = useState(lockPersonId);
  const [date, setDate] = useState(toDateInput());
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [newName, setNewName] = useState(null); // null = the inline add row is closed
  const [newCat, setNewCat] = useState(null); // null = "নিজের খাত" not being typed
  // খাত made in THIS sitting. They have no entry behind them yet, so nothing
  // else can remember them — and a name that vanishes because you tapped
  // another tile to compare would be maddening.
  const [draftCats, setDraftCats] = useState([]);

  // (re)initialise every time it opens — an edit loads the row, a fresh add
  // starts from today with the caller's locked type / person.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount ?? ''));
      setCategory(editing.category || (editing.type === 'income' ? 'salary' : 'food'));
      setPersonId(editing.personId || null);
      setDate(toDateInput(editing.date));
      setMethod(editing.method || 'cash');
      setNote(editing.note || '');
    } else {
      setType(lockType || typeOptions[0]);
      setAmount('');
      setCategory(presetCategory || (flow === 'in' ? 'salary' : 'food'));
      setPersonId(lockPersonId);
      setDate(toDateInput());
      setMethod('cash');
      setNote('');
    }
    setNewName(null);
    setNewCat(null);
    setDraftCats([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, lockType, lockPersonId, presetCategory, flow]);

  const meta = getEntryType(type);
  const needsPerson = meta.needsPerson;
  const needsCategory = !needsPerson;
  const table = type === 'income' ? INCOME_CATEGORIES : SPEND_CATEGORIES;
  const order = type === 'income' ? INCOME_ORDER : SPEND_ORDER;
  const metaOf = type === 'income' ? getIncomeCategory : getSpendCategory;

  // Switching between the two category tables must not leave a key behind that
  // doesn't exist in the new one (e.g. 'transport' when the type became income).
  // A খাত the user made themselves belongs to neither table and must survive.
  useEffect(() => {
    if (needsCategory && !table[category] && !isCustomCategory(category)) setCategory(order[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // The twelve defaults, then every খাত this person has made for themselves —
  // including the one being written right now, which has no entry behind it yet.
  const tiles = useMemo(() => {
    const mine = customCategoriesUsed(entries, type);
    const all = [...order, ...mine];
    [...draftCats, category].forEach((k) => {
      if (isCustomCategory(k) && !all.includes(k)) all.push(k);
    });
    return all;
  }, [entries, type, order, category, draftCats]);

  const createCategory = () => {
    const clean = cleanCategoryName(newCat);
    if (!clean) return;
    // Typing the name of a খাত that already exists picks THAT one — the whole
    // point is fewer heads to read, not a second বাজার beside the first.
    const existing = matchDefaultCategory(clean, type === 'income' ? 'in' : 'out');
    const key = existing || customCategoryKey(clean);
    if (!existing) setDraftCats((list) => (list.includes(key) ? list : [...list, key]));
    setCategory(key);
    setNewCat(null);
  };

  const amt = Number(amount) || 0;
  const invalid = !(amt > 0) || (needsPerson && !personId);

  const selectedPerson = useMemo(() => people.find((p) => p.id === personId) || null, [people, personId]);

  // Notes already written under this খাত, offered back as one-tap chips —
  // "রিকশা ভাড়া" is typed once and reused all month. This is what keeps people
  // from inventing a category for every kind of খরচ: the note carries the
  // detail, the খাত stays one of the twelve, and the totals stay readable.
  const suggestions = useMemo(
    () => recentNotes(entries, needsPerson ? { type } : { type, category }, 6),
    [entries, type, category, needsPerson]
  );

  const createPerson = () => {
    const name = (newName || '').trim();
    if (!name) return;
    const id = addPerson({ name, color: PERSON_SWATCHES[people.length % PERSON_SWATCHES.length] });
    setPersonId(id);
    setNewName(null);
  };

  const submit = () => {
    if (invalid) return;
    onSave({
      type,
      amount: amt,
      category: needsCategory ? category : null,
      personId: needsPerson ? personId : null,
      date: fromDateInput(date),
      method,
      note: note.trim(),
    });
    onClose();
  };

  const title = editing
    ? isBn ? 'হিসাব এডিট' : 'Edit entry'
    : flow === 'in'
    ? isBn ? 'টাকা এসেছে' : 'Money in'
    : isBn ? 'টাকা গেছে' : 'Money out';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={isBn ? 'এক লাইনে খাতায় উঠে যাবে' : 'One line, straight into your ledger'}
      footer={
        <PrimaryButton className="w-full" onClick={submit} disabled={invalid}>
          <Check size={17} />
          {editing ? (isBn ? 'আপডেট করুন' : 'Update entry') : isBn ? 'খাতায় লিখুন' : 'Save to ledger'}
        </PrimaryButton>
      }
    >
      <div data-tour="solo-entry-sheet" className="space-y-4 py-1">
        {/* what kind of entry — hidden when the caller already decided */}
        {!lockType && (
          <Field label={isBn ? 'কী ধরনের হিসাব' : 'What kind of entry'}>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((key) => {
                const t = getEntryType(key);
                const Icon = t.icon;
                const active = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={cx(
                      'flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition active:scale-95',
                      active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-100 bg-gray-50'
                    )}
                  >
                    <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center', t.tint, t.text)}>
                      <Icon size={16} strokeWidth={2.3} />
                    </span>
                    <span className="text-[10.5px] font-black text-gray-700 leading-none text-center">{isBn ? t.bn : t.en}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label={isBn ? 'কত টাকা' : 'Amount'}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>

        {needsCategory && (
          <Field
            label={type === 'income' ? (isBn ? 'কোথা থেকে এসেছে' : 'Where it came from') : isBn ? 'কোন খাতে' : 'Category'}
            // Said out loud, because the instinct is to invent a category per
            // purchase: রিকশা ভাড়া goes *inside* যাতায়াত, as a note.
            hint={
              type === 'income'
                ? undefined
                : isBn
                ? 'কী কিনলেন সেটা নিচের নোটে লিখুন — একই খাতেই জমা হবে। কোনোটাই না মিললে নিজের খাত বানিয়ে নিন।'
                : "Put what it was in the note below — it files under this category. If none of them fit, make your own."
            }
          >
            <div className="grid grid-cols-4 gap-2">
              {tiles.map((key) => {
                const c = metaOf(key);
                const Icon = c.icon;
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={cx(
                      'flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition active:scale-95',
                      active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-100 bg-gray-50'
                    )}
                  >
                    <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center', c.tint, c.text)}>
                      <Icon size={16} />
                    </span>
                    <span className="w-full px-1 text-[9.5px] font-bold text-gray-600 leading-tight text-center truncate">
                      {isBn ? c.bn : c.en}
                    </span>
                  </button>
                );
              })}

              {/* The user's own খাত. Written here rather than in a settings
                  page because the moment you need one is the moment you are
                  standing at the shop with a খরচ that fits nothing. */}
              {newCat === null && (
                <button
                  type="button"
                  onClick={() => setNewCat('')}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-gray-300 text-gray-500 transition active:scale-95 hover:border-[#ba0036]/40 hover:text-[#ba0036]"
                >
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-white border border-gray-200">
                    <Plus size={15} />
                  </span>
                  <span className="text-[9.5px] font-black leading-tight text-center">
                    {isBn ? 'নিজের খাত' : 'Own category'}
                  </span>
                </button>
              )}
            </div>

            {newCat !== null && (
              <div className="mt-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <TextInput
                      value={newCat}
                      maxLength={CUSTOM_NAME_MAX}
                      onChange={(e) => setNewCat(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } }}
                      placeholder={isBn ? 'খাতের নাম — যেমন: বাইকের তেল' : 'Category name — e.g. bike fuel'}
                      autoFocus
                      className="pl-10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createCategory}
                    disabled={!cleanCategoryName(newCat)}
                    className="shrink-0 w-11 h-11 rounded-2xl bg-[#ba0036] text-white flex items-center justify-center active:scale-90 transition disabled:opacity-40"
                    aria-label={isBn ? 'খাত বানান' : 'Create category'}
                  >
                    <Check size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCat(null)}
                    className="shrink-0 w-11 h-11 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90 transition"
                    aria-label={isBn ? 'বাতিল' : 'Cancel'}
                  >
                    <X size={17} />
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-gray-400 mt-1.5 leading-relaxed">
                  {isBn
                    ? 'খাতটা এই হিসাবের সাথেই তৈরি হবে, আর পরের বার তালিকাতেই পাবেন।'
                    : 'The category is created along with this entry, and waits in the list next time.'}
                </p>
              </div>
            )}
          </Field>
        )}

        {needsPerson && (
          <Field
            label={isBn ? 'কার সাথে' : 'With whom'}
            hint={
              selectedPerson
                ? undefined
                : isBn
                ? 'নাম দিয়ে রাখলে পরে আর গুলিয়ে যাবে না — কার কাছে কত, সব আলাদা থাকবে।'
                : "Naming them keeps it straight later — everyone's dues stay on their own line."
            }
          >
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const active = personId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersonId(p.id)}
                    className={cx(
                      'flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border transition active:scale-95',
                      active ? 'border-[#ba0036] bg-[#ba0036]/5' : 'border-gray-200 bg-white'
                    )}
                  >
                    <Avatar roommate={p} size={24} />
                    <span className="text-[11.5px] font-bold text-gray-700">{p.name}</span>
                    {active && <Check size={12} className="text-[#ba0036]" />}
                  </button>
                );
              })}
              {newName === null && (
                <button
                  type="button"
                  onClick={() => setNewName('')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-500 text-[11.5px] font-black active:scale-95 transition hover:border-[#ba0036]/40 hover:text-[#ba0036]"
                >
                  <UserPlus size={13} /> {isBn ? 'নতুন' : 'New'}
                </button>
              )}
            </div>

            {newName !== null && (
              <div className="flex items-center gap-2 mt-2.5">
                <TextInput
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createPerson(); } }}
                  placeholder={isBn ? 'বন্ধুর নাম' : "Friend's name"}
                  autoFocus
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={createPerson}
                  disabled={!newName.trim()}
                  className="shrink-0 w-11 h-11 rounded-2xl bg-[#ba0036] text-white flex items-center justify-center active:scale-90 transition disabled:opacity-40"
                  aria-label={isBn ? 'যোগ করুন' : 'Add'}
                >
                  <Check size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setNewName(null)}
                  className="shrink-0 w-11 h-11 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90 transition"
                  aria-label={isBn ? 'বাতিল' : 'Cancel'}
                >
                  <X size={17} />
                </button>
              </div>
            )}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={isBn ? 'তারিখ' : 'Date'}>
            <input type="date" value={date} max={toDateInput()} onChange={(e) => setDate(e.target.value)} className={dateInputClass} />
          </Field>
          <Field label={isBn ? 'কীভাবে' : 'Method'}>
            <div className="grid grid-cols-4 gap-1.5">
              {METHOD_ORDER.map((key) => {
                const m = PAYMENT_METHODS[key];
                const Icon = m.icon;
                const active = method === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    title={isBn ? m.bn : m.en}
                    className={cx(
                      'h-[46px] rounded-xl border flex items-center justify-center transition active:scale-95',
                      active ? 'border-[#ba0036] bg-[#ba0036]/5 text-[#ba0036]' : 'border-gray-100 bg-gray-50 text-gray-400'
                    )}
                    aria-label={isBn ? m.bn : m.en}
                  >
                    <Icon size={17} />
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <Field label={isBn ? 'নোট' : 'Note'}>
          <TextArea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              type === 'expense'
                ? isBn ? 'যেমন: রিকশা ভাড়া' : 'e.g. rickshaw fare'
                : type === 'income'
                ? isBn ? 'যেমন: এ মাসের বেতন' : "e.g. this month's salary"
                : isBn ? 'যেমন: বাসা ভাড়ার জন্য' : 'e.g. for the rent'
            }
          />

          {/* What was written here before, one tap away. The same three or four
              lines repeat all month, and typing them out every time is exactly
              why a খাতা stops being kept. */}
          {suggestions.length > 0 && (
            <div className="mt-2">
              <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                {isBn ? 'আগে যা লিখেছেন' : 'Written before'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => {
                  const active = note.trim() === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNote(active ? '' : s)}
                      className={cx(
                        'max-w-full truncate px-2.5 py-1.5 rounded-full border text-[11.5px] font-bold transition active:scale-95',
                        active
                          ? 'border-[#ba0036] bg-[#ba0036]/5 text-[#ba0036]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#ba0036]/40'
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Field>

        {/* A live one-line restatement of what is about to be written. It is the
            cheapest possible guard against the exact mistake this whole feature
            exists to fix: money entered on the wrong side of the খাতা. */}
        {amt > 0 && (
          <div className={cx('rounded-2xl border p-3 flex items-start gap-2.5', meta.flow === 'in' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100')}>
            <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', meta.tint, meta.text)}>
              <meta.icon size={16} strokeWidth={2.3} />
            </span>
            <p className={cx('text-[11.5px] font-bold leading-relaxed', meta.flow === 'in' ? 'text-emerald-700' : 'text-red-700')}>
              {type === 'expense' && (isBn ? `${taka(amt, language)} খরচ হিসেবে লেখা হবে।` : `${taka(amt, language)} will be recorded as spending.`)}
              {type === 'income' && (isBn ? `${taka(amt, language)} আয় হিসেবে লেখা হবে।` : `${taka(amt, language)} will be recorded as income.`)}
              {type === 'lend' && (isBn ? `${selectedPerson?.name || 'বন্ধু'} আপনাকে ${taka(amt, language)} ফেরত দেবে। এটি খরচ নয়।` : `${selectedPerson?.name || 'They'} will owe you ${taka(amt, language)}. This is not spending.`)}
              {type === 'borrow' && (isBn ? `আপনি ${selectedPerson?.name || 'বন্ধু'}-কে ${taka(amt, language)} ফেরত দেবেন। এটি আয় নয়।` : `You will owe ${selectedPerson?.name || 'them'} ${taka(amt, language)}. This is not income.`)}
              {type === 'repay-in' && (isBn ? `${selectedPerson?.name || 'বন্ধু'}-র কাছে পাওনা ${taka(amt, language)} কমে যাবে।` : `${selectedPerson?.name || 'Their'} dues drop by ${taka(amt, language)}.`)}
              {type === 'repay-out' && (isBn ? `${selectedPerson?.name || 'বন্ধু'}-কে আপনার দেনা ${taka(amt, language)} কমে যাবে।` : `What you owe ${selectedPerson?.name || 'them'} drops by ${taka(amt, language)}.`)}
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
};

export default SoloEntrySheet;
