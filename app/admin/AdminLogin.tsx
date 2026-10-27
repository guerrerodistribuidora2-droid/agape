"use client";

import { useState } from "react";

type ApiResponse = { error?: string };

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
      window.location.replace("/admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
      setBusy(false);
    }
  }

  return (
    <main className="admin-gate">
      <section className="admin-gate-card">
        <img className="admin-brand-image" src="/agape-mark.png" alt="Ágape" />
        <p className="admin-eyebrow">ÁGAPE · ORGANIZADORES</p>
        <h1>Panel de administración</h1>
        <p>Ingresa con tu usuario privado para administrar las noches Ágape.</p>
        <form className="admin-login-form" onSubmit={submit}>
          <label>USUARIO<input autoComplete="username" required maxLength={100} value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>CONTRASEÑA<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Verificando…" : "Iniciar sesión →"}</button>
        </form>
        <a className="admin-secondary-button" href="/agape">Volver al sitio</a>
      </section>
    </main>
  );
}
