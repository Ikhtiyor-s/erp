// Uzbek mobile phone helpers — keep in sync with apps/api/app/core/phone.py

/** Strip everything but digits, then drop a leading 998/0 national prefix. */
export function normalizeUzPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 9);
}

/** Format 9 national digits as "XX XXX XX XX" for display under the +998 prefix. */
export function formatUzPhone(nationalDigits: string): string {
  const d = nationalDigits.replace(/\D/g, "").slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
}

/** Full E.164-ish form sent to the API. */
export function toApiPhone(nationalDigits: string): string {
  return `+998${nationalDigits}`;
}

export function isValidUzPhone(nationalDigits: string): boolean {
  return /^\d{9}$/.test(nationalDigits);
}
