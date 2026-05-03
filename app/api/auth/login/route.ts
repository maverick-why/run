import { NextRequest, NextResponse } from "next/server";
import { getAdminDisplayName, verifyAdminCredentials } from "@/lib/auth";
import { SESSION_COOKIE_NAME, createSessionToken, getSessionMaxAgeSeconds } from "@/lib/session";

type LoginPayload = {
  password?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as LoginPayload | null;
  if (!body?.password) {
    return NextResponse.json({ error: "password is required" }, { status: 400 });
  }

  let isValid = false;
  try {
    isValid = verifyAdminCredentials(body.password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "server config error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(getAdminDisplayName()),
    maxAge: getSessionMaxAgeSeconds(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return response;
}
