import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { readCosConfig } from "@/lib/cos";
import {
  createRunVoucherCosClient,
  getRunVoucherActivitySlug,
  listSubmissionRecords,
  type SubmissionRecord,
  type SubmissionStatus
} from "@/lib/run-voucher";

type MockItem = SubmissionRecord & { recordKey: string };

const MOCK_ITEMS: MockItem[] = [
  {
    recordKey: "run-voucher/default/2026/04/records/mock-001.json",
    id: "mock-001", activitySlug: "default", month: "2026-04",
    name: "李明", contact: "13812345678", km: 168,
    screenshotKey: "", screenshotKeys: ["mock/s1.jpg", "mock/s2.jpg"],
    screenshotContentType: "image/jpeg", screenshotSize: 1024000,
    submittedAt: "2026-05-03T09:21:00+08:00",
    status: "pending",
    customerNum: "10023", customerUid: "U_88821",
    grantPlan: { mode: "voucher", amountYuan: 100, packCount: 1, note: "100元券包" },
  },
  {
    recordKey: "run-voucher/default/2026/04/records/mock-002.json",
    id: "mock-002", activitySlug: "default", month: "2026-04",
    name: "王芳", contact: "13987654321", km: 237,
    screenshotKey: "", screenshotKeys: ["mock/s3.jpg"],
    screenshotContentType: "image/jpeg", screenshotSize: 860000,
    submittedAt: "2026-05-04T14:05:00+08:00",
    status: "pending",
    customerNum: "10051", customerUid: "U_88834",
    grantPlan: { mode: "voucher", amountYuan: 200, packCount: 2, note: "200元券包" },
  },
  {
    recordKey: "run-voucher/default/2026/04/records/mock-003.json",
    id: "mock-003", activitySlug: "default", month: "2026-04",
    name: "张伟", contact: "13600001111", km: 312,
    screenshotKey: "", screenshotKeys: ["mock/s4.jpg", "mock/s5.jpg", "mock/s6.jpg"],
    screenshotContentType: "image/jpeg", screenshotSize: 1200000,
    submittedAt: "2026-05-02T18:30:00+08:00",
    status: "approved",
    reviewedAt: "2026-05-05T10:00:00+08:00", reviewedBy: "admin",
    customerNum: "10078", customerUid: "U_88901",
    grantPlan: { mode: "owner_treat", amountYuan: 0, packCount: 0, note: "老板请喝酒" },
    yinbao: { status: "not_required", message: "老板请喝酒流程，无需发券" },
  },
  {
    recordKey: "run-voucher/default/2026/04/records/mock-004.json",
    id: "mock-004", activitySlug: "default", month: "2026-04",
    name: "陈静", contact: "13500009999", km: 143,
    screenshotKey: "", screenshotKeys: ["mock/s7.jpg"],
    screenshotContentType: "image/jpeg", screenshotSize: 750000,
    submittedAt: "2026-05-05T11:22:00+08:00",
    status: "issue_failed",
    customerNum: "10099", customerUid: "U_88955",
    grantPlan: { mode: "voucher", amountYuan: 100, packCount: 1, note: "100元券包" },
    yinbao: { status: "failed", message: "指定会员不存在，请检查 customerUid 或凭证配置" },
  },
  {
    recordKey: "run-voucher/default/2026/04/records/mock-005.json",
    id: "mock-005", activitySlug: "default", month: "2026-04",
    name: "刘洋", contact: "13711112222", km: 58,
    screenshotKey: "", screenshotKeys: ["mock/s8.jpg"],
    screenshotContentType: "image/jpeg", screenshotSize: 920000,
    submittedAt: "2026-05-06T08:45:00+08:00",
    status: "rejected",
    reviewedAt: "2026-05-06T15:00:00+08:00", reviewedBy: "admin",
    reviewNote: "跑量不足100km，不符合兑换条件",
    customerNum: "10112", customerUid: "U_89002",
    grantPlan: { mode: "none", amountYuan: 0, packCount: 0, note: "不足100km" },
  },
  {
    recordKey: "run-voucher/default/2026/04/records/mock-006.json",
    id: "mock-006", activitySlug: "default", month: "2026-04",
    name: "赵磊", contact: "13922223333", km: 205,
    screenshotKey: "", screenshotKeys: ["mock/s9.jpg", "mock/s10.jpg"],
    screenshotContentType: "image/jpeg", screenshotSize: 1100000,
    submittedAt: "2026-05-07T16:10:00+08:00",
    status: "approved",
    reviewedAt: "2026-05-08T09:30:00+08:00", reviewedBy: "admin",
    customerNum: "10145", customerUid: "U_89100",
    grantPlan: { mode: "voucher", amountYuan: 200, packCount: 2, note: "200元券包" },
    yinbao: {
      status: "issued",
      issuedAt: "2026-05-08T09:30:05+08:00",
      message: "发券成功",
      issuedCoupons: [
        { code: "CB240508001", promotionCouponUid: "40", codeExpiredDate: "2026-06-08" },
        { code: "CB240508002", promotionCouponUid: "40", codeExpiredDate: "2026-06-08" },
        { code: "CB240508003", promotionCouponUid: "20", codeExpiredDate: "2026-06-08" },
      ],
    },
  },
];

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

  // Mock fallback when COS is not configured
  if (!process.env.TENCENT_COS_BUCKET) {
    const filtered = status === "all"
      ? MOCK_ITEMS
      : MOCK_ITEMS.filter((i) => i.status === status);
    return NextResponse.json({ success: true, activitySlug: "default", status, count: filtered.length, items: filtered });
  }

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
