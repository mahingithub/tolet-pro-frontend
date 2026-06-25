const parseSafeNum = (val) => {
  if (!val && val !== 0) return 0;
  const bnToEn = str => String(str).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const cleaned = bnToEn(val).replace(/[^\d.]/g, '');
  return Number(cleaned) || 0;
};
console.log(parseSafeNum('১২০০'));
console.log(parseSafeNum('৫'));
console.log(parseSafeNum('15000'));
