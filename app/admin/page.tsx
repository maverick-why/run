import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { UploadPanel } from "./UploadPanel";

export default function AdminPage() {
  const session = getSessionFromCookies();
  if (!session) {
    redirect("/admin/login");
  }
  const activitySlug = process.env.NEXT_PUBLIC_ACTIVITY_SLUG || "default";

  return (
    <main className="container stack">
      <section className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="stack" style={{ gap: 4 }}>
          <strong>后台工具</strong>
          <span className="muted">可进入海报文案定制页，或进入跑量活动审核页触发银豹发券。</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/admin/poster">
            海报文案定制
          </Link>
          <Link className="btn btn-primary" href="/admin/run-voucher">
            跑量活动审核
          </Link>
        </div>
      </section>
      <UploadPanel activitySlug={activitySlug} username={session.username} />
    </main>
  );
}
