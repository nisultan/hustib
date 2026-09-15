/**
 * Password-protected storage for the local hub.
 *
 * What this actually does: the password is stretched with PBKDF2 into an
 * AES-GCM key, and the whole data blob is encrypted with it before it touches
 * localStorage. The password itself is never stored — not hashed, not
 * anywhere — so the only way to read the data back is to derive the same key
 * from the same password.
 *
 * What it protects against: someone with access to the browser (a shared
 * laptop, an open devtools panel) reading tasks, grades and application notes
 * straight out of storage.
 *
 * What it does not protect against: anything running code in the page while
 * the hub is unlocked, since the key is in memory then by necessity. It is a
 * lock on a drawer, not a safe.
 *
 * There is no recovery. Forgetting the password means the data is gone, which
 * is why the UI says so plainly and pushes an export.
 */

export const VAULT_KEY = "iblearner.vault";
export const PLAIN_KEY = "iblearner.v1";
/** Records that we have asked about a password, so we ask exactly once. */
export const PASSWORD_CHOICE_KEY = "iblearner.passwordChoice";

/**
 * OWASP's floor for PBKDF2-HMAC-SHA256. Costs a few hundred milliseconds on a
 * typical laptop, which is unnoticeable once per unlock and expensive in bulk.
 */
const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface VaultBlob {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

export function hasVault(): boolean {
  try {
    return localStorage.getItem(VAULT_KEY) != null;
  } catch {
    return false;
  }
}

export function readVault(): VaultBlob | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as VaultBlob;
    return parsed.v === 1 && parsed.salt && parsed.iv && parsed.ct ? parsed : null;
  } catch {
    return null;
  }
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Derives a key for a brand new password, returning it with its fresh salt. */
export async function createKey(password: string): Promise<{ key: CryptoKey; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt);
  return { key, salt: toBase64(salt) };
}

/** Derives the key for an existing vault. Cannot itself tell you if it is right. */
export async function keyForVault(password: string, vault: VaultBlob): Promise<CryptoKey> {
  return deriveKey(password, fromBase64(vault.salt));
}

export async function encrypt(
  key: CryptoKey,
  salt: string,
  plaintext: string,
): Promise<VaultBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { v: 1, salt, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

/**
 * Returns null when the password is wrong. AES-GCM authenticates the
 * ciphertext, so a wrong key fails the integrity check and throws rather than
 * returning garbage — which is what makes "wrong password" detectable at all
 * without storing anything derived from the password.
 */
export async function decrypt(key: CryptoKey, vault: VaultBlob): Promise<string | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(vault.iv) as BufferSource },
      key,
      fromBase64(vault.ct) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Available over HTTPS and on localhost; absent on plain http origins. */
export function cryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && crypto.subtle != null;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3;
  label: string;
  problem: string | null;
}

/**
 * Deliberately simple and advisory. Length dominates because it genuinely
 * dominates the search space; the character-class checks only nudge.
 */
export function ratePassword(password: string): PasswordStrength {
  if (password.length === 0) {
    return { score: 0, label: "", problem: null };
  }
  if (password.length < 8) {
    return { score: 0, label: "Too short", problem: "Use at least 8 characters." };
  }

  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/\d/.test(password)) variety++;
  if (/[^A-Za-z0-9]/.test(password)) variety++;

  if (password.length >= 16 || (password.length >= 12 && variety >= 3)) {
    return { score: 3, label: "Strong", problem: null };
  }
  if (password.length >= 12 || variety >= 3) {
    return { score: 2, label: "Good", problem: null };
  }
  return { score: 1, label: "Weak", problem: "Longer is better than more symbols." };
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
