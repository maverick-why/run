import { createHash, randomBytes } from "node:crypto";
import { type GrantPlan, type SubmissionRecord, type YinbaoIssueResult } from "@/lib/run-voucher";

type YinbaoConfig = {
  appId: string;
  appKey: string;
  queryAppId: string;
  queryAppKey: string;
  areaId: string;
  userAgent: string;
  groupShare: number;
  couponUid40: string;
  couponUid20: string;
  couponName40: string;
  couponName20: string;
  requestTimeoutMs: number;
  mockMode: boolean;
};

type PospalResponse<T = unknown> = {
  status?: string;
  errorCode?: number | string;
  messages?: string[] | string;
  data?: T;
};

type AddedCouponResult = {
  codeExpiredDate?: string;
};

type CouponPromotion = {
  promotionCouponUid?: string | number;
  name?: string;
  enable?: string | number;
  createUserAppId?: string;
};

function parsePospalPayloadPreserveLong(text: string) {
  // Preserve long integer IDs (especially *Uid fields) as strings to avoid JS precision loss.
  const normalized = text.replace(
    /("(?:[A-Za-z0-9_]*[Uu]id)"\s*:\s*)(-?\d{16,})/g,
    '$1"$2"'
  );
  return JSON.parse(normalized) as PospalResponse<unknown>;
}

function readYinbaoConfig(): YinbaoConfig {
  const appId = process.env.POSPAL_APP_ID || "";
  const appKey = process.env.POSPAL_APP_KEY || "";
  const queryAppId = process.env.POSPAL_QUERY_APP_ID || appId;
  const queryAppKey = process.env.POSPAL_QUERY_APP_KEY || appKey;
  const areaId = process.env.POSPAL_AREA_ID || "1";
  const userAgent = process.env.POSPAL_USER_AGENT || "openApi";
  const groupShare = Number(process.env.POSPAL_GROUP_SHARE || "1");
  const couponUid40 = process.env.POSPAL_COUPON_UID_40 || "";
  const couponUid20 = process.env.POSPAL_COUPON_UID_20 || "";
  const couponName40 = process.env.POSPAL_COUPON_NAME_40 || "";
  const couponName20 = process.env.POSPAL_COUPON_NAME_20 || "";
  const requestTimeoutMs = Number(process.env.YINBAO_TIMEOUT_MS || "10000");
  const mockMode = process.env.YINBAO_MOCK_MODE === "true";
  return {
    appId,
    appKey,
    queryAppId,
    queryAppKey,
    areaId,
    userAgent,
    groupShare,
    couponUid40,
    couponUid20,
    couponName40,
    couponName20,
    requestTimeoutMs,
    mockMode
  };
}

function buildCouponUidSequence(grantPlan: GrantPlan, config: YinbaoConfig) {
  const unitPack = [config.couponUid40, config.couponUid40, config.couponUid20];
  const sequence: string[] = [];
  for (let i = 0; i < grantPlan.packCount; i += 1) {
    sequence.push(...unitPack);
  }
  return sequence;
}

function genCouponCode() {
  const rand = randomBytes(4).toString("hex").toUpperCase();
  const tail = Date.now().toString().slice(-8);
  return `RV${tail}${rand}`;
}

function stringifyBody(body: Record<string, unknown>) {
  return JSON.stringify(body);
}

function computeSignatureV3(appId: string, appKey: string, timestamp: string, body: string) {
  return createHash("md5").update(`${appId}${appKey}${timestamp}${body}`, "utf8").digest("hex").toUpperCase();
}

function computeSignatureLegacy(appKey: string, body: string) {
  return createHash("md5").update(`${appKey}${body}`, "utf8").digest("hex").toUpperCase();
}

function getMessage(messages: unknown) {
  if (Array.isArray(messages)) {
    return messages.join(" | ");
  }
  if (typeof messages === "string") {
    return messages;
  }
  return "";
}

function normalizeName(name: string) {
  return name.trim();
}

function toUidString(uid: string | number | undefined) {
  if (uid === undefined || uid === null) return "";
  return String(uid).trim();
}

function isNumericUid(value: string) {
  return /^\d+$/.test(value);
}

async function postPospal<T>(config: YinbaoConfig, path: string, bodyObj: Record<string, unknown>) {
  return postPospalWithCredential(
    {
      appId: config.appId,
      appKey: config.appKey
    },
    config,
    path,
    bodyObj
  );
}

async function postPospalWithCredential<T>(
  credential: { appId: string; appKey: string },
  config: YinbaoConfig,
  path: string,
  bodyObj: Record<string, unknown>
) {
  const timestamp = String(Date.now());
  const payloadObj = Object.prototype.hasOwnProperty.call(bodyObj, "appId")
    ? bodyObj
    : { ...bodyObj, appId: credential.appId };
  const body = stringifyBody(payloadObj);
  const signatureV3 = computeSignatureV3(credential.appId, credential.appKey, timestamp, body);
  const signatureLegacy = computeSignatureLegacy(credential.appKey, body);
  const isLegacyCustomerQuery = path === "/customerOpenApi/queryByNumber" || path === "/customerOpenApi/queryByUid";
  const baseUrl = isLegacyCustomerQuery
    ? `https://area${config.areaId}-win.pospal.cn:443/pospal-api2/openapi/v1`
    : `https://openapi${config.areaId}.pospal.cn/openinterface`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        appId: credential.appId,
        "User-Agent": config.userAgent,
        UserAgent: config.userAgent,
        "time-stamp": timestamp,
        "data-signature": signatureLegacy,
        "data-signature-v3": signatureV3,
        "Content-Type": "application/json; charset=utf-8"
      },
      body,
      signal: controller.signal
    });

    const text = await response.text();
    const payload = (text ? parsePospalPayloadPreserveLong(text) : null) as PospalResponse<T> | null;
    if (!response.ok || !payload) {
      return {
        ok: false,
        message: `银豹接口调用失败（HTTP ${response.status}）`,
        raw: payload
      };
    }
    if (String(payload.status || "").toLowerCase() !== "success") {
      return {
        ok: false,
        message: getMessage(payload.messages) || `银豹返回失败 errorCode=${payload.errorCode ?? "-"}`,
        raw: payload
      };
    }

    return {
      ok: true,
      message: getMessage(payload.messages),
      data: payload.data,
      raw: payload
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "银豹接口调用异常",
      raw: { error }
    };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCouponUids(config: YinbaoConfig) {
  let uid40 = config.couponUid40.trim();
  let uid20 = config.couponUid20.trim();

  // Support misconfiguration where coupon name is mistakenly set in UID env var.
  // If UID fields are non-numeric, treat them as candidate names and resolve from Pospal.
  const uid40LooksNumeric = isNumericUid(uid40);
  const uid20LooksNumeric = isNumericUid(uid20);
  if (uid40 && !uid40LooksNumeric) {
    if (!config.couponName40.trim()) {
      config.couponName40 = uid40;
    }
    uid40 = "";
  }
  if (uid20 && !uid20LooksNumeric) {
    if (!config.couponName20.trim()) {
      config.couponName20 = uid20;
    }
    uid20 = "";
  }

  if (uid40 && uid20 && isNumericUid(uid40) && isNumericUid(uid20)) {
    return {
      ok: true as const,
      uid40,
      uid20,
      issuerAppId40: "",
      issuerAppId20: ""
    };
  }

  const name40 = normalizeName(config.couponName40);
  const name20 = normalizeName(config.couponName20);
  if ((!uid40 && !name40) || (!uid20 && !name20)) {
    return {
      ok: false as const,
      message:
        "缺少券规则配置：请配置 POSPAL_COUPON_UID_40/20，或配置 POSPAL_COUPON_NAME_40/20 以自动匹配"
    };
  }

  const queryResult = await postPospal<CouponPromotion[]>(config, "/promotionOpenApi/queryCouponPromotions", {});
  if (!queryResult.ok) {
    return {
      ok: false as const,
      message: `查询银豹优惠券规则失败：${queryResult.message}`,
      raw: queryResult.raw
    };
  }

  const promotions = Array.isArray(queryResult.data) ? queryResult.data : [];
  let issuerAppId40 = "";
  let issuerAppId20 = "";
  if (!uid40) {
    const matched40 = promotions.find((item) => normalizeName(item.name || "") === name40);
    uid40 = toUidString(matched40?.promotionCouponUid);
    issuerAppId40 = (matched40?.createUserAppId || "").trim();
  }
  if (!uid20) {
    const matched20 = promotions.find((item) => normalizeName(item.name || "") === name20);
    uid20 = toUidString(matched20?.promotionCouponUid);
    issuerAppId20 = (matched20?.createUserAppId || "").trim();
  }

  if (!uid40 || !uid20) {
    return {
      ok: false as const,
      message: `未找到券规则UID，请确认名称精确匹配：40元='${name40}' 20元='${name20}'`,
      raw: {
        availableNames: promotions.map((item) => item.name).filter(Boolean)
      }
    };
  }

  if (!isNumericUid(uid40) || !isNumericUid(uid20)) {
    return {
      ok: false as const,
      message:
        "券规则UID格式无效：POSPAL_COUPON_UID_40/20 必须是纯数字 Long。若想按券名称匹配，请改填 POSPAL_COUPON_NAME_40/20。"
    };
  }

  return { ok: true as const, uid40, uid20, issuerAppId40, issuerAppId20 };
}

function extractCustomerUid(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  const candidates = [obj.customerUid, obj.customrUid, obj.uid, obj.customeruid];
  for (const c of candidates) {
    const text = toUidString(c as string | number | undefined);
    if (isNumericUid(text)) return text;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (!/customr?uid|customeruid|uid/i.test(k)) continue;
    const text = toUidString(v as string | number | undefined);
    if (isNumericUid(text)) return text;
  }
  return "";
}

async function resolveCustomerUid(config: YinbaoConfig, customerInput: string) {
  const normalized = customerInput.trim();
  if (!isNumericUid(normalized)) {
    return {
      ok: false as const,
      message: "会员UID/会员编号必须是纯数字"
    };
  }

  const queryCredential = {
    appId: config.queryAppId,
    appKey: config.queryAppKey
  };

  const byNumber = await postPospalWithCredential<Record<string, unknown>>(
    queryCredential,
    config,
    "/customerOpenApi/queryByNumber",
    {
      customerNum: normalized,
      groupShare: config.groupShare
    }
  );
  if (byNumber.ok) {
    const uid = extractCustomerUid(byNumber.data);
    if (uid) {
      return { ok: true as const, customerUid: uid };
    }
  }

  const byUid = await postPospalWithCredential<Record<string, unknown>>(
    queryCredential,
    config,
    "/customerOpenApi/queryByUid",
    {
      customerUid: normalized,
      groupShare: config.groupShare
    }
  );
  if (byUid.ok) {
    const uid = extractCustomerUid(byUid.data);
    if (uid) {
      return { ok: true as const, customerUid: uid };
    }
  }

  return {
    ok: false as const,
    message:
      "未找到该会员。请填写银豹 customerUid，或使用总部凭证通过 queryByNumber 可查到该会员后再发券。",
    raw: {
      byUid: byUid.raw,
      byNumber: byNumber.raw
    }
  };
}

export async function issueVoucherToYinbao(params: {
  submission: SubmissionRecord;
  grantPlan: GrantPlan;
  customerUid?: string | number;
}): Promise<YinbaoIssueResult> {
  const { submission, grantPlan } = params;
  const config = readYinbaoConfig();

  if (grantPlan.mode !== "voucher") {
    return {
      success: true,
      message: "非代金券发放场景，银豹发券跳过"
    };
  }

  if (config.mockMode) {
    const sequence = [
      ...Array.from({ length: grantPlan.packCount * 3 }).map(() => ({
        code: `MOCK${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        promotionCouponUid: "mock"
      }))
    ];
    return {
      success: true,
      referenceId: `mock-${submission.id}`,
      message: "YINBAO_MOCK_MODE=true，已使用模拟发券",
      raw: {
        customerUid: params.customerUid || submission.customerUid,
        issuedCoupons: sequence
      }
    };
  }

  const customerInput = toUidString((params.customerUid as string | number | undefined) || submission.customerUid);
  if (!customerInput || !isNumericUid(customerInput)) {
    return {
      success: false,
      message: "缺少会员UID/会员编号，无法发券。请在审核时填写纯数字。"
    };
  }

  if (!config.appId || !config.appKey) {
    return {
      success: false,
      message: "缺少 POSPAL_APP_ID 或 POSPAL_APP_KEY 配置"
    };
  }
  if (!config.queryAppId || !config.queryAppKey) {
    return {
      success: false,
      message: "缺少 POSPAL_QUERY_APP_ID 或 POSPAL_QUERY_APP_KEY 配置（会员查询需总部凭证）"
    };
  }

  const resolved = await resolveCouponUids(config);
  if (!resolved.ok) {
    return { success: false, message: resolved.message, raw: resolved.raw };
  }
  const issuerMismatch = [resolved.issuerAppId40, resolved.issuerAppId20]
    .filter((v) => v && v !== config.appId)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
  if (issuerMismatch.length > 0) {
    return {
      success: false,
      message:
        `券规则所属门店与当前发券 appId 不一致。当前 appId=${config.appId}，券规则 createUserAppId=` +
        issuerMismatch.join(",") +
        "。请改用创建该券规则的门店 appId/appKey 发券。",
      raw: {
        currentAppId: config.appId,
        couponIssuerAppIds: issuerMismatch
      }
    };
  }

  const resolvedCustomer = await resolveCustomerUid(config, customerInput);
  if (!resolvedCustomer.ok) {
    return { success: false, message: resolvedCustomer.message, raw: resolvedCustomer };
  }
  const customerUid = resolvedCustomer.customerUid;

  const couponUidSequence = buildCouponUidSequence(grantPlan, {
    ...config,
    couponUid40: resolved.uid40,
    couponUid20: resolved.uid20
  });
  const issuedCoupons: Array<{ code: string; promotionCouponUid: string; codeExpiredDate?: string }> = [];

  for (const promotionCouponUid of couponUidSequence) {
    const code = genCouponCode();
    const result = await postPospal<AddedCouponResult>(
      config,
      "/promotionOpenApi/promotion/addCouponcode",
      {
        code,
        customerUid,
        promotionCouponUid
      }
    );
    if (!result.ok) {
      return {
        success: false,
        message: `发券失败（${promotionCouponUid}）：${result.message}`,
        raw: {
          customerUid,
          issuedCoupons,
          failedOn: {
            code,
            promotionCouponUid
          },
          response: result.raw
        }
      };
    }

    issuedCoupons.push({
      code,
      promotionCouponUid,
      codeExpiredDate: (result.data as AddedCouponResult | undefined)?.codeExpiredDate
    });
  }

  return {
    success: true,
    referenceId: `${submission.id}:${customerUid}`,
    message: `已发放${issuedCoupons.length}张优惠券号`,
    raw: {
      customerUid,
      issuedCoupons
    }
  };
}
