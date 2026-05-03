import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { PosterCustomizer } from "./PosterCustomizer";

export default function PosterAdminPage() {
  const session = getSessionFromCookies();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <main className="container stack">
      <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>海报文案定制</h1>
          <p className="muted" style={{ margin: 0 }}>
            当前登录：{session.username}
          </p>
        </div>
        <Link className="btn btn-secondary" href="/admin">
          返回上传后台
        </Link>
      </section>
      <PosterCustomizer />
    </main>
  );
}
