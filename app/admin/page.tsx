import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { isOrganizer } from "../../lib/admin-auth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="admin-gate">
        <section className="admin-gate-card">
          <img className="admin-brand-image" src="/agape-mark.png" alt="Ágape" />
          <p className="admin-eyebrow">ÁGAPE · ORGANIZADORES</p>
          <h1>Inicia sesión para continuar.</h1>
          <p>El panel está protegido y solo lo pueden usar organizadores autorizados.</p>
          <a className="admin-primary-button" href={chatGPTSignInPath("/admin")} target="_top">
            Iniciar sesión <span>→</span>
          </a>
        </section>
      </main>
    );
  }

  if (!isOrganizer(user.email)) {
    return (
      <main className="admin-gate">
        <section className="admin-gate-card">
          <img className="admin-brand-image" src="/agape-mark.png" alt="Ágape" />
          <p className="admin-eyebrow">ÁGAPE · ORGANIZADORES</p>
          <h1>Tu cuenta aún no tiene acceso.</h1>
          <p>Solicita al propietario del sitio que autorice tu correo como organizador.</p>
          <a className="admin-secondary-button" href="/">Volver al sitio</a>
        </section>
      </main>
    );
  }

  return <AdminDashboard organizerName={user.fullName ?? user.email} />;
}

