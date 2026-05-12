import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createCosClient, readCosConfig } from "@/lib/cos";
import {
  buildSubmissionKeys,
  getRunVoucherActivitySlug,
  normalizeSubmissionMonth,
  type SubmissionRecord
} from "@/lib/run-voucher";
import { resolveImageExtension } from "@/lib/upload";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function putObject(
  cos: ReturnType<typeof createCosClient>,
  params: {
    Bucket: string;
    Region: string;
    Key: string;
    Body: Buffer | string;
    ContentType: string;
  }
) {
  return new Promise<void>((resolve, reject) => {
    cos.putObject(params, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }

  const name = String(formData.get("name") || "").trim();
  const contact = String(formData.get("contact") || "").trim();
  const customerNum = String(formData.get("customerNum") || "").trim();
  const customerUid = String(formData.get("customerUid") || "").trim();
  const kmRaw = String(formData.get("km") || "").trim();
  const screenshotListRaw = formData.getAll("screenshots");
  const legacyScreenshot = formData.get("screenshot");
  const month = normalizeSubmissionMonth(String(formData.get("month") || ""));

  const screenshots: File[] = screenshotListRaw.filter((item): item is File => item instanceof File);
  if (screenshots.length === 0 && legacyScreenshot instanceof File) {
    screenshots.push(legacyScreenshot);
  }

  if (!name || !contact || !customerNum || !kmRaw || screenshots.length === 0) {
    return NextResponse.json(
      { success: false, error: "缺少必填字段，请检查后重试" },
      { status: 400 }
    );
  }
  if (screenshots.length > 6) {
    return NextResponse.json({ success: false, error: "最多上传6张截图" }, { status: 400 });
  }
  if (!/^\d+$/.test(customerNum)) {
    return NextResponse.json({ success: false, error: "会员编号（customerNum）格式不正确" }, { status: 400 });
  }
  if (customerUid && !/^\d+$/.test(customerUid)) {
    return NextResponse.json({ success: false, error: "会员UID格式不正确" }, { status: 400 });
  }

  for (const file of screenshots) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "仅支持图片格式截图" },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "单张截图大小不能超过10MB" },
        { status: 400 }
      );
    }
  }

  const km = Number(kmRaw);
  if (!Number.isFinite(km) || km < 0) {
    return NextResponse.json({ success: false, error: "跑量数值不合法" }, { status: 400 });
  }

  let config;
  try {
    config = readCosConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务配置错误";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }

  const activitySlug = getRunVoucherActivitySlug();
  const submissionId = randomUUID();
  const first = screenshots[0];
  const ext = resolveImageExtension(first.name, first.type);
  const objectKeys = buildSubmissionKeys(activitySlug, month, ext, submissionId);
  const screenshotBuffers = await Promise.all(
    screenshots.map(async (file) => ({
      file,
      buffer: Buffer.from(await file.arrayBuffer()),
      ext: resolveImageExtension(file.name, file.type)
    }))
  );
  const screenshotKeys = screenshotBuffers.map((item, idx) =>
    idx === 0
      ? objectKeys.screenshot
      : objectKeys.screenshot.replace(`.${ext}`, `-${String(idx + 1)}.${item.ext}`)
  );

  const record: SubmissionRecord = {
    id: submissionId,
    activitySlug,
    month,
    name,
    contact,
    km,
    screenshotKey: screenshotKeys[0],
    screenshotContentType: first.type || "application/octet-stream",
    screenshotSize: first.size,
    screenshotKeys,
    screenshotContentTypes: screenshotBuffers.map((item) => item.file.type || "application/octet-stream"),
    screenshotSizes: screenshotBuffers.map((item) => item.file.size),
    submittedAt: new Date().toISOString(),
    status: "pending",
    customerNum,
    customerUid: customerUid || undefined
  };

  try {
    const cos = createCosClient(config);
    await Promise.all(
      screenshotBuffers.map((item, idx) =>
        putObject(cos, {
          Bucket: config.bucket,
          Region: config.region,
          Key: screenshotKeys[idx],
          Body: item.buffer,
          ContentType: item.file.type || "application/octet-stream"
        })
      )
    );

    await putObject(cos, {
      Bucket: config.bucket,
      Region: config.region,
      Key: objectKeys.record,
      Body: JSON.stringify(record),
      ContentType: "application/json; charset=utf-8"
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "提交失败，上传到存储服务时发生错误" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: submissionId });
}
