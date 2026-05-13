"use client";

import { useEffect, useMemo, useState } from "react";
import { type GrantPlan, type SubmissionRecord, type SubmissionStatus } from "@/lib/run-voucher";

type SubmissionItem = SubmissionRecord & { recordKey: string };

type ListResponse = {
  success: boolean;
  error?: string;
  items?: SubmissionItem[];
};

type ApproveResponse = {
  success: boolean;
  error?: string;
  item?: SubmissionItem;
  outcome?: string;
};

const FILTERS: Array<{ value: SubmissionStatus | "all"; label: string }> = [
  { value: "pending", label: "待审核" },
  { value: "issue_failed", label: "发券失败" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "all", label: "全部" }
];

function planText(plan?: GrantPlan) {
  if (!plan) return "-";
  if (plan.mode === "voucher") return `${plan.amountYuan}元券包（${plan.packCount}套）`;
  if (plan.mode === "owner_treat") return ">=300km（老板请喝酒）";
  return "不满足发券门槛";
}

function fmtTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function getScreenshotKeys(item: SubmissionItem) {
  if (Array.isArray(item.screenshotKeys) && item.screenshotKeys.length > 0) {
    return item.screenshotKeys;
  }
  return item.screenshotKey ? [item.screenshotKey] : [];
}

export function RunVoucherReviewPanel({ reviewer }: { reviewer: string }) {
  const [status, setStatus] = useState<SubmissionStatus | "all">("pending");
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingKey, setApprovingKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/run-voucher/submissions?status=${status}`);
      const payload = (await response.json().catch(() => null)) as ListResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "读取数据失败");
      }
      setItems(payload.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "读取数据失败";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending" || item.status === "issue_failed").length,
    [items]
  );

  async function approve(item: SubmissionItem) {
    setApprovingKey(item.recordKey);
    setError("");
    setNotice("");
    if (item.km >= 100 && item.km < 300) {
      if (!item.customerNum || !/^\d+$/.test(item.customerNum)) {
        setError("记录里缺少会员编号（customerNum），请让用户在前台重新绑定后再提交");
        setApprovingKey("");
        return;
      }
    }
    try {
      const response = await fetch("/api/run-voucher/submissions/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recordKey: item.recordKey
        })
      });
      const raw = await response.text();
      let payload: ApproveResponse | null = null;
      try {
        payload = raw ? (JSON.parse(raw) as ApproveResponse) : null;
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || raw.slice(0, 240) || `审核失败（HTTP ${response.status}）`);
      }
      setNotice("审核已完成，记录状态已更新");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "审核失败");
    } finally {
      setApprovingKey("");
    }
  }

  async function reject(item: SubmissionItem) {
    setApprovingKey(item.recordKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/run-voucher/submissions/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recordKey: item.recordKey,
          action: "reject"
        })
      });
      const raw = await response.text();
      let payload: ApproveResponse | null = null;
      try {
        payload = raw ? (JSON.parse(raw) as ApproveResponse) : null;
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || raw.slice(0, 240) || `拒绝失败（HTTP ${response.status}）`);
      }
      setNotice("已拒绝该申请，记录状态已更新");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "拒绝失败");
    } finally {
      setApprovingKey("");
    }
  }

  async function openScreenshot(key: string) {
    try {
      const response = await fetch(`/api/run-voucher/screenshot-url?key=${encodeURIComponent(key)}`);
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.success || !payload.url) {
        throw new Error(payload?.error || "生成截图链接失败");
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开截图失败");
    }
  }

  return (
    <section className="card stack" style={{ gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div className="stack" style={{ gap: 4 }}>
          <strong>当前审核员：{reviewer}</strong>
          <span className="muted">待处理：{pendingCount}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={status === filter.value ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setStatus(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
          <button className="btn btn-secondary" onClick={() => void load()} type="button">
            刷新
          </button>
        </div>
      </div>

      {error ? <p style={{ margin: 0, color: "#af2934" }}>{error}</p> : null}
      {notice ? <p style={{ margin: 0, color: "#0a7b34" }}>{notice}</p> : null}

      {loading ? (
        <p className="muted" style={{ margin: 0 }}>
          加载中...
        </p>
      ) : items.length ? (
        <div className="stack" style={{ gap: 10 }}>
          {items.map((item) => (
            <div key={item.recordKey} style={{ border: "1px solid #d9e2ef", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>
                  {item.name} / {item.contact}
                </strong>
                <span className="muted">{fmtTime(item.submittedAt)}</span>
              </div>
              <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                <div>跑量：{item.km} km</div>
                <div>申请月份：{item.month}</div>
                <div>状态：{item.status}</div>
                <div>预期处理：{planText(item.grantPlan)}</div>
                <div>会员编号：{item.customerNum || "-"}</div>
                <div>会员UID：{item.customerUid || "-"}</div>
                <div style={{ wordBreak: "break-all" }}>
                  截图文件（{getScreenshotKeys(item).length}张）：
                  <code>{getScreenshotKeys(item).join(", ")}</code>
                </div>
                {item.reviewNote ? <div>审核备注：{item.reviewNote}</div> : null}
                {item.yinbao?.message ? (
                  <div className="muted">银豹返回：{item.yinbao.message}</div>
                ) : null}
                {item.yinbao?.issuedCoupons?.length ? (
                  <div>
                    发券码：
                    <code>
                      {item.yinbao.issuedCoupons
                        .map((coupon) => `${coupon.code}(${coupon.promotionCouponUid})`)
                        .join(", ")}
                    </code>
                  </div>
                ) : null}
              </div>

              {(item.status === "pending" || item.status === "issue_failed") && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void openScreenshot(getScreenshotKeys(item)[0] || item.screenshotKey)}
                    type="button"
                  >
                    查看截图1
                  </button>
                  {getScreenshotKeys(item).slice(1).map((key, idx) => (
                    <button
                      key={key}
                      className="btn btn-secondary"
                      onClick={() => void openScreenshot(key)}
                      type="button"
                    >
                      查看截图{idx + 2}
                    </button>
                  ))}
                  <button
                    className="btn btn-primary"
                    disabled={approvingKey === item.recordKey}
                    onClick={() => void approve(item)}
                    type="button"
                  >
                    {approvingKey === item.recordKey ? "处理中..." : "审核通过并通知银豹发券"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={approvingKey === item.recordKey}
                    onClick={() => {
                      if (window.confirm("确认拒绝这条申请吗？")) {
                        void reject(item);
                      }
                    }}
                    type="button"
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          当前筛选条件下暂无记录。
        </p>
      )}
    </section>
  );
}
