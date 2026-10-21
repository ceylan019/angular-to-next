export const DECLINED_CARD = "4000000000000002";

export function normalizeCardNumber(input: string): string {
  return input.replaceAll(" ", "");
}

export function isLuhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const value = Number(digits[i]);
    sum += double ? (value > 4 ? value * 2 - 9 : value * 2) : value;
    double = !double;
  }
  return sum % 10 === 0;
}

export function parseExpiry(
  input: string,
): { month: number; year: number } | null {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(input);
  if (!match) return null;
  return { month: Number(match[1]), year: 2000 + Number(match[2]) };
}

export function isExpired(
  expiry: { month: number; year: number },
  now: Date,
): boolean {
  const firstMomentAfter = Date.UTC(expiry.year, expiry.month, 1);
  return now.getTime() >= firstMomentAfter;
}

export function chargeCard(cardNumber: string): "approved" | "declined" {
  return cardNumber === DECLINED_CARD ? "declined" : "approved";
}
