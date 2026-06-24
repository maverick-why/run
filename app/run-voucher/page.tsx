"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

function getDefaultMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  let year = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  let month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  month -= 1;
  if (month <= 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

type KmFeedback = {
  kind: "encourage" | "tier1" | "tier2" | "special";
  text: string;
  coupons?: { label: string; count: number }[];
} | null;

function getKmFeedback(raw: string): KmFeedback {
  const v = parseFloat(raw);
  if (!raw || !Number.isFinite(v) || v <= 0) return null;
  if (v < 100)
    return {
      kind: "encourage",
      text: `💪 再跑 ${Math.ceil(100 - v)} km 就能兑换！继续加油`,
    };
  if (v < 200)
    return {
      kind: "tier1",
      text: "🍺 可兑换 100元券包",
      coupons: [
        { label: "40元", count: 2 },
        { label: "20元", count: 1 },
      ],
    };
  if (v < 300)
    return {
      kind: "tier2",
      text: "🍺🍺 可兑换 200元券包",
      coupons: [
        { label: "40元", count: 4 },
        { label: "20元", count: 2 },
      ],
    };
  return { kind: "special", text: "🎉 老板亲自请酒！来店找我们" };
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://run.dbbrewbeer.com";
const SHARE_TEXT = `我参加了时光酿造所的"夏练三伏"特训，跑多少喝多少。快跑，来喝！`;

const TIER_PILLS = [
  { label: "100–199 km", reward: "100元券包", variant: "" },
  { label: "200–299 km", reward: "200元券包", variant: "pill-highlight" },
  { label: "300 km↑", reward: "老板亲自请酒 🍺", variant: "pill-gold" },
];

const RULES = [
  "本活动仅限有效会员参加。",
  "每月可上传上一个自然月的完整跑量截图。",
  "截图需清晰展示跑步平台、账户信息、统计月份或时间范围、累计跑量。",
  "跑量以工作人员人工审核确认的有效跑量为准。",
  "上月跑量满100公里起兑，1公里兑换1元精酿代金券。",
  "每满100公里发放1套100元券包，包含40元券2张、20元券1张。",
  "不足100公里的部分不参与兑换。例如268公里，可兑换200元代金券。",
  "每位会员每月最高按299公里计算兑换，最多获得200元代金券。",
  "上月跑量达300公里及以上的会员，请直接到门店找老板，老板单独请你喝酒。",
  "代金券有效期为发放后1个月。",
  "每张券每单限用1张，不可叠加，不可折现，不可转赠。",
  "代金券仅限会员本人到店使用。",
  "代金券不适用于进口瓶装酒、限量款、桶陈款、烈性酒款及门店标注不参与活动的商品。",
  "如发现截图造假、冒用他人跑量等行为，门店有权取消参与资格并收回已发放权益。",
];

export default function RunVoucherPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [km, setKm] = useState("");
  const [month] = useState(getDefaultMonth);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // 会员验证弹窗
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [dialCode, setDialCode] = useState("+86");
  const [rawPhone, setRawPhone] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<null | "checking" | "ok" | "fail">(null);
  const [toast, setToast] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const kmFeedback = getKmFeedback(km);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(
    () => () => previewUrls.forEach((u) => URL.revokeObjectURL(u)),
    [previewUrls]
  );

  function showError(msg: string) {
    setToast({ type: "error", message: msg });
  }

  function removeAt(i: number) {
    if (previewUrls[i]) URL.revokeObjectURL(previewUrls[i]);
    setScreenshots((p) => p.filter((_, j) => j !== i));
    setPreviewUrls((p) => p.filter((_, j) => j !== i));
  }

  function clearAll() {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setScreenshots([]);
    setPreviewUrls([]);
  }

  function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        showError("仅支持上传图片格式文件");
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        showError("单张图片大小不能超过 10MB");
        return;
      }
    }
    const seen = new Set<string>();
    const merged: File[] = [];
    const push = (f: File) => {
      const k = `${f.name}:${f.size}:${f.lastModified}`;
      if (seen.has(k)) return;
      seen.add(k);
      merged.push(f);
    };
    screenshots.forEach(push);
    files.forEach(push);
    if (merged.length > 6) {
      showError("最多上传 6 张截图");
      return;
    }
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setScreenshots(merged);
    setPreviewUrls(merged.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting || submitted) return;
    if (!name.trim() || !phone.trim() || !km.trim() || !screenshots.length) {
      showError("请完整填写信息并上传跑量截图");
      return;
    }
    const kmVal = Number(km);
    if (!Number.isFinite(kmVal) || kmVal < 0) {
      showError("请填写正确的跑量公里数");
      return;
    }
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("contact", phone.trim());
    fd.append("km", String(kmVal));
    fd.append("month", month);
    screenshots.forEach((f) => fd.append("screenshots", f));
    if (verifyStatus !== "ok") {
      setVerifyOpen(true);
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/run-voucher/submit", {
        method: "POST",
        body: fd,
      });
      const payload = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !payload?.success) {
        showError(payload?.error ?? "提交失败，请稍后再试");
        return;
      }
      setSubmitted(true);
    } catch {
      showError("网络异常，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ title: "夏练三伏", text: SHARE_TEXT, url: SITE_URL });
    } catch {
      try {
        await navigator.clipboard.writeText(SITE_URL);
        setToast({ type: "success", message: "链接已复制，快去发给跑友！" });
      } catch {
        // ignore
      }
    }
  }

  function openVerify() {
    setVerifyStatus(null);
    setRawPhone("");
    setVerifyOpen(true);
    setTimeout(() => verifyInputRef.current?.focus(), 300);
  }

  function isVerifyValid() {
    const v = rawPhone.trim();
    return dialCode === "+86" ? /^1[3-9]\d{9}$/.test(v) : /^\d{6,14}$/.test(v);
  }

  async function handleVerify() {
    const p = rawPhone.trim();
    if (!p) return;
    const fullPhone = dialCode + p;
    setVerifyStatus("checking");
    try {
      const res = await fetch("/api/run-voucher/member-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      if (res.ok) {
        setPhone(fullPhone);
        setVerifyStatus("ok");
      } else {
        setVerifyStatus("fail");
      }
    } catch {
      setVerifyStatus(null);
      showError("网络异常，请稍后重试");
    }
  }

  function resetForm() {
    setSubmitted(false);
    setName("");
    setPhone("");
    setKm("");
    setVerifyStatus(null);
    setRawPhone("");
    clearAll();
  }

  return (
    <main className="page">
      {/* ── HERO ── */}
      <section className="hero">
        <div className="bg-slash" />
        <div className="hero-inner">
          <div className="hero-main">
            <div className="hero-left">
              <h1 className="hero-title">
                <span className="t1">夏练</span>
                <span className="t2">三伏</span>
              </h1>
              <p className="tagline">跑多少，<em>喝多少</em></p>
            </div>
            <div className="hero-right">
              <div className="brand-cn">时光酿造所</div>
              <div className="brand-en">CHRONO BREWERY</div>
              <div className="ratio-badge">1KM = 1元券</div>
            </div>
          </div>
          <div className="tier-pills">
            {TIER_PILLS.map((p) => (
              <div key={p.label} className={`tier-pill ${p.variant}`}>
                <span className="pill-km">{p.label}</span>
                <span className="pill-arrow">→</span>
                <span className="pill-reward">{p.reward}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM / SUCCESS ── */}
      <section className="form-section">
        <div className="form-inner">
          {submitted ? (
            <div className="success-view">
              <div className="check-circle">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="27" stroke="#FF4500" strokeWidth="2" />
                  <path
                    d="M17 28l8 8 14-16"
                    stroke="#FF4500"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="success-title">提交成功！</h2>
              <p className="success-sub">我们收到了你的跑量申请</p>
              <div className="next-steps">
                <p className="next-label">接下来</p>
                <p>审核员会在 1–3 个工作日内核实截图并完成发券</p>
                <p>券会直接发到你的会员账户，请留意</p>
              </div>
              <button className="share-btn" onClick={handleShare} type="button">
                📣 分享给跑友
              </button>
              <button className="reset-link" onClick={resetForm} type="button">
                重新填写
              </button>
            </div>
          ) : (
            <form className="form" onSubmit={handleSubmit} noValidate>
              <div className="month-hint">
                <span className="month-main">提交上月跑量申请</span>
                <span className="month-sub">
                  请提供 {Number(month.split("-")[1])} 月份的跑量截图
                </span>
              </div>

              <div className="field">
                <label htmlFor="km" className="field-label">
                  上月跑量（km）
                </label>
                <input
                  className="input input-km"
                  id="km"
                  inputMode="decimal"
                  min={0}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="例如 168"
                  required
                  value={km}
                />
                {kmFeedback && (
                  <div className={`km-feedback km-${kmFeedback.kind}`}>
                    <span className="km-text">{kmFeedback.text}</span>
                    {kmFeedback.coupons && (
                      <span className="coupon-tags">
                        {kmFeedback.coupons.map(({ label, count }) => (
                          <span key={label} className={`coupon-tag coupon-${label}`}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                              <rect x="0.5" y="2.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none"/>
                              <line x1="4" y1="2.5" x2="4" y2="10.5" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.5 1.5"/>
                              <line x1="9" y1="2.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.5 1.5"/>
                            </svg>
                            {label} × {count}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="name" className="field-label">
                    姓名 / 昵称
                  </label>
                  <input
                    className="input"
                    id="name"
                    maxLength={32}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入姓名"
                    required
                    value={name}
                  />
                </div>
                <div className="field">
                  <label htmlFor="contact" className="field-label">
                    会员手机号
                    {verifyStatus === "ok" && <span className="member-badge">✓ 已验证</span>}
                  </label>
                  <input
                    className={`input${verifyStatus === "ok" ? " input-verified" : ""}`}
                    id="contact"
                    readOnly
                    onClick={openVerify}
                    placeholder="点击验证会员身份"
                    value={phone}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">
                  跑量截图（最多6张 / 每张≤10MB）
                </label>
                <p className="field-hint">
                  截图需包含平台名称、账号、月份和累计里程
                </p>
                <input
                  accept="image/*"
                  hidden
                  multiple
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                {previewUrls.length > 0 && (
                  <div className="preview-grid">
                    {previewUrls.map((url, i) => (
                      <div key={`${url}-${i}`} className="preview-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={`截图${i + 1}`}
                          src={url}
                          className="preview-img"
                        />
                        <button
                          className="remove-btn"
                          onClick={() => removeAt(i)}
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="upload-actions">
                  {screenshots.length < 6 && (
                    <button
                      className="upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      {screenshots.length
                        ? `继续添加（${screenshots.length}/6）`
                        : "选择截图"}
                    </button>
                  )}
                  {screenshots.length > 0 && (
                    <button
                      className="clear-btn"
                      onClick={clearAll}
                      type="button"
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>

              <button
                className="submit-btn"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "提交中..." : "提交申请"}
              </button>
            </form>
          )}

          {!submitted && (
            <div className="rules-section">
              <button
                className="rules-toggle"
                onClick={() => setRulesOpen((p) => !p)}
                type="button"
              >
                {rulesOpen ? "收起活动规则 ↑" : "查看完整活动规则 ↓"}
              </button>
              {rulesOpen && (
                <ol className="rules-list">
                  {RULES.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
        <footer className="page-footer">
          时光酿造所 · CHRONO BREWERY · 深圳
        </footer>
      </section>

      {verifyOpen && (
        <div
          className="vm-mask"
          onClick={() => { if (verifyStatus !== "checking") setVerifyOpen(false); }}
        >
          <div className="vm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="vm-handle" />

            {/* 状态1：输入手机号 */}
            {verifyStatus !== "ok" && verifyStatus !== "fail" && (
              <>
                <div className="vm-top">
                  <div className="vm-label">MEMBER VERIFICATION · 会员验证</div>
                  <div className="vm-title">验证会员身份</div>
                  <div className="vm-sub">本活动仅限时光酿造所会员参与</div>
                </div>
                <div className="vm-input-area">
                  <div className="vm-input-label">手机号</div>
                  <div className={`vm-input-row${verifyStatus === "checking" ? " vm-checking" : ""}`}>
                    <select
                      className="vm-dial-select"
                      value={dialCode}
                      onChange={(e) => setDialCode(e.target.value)}
                      disabled={verifyStatus === "checking"}
                    >
                      <option value="+86">+86 🇨🇳 中国大陆</option>
                      <option value="+852">+852 🇭🇰 香港</option>
                      <option value="+853">+853 🇲🇴 澳門</option>
                      <option value="+886">+886 🇹🇼 臺灣</option>
                      <option value="+62">+62 🇮🇩 Indonesia</option>
                      <option disabled>──────</option>
                      <option value="+65">+65 🇸🇬 Singapore</option>
                      <option value="+60">+60 🇲🇾 Malaysia</option>
                      <option value="+1">+1 🇺🇸 United States / Canada</option>
                      <option value="+44">+44 🇬🇧 United Kingdom</option>
                      <option value="+61">+61 🇦🇺 Australia</option>
                      <option value="+81">+81 🇯🇵 日本</option>
                      <option value="+82">+82 🇰🇷 한국</option>
                    </select>
                    <div className="vm-sep" />
                    <input
                      ref={verifyInputRef}
                      className="vm-input"
                      type="tel"
                      inputMode="tel"
                      placeholder="请输入手机号"
                      value={rawPhone}
                      onChange={(e) => setRawPhone(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && isVerifyValid()) handleVerify(); }}
                      disabled={verifyStatus === "checking"}
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <div className="vm-actions">
                  <button
                    className="vm-btn-main"
                    onClick={handleVerify}
                    disabled={!isVerifyValid() || verifyStatus === "checking"}
                    type="button"
                  >
                    {verifyStatus === "checking" ? "查询中…" : isVerifyValid() ? "查询会员" : rawPhone.length === 0 ? "请输入手机号" : dialCode === "+86" && rawPhone.length < 11 ? "请输入11位手机号" : "手机号格式不正确"}
                  </button>
                  <button className="vm-btn-ghost" onClick={() => setVerifyOpen(false)} type="button">
                    取消
                  </button>
                </div>
              </>
            )}

            {/* 状态2：验证通过 */}
            {verifyStatus === "ok" && (
              <>
                <div className="vm-top">
                  <div className="vm-label">MEMBER VERIFIED · 验证通过</div>
                  <div className="vm-ok-card">
                    <div className="vm-ok-badge">✓</div>
                    <div className="vm-ok-info">
                      <div className="vm-ok-name">会员验证通过</div>
                      <div className="vm-ok-phone">{phone.length > 7 ? phone.slice(0, 5) + "****" + phone.slice(-4) : phone}</div>
                    </div>
                  </div>
                </div>
                <div className="vm-actions">
                  <button className="vm-btn-main vm-btn-green" onClick={() => setVerifyOpen(false)} type="button">
                    开始填写 →
                  </button>
                </div>
              </>
            )}

            {/* 状态3：非会员 */}
            {verifyStatus === "fail" && (
              <>
                <div className="vm-nonmember">
                  <div className="vm-nonmember-icon">🍺</div>
                  <div className="vm-nonmember-title">仅限会员参与</div>
                  <div className="vm-nonmember-body">
                    未找到该手机号的会员记录。<br />
                    请先在小程序完成注册，成为会员后即可参与兑换。
                  </div>
                </div>
                <div className="vm-actions">
                  <a
                    className="vm-btn-main vm-btn-reg"
                    href="https://pospal.cn/d/3736013"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    前往注册 →
                  </a>
                  <button
                    className="vm-btn-ghost"
                    onClick={() => { setVerifyStatus(null); setRawPhone(""); setTimeout(() => verifyInputRef.current?.focus(), 100); }}
                    type="button"
                  >
                    重新输入手机号
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #060606;
          color: #fff;
          font-family: "PingFang SC", "Noto Sans SC", "Helvetica Neue", Arial,
            sans-serif;
          -webkit-tap-highlight-color: transparent;
        }

        /* ── HERO ── */
        .hero {
          position: relative;
          background: #060606;
          overflow: hidden;
          padding-bottom: 16px;
        }
        .bg-slash {
          position: absolute;
          top: -60px;
          left: -40px;
          width: 600px;
          height: 400px;
          background: linear-gradient(135deg, #ff4500 0%, #ff6b00 40%, transparent 65%);
          transform: skewY(-8deg);
          opacity: 0.1;
          pointer-events: none;
        }
        .hero-inner {
          position: relative;
          z-index: 2;
          max-width: 500px;
          margin: 0 auto;
          padding: 20px 20px 0;
        }
        .hero-main {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .hero-left {
          flex: 1;
          min-width: 0;
        }
        .hero-title {
          margin: 0;
          line-height: 0.85;
          letter-spacing: -0.02em;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .t1 {
          font-family: var(--font-bebas, "Bebas Neue", sans-serif);
          font-size: clamp(52px, 16vw, 72px);
          color: #fff;
        }
        .t2 {
          font-family: var(--font-bebas, "Bebas Neue", sans-serif);
          font-size: clamp(52px, 16vw, 72px);
          -webkit-text-stroke: 1.5px #ff4500;
          color: transparent;
          text-shadow: 0 0 20px rgba(255, 69, 0, 0.45);
        }
        .tagline {
          margin: 6px 0 0;
          font-weight: 700;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.7);
          letter-spacing: 0.02em;
        }
        .tagline em {
          font-style: normal;
          color: #ff6b00;
        }
        .hero-right {
          flex-shrink: 0;
          text-align: right;
        }
        .brand-cn {
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.12em;
          color: #ff6b00;
        }
        .brand-en {
          font-family: var(--font-bebas, "Bebas Neue", sans-serif);
          font-size: 11px;
          letter-spacing: 0.18em;
          color: rgba(255, 255, 255, 0.3);
          margin-top: 1px;
        }
        .ratio-badge {
          margin-top: 8px;
          display: inline-block;
          background: rgba(255, 69, 0, 0.2);
          border: 1px solid rgba(255, 69, 0, 0.5);
          color: #ff6b00;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }
        .tier-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tier-pill {
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 5px 10px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .pill-highlight {
          border-color: rgba(255, 69, 0, 0.5);
          background: rgba(255, 69, 0, 0.1);
          color: rgba(255, 255, 255, 0.85);
        }
        .pill-gold {
          border-color: rgba(255, 184, 0, 0.4);
          background: rgba(255, 184, 0, 0.07);
          color: rgba(255, 220, 100, 0.85);
        }
        .pill-km {
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
        }
        .pill-arrow {
          color: rgba(255, 69, 0, 0.6);
          font-size: 10px;
        }
        .pill-reward {
          color: inherit;
        }

        /* ── FORM SECTION ── */
        .form-section {
          background: #f6f8fb;
          color: #0f1b2d;
        }
        .form-inner {
          max-width: 500px;
          margin: 0 auto;
          padding: 28px 20px;
        }
        .month-hint {
          margin-bottom: 20px;
          padding: 10px 14px;
          background: #e8edf5;
          border-radius: 10px;
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }
        .month-main {
          font-size: 14px;
          font-weight: 700;
          color: #0f1b2d;
        }
        .month-sub {
          font-size: 12px;
          color: #5c6b82;
        }
        .form {
          display: grid;
          gap: 18px;
        }
        .field {
          display: grid;
          gap: 6px;
        }
        .field-row {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr 1fr;
        }
        .field-label {
          font-size: 13px;
          font-weight: 600;
          color: #3d4f66;
        }
        .field-hint {
          font-size: 12px;
          color: #8a9ab2;
          margin: 0;
        }
        .input {
          width: 100%;
          height: 44px;
          border: 1.5px solid #d9e2ef;
          border-radius: 10px;
          padding: 0 14px;
          background: #fff;
          font-size: 15px;
          color: #0f1b2d;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .input:focus {
          border-color: #ff4500;
        }
        .input-km {
          height: 56px;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .km-feedback {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .km-text {
          flex-shrink: 0;
        }
        .coupon-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .coupon-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
        }
        .coupon-40元 {
          background: #fff0e6;
          color: #c84000;
          border: 1px solid rgba(255, 69, 0, 0.35);
        }
        .coupon-20元 {
          background: #e8f4ff;
          color: #1a5fa8;
          border: 1px solid rgba(26, 95, 168, 0.3);
        }
        .km-encourage {
          background: #eef2f8;
          color: #5c6b82;
        }
        .km-tier1 {
          background: #fff3ec;
          color: #c84000;
          border: 1px solid rgba(255, 69, 0, 0.2);
        }
        .km-tier2 {
          background: #ffe8d6;
          color: #a33000;
          border: 1px solid rgba(255, 69, 0, 0.3);
        }
        .km-special {
          background: #fff8e1;
          color: #8a6000;
          border: 1px solid rgba(255, 184, 0, 0.4);
        }
        .preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 10px;
        }
        .preview-item {
          position: relative;
        }
        .preview-img {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #d9e2ef;
          display: block;
        }
        .remove-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          border: none;
          font-size: 11px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          padding: 0;
        }
        .upload-actions {
          display: flex;
          gap: 8px;
        }
        .upload-btn {
          flex: 1;
          height: 44px;
          border-radius: 10px;
          border: 1.5px dashed #b8c8de;
          background: #fff;
          color: #3d4f66;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .clear-btn {
          height: 44px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1.5px solid #d9e2ef;
          background: transparent;
          color: #5c6b82;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
        }
        .submit-btn {
          width: 100%;
          height: 52px;
          border-radius: 12px;
          border: none;
          background: #ff4500;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 4px;
          transition: opacity 0.15s;
          font-family: inherit;
        }
        .submit-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .submit-btn:not(:disabled):active {
          opacity: 0.85;
        }
        .rules-section {
          margin-top: 24px;
        }
        .rules-toggle {
          width: 100%;
          height: 42px;
          border-radius: 10px;
          border: 1px solid #d9e2ef;
          background: transparent;
          color: #5c6b82;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
        }
        .rules-list {
          margin: 12px 0 0;
          padding-left: 18px;
          color: #5c6b82;
          font-size: 13px;
          line-height: 1.7;
          display: grid;
          gap: 4px;
        }

        /* ── SUCCESS VIEW ── */
        .success-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 24px 0;
          gap: 14px;
        }
        .check-circle {
          margin-bottom: 4px;
        }
        .success-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          color: #0f1b2d;
        }
        .success-sub {
          margin: 0;
          font-size: 15px;
          color: #5c6b82;
        }
        .next-steps {
          width: 100%;
          background: #fff;
          border: 1px solid #d9e2ef;
          border-radius: 12px;
          padding: 16px;
          text-align: left;
          font-size: 14px;
          color: #3d4f66;
          line-height: 1.8;
        }
        .next-steps p {
          margin: 0;
        }
        .next-label {
          font-weight: 700;
          color: #0f1b2d;
          margin-bottom: 4px !important;
        }
        .share-btn {
          width: 100%;
          height: 52px;
          border-radius: 12px;
          border: none;
          background: #ff4500;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .reset-link {
          background: none;
          border: none;
          color: #8a9ab2;
          font-size: 13px;
          cursor: pointer;
          padding: 4px 8px;
          font-family: inherit;
        }

        /* ── FOOTER ── */
        .page-footer {
          text-align: center;
          color: #8a9ab2;
          font-size: 12px;
          padding: 20px 0 28px;
        }

        /* ── TOAST ── */
        .toast {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          border-radius: 999px;
          padding: 10px 18px;
          font-size: 13px;
          max-width: min(90vw, 460px);
          z-index: 999;
          white-space: nowrap;
        }
        .toast-error {
          background: #332020;
          border: 1px solid #ee5a5a;
          color: #fff;
        }
        .toast-success {
          background: #173525;
          border: 1px solid #43cc7b;
          color: #fff;
        }

        /* ── 会员验证弹窗 ── */
        .member-badge {
          margin-left: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #2e7d32;
          background: #e8f5e9;
          border-radius: 20px;
          padding: 2px 7px;
        }
        .input-verified {
          border-color: #2e7d32 !important;
          background: #f8fff8 !important;
          cursor: pointer;
        }
        .input[readonly] { cursor: pointer; }
        .vm-mask {
          position: fixed;
          top: 0; right: 0; bottom: 0; left: 0;
          z-index: 200;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .vm-sheet {
          background: #faf8f5;
          width: 100%;
          max-width: 480px;
          border-radius: 20px 20px 0 0;
          padding: 0 0 48px;
          overflow: hidden;
        }
        .vm-handle {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: #e0dbd4;
          margin: 14px auto 0;
        }
        .vm-top {
          padding: 18px 20px 16px;
          border-bottom: 1px solid #e8e3dc;
        }
        .vm-label {
          font-size: 11px;
          letter-spacing: 0.15em;
          color: #b8afa6;
          margin-bottom: 4px;
        }
        .vm-title {
          font-size: 17px;
          font-weight: 900;
          color: #2d2520;
          letter-spacing: 2px;
          margin-bottom: 3px;
        }
        .vm-sub {
          font-size: 12px;
          color: #b8b0a4;
          letter-spacing: 0.3px;
        }
        .vm-input-area {
          padding: 16px 20px 0;
        }
        .vm-input-label {
          font-size: 12px;
          font-weight: 600;
          color: #8a7e74;
          margin-bottom: 8px;
          letter-spacing: 0.05em;
        }
        .vm-input-row {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1.5px solid #e8e3dc;
          border-radius: 10px;
          padding: 12px 14px;
          gap: 8px;
          transition: border-color 0.2s;
        }
        .vm-input-row:focus-within { border-color: #c8922a; }
        .vm-checking { border-color: #e8b070; background: #fffdf8; }
        .vm-dial-select {
          border: none;
          outline: none;
          background: transparent;
          font-family: inherit;
          font-size: 14px;
          color: #2d2520;
          cursor: pointer;
          flex-shrink: 0;
          max-width: 130px;
        }
        .vm-sep {
          width: 1px;
          height: 18px;
          background: #e0dbd4;
          flex-shrink: 0;
        }
        .vm-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-family: inherit;
          font-size: 17px;
          font-weight: 700;
          color: #c8922a;
          letter-spacing: 2px;
          min-width: 0;
        }
        .vm-input::placeholder { font-size: 13px; color: #d4cfc7; font-weight: 400; letter-spacing: 0.5px; }
        .vm-actions {
          padding: 16px 20px 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .vm-btn-main {
          width: 100%;
          height: 50px;
          border-radius: 12px;
          border: none;
          background: #2d2520;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 1px;
          transition: opacity 0.15s;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .vm-btn-main:disabled { opacity: 0.45; cursor: not-allowed; }
        .vm-btn-main:not(:disabled):active { opacity: 0.8; }
        .vm-btn-green { background: #2e7d32; }
        .vm-btn-reg { background: linear-gradient(135deg, #c9975b, #b8874d); }
        .vm-btn-ghost {
          background: none;
          border: none;
          color: #8a7e74;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          padding: 8px;
          text-align: center;
        }
        .vm-ok-card {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 12px;
        }
        .vm-ok-badge {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #2e7d32;
          color: #fff;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .vm-ok-name {
          font-size: 15px;
          font-weight: 700;
          color: #2e7d32;
        }
        .vm-ok-phone {
          font-size: 13px;
          color: #8a7e74;
          margin-top: 2px;
          letter-spacing: 1px;
        }
        .vm-nonmember {
          text-align: center;
          padding: 28px 20px 8px;
        }
        .vm-nonmember-icon { font-size: 42px; margin-bottom: 12px; }
        .vm-nonmember-title {
          font-size: 16px;
          font-weight: 900;
          color: #2d2520;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }
        .vm-nonmember-body {
          font-size: 13px;
          color: #5a5048;
          line-height: 1.8;
          letter-spacing: 0.3px;
        }

        @media (max-width: 400px) {
          .field-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
