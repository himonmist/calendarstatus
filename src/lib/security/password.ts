import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384, R = 8, P = 1, LEN = 64;
const derive = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, LEN, { N, r: R, p: P }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${N}$${salt.toString("base64url")}$${(await derive(pw, salt)).toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, s, h] = stored.split("$");
  if (alg !== "scrypt" || Number(n) !== N || !s || !h) return false;
  const expected = Buffer.from(h, "base64url");
  const actual = await derive(pw, Buffer.from(s, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
