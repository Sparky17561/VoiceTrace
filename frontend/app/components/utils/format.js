export const fmtAmt = e => {
  if (e.amount_type === 'exact' && e.value != null) return `₹${e.value}`;
  if (e.min != null && e.max != null) return `₹${e.min}–${e.max}`;
  return e.value != null ? `~₹${e.value}` : '—';
};
