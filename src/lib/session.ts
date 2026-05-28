import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isAdminMobile } from "./auth";

export type SessionRole = "admin" | "customer";

export type Session = {
  mobile: string;
  role: SessionRole;
  /** Unix epoch seconds when the session expires. */
  exp: number;
};

export const SESSION_COOKIE = "notekart_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

class ConfigError extends Error {}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new ConfigError(
      "SESSION_SECRET is not configured. Set a long random string in the environment.",
    );
  }
  return secret;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string) {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

/** Serialize and HMAC-sign a session payload into a compact token. */
export function signSession(payload: Omit<Session, "exp"> & { exp?: number }) {
  const exp = payload.exp ?? Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const body = base64url(JSON.stringify({ mobile: payload.mobile, role: payload.role, exp }));
  return `${body}.${sign(body)}`;
}

/** Verify a token's signature and expiry. Returns the session or null. */
export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let expectedSig: string;
  try {
    expectedSig = sign(body);
  } catch {
    // Missing secret — treat as unauthenticated rather than crashing every request.
    return null;
  }

  const provided = Buffer.from(providedSig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (typeof parsed.mobile !== "string" || (parsed.role !== "admin" && parsed.role !== "customer")) {
      return null;
    }
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Issue a session cookie for the given mobile. Role is derived server-side. */
export async function createSession(mobile: string) {
  const role: SessionRole = isAdminMobile(mobile) ? "admin" : "customer";
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = signSession({ mobile, role, exp });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return { mobile, role };
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Read and verify the current session from the request cookies. */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

/** Thrown by require* helpers; carries the HTTP status to return. */
export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "You must be logged in.");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "You must be logged in.");
  if (session.role !== "admin") throw new AuthError(403, "Admin access only.");
  return session;
}
