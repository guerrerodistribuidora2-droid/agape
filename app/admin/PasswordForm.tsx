"use client";

import { useEffect, useState } from "react";

type Mode = "recover" | "change" | "reset";
export default function PasswordForm({ mode, currentUsername = "" }: { mode: Mode; currentUsername?: string }) {
  const [username, setUsername] = useState(currentUsername);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (mode !== "reset") return;
    setToken(window.location.hash.slice(1));
    window.history.replaceState(null, "", window.location.pathname);
  }, [mode]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (mode === "reset" && password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    if (mode === "reset" && !token) { setError("El enlace no es válido o ya no está disponible. Solicita uno nuevo."); return; }
    setBusy(true);
    try {
      const response = await fetch(mode === "reset" ? "/api/admin/password/reset" : "/api/admin/password/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "reset" ? { token, password } : { mode, username, password: currentPassword }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo completar la solicitud.");
      setMessage(result.message || "Solicitud completada."); setCurrentPassword(""); setPassword(""); setConfirmPassword(""); setToken(""); setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo completar la solicitud."); }
    finally { setBusy(false); }
  }
  const title = mode === "recover" ? "Recuperar contraseña" : mode === "change" ? "Cambiar contraseña" : "Elige una contraseña";
  return <main className="admin-gate"><section className="admin-gate-card">
    <img className="admin-brand-image" src="/agape-mark.png" alt="Ágape" />
    <p className="admin-eyebrow">ÁGAPE · ORGANIZADORES</p><h1>{title}</h1>
    <p>{mode === "reset" ? "El enlace es personal y válido por 20 minutos." : "Enviaremos un enlace de un solo uso al correo de recuperación del propietario."}</p>
    {!done && <form className="admin-login-form" onSubmit={submit}>
      {mode === "recover" && <label>USUARIO<input autoComplete="username" required maxLength={100} value={username} onChange={(e) => setUsername(e.target.value)} /></label>}
      {mode === "change" && <label>CONTRASEÑA ACTUAL<input type="password" autoComplete="current-password" required maxLength={1024} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>}
      {mode === "reset" && <><label>NUEVA CONTRASEÑA<input type="password" autoComplete="new-password" required minLength={4} maxLength={1024} value={password} onChange={(e) => setPassword(e.target.value)} /></label><label>CONFIRMAR CONTRASEÑA<input type="password" autoComplete="new-password" required minLength={4} maxLength={1024} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label><small>Usa una contraseña larga y única para proteger los datos de tus clientes.</small></>}
      {error && <p className="admin-login-error" role="alert">{error}</p>}
      <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Un momento…" : mode === "reset" ? "Guardar contraseña" : "Enviar enlace"}</button>
    </form>}
    {message && <p className="admin-login-status" role="status">{message}</p>}
    <a className="admin-secondary-button" href="/admin">Volver al administrador</a>
  </section></main>;
}
