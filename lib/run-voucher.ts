import COS from "cos-nodejs-sdk-v5";
import { createCosClient, type CosConfig } from "@/lib/cos";

export type SubmissionStatus = "pending" | "approved" | "rejected" | "issue_failed";

export type GrantPlan = {
  mode: "none" | "voucher" | "owner_treat";
  amountYuan: number;
  packCount: number;
  note: string;
};

export type YinbaoIssueResult = {
  success: boolean;
  referenceId?: string;
  message?: string;
  raw?: unknown;
};

export type SubmissionRecord = {
  id: string;
  activitySlug: string;
  month: string;
  name: string;
  contact: string;
  km: number;
  screenshotKey: string;
  screenshotContentType: string;
  screenshotSize: number;
  screenshotKeys?: string[];
  screenshotContentTypes?: string[];
  screenshotSizes?: number[];
  submittedAt: string;
  status: SubmissionStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  grantPlan?: GrantPlan;
  customerUid?: string;
  customerNum?: string;
  yinbao?: {
    status: "not_required" | "issued" | "failed";
    issuedAt?: string;
    referenceId?: string;
    message?: string;
    issuedCoupons?: Array<{
      code: string;
      promotionCouponUid: string;
      codeExpiredDate?: string;
    }>;
    raw?: unknown;
  };
};

export function getRunVoucherActivitySlug() {
  return process.env.NEXT_PUBLIC_ACTIVITY_SLUG || "default";
}

export function normalizeSubmissionMonth(raw: string | null) {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    return raw;
  }
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function buildSubmissionKeys(activitySlug: string, month: string, ext: string, id: string) {
  const safeMonth = month.replace("-", "/");
  return {
    screenshot: `run-voucher/${activitySlug}/${safeMonth}/screenshots/${id}.${ext}`,
    record: `run-voucher/${activitySlug}/${safeMonth}/records/${id}.json`
  };
}

export function calculateGrantPlan(kmRaw: number): GrantPlan {
  const km = Math.floor(Number.isFinite(kmRaw) ? kmRaw : 0);
  if (km < 100) {
    return {
      mode: "none",
      amountYuan: 0,
      packCount: 0,
      note: "未达到100km起兑门槛"
    };
  }
  if (km >= 300) {
    return {
      mode: "owner_treat",
      amountYuan: 0,
      packCount: 0,
      note: "达到300km及以上，走老板单独请喝酒流程"
    };
  }
  if (km >= 200) {
    return {
      mode: "voucher",
      amountYuan: 200,
      packCount: 2,
      note: "发放200元券包（40+40+20）x2"
    };
  }
  return {
    mode: "voucher",
    amountYuan: 100,
    packCount: 1,
    note: "发放100元券包（40+40+20）"
  };
}

function decodeBodyToString(body: Buffer | string) {
  if (typeof body === "string") {
    return body;
  }
  return body.toString("utf-8");
}

async function fetchSubmissionRecord(
  cos: COS,
  config: CosConfig,
  key: string
): Promise<SubmissionRecord | null> {
  const data = await cos.getObject({
    Bucket: config.bucket,
    Region: config.region,
    Key: key
  });
  const text = decodeBodyToString(data.Body);
  const parsed = JSON.parse(text) as SubmissionRecord;
  if (!parsed?.id || !parsed?.submittedAt || !parsed?.status) {
    return null;
  }
  return parsed;
}

export async function listSubmissionRecords(params: {
  cos: COS;
  config: CosConfig;
  activitySlug: string;
  limit?: number;
  status?: SubmissionStatus | "all";
}) {
  const { cos, config, activitySlug, status = "pending", limit = 80 } = params;
  const prefix = `run-voucher/${activitySlug}/`;
  const candidates: Array<{ key: string; lastModified: string }> = [];
  let marker: string | undefined;

  while (candidates.length < limit * 3) {
    const page = await cos.getBucket({
      Bucket: config.bucket,
      Region: config.region,
      Prefix: prefix,
      Marker: marker,
      MaxKeys: 1000
    });

    const pageItems = (page.Contents || [])
      .filter((item) => item.Key.includes("/records/") && item.Key.endsWith(".json"))
      .map((item) => ({ key: item.Key, lastModified: item.LastModified }));

    candidates.push(...pageItems);
    if (page.IsTruncated !== "true" || !page.NextMarker) {
      break;
    }
    marker = page.NextMarker;
  }

  candidates.sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified));
  const keys = candidates.slice(0, limit).map((item) => item.key);
  const records = (await Promise.all(
    keys.map((key) =>
      fetchSubmissionRecord(cos, config, key)
        .then((record) => (record ? { record, key } : null))
        .catch(() => null)
    )
  ))
    .filter((item): item is { record: SubmissionRecord; key: string } => Boolean(item))
    .sort(
      (a, b) => Date.parse(b.record.submittedAt || b.record.reviewedAt || "") - Date.parse(a.record.submittedAt || a.record.reviewedAt || "")
    );

  if (status === "all") {
    return records;
  }
  return records.filter((item) => item.record.status === status);
}

export async function loadSubmissionRecordByKey(params: {
  cos: COS;
  config: CosConfig;
  key: string;
}) {
  const { cos, config, key } = params;
  return fetchSubmissionRecord(cos, config, key);
}

export async function saveSubmissionRecord(params: {
  cos: COS;
  config: CosConfig;
  key: string;
  record: SubmissionRecord;
}) {
  const { cos, config, key, record } = params;
  await cos.putObject({
    Bucket: config.bucket,
    Region: config.region,
    Key: key,
    Body: JSON.stringify(record),
    ContentType: "application/json; charset=utf-8"
  });
}

export function createRunVoucherCosClient(config: CosConfig) {
  return createCosClient(config);
}
