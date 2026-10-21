import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 6;

export function generateOrderNumber(
  random: (size: number) => Buffer = randomBytes,
): string {
  const bytes = random(LENGTH);
  const suffix = Array.from({ length: LENGTH }, (_, i) =>
    ALPHABET.charAt((bytes[i] ?? 0) % ALPHABET.length),
  ).join("");
  return `WC-${suffix}`;
}
