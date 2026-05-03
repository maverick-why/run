import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { readCosConfig } from "@/lib/cos";
import {
  createRunVoucherCosClient,
  getRunVoucherActivitySlug,
  listSubmissionRecords,
  type SubmissionStatus
} from "@/lib/run-voucher";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const statusParam = request.nextUrl.searchParams.get("status") || "pending";
  const status = (
    ["pending", "approved", "rejected", "issue_failed", "all"].includes(statusParam)
      ? statusParam
      : "pending"
  ) as SubmissionStatus | "all";

  let config;
  try {
    config = readCosConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "server config error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }

  try {
    const cos = createRunVoucherCosClient(config);
    const activitySlug = getRunVoucherActivitySlug();
    const records = await listSubmissionRecords({
      cos,
      config,
      activitySlug,
      status,
      limit: 120
    });

    return NextResponse.json({
      success: true,
      activitySlug,
      status,
      count: records.length,
      items: records.map((item) => ({
        recordKey: item.key,
        ...item.record
      }))
    });
  } catch {
    return NextResponse.json({ success: false, error: "读取申请记录失败" }, { status: 500 });
  }
}
