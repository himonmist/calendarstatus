import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyBuf(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return Buffer.from(hexKey, "hex");
}

/** AES-256-GCM. Output: base64url(iv[12] | tag[16] | ciphertext). */
export function encryptSecret(plain: string, hexKey: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyBuf(hexKey), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function decryptSecret(blob: string, hexKey: string): string {
  const raw = Buffer.from(blob, "base64url");
  if (raw.length < 29) throw new Error("Invalid ciphertext");
  const d = createDecipheriv("aes-256-gcm", keyBuf(hexKey), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}
