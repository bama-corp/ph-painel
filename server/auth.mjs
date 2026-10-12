/**
 * Auth de utilizador único (painel privado).
 * Credenciais só via env — nunca no frontend.
 *
 * AUTH_EMAIL, AUTH_NAME, AUTH_PASSWORD, AUTH_SECRET
 * Opcional: AUTH_SESSION_DAYS (default 14)
 */
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";

const COOKIE = "ph_session";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export function authConfigured() {
  const email = (process.env.AUTH_EMAIL || "").trim();
  const password = process.env.AUTH_PASSWORD || "";
  const secret = (process.env.AUTH_SECRET || "").trim();
  return Boolean(email && password && secret);
}

export function authProfile() {
  return {
    name: (process.env.AUTH_NAME || "Utilizador").trim(),
    email: (process.env.AUTH_EMAIL || "").trim().toLowerCase(),
  };
}

function sessionDays() {
  const n = Number(process.env.AUTH_SESSION_DAYS || 14);
  return Number.isFinite(n) && n > 0 ? Math.min(90, Math.round(n)) : 14;
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

/** Hash estável para comparar (scrypt com salt derivado do secret — single-user). */
function passwordDigest(password) {
  const secret = (process.env.AUTH_SECRET || "ph").trim();
  const salt = createHmac("sha256", secret).update("ph-auth-salt-v1").digest();
  return scryptSync(String(password), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

export function verifyCredentials(login, password) {
  if (!authConfigured()) return { ok: false, reason: "Auth não configurada." };
  const profile = authProfile();
  const id = String(login || "")
    .trim()
    .toLowerCase();
  const nameOk = profile.name.toLowerCase() === id;
  const emailOk = profile.email === id;
  if (!id || (!nameOk && !emailOk)) {
    return { ok: false, reason: "Credenciais inválidas." };
  }
  const expected = passwordDigest(process.env.AUTH_PASSWORD);
  const got = passwordDigest(password || "");
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false, reason: "Credenciais inválidas." };
  }
  return { ok: true, user: { name: profile.name, email: profile.email } };
}

function sign(payloadB64) {
  const secret = (process.env.AUTH_SECRET || "").trim();
  return b64url(createHmac("sha256", secret).update(payloadB64).digest());
}

export function createSessionToken(user) {
  const exp = Date.now() + sessionDays() * 24 * 60 * 60 * 1000;
  const payload = b64url(
    JSON.stringify({
      email: user.email,
      name: user.name,
      exp,
      v: 1,
    }),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "Sessão inválida." };
  }
  if (!authConfigured()) return { ok: false, reason: "Auth não configurada." };
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return { ok: false, reason: "Sessão inválida." };
  const expect = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Sessão inválida." };
  }
  try {
    const data = JSON.parse(fromB64url(payloadB64).toString("utf8"));
    if (!data?.email || !data?.exp || data.exp < Date.now()) {
      return { ok: false, reason: "Sessão expirada." };
    }
    const profile = authProfile();
    if (String(data.email).toLowerCase() !== profile.email) {
      return { ok: false, reason: "Sessão inválida." };
    }
    return {
      ok: true,
      user: { name: data.name || profile.name, email: profile.email },
    };
  } catch {
    return { ok: false, reason: "Sessão inválida." };
  }
}

/** Lê cookies de um request Node / Vercel. */
export function parseCookies(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie || "";
  const out = {};
  for (const part of String(raw).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readSession(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE]);
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  const secure =
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
    String(process.env.AUTH_COOKIE_SECURE || "") === "1";
  const maxAge = clear ? 0 : sessionDays() * 24 * 60 * 60;
  const parts = [
    `${COOKIE}=${clear ? "" : encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function newAuthSecret() {
  return randomBytes(32).toString("hex");
}

export { COOKIE as SESSION_COOKIE_NAME };
