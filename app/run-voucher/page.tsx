"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ToastType = "error" | "success";
type LookupPayload =
  | { success: true; customerNum: string; customerUid?: string; memberName?: string }
  | { success: false; error?: string };

const TIER_CARDS = [
  {
    title: "0-99 km",
    desc: "不可兑换，继续加油",
    value: "0 元",
    className: "tier tier-muted"
  },
  {
    title: "100-199 km",
    desc: "100 元券包（40+40+20）",
    value: "100 元",
    className: "tier tier-hot"
  },
  {
    title: "200-299 km",
    desc: "200 元券包（40+40+20）x2",
    value: "200 元",
    className: "tier tier-hot"
  },
  {
    title: ">=300 km",
    desc: "老板单独请喝酒",
    value: "特殊礼遇",
    className: "tier tier-gold"
  }
];

const RULES = [
  "本活动仅限有效会员参加。",
  "每月可上传上一个自然月的完整跑量截图。",
  "跑量截图需清晰展示跑步平台、用户信息、统计月份或时间范围、累计跑量。",
  "跑量以工作人员人工审核确认的有效跑量为准。",
  "上月跑量满100公里起兑，1公里可兑换1元精酿代金券。",
  "每满100公里发放1套100元券包，包含40元券2张、20元券1张。",
  "不足100公里的部分不参与兑换。例如268公里，可兑换200元代金券。",
  "每位会员每月最高按299公里计算兑换，最多可获得200元代金券。",
  "上月跑量达到300公里及以上的会员，请直接到门店找老板，老板单独请你喝酒。",
  "代金券有效期为发放后1个月。",
  "每张券每单限用1张，不可叠加使用，不可折现，不可转赠。",
  "代金券仅限会员本人到店使用。",
  "代金券不适用于进口瓶装酒、限量款、桶陈款、烈性酒款及门店标注不参与活动的商品。",
  "如发现截图造假、冒用他人跑量等行为，门店有权取消参与资格并收回已发放权益。"
];

function getDefaultMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export default function RunVoucherPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerNum, setCustomerNum] = useState("");
  const [customerUid, setCustomerUid] = useState("");
  const [memberName, setMemberName] = useState("");
  const [isLookingUpMember, setIsLookingUpMember] = useState(false);
  const [memberLookupError, setMemberLookupError] = useState("");
  const [km, setKm] = useState("");
  const [month] = useState(getDefaultMonth);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const screenshotName = useMemo(() => screenshot?.name || "", [screenshot]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function showError(message: string) {
    setToast({ type: "error", message });
  }

  function handleScreenshotChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("仅支持上传图片格式文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError("图片大小不能超过 10MB");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function lookupMember() {
    const normalized = phone.replace(/\s+/g, "");
    if (!normalized) {
      setMemberLookupError("请先填写手机号");
      setCustomerNum("");
      setCustomerUid("");
      setMemberName("");
      return;
    }
    setIsLookingUpMember(true);
    setMemberLookupError("");
    try {
      const response = await fetch("/api/run-voucher/member-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ phone: normalized })
      });
      const payload = (await response.json().catch(() => null)) as LookupPayload | null;
      if (!response.ok || !payload?.success) {
        const errorMessage =
          payload && "error" in payload ? payload.error || "未找到该手机号对应会员" : "未找到该手机号对应会员";
        setCustomerNum("");
        setCustomerUid("");
        setMemberName("");
        setMemberLookupError(errorMessage);
        return;
      }
      setCustomerNum(payload.customerNum || "");
      setCustomerUid(payload.customerUid || "");
      setMemberName(payload.memberName || "");
      setToast({ type: "success", message: "会员绑定成功" });
    } catch {
      setMemberLookupError("查询会员失败，请稍后重试");
    } finally {
      setIsLookingUpMember(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || submitted) return;

    if (!name.trim() || !phone.trim() || !km.trim() || !screenshot) {
      showError("请完整填写信息并上传跑量截图");
      return;
    }
    if (!customerNum) {
      showError("请先输入手机号并完成会员绑定");
      return;
    }

    const kmValue = Number(km);
    if (!Number.isFinite(kmValue) || kmValue < 0) {
      showError("请填写正确的跑量公里数");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("contact", phone.trim());
    formData.append("customerNum", customerNum);
    if (customerUid) {
      formData.append("customerUid", customerUid);
    }
    formData.append("km", String(kmValue));
    formData.append("month", month);
    formData.append("screenshot", screenshot);

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/run-voucher/submit", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.success) {
        showError(payload?.error || "提交失败，请稍后再试");
        return;
      }

      setSubmitted(true);
      setToast({
        type: "success",
        message: "提交成功，工作人员将在1-3个工作日内审核并发放代金券"
      });
    } catch {
      showError("网络异常，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="run-voucher-page">
      <div className="canvas">
        <section className="hero card">
          <p className="tag">会员专属活动</p>
          <h1>夏练三伏</h1>
          <p className="subtitle">跑多少，喝多少</p>
          <div className="badge">1 KM = 1 元精酿代金券</div>
        </section>

        <section className="card">
          <h2>兑换档位说明</h2>
          <div className="tier-list">
            {TIER_CARDS.map((tier) => (
              <div className={tier.className} key={tier.title}>
                <div>
                  <p className="tier-title">{tier.title}</p>
                  <p className="tier-desc">{tier.desc}</p>
                </div>
                <strong>{tier.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>上传跑量截图申请兑换</h2>
          <p className="helper">
            截图需包含：跑步平台、账户信息、统计月份（{month}）和累计跑量。
          </p>

          {submitted ? (
            <div className="success-box">
              <strong>提交成功</strong>
              <p>工作人员将在1-3个工作日内审核，审核通过后通过你留下的联系方式发放代金券。</p>
            </div>
          ) : (
            <form className="form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="name">姓名 / 昵称</label>
                <input
                  className="input"
                  id="name"
                  maxLength={32}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名或昵称"
                  required
                  value={name}
                />
              </div>

              <div className="field">
                <label htmlFor="contact">手机号（用于关联会员）</label>
                <div className="lookup-row">
                  <input
                    className="input"
                    id="contact"
                    inputMode="tel"
                    maxLength={24}
                    onBlur={() => {
                      if (phone.trim() && !customerNum && !isLookingUpMember) {
                        void lookupMember();
                      }
                    }}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (customerNum || customerUid || memberName || memberLookupError) {
                        setCustomerNum("");
                        setCustomerUid("");
                        setMemberName("");
                        setMemberLookupError("");
                      }
                    }}
                    placeholder="请输入会员绑定手机号"
                    required
                    value={phone}
                  />
                  <button
                    className="lookup-btn"
                    disabled={isLookingUpMember}
                    onClick={() => void lookupMember()}
                    type="button"
                  >
                    {isLookingUpMember ? "查询中..." : "关联会员"}
                  </button>
                </div>
                {memberLookupError ? <p className="helper error">{memberLookupError}</p> : null}
              </div>

              <div className="field">
                <label htmlFor="customerNum">会员编号（自动带出，不可修改）</label>
                <input
                  className="input input-readonly"
                  id="customerNum"
                  placeholder="请先输入手机号并关联会员"
                  readOnly
                  value={customerNum}
                />
                {memberName ? <p className="helper">会员姓名：{memberName}</p> : null}
              </div>

              <div className="field">
                <label htmlFor="km">上月跑量（km）</label>
                <input
                  className="input"
                  id="km"
                  inputMode="decimal"
                  min={0}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="例如 168"
                  required
                  value={km}
                />
              </div>

              <div className="field">
                <label>跑量截图（&lt;=10MB）</label>
                <input
                  accept="image/*"
                  hidden
                  onChange={(e) => handleScreenshotChange(e.target.files?.[0])}
                  ref={fileInputRef}
                  type="file"
                />
                <button className="upload-btn" onClick={openFilePicker} type="button">
                  {screenshot ? "重新选择截图" : "选择跑量截图"}
                </button>
                {previewUrl ? (
                  <button className="preview-wrap" onClick={openFilePicker} type="button">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="截图预览" src={previewUrl} />
                  </button>
                ) : null}
                {screenshotName ? <p className="helper">{screenshotName}</p> : null}
              </div>

              <button className="submit-btn" disabled={isSubmitting} type="submit">
                {isSubmitting ? "提交中..." : "提交申请"}
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <button
            className="rule-toggle"
            onClick={() => setRulesOpen((prev) => !prev)}
            type="button"
          >
            {rulesOpen ? "收起完整活动规则" : "查看完整活动规则"}
          </button>
          {rulesOpen ? (
            <ol className="rule-list">
              {RULES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : null}
        </section>

        <footer className="footer">时光酿造所 · CHRONO BREWERY · 深圳</footer>
      </div>

      {toast ? <div className={`toast toast-${toast.type}`}>{toast.message}</div> : null}

      <style jsx>{`
        .run-voucher-page {
          min-height: 100vh;
          background: #080808;
          color: #fff;
          padding: 16px 14px 32px;
          -webkit-tap-highlight-color: transparent;
        }
        .canvas {
          width: min(480px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 12px;
        }
        .card {
          background: #111;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          padding: 16px;
        }
        .hero h1 {
          margin: 10px 0 0;
          font-size: 52px;
          line-height: 1;
          letter-spacing: 0.04em;
          font-weight: 800;
        }
        .tag {
          margin: 0;
          color: #ff6b00;
          font-size: 13px;
        }
        .subtitle {
          margin: 8px 0 0;
          font-size: 20px;
          font-weight: 600;
        }
        .badge {
          margin-top: 14px;
          display: inline-flex;
          background: #ff4500;
          color: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 700;
        }
        h2 {
          margin: 0 0 12px;
          font-size: 18px;
        }
        .helper {
          margin: 0 0 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.62);
        }
        .tier-list {
          display: grid;
          gap: 8px;
        }
        .tier {
          border-radius: 12px;
          padding: 10px 12px;
          border: 1px solid transparent;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }
        .tier-muted {
          border-color: rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.03);
        }
        .tier-hot {
          border-color: rgba(255, 69, 0, 0.55);
          background: rgba(255, 69, 0, 0.12);
        }
        .tier-gold {
          border-color: rgba(255, 184, 0, 0.6);
          background: rgba(255, 184, 0, 0.12);
        }
        .tier-title {
          margin: 0;
          font-weight: 700;
        }
        .tier-desc {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.62);
          font-size: 13px;
        }
        .form {
          display: grid;
          gap: 12px;
        }
        .field {
          display: grid;
          gap: 6px;
        }
        .field label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.75);
        }
        .input {
          width: 100%;
          height: 42px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(0, 0, 0, 0.24);
          color: #fff;
          padding: 0 12px;
          outline: none;
        }
        .input:focus {
          border-color: #ff4500;
        }
        .upload-btn,
        .submit-btn,
        .rule-toggle,
        .lookup-btn {
          height: 42px;
          border-radius: 10px;
          border: none;
          font-weight: 700;
          cursor: pointer;
        }
        .upload-btn {
          background: #1b1b1b;
          color: #fff;
          border: 1px dashed rgba(255, 255, 255, 0.24);
        }
        .lookup-row {
          display: grid;
          grid-template-columns: 1fr 108px;
          gap: 8px;
        }
        .lookup-btn {
          background: #2c2c2c;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .lookup-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .input-readonly {
          opacity: 0.88;
          background: rgba(255, 255, 255, 0.08);
          border-style: dashed;
        }
        .helper.error {
          color: #ee7f7f;
        }
        .preview-wrap {
          border: none;
          padding: 0;
          background: transparent;
          width: 100%;
          cursor: pointer;
        }
        .preview-wrap img {
          display: block;
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          max-height: 220px;
          object-fit: cover;
        }
        .submit-btn {
          background: #ff4500;
          color: #fff;
        }
        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .rule-toggle {
          width: 100%;
          background: transparent;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.28);
        }
        .rule-list {
          margin: 12px 0 0;
          padding-left: 18px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
          font-size: 13px;
          display: grid;
          gap: 6px;
        }
        .footer {
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          padding: 12px 0 4px;
        }
        .success-box {
          border: 1px solid rgba(255, 107, 0, 0.5);
          background: rgba(255, 107, 0, 0.1);
          border-radius: 12px;
          padding: 14px;
          display: grid;
          gap: 8px;
        }
        .success-box p {
          margin: 0;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.5;
          font-size: 14px;
        }
        .toast {
          position: fixed;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 13px;
          max-width: min(90vw, 460px);
          z-index: 20;
        }
        .toast-error {
          background: #332020;
          border: 1px solid #ee5a5a;
        }
        .toast-success {
          background: #173525;
          border: 1px solid #43cc7b;
        }
      `}</style>
    </main>
  );
}
