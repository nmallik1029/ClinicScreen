import crypto from "crypto";

// Pairing codes are read off a TV and typed by an admin, so we avoid ambiguous
// characters (no O/0, I/1, etc.).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** How long a pairing code is valid before the device must request a new one. */
export const ENROLLMENT_TTL_MS = 10 * 60 * 1000;

/** A fresh, human-friendly pairing code (e.g. "K7P4Q2"). */
export function newEnrollmentCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Normalize admin-entered codes (uppercase, strip spaces/dashes). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** A machine-only secret the device keeps to prove it owns the enrollment. */
export function newEnrollmentSecret(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Display form of a code, grouped for readability ("K7P4Q2" → "K7P-4Q2"). */
export function formatCode(code: string): string {
  const c = normalizeCode(code);
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}
