import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { readCosConfig } from "@/lib/cos";
import {
  calculateGrantPlan,
  createRunVoucherCosClient,
  loadSubmissionRecordByKey,
  saveSubmissionRecord
} from "@/lib/run-voucher";
import { issueVoucherToYinbao } from "@/lib/yinbao";

type ApprovePayload = {
  recordKey?: string;
  note?: string;
  customerUid?: string;
};

export const runtime = "nodejs";

function stringifyUnknownError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function POST(request: NextRequest) {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ApprovePayload | null;
  const recordKey = body?.recordKey?.trim();
  const note = body?.note?.trim();
  const customerUidInput = body?.customerUid?.trim();
  const parsedInputUid =
    customerUidInput && /^\d+$/.test(customerUidInput) ? Number(customerUidInput) : undefined;
  if (!recordKey) {
    return NextResponse.json({ success: false, error: "recordKey is required" }, { status: 400 });
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
    const record = await loadSubmissionRecordByKey({ cos, config, key: recordKey });
    if (!record) {
      return NextResponse.json({ success: false, error: "未找到申请记录" }, { status: 404 });
    }

    if (record.status !== "pending" && record.status !== "issue_failed") {
      return NextResponse.json(
        { success: false, error: `当前状态为 ${record.status}，不可重复审核通过` },
        { status: 409 }
      );
    }

    const grantPlan = calculateGrantPlan(record.km);
    const nowIso = new Date().toISOString();
    const fallbackUid =
      typeof record.customerUid === "number"
        ? record.customerUid
        : typeof (record as { customerUid?: unknown }).customerUid === "string" &&
            /^\d+$/.test((record as { customerUid?: string }).customerUid || "")
          ? Number((record as { customerUid?: string }).customerUid)
          : undefined;
    const customerUidValue = Number.isFinite(parsedInputUid) ? parsedInputUid : fallbackUid;

    if (grantPlan.mode === "none") {
      const updated = {
        ...record,
        status: "rejected" as const,
        reviewedAt: nowIso,
        reviewedBy: session.username,
        reviewNote: note || grantPlan.note,
        grantPlan,
        yinbao: {
          status: "not_required" as const,
          message: "未达门槛，不发券"
        }
      };
      await saveSubmissionRecord({ cos, config, key: recordKey, record: updated });
      return NextResponse.json({
        success: true,
        outcome: "rejected",
        reason: grantPlan.note,
        item: updated
      });
    }

    if (grantPlan.mode === "owner_treat") {
      const updated = {
        ...record,
        status: "approved" as const,
        reviewedAt: nowIso,
        reviewedBy: session.username,
        reviewNote: note || grantPlan.note,
        grantPlan,
        yinbao: {
          status: "not_required" as const,
          message: ">=300km 走老板单独请喝酒流程"
        }
      };
      await saveSubmissionRecord({ cos, config, key: recordKey, record: updated });
      return NextResponse.json({
        success: true,
        outcome: "approved_owner_treat",
        item: updated
      });
    }

    const issueResult = await issueVoucherToYinbao({
      submission: record,
      grantPlan,
      customerUid: customerUidInput || (customerUidValue ? String(customerUidValue) : undefined)
    });
    const updated = {
      ...record,
      customerUid: customerUidValue,
      status: issueResult.success ? ("approved" as const) : ("issue_failed" as const),
      reviewedAt: nowIso,
      reviewedBy: session.username,
      reviewNote: note || grantPlan.note,
      grantPlan,
      yinbao: {
        status: issueResult.success ? ("issued" as const) : ("failed" as const),
        issuedAt: issueResult.success ? nowIso : undefined,
        referenceId: issueResult.referenceId,
        message: issueResult.message,
        issuedCoupons: Array.isArray((issueResult.raw as { issuedCoupons?: unknown } | undefined)?.issuedCoupons)
          ? ((issueResult.raw as { issuedCoupons: Array<{ code: string; promotionCouponUid: string; codeExpiredDate?: string }> }).issuedCoupons)
          : undefined,
        raw: issueResult.raw
      }
    };
    await saveSubmissionRecord({ cos, config, key: recordKey, record: updated });

    if (!issueResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: issueResult.message || "银豹发券失败",
          item: updated
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      outcome: "approved_issued",
      item: updated
    });
  } catch (error) {
    const message = stringifyUnknownError(error);
    console.error("[run-voucher/approve] unexpected error:", error);
    return NextResponse.json({ success: false, error: `审核通过操作失败：${message}` }, { status: 500 });
  }
}
