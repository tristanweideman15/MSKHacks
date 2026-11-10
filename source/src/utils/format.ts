export function formatPrice(price?: number): string {
  return price && price > 0 ? `R${price.toLocaleString('en-ZA')}` : 'Rates on request';
}

export function paymentLabel(type?: string): string {
  if (type === 'in-network') return 'Medical aid';
  if (type === 'hsa-fsa') return 'Card / EFT';
  return 'Private (cash)';
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function todayStr(): string {
  return ymd(new Date());
}

export function nextWorkdayStr(): string {
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return ymd(d);
}
