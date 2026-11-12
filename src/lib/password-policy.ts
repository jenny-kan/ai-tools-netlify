/**
 * Password policy — shared client-side mirror of the server rules in
 * lib/security.ts. Kept pure (no server imports) so client components
 * can validate live and generate strong passwords in the browser.
 */

export const BLOGGER_PASSWORD_MIN = 20;
export const ADMIN_PASSWORD_MIN = 48;

export interface PasswordRule {
  key: "length" | "letter" | "number" | "case";
  label: string;
  test: (pw: string) => boolean;
}

/** The four rules shown on the signup form, in display order. */
export const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", label: `At least ${BLOGGER_PASSWORD_MIN} characters`, test: (pw) => pw.length >= BLOGGER_PASSWORD_MIN },
  { key: "letter", label: "Contains a letter", test: (pw) => /[A-Za-z]/.test(pw) },
  { key: "number", label: "Contains a number", test: (pw) => /\d/.test(pw) },
  { key: "case", label: "At least 1 lower and 1 upper", test: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
];

export function isValidPassword(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

/**
 * Generate a strong, unambiguous password in the browser using the Web Crypto
 * API. Guarantees at least one of each required character class, so the
 * generated value always passes the policy checklist.
 */
export function generatePassword(length = 24): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;

  const rand = (max: number): number => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };

  const chars = [upper[rand(upper.length)], upper[rand(upper.length)], lower[rand(lower.length)], lower[rand(lower.length)], digits[rand(digits.length)], digits[rand(digits.length)]];
  while (chars.length < Math.max(length, BLOGGER_PASSWORD_MIN)) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
