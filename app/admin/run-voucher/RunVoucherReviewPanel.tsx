"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type GrantPlan,
  type SubmissionRecord,
  type SubmissionStatus,
} from "@/lib/run-voucher";

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
  { value: "all", label: "全部" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "待审核",
  issue_failed: "发券失败",
  approved: "已通过",
  rejected: "已拒绝",
};

function planText(plan?: GrantPlan) {
  if (!plan) return "-";
  if (plan.mode === "voucher") return `${plan.amountYuan}元券包`;
  if (plan.mode === "owner_treat") return "老板请喝酒 🍺";
  return "不足100km";
}

function fmtTime(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function getScreenshotKeys(item: SubmissionItem): string[] {
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/run-voucher/submissions?status=${status}`
      );
      const payload = (await res.json().catch(() => null)) as ListResponse | null;
      if (!res.ok || !payload?.success)
        throw new Error(payload?.error ?? "读取数据失败");
      setItems(payload.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取数据失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  const pendingCount = useMemo(
    () =>
      items.filter(
        (i) => i.status === "pending" || i.status === "issue_failed"
      ).length,
    [items]
  );

  async function approve(item: SubmissionItem) {
    setApprovingKey(item.recordKey);
    setError("");
    setNotice("");
    if (item.km >= 100 && item.km < 300) {
      if (!item.customerNum || !/^\d+$/.test(item.customerNum)) {
        setError(
          "记录里缺少会员编号（customerNum），请让用户在前台重新绑定后再提交"
        );
        setApprovingKey("");
        return;
      }
    }
    try {
      const res = await fetch("/api/run-voucher/submissions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordKey: item.recordKey }),
      });
      const raw = await res.text();
      let payload: ApproveResponse | null = null;
      try {
        payload = raw ? (JSON.parse(raw) as ApproveResponse) : null;
      } catch {
        payload = null;
      }
      if (!res.ok || !payload?.success)
        throw new Error(
          payload?.error ?? raw.slice(0, 240) ?? `审核失败（HTTP ${res.status}）`
        );
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
      const res = await fetch("/api/run-voucher/submissions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordKey: item.recordKey, action: "reject" }),
      });
      const raw = await res.text();
      let payload: ApproveResponse | null = null;
      try {
        payload = raw ? (JSON.parse(raw) as ApproveResponse) : null;
      } catch {
        payload = null;
      }
      if (!res.ok || !payload?.success)
        throw new Error(
          payload?.error ?? raw.slice(0, 240) ?? `拒绝失败（HTTP ${res.status}）`
        );
      setNotice("已拒绝该申请");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "拒绝失败");
    } finally {
      setApprovingKey("");
    }
  }

  async function previewScreenshot(key: string) {
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const res = await fetch(
        `/api/run-voucher/screenshot-url?key=${encodeURIComponent(key)}`
      );
      const payload = (await res.json().catch(() => null)) as {
        success?: boolean;
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !payload?.success || !payload.url)
        throw new Error(payload?.error ?? "生成截图链接失败");
      setPreviewUrl(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开截图失败");
    } finally {
      setPreviewLoading(false);
    }
  }

  const isActionable = (s: string) =>
    s === "pending" || s === "issue_failed";

  return (
    <div className="panel">
      {/* ── 顶部工具栏 ── */}
      <div className="toolbar">
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`tab ${status === f.value ? "tab-active" : ""}`}
              onClick={() => setStatus(f.value)}
              type="button"
            >
              {f.label}
              {f.value === "pending" && pendingCount > 0 && (
                <span className="badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        <button className="refresh-btn" onClick={() => void load()} type="button">
          ↻ 刷新
        </button>
      </div>

      {/* ── 全局消息 ── */}
      {error && <div className="msg msg-error">{error}</div>}
      {notice && <div className="msg msg-notice">{notice}</div>}

      {/* ── 列表 ── */}
      {loading ? (
        <div className="empty">加载中...</div>
      ) : items.length === 0 ? (
        <div className="empty">当前筛选条件下暂无记录</div>
      ) : (
        <div className="list">
          {items.map((item) => {
            const keys = getScreenshotKeys(item);
            const busy = approvingKey === item.recordKey;
            return (
              <div key={item.recordKey} className={`record record-${item.status}`}>
                {/* 卡片头部 */}
                <div className="record-head">
                  <div className="record-identity">
                    <span className="record-name">{item.name}</span>
                    <span className="record-contact">{item.contact}</span>
                  </div>
                  <span className={`status-badge status-${item.status}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>

                {/* 核心信息行 */}
                <div className="record-meta">
                  <span className="meta-item">
                    <span className="meta-label">月份</span>
                    {item.month}
                  </span>
                  <span className="meta-item">
                    <span className="meta-label">跑量</span>
                    <strong>{item.km} km</strong>
                  </span>
                  <span className="meta-item">
                    <span className="meta-label">预期</span>
                    {planText(item.grantPlan)}
                  </span>
                </div>

                {/* 会员信息 */}
                <div className="record-member">
                  <span className="meta-item">
                    <span className="meta-label">会员号</span>
                    {item.customerNum || <span className="warn">未获取</span>}
                  </span>
                  <span className="meta-item">
                    <span className="meta-label">UID</span>
                    {item.customerUid || <span className="warn">未获取</span>}
                  </span>
                </div>

                {/* 截图预览 */}
                {keys.length > 0 && (
                  <div className="screenshot-row">
                    {keys.map((key, idx) => (
                      <button
                        key={key}
                        className="screenshot-btn"
                        onClick={() => void previewScreenshot(key)}
                        type="button"
                        disabled={previewLoading}
                      >
                        📷 截图 {idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* 银豹返回信息 */}
                {item.yinbao?.message && (
                  <div className={`yinbao-msg ${item.status === "issue_failed" ? "yinbao-error" : "yinbao-ok"}`}>
                    银豹：{item.yinbao.message}
                  </div>
                )}
                {item.yinbao?.issuedCoupons?.length ? (
                  <div className="coupon-codes">
                    {item.yinbao.issuedCoupons.map((c) => (
                      <span key={c.code} className="coupon-code">{c.code}</span>
                    ))}
                  </div>
                ) : null}

                {/* 操作按钮 */}
                {isActionable(item.status) && (
                  <div className="record-actions">
                    <button
                      className="action-approve"
                      disabled={busy}
                      onClick={() => void approve(item)}
                      type="button"
                    >
                      {busy ? "处理中..." : "通过并发券"}
                    </button>
                    <button
                      className="action-reject"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("确认拒绝这条申请吗？")) void reject(item);
                      }}
                      type="button"
                    >
                      拒绝
                    </button>
                  </div>
                )}

                {/* 提交时间 */}
                <div className="record-time">{fmtTime(item.submittedAt)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 截图预览弹层 ── */}
      {(previewUrl || previewLoading) && (
        <div
          className="lightbox"
          onClick={() => setPreviewUrl(null)}
        >
          {previewLoading ? (
            <div className="lightbox-loading">加载中...</div>
          ) : (
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl!} alt="截图预览" className="lightbox-img" />
              <button
                className="lightbox-close"
                onClick={() => setPreviewUrl(null)}
                type="button"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .panel {
          display: grid;
          gap: 12px;
        }

        /* ── 工具栏 ── */
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .filter-tabs {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .tab {
          height: 34px;
          padding: 0 14px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.12s;
        }
        .tab-active {
          background: var(--brand);
          border-color: var(--brand);
          color: #fff;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: #ff4500;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
        }
        .tab-active .badge {
          background: rgba(255, 255, 255, 0.3);
        }
        .refresh-btn {
          height: 34px;
          padding: 0 14px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--muted);
          font-size: 13px;
          cursor: pointer;
        }

        /* ── 消息 ── */
        .msg {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
        }
        .msg-error {
          background: #fff2f2;
          border: 1px solid #fca5a5;
          color: #b91c1c;
        }
        .msg-notice {
          background: #f0fdf4;
          border: 1px solid #86efac;
          color: #15803d;
        }
        .empty {
          padding: 32px;
          text-align: center;
          color: var(--muted);
          font-size: 14px;
        }

        /* ── 记录列表 ── */
        .list {
          display: grid;
          gap: 10px;
        }
        .record {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 14px 16px;
          display: grid;
          gap: 10px;
        }
        .record-issue_failed {
          border-color: #fca5a5;
          background: #fff9f9;
        }

        /* 头部 */
        .record-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .record-identity {
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
        }
        .record-name {
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
        }
        .record-contact {
          font-size: 13px;
          color: var(--muted);
        }

        /* 状态标签 */
        .status-badge {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }
        .status-pending {
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }
        .status-issue_failed {
          background: #fff2f2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
        }
        .status-approved {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #86efac;
        }
        .status-rejected {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        /* 核心信息 */
        .record-meta,
        .record-member {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .meta-item {
          font-size: 13px;
          color: var(--text);
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .meta-label {
          font-size: 11px;
          color: var(--muted);
          flex-shrink: 0;
        }
        .warn {
          color: #c2410c;
          font-weight: 600;
        }

        /* 截图 */
        .screenshot-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .screenshot-btn {
          height: 30px;
          padding: 0 12px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: #f8fafc;
          color: var(--text);
          font-size: 12px;
          cursor: pointer;
        }
        .screenshot-btn:hover {
          background: #f1f5f9;
        }

        /* 银豹消息 */
        .yinbao-msg {
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 6px;
        }
        .yinbao-error {
          background: #fff2f2;
          color: #b91c1c;
        }
        .yinbao-ok {
          background: #f0fdf4;
          color: #15803d;
        }
        .coupon-codes {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .coupon-code {
          font-size: 11px;
          font-family: monospace;
          background: #f1f5f9;
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 2px 7px;
          color: var(--text);
        }

        /* 操作按钮 */
        .record-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .action-approve {
          height: 36px;
          padding: 0 20px;
          border-radius: 8px;
          border: none;
          background: #0f3f87;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .action-approve:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .action-reject {
          height: 36px;
          padding: 0 16px;
          border-radius: 8px;
          border: 1px solid #fca5a5;
          background: #fff;
          color: #b91c1c;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .action-reject:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* 时间 */
        .record-time {
          font-size: 11px;
          color: var(--muted);
        }

        /* ── 弹层 ── */
        .lightbox {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .lightbox-loading {
          color: #fff;
          font-size: 15px;
        }
        .lightbox-content {
          position: relative;
          max-width: min(480px, 100%);
          max-height: 90vh;
        }
        .lightbox-img {
          display: block;
          max-width: 100%;
          max-height: 88vh;
          border-radius: 10px;
          object-fit: contain;
        }
        .lightbox-close {
          position: absolute;
          top: -12px;
          right: -12px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #fff;
          border: none;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
