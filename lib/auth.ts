import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

function readRequiredEnv(name: "ADMIN_PASSWORD") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function safeEquals(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function verifyAdminCredentials(password: string) {
  const expectedPassword = readRequiredEnv("ADMIN_PASSWORD");
  return safeEquals(password, expectedPassword);
}

export function getAdminDisplayName() {
  return process.env.ADMIN_USERNAME || "admin";
}

export function getSessionFromCookies() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
