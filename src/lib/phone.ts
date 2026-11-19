/** Normalises a Kenyan phone number to international digits for wa.me links (e.g. 0712 345 678 -> 254712345678). */
export function toWhatsAppNumber(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let national: string | null = null;
  if (digits.startsWith("254") && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9 && /^[17]/.test(digits)) national = digits;
  if (!national || !/^[17]\d{8}$/.test(national)) return null;
  return `254${national}`;
}

export function reminderMessage(opts: {
  customer: string;
  business: string;
  owed: number;
  overdue: number;
  currency?: string;
}): string {
  const money = (n: number) =>
    `${opts.currency ?? "KES"} ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
  const overdue = opts.overdue > 0 ? ` Of this, ${money(opts.overdue)} is overdue.` : "";
  return `Hello ${opts.customer}, this is a friendly reminder from ${opts.business}. Your outstanding balance is ${money(opts.owed)}.${overdue} Kindly settle at your earliest convenience. Thank you!`;
}
