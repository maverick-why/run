import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createCosClient, createSignedObjectUrl, readCosConfig } from "@/lib/cos";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const key = request.nextUrl.searchParams.get("key")?.trim() || "";
  if (!key || !key.startsWith("run-voucher/")) {
    return NextResponse.json({ success: false, error: "invalid key" }, { status: 400 });
  }

  let config;
  try {
    config = readCosConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "server config error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }

  try {
    const cos = createCosClient(config);
    const url = createSignedObjectUrl(cos, config, key, 10 * 60);
    return NextResponse.json({ success: true, url, expiresInSeconds: 600 });
  } catch {
    return NextResponse.json({ success: false, error: "生成截图链接失败" }, { status: 500 });
  }
}
