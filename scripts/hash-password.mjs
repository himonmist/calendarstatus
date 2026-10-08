// Usage: node scripts/hash-password.mjs '<password>'   -> prints ADMIN_PASSWORD_HASH value (scrypt, same params as the app)
import { randomBytes, scrypt } from "node:crypto";
const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error("Provide a password of at least 12 characters."); process.exit(1); }
const salt = randomBytes(16);
scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => {
  if (e) throw e;
  console.log(`scrypt$16384$${salt.toString("base64url")}$${k.toString("base64url")}`);
});
