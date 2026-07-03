// ─── LOCALIZED BDT CURRENCY / NUMERAL FORMATTING ─────────────────────────────
// Shared by the map marker pills and the bottom-sheet card. Mirrors the price
// convention already used across the app (AddProperty.jsx, HostDashboard.jsx,
// PropertyDetails.jsx): the ৳ symbol + Indian digit grouping via
// `toLocaleString('en-IN')`. The only addition here is that when the active UI
// language is Bengali (the app default), the Latin digits are converted to
// Bengali numerals so a marker reads e.g. "৳ ২৩,০০০" — matching the rest of the
// Bengali-first UI while still rendering "৳ 23,000" in English mode.

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

// The LanguageContext stores the language as the literal string 'বাংলা' | 'English'.
export const isBengali = (language) => language === "বাংলা";

// Convert any Latin digits (0-9) in a value to Bengali numerals. Every other
// character (commas, ৳, spaces, letters) passes through untouched.
export const toBengaliDigits = (value) =>
	String(value ?? "").replace(/[0-9]/g, (d) => BN_DIGITS[+d]);

// Localize the digits inside a string based on the active language. English
// keeps Latin digits; Bengali swaps them for Bengali numerals.
export const toLocalizedDigits = (value, language) =>
	isBengali(language) ? toBengaliDigits(value) : String(value ?? "");

// Format a numeric price as a localized BDT string:
//   English → "৳ 23,000"      Bengali → "৳ ২৩,০০০"
// Uses Indian grouping (en-IN) so lakh/crore values group correctly
// (e.g. 2,300,000 → "২৩,০০,০০০").
export const formatBdt = (price, language) => {
	const grouped = Number(price || 0).toLocaleString("en-IN");
	return `৳ ${toLocalizedDigits(grouped, language)}`;
};
