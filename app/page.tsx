import { getChatGPTUser } from "./chatgpt-auth";
import { isOrganizer } from "../lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const canManage = user ? isOrganizer(user.email) : false;

  return (
    <main className="public-shell">
      {canManage ? (
        <a className="organizer-entry" href="/admin">
          Panel organizador <span aria-hidden="true">↗</span>
        </a>
      ) : null}
      <iframe
        className="public-site-frame"
        src="/agape.html"
        title="Ágape — Conexión humana real"
      />
    </main>
  );
}
