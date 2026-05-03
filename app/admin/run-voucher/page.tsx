import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { RunVoucherReviewPanel } from "./RunVoucherReviewPanel";

export default function RunVoucherAdminPage() {
  const session = getSessionFromCookies();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <main className="container stack">
      <section className="card stack" style={{ gap: 6 }}>
        <strong>跑量券审核后台</strong>
        <span className="muted">审核用户提交后，可一键通知银豹系统为会员发券。</span>
      </section>
      <RunVoucherReviewPanel reviewer={session.username} />
    </main>
  );
}
