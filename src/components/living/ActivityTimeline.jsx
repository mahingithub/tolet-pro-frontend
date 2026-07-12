import React, { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';

import useLivingStore from '../../store/useLivingStore';
import { timeAgo, dateLabel } from './livingUtils';
import { getActivityMeta } from './livingConfig';
import { Card, SectionHeader, IconBadge, EmptyState, cx } from './ui';

const FILTERS = [
  { id: 'all', en: 'All', bn: 'সব' },
  { id: 'expense', en: 'Expenses', bn: 'খরচ' },
  { id: 'bill', en: 'Bills', bn: 'বিল' },
  { id: 'meal', en: 'Meals', bn: 'মিল' },
  { id: 'settlement', en: 'Settlements', bn: 'সেটেলমেন্ট' },
  { id: 'reminder', en: 'Reminders', bn: 'রিমাইন্ডার' },
];

const dayGroup = (dateISO, isBn) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateISO);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff <= 0) return isBn ? 'আজ' : 'Today';
  if (diff === 1) return isBn ? 'গতকাল' : 'Yesterday';
  return null;
};

const ActivityTimeline = ({ language }) => {
  const isBn = language === 'বাংলা';
  const activities = useLivingStore((s) => s.activities);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(
    () => (filter === 'all' ? activities : activities.filter((a) => a.type === filter)),
    [activities, filter]
  );

  // group consecutively by day label
  const groups = useMemo(() => {
    const out = [];
    let currentKey = null;
    filtered.forEach((a) => {
      const key = dayGroup(a.date, isBn) || dateLabel(a.date, language);
      if (key !== currentKey) {
        out.push({ key, items: [] });
        currentKey = key;
      }
      out[out.length - 1].items.push(a);
    });
    return out;
  }, [filtered, isBn, language]);

  return (
    <div className="space-y-4">
      <SectionHeader title={isBn ? 'একটিভিটি টাইমলাইন' : 'Activity Timeline'} subtitle={isBn ? 'সব কার্যক্রমের ইতিহাস' : 'Everything that happened'} />

      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cx('shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-black transition border active:scale-95', filter === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200')}
          >
            {isBn ? f.bn : f.en}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Activity} title={isBn ? 'কোনো কার্যক্রম নেই' : 'No activity yet'} subtitle={isBn ? 'খরচ বা বিল যোগ করলে এখানে দেখা যাবে' : 'Your actions will show up here'} />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 pl-1">{g.key}</p>
              <Card className="p-4">
                <div className="relative">
                  {/* vertical rail */}
                  <span className="absolute left-[18px] top-2 bottom-2 w-px bg-gray-100" />
                  <div className="space-y-4">
                    {g.items.map((a) => {
                      const meta = getActivityMeta(a.type);
                      const Icon = meta.icon;
                      return (
                        <div key={a.id} className="relative flex items-start gap-3">
                          <span className={cx('relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-4 ring-white', meta.tint, meta.text)}>
                            <Icon size={16} strokeWidth={2.3} />
                          </span>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] font-black text-gray-900 leading-tight">{a.title}</p>
                              <span className="text-[10px] font-bold text-gray-400 shrink-0 pt-0.5">{timeAgo(a.date, language)}</span>
                            </div>
                            {a.detail && <p className="text-[11.5px] font-medium text-gray-500 mt-0.5">{a.detail}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;
