import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "workplace-login-context";
const TOKEN_PREFIX = "wctx1";

export interface WorkplaceLoginContext {
  v: 1;
  email?: string;
  tenantKey: string;
  tenantName: string;
  locale: "en" | "ar";
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  allowRegistration: false;
  exp: number;
}

function secret() {
  const value = process.env.WORKPLACE_LOGIN_CONTEXT_SECRET;
  if (!value || value.length < 32) return null;
  return value;
}

function validColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function validLogo(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function decodeWorkplaceLoginContext(token: string | null | undefined, now = new Date()): WorkplaceLoginContext | null {
  const key = secret();
  if (!key || !token) return null;
  const [prefix, encoded, provided] = token.split(".");
  if (prefix !== TOKEN_PREFIX || !encoded || !provided) return null;
  const expected = createHmac("sha256", key).update(encoded).digest();
  let signature: Buffer;
  try {
    signature = Buffer.from(provided, "base64url");
  } catch {
    return null;
  }
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;

  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as WorkplaceLoginContext;
    if (
      value.v !== 1 ||
      value.allowRegistration !== false ||
      !Number.isInteger(value.exp) ||
      value.exp <= Math.floor(now.getTime() / 1000) ||
      value.exp > Math.floor(now.getTime() / 1000) + 10 * 60 ||
      !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(value.tenantKey) ||
      typeof value.tenantName !== "string" ||
      value.tenantName.trim().length < 1 ||
      value.tenantName.length > 120 ||
      !["en", "ar"].includes(value.locale) ||
      (value.email !== undefined && (value.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) ||
      (value.logoUrl !== undefined && !validLogo(value.logoUrl)) ||
      (value.primaryColor !== undefined && !validColor(value.primaryColor)) ||
      (value.accentColor !== undefined && !validColor(value.accentColor))
    ) return null;
    return { ...value, tenantName: value.tenantName.trim() };
  } catch {
    return null;
  }
}

export async function persistWorkplaceLoginContext(token: string | null | undefined) {
  const store = await cookies();
  const context = decodeWorkplaceLoginContext(token);
  if (!context) {
    store.delete(COOKIE_NAME);
    return null;
  }
  store.set(COOKIE_NAME, token!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
    maxAge: Math.max(1, context.exp - Math.floor(Date.now() / 1000)),
  });
  return context;
}

export async function getWorkplaceLoginContext() {
  const store = await cookies();
  return decodeWorkplaceLoginContext(store.get(COOKIE_NAME)?.value);
}
