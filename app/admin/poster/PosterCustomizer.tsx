"use client";

import { useMemo, useState } from "react";

type PosterForm = {
  openingPrefix: string;
  openingText: string;
  guestName: string;
  togetherText: string;
};

const FIXED_DATE = "2026.5.20～2026.5.21";
const FIXED_TIME = "14:00～18:00pm";
const FIXED_ADDRESS = "深圳 南山 沙河西路 智谷产业园F座 107";
const DEFAULT_OPENING_PREFIX = "不是开业，是";
const OPENING_TOTAL_LIMIT = 10;

function countChineseChars(text: string) {
  return (text.match(/[\u4e00-\u9fff]/g) || []).length;
}

function countAllChars(text: string) {
  return Array.from(text).length;
}

function drawPoster(form: PosterForm) {
  const width = 750;
  const height = 1334;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("海报画布初始化失败");
  }

  ctx.scale(scale, scale);

  const topGlow = ctx.createLinearGradient(0, 0, 0, 520);
  topGlow.addColorStop(0, "#2f2208");
  topGlow.addColorStop(0.55, "#151515");
  topGlow.addColorStop(1, "#090a0d");

  ctx.fillStyle = "#090a0d";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 520);

  for (let i = 0; i < 12; i += 1) {
    const alpha = 0.03 + (i % 3) * 0.02;
    ctx.fillStyle = `rgba(255, 182, 60, ${alpha})`;
    ctx.fillRect(i * 64, 20 + (i % 2) * 8, 44, 340);
  }

  const maskGradient = ctx.createLinearGradient(0, 420, 0, height);
  maskGradient.addColorStop(0, "rgba(0, 0, 0, 0.08)");
  maskGradient.addColorStop(0.6, "rgba(0, 0, 0, 0.55)");
  maskGradient.addColorStop(1, "rgba(0, 0, 0, 0.86)");
  ctx.fillStyle = maskGradient;
  ctx.fillRect(0, 360, width, height - 360);

  ctx.fillStyle = "#d7c17a";
  ctx.font = 'italic 700 34px "Arial Black", "Helvetica Neue", sans-serif';
  ctx.fillText("CHRONOBREWERY", 52, 84);

  const heading = `${form.openingPrefix.trim()}${form.openingText.trim()}`;
  ctx.fillStyle = "#f4f4f4";
  ctx.textAlign = "center";
  ctx.font = '700 86px "STSong", "Songti SC", "Noto Serif SC", serif';
  ctx.fillText(heading, width / 2, 515);

  ctx.strokeStyle = "rgba(198, 140, 68, 0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(140, 598);
  ctx.lineTo(width - 140, 598);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#e4e4e4";
  ctx.font = '600 50px "STSong", "Songti SC", "Noto Serif SC", serif';
  ctx.fillText("诚 邀", 140, 685);

  ctx.textAlign = "center";
  ctx.fillStyle = "#d6b652";
  ctx.font = '800 90px "Arial Black", "Helvetica Neue", sans-serif';
  ctx.fillText(form.guestName.trim(), width / 2, 702);

  ctx.textAlign = "right";
  ctx.fillStyle = "#f1f1f1";
  ctx.font = '600 50px "STSong", "Songti SC", "Noto Serif SC", serif';
  ctx.fillText(form.togetherText.trim(), width - 140, 685);

  ctx.strokeStyle = "rgba(198, 140, 68, 0.7)";
  ctx.beginPath();
  ctx.moveTo(140, 760);
  ctx.lineTo(width - 140, 760);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#c8a94c";
  ctx.font = '700 62px "DIN Alternate", "Arial", sans-serif';
  ctx.fillText(FIXED_DATE, width / 2, 845);

  ctx.fillStyle = "#dddddd";
  ctx.font = '700 46px "DIN Alternate", "Arial", sans-serif';
  ctx.fillText(FIXED_TIME, width / 2, 912);

  ctx.fillStyle = "#e7e7e7";
  ctx.font = '500 42px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(FIXED_ADDRESS, width / 2, 983);

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.fillRect(95, 1060, 130, 170);
  ctx.fillStyle = "#b8943d";
  ctx.font = '600 28px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("酒杯示意", 160, 1155);

  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(255, 1080, 150, 150);
  ctx.strokeStyle = "#0f0f0f";
  ctx.lineWidth = 8;
  ctx.strokeRect(255, 1080, 150, 150);
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(272 + i * 35, 1098);
    ctx.lineTo(272 + i * 35, 1212);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(272, 1098 + i * 35);
    ctx.lineTo(388, 1098 + i * 35);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "#c8a94c";
  ctx.font = '700 33px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText("领取说明", 440, 1122);
  ctx.fillStyle = "#cfcfcf";
  ctx.font = '500 25px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText("1. 扫码进入领取页", 440, 1166);
  ctx.fillText("2. 如未注册会员，请先完成注册", 440, 1206);
  ctx.fillText("3. 注册完成后，返回海报扫码领取", 440, 1246);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f0f0f0";
  ctx.font = '700 40px "Arial Black", "PingFang SC", sans-serif';
  ctx.fillText("CHRONOBREWERY", width / 2, 1296);

  return canvas.toDataURL("image/png");
}

const initialForm: PosterForm = {
  openingPrefix: DEFAULT_OPENING_PREFIX,
  openingText: "开场",
  guestName: "Q",
  togetherText: "一起开场"
};

function canShareImageFile(file: File) {
  try {
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
      return false;
    }
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function PosterCustomizer() {
  const [form, setForm] = useState<PosterForm>(initialForm);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [saveTip, setSaveTip] = useState("");

  const openingCount = useMemo(() => countChineseChars(form.openingText), [form.openingText]);
  const togetherCount = useMemo(() => countChineseChars(form.togetherText), [form.togetherText]);
  const openingTotalCount = useMemo(
    () => countAllChars(`${form.openingPrefix.trim()}${form.openingText.trim()}`),
    [form.openingPrefix, form.openingText]
  );

  function validateForm() {
    if (!form.openingPrefix.trim()) {
      return "主标题前半句不能为空。";
    }
    if (!form.openingText.trim()) {
      return "主标题后半句不能为空。";
    }
    if (countChineseChars(form.openingText) > 8) {
      return "主标题后半句最多 8 个汉字。";
    }
    if (countAllChars(`${form.openingPrefix.trim()}${form.openingText.trim()}`) > OPENING_TOTAL_LIMIT) {
      return "主标题整句总长度（含标点）不能超过 10 个字符。";
    }
    if (!form.guestName.trim()) {
      return "嘉宾名不能为空。";
    }
    if (form.guestName.trim().length > 12) {
      return "嘉宾名最多 12 个字符。";
    }
    if (!form.togetherText.trim()) {
      return "“一起开场”文案不能为空。";
    }
    if (countChineseChars(form.togetherText) > 5) {
      return "“一起开场”文案最多 5 个汉字。";
    }
    return "";
  }

  function handlePreview() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSaveTip("");
    try {
      setPreviewUrl(drawPoster(form));
    } catch (drawError) {
      setError(drawError instanceof Error ? drawError.message : "预览生成失败，请重试。");
    }
  }

  async function handleSave() {
    if (!previewUrl) {
      setError("请先点击“预览邀请函”。");
      return;
    }

    setError("");
    setSaveTip("");

    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const filename = `chronobrewery-invite-${Date.now()}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      const canUseShare = canShareImageFile(file);
      if (canUseShare) {
        try {
          await navigator.share({
            files: [file],
            title: "ChronoBrewery 邀请函"
          });
          setSaveTip("已打开手机分享面板，请选择“存储到图片”或“保存到相册”。");
        } catch {
          setSaveTip("已取消分享；你也可以长按预览图保存到相册。");
        }
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = previewUrl;
      anchor.download = filename;
      anchor.click();
      setSaveTip("已触发下载；若手机浏览器未自动保存，请长按下方预览图保存到相册。");
    } catch {
      setError("保存失败，请重试。");
    }
  }

  return (
    <section className="card stack" style={{ gap: 16 }}>
      <p className="muted" style={{ margin: 0 }}>
        仅支持定制 4 段文案。其他时间、地址、说明信息固定不可编辑。
      </p>

      <div className="stack" style={{ gap: 10 }}>
        <label className="stack" style={{ gap: 6 }}>
          <span>主标题前半句（可定制）</span>
          <input
            className="input"
            maxLength={10}
            onChange={(event) => setForm((prev) => ({ ...prev, openingPrefix: event.target.value }))}
            placeholder="例如：不是开业，是"
            value={form.openingPrefix}
          />
        </label>

        <label className="stack" style={{ gap: 6 }}>
          <span>主标题后半句（最多 8 个汉字；整句含标点总长 ≤ 10）</span>
          <input
            className="input"
            maxLength={8}
            onChange={(event) => setForm((prev) => ({ ...prev, openingText: event.target.value }))}
            placeholder="例如：开场"
            value={form.openingText}
          />
          <span className="muted">当前汉字数：{openingCount} / 8</span>
          <span className="muted">主标题整句总长度（含标点）：{openingTotalCount} / 10</span>
        </label>

        <label className="stack" style={{ gap: 6 }}>
          <span>嘉宾名（诚邀 XXX）</span>
          <input
            className="input"
            maxLength={12}
            onChange={(event) => setForm((prev) => ({ ...prev, guestName: event.target.value }))}
            placeholder="例如：Q"
            value={form.guestName}
          />
        </label>

        <label className="stack" style={{ gap: 6 }}>
          <span>右侧文案（最多 5 个汉字）</span>
          <input
            className="input"
            maxLength={10}
            onChange={(event) => setForm((prev) => ({ ...prev, togetherText: event.target.value }))}
            placeholder="例如：一起开场"
            value={form.togetherText}
          />
          <span className="muted">当前汉字数：{togetherCount} / 5</span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={handlePreview} type="button">
          预览邀请函
        </button>
        <button className="btn btn-secondary" onClick={handleSave} type="button">
          确认无误，保存到手机
        </button>
      </div>

      {error ? <p style={{ margin: 0, color: "#af2934" }}>{error}</p> : null}
      {saveTip ? <p style={{ margin: 0, color: "#0f3f87" }}>{saveTip}</p> : null}

      {previewUrl ? (
        <div className="stack" style={{ gap: 8 }}>
          <strong>邀请函预览</strong>
          <img
            alt="邀请函预览图"
            src={previewUrl}
            style={{
              width: "min(100%, 420px)",
              borderRadius: 16,
              border: "1px solid #d9e2ef",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.2)"
            }}
          />
          <p className="muted" style={{ margin: 0 }}>
            手机端如未自动下载，请长按预览图并选择“保存到相册”。
          </p>
        </div>
      ) : null}
    </section>
  );
}
