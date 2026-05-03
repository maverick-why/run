"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "登录失败，请检查账号密码。");
      return;
    }

    startTransition(() => {
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h1 style={{ margin: 0 }}>后台登录</h1>
      <label className="stack">
        <span>密码</span>
        <input className="input" type="password" name="password" required />
      </label>
      {error ? (
        <p style={{ margin: 0, color: "#af2934" }}>{error}</p>
      ) : (
        <p style={{ margin: 0 }} className="muted">
          当前为密码登录，凭证由环境变量 `ADMIN_PASSWORD` 管理。
        </p>
      )}
      <button className="btn btn-primary" disabled={isPending} type="submit">
        {isPending ? "登录中..." : "登录后台"}
      </button>
    </form>
  );
}
