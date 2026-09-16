/**
 * Clock times in the chosen language.
 *
 * CLDR's `bn` locale gives Bangla digits but keeps "AM"/"PM" in Latin script
 * ("১০:০৫ AM"), so a Bangla screen still shows English. Every time of day the
 * app prints in Bangla goes through here.
 */
export const bnDayPeriod = (text) =>
  String(text).replace(/\bAM\b/g, 'পূর্বাহ্ণ').replace(/\bPM\b/g, 'অপরাহ্ণ');

const HM = { hour: '2-digit', minute: '2-digit' };

/** "10:05 AM" / "১০:০৫ পূর্বাহ্ণ". Empty string for a missing or invalid date. */
export const clockTime = (value, isBn, opts = HM) => {
  const d = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(d.getTime())) return '';
  return isBn ? bnDayPeriod(d.toLocaleTimeString('bn-BD', opts)) : d.toLocaleTimeString([], opts);
};

/** Date + time via toLocaleString, with the same AM/PM fix. */
export const dateTime = (value, isBn, opts) => {
  const d = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(d.getTime())) return '';
  return isBn ? bnDayPeriod(d.toLocaleString('bn-BD', opts)) : d.toLocaleString(undefined, opts);
};
