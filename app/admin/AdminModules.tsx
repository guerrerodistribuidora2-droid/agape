"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Section = "gallery" | "coupons" | "content" | "customers";
type GalleryItem = { id: string; caption: string; altText: string; imageUrl: string };
type Coupon = { id: string; code: string; discountType: "percent" | "fixed"; amount: number; active: boolean; startsAt: string | null; endsAt: string | null; maxUses: number | null; usedCount: number };
type Customer = { id: string; reference: string; eventTitle: string; eventDate: string; name: string; age: number; gender: string; phone: string; email: string; social: string; cedula: string; cocktail: string; intention: string; couponCode: string | null; totalCents: number; status: string; createdAt: string; paymentMethod: string | null; providerTransactionId: string | null; hasReceipt: boolean; receiptFileName: string | null; proofUploadedAt: string | null; confirmationEmailSentAt: string | null };
type Settings = { contact_email: string; whatsapp_number: string; instagram_url: string; bank_primary: string; bank_other: string; hero_title: string; hero_lede: string; agenda_intro: string; story_title: string; story_text: string; closing_title: string };
type ApiResponse = { error?: string; settings?: Partial<Settings>; images?: GalleryItem[]; coupons?: Coupon[]; customers?: Customer[]; emailSent?: boolean; emailError?: string; alreadySent?: boolean };
const defaultSettings: Settings = { contact_email: "", whatsapp_number: "", instagram_url: "", bank_primary: "", bank_other: "", hero_title: "", hero_lede: "", agenda_intro: "", story_title: "", story_text: "", closing_title: "" };

const sectionTitle: Record<Section, { title: string; subtitle: string }> = {
  gallery: { title: "Momentos Ágape", subtitle: "Sube y administra las imágenes del carrusel público." },
  coupons: { title: "Códigos promocionales", subtitle: "Crea descuentos y revisa sus usos y vigencia." },
  content: { title: "Información del sitio", subtitle: "Administra contacto, WhatsApp, Instagram e instrucciones de transferencia." },
  customers: { title: "Solicitudes y clientes", subtitle: "Consulta los datos que las personas enviaron después de aceptar privacidad." },
};

export default function AdminModules({ section, organizerName }: { section: Section; organizerName: string }) {
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [revealIds, setRevealIds] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");

  async function logout() {
    await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.replace("/admin");
  }

  async function load() {
    setBusy(true); setMessage("");
    try {
      const endpoint = section === "content" ? "/api/admin/site-content" : section === "gallery" ? "/api/admin/gallery" : section === "coupons" ? "/api/admin/coupons" : "/api/admin/customers";
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.error || "No se pudo cargar la información.");
      if (section === "content") setSettings({ ...defaultSettings, ...data.settings });
      if (section === "gallery") setGallery(data.images || []);
      if (section === "coupons") setCoupons(data.coupons || []);
      if (section === "customers") setCustomers(data.customers || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar la información."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, [section]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/site-content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await response.json() as ApiResponse; if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      setMessage("Información guardada. El sitio público la actualizará al recargar.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/gallery", { method: "POST", body: data }); const body = await response.json() as ApiResponse; if (!response.ok) throw new Error(body.error || "No se pudo subir la imagen."); form.reset(); setMessage("Imagen añadida al carrusel."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo subir la imagen."); }
    finally { setBusy(false); }
  }

  async function removeImage(id: string) {
    if (!window.confirm("¿Quitar esta imagen del carrusel?")) return;
    const response = await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" }); const data = await response.json() as ApiResponse;
    if (!response.ok) { setMessage(data.error || "No se pudo quitar la imagen."); return; }
    setMessage("Imagen quitada."); await load();
  }

  async function createCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formNode = event.currentTarget; const form = new FormData(formNode);
    const rawAmount = Number(form.get("amount")); const payload = { code: String(form.get("code") || ""), discountType, amount: discountType === "percent" ? Math.round(rawAmount * 100) : Math.round(rawAmount * 100), startsAt: String(form.get("startsAt") || ""), endsAt: String(form.get("endsAt") || ""), maxUses: String(form.get("maxUses") || "") };
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json() as ApiResponse; if (!response.ok) throw new Error(data.error || "No se pudo crear el código."); formNode.reset(); setMessage("Código promocional creado."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear el código."); }
    finally { setBusy(false); }
  }

  async function deactivateCoupon(id: string) {
    const response = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" }); const data = await response.json() as ApiResponse;
    if (!response.ok) { setMessage(data.error || "No se pudo desactivar."); return; }
    setMessage("Código desactivado."); await load();
  }

  async function updateCustomerStatus(id: string, status: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json() as ApiResponse; if (!response.ok) throw new Error(data.error || "No se pudo actualizar la solicitud.");
      const feedback = data.emailSent ? "Pago confirmado y pase QR enviado por correo." : data.emailError ? `Estado actualizado. Correo pendiente: ${data.emailError}` : "Estado de la solicitud actualizado.";
      await load(); setMessage(feedback);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar la solicitud."); }
    finally { setBusy(false); }
  }

  async function resendCustomerEmail(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resend_confirmation" }) });
      const data = await response.json() as ApiResponse; if (!response.ok) throw new Error(data.error || "No se pudo enviar el pase.");
      const feedback = data.alreadySent ? "El correo ya constaba como enviado; no se duplicó." : "Pase QR enviado al correo registrado.";
      await load(); setMessage(feedback);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo enviar el pase."); }
    finally { setBusy(false); }
  }

  const info = sectionTitle[section];
  return <main className="admin-app">
    <aside className="admin-sidebar"><a className="admin-logo" href="/" aria-label="Volver a Ágape"><img src="/agape-logo-transparent.png" alt="Ágape · Conexión humana real" /></a><div className="sidebar-caption">GESTIÓN</div>
      <a className="sidebar-link" href="/admin?seccion=eventos"><span>◫</span> Eventos</a><a className={`sidebar-link ${section === "gallery" ? "active" : ""}`} href="/admin?seccion=galeria"><span>▧</span> Carrusel</a><a className={`sidebar-link ${section === "coupons" ? "active" : ""}`} href="/admin?seccion=cupones"><span>％</span> Promociones</a><a className={`sidebar-link ${section === "content" ? "active" : ""}`} href="/admin?seccion=contenido"><span>⌘</span> Contenido y contacto</a><a className={`sidebar-link ${section === "customers" ? "active" : ""}`} href="/admin?seccion=clientes"><span>◉</span> Clientes</a>
      <div className="sidebar-bottom"><div className="organizer-avatar">{organizerName.slice(0, 1).toUpperCase()}</div><div><b>{organizerName}</b><small>Administrador</small></div></div>
    </aside>
    <section className="admin-main"><header className="admin-topbar"><a href="/" className="back-to-site">← Ver sitio público</a><div className="admin-top-actions"><span className="secure-label"><i /> PANEL PRIVADO</span><a className="admin-logout" href="/admin/cambiar-contrasena">Cambiar contraseña</a><button className="admin-logout" onClick={() => void logout()}>Cerrar sesión</button></div></header>
      <div className="admin-content"><div className="admin-heading-row"><div><p className="admin-eyebrow">CENTRO DE CONTROL · ÁGAPE</p><h1>{info.title}</h1><p className="admin-subtitle">{info.subtitle}</p></div><button className="refresh-button" onClick={() => void load()}>↻ Actualizar</button></div>
        {message && <div className="admin-message" role="status">{message}</div>}
        {busy && <p className="admin-module-loading">Sincronizando con Ágape…</p>}

        {section === "content" && <form className="admin-form-card" onSubmit={saveSettings}>
          <h2 className="module-form-heading">Textos de la página</h2>
          <label>Título principal<input maxLength={180} value={settings.hero_title} onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })} /></label>
          <label>Texto principal<textarea rows={3} maxLength={250} value={settings.hero_lede} onChange={(e) => setSettings({ ...settings, hero_lede: e.target.value })} /></label>
          <label>Introducción de la agenda<textarea rows={3} maxLength={250} value={settings.agenda_intro} onChange={(e) => setSettings({ ...settings, agenda_intro: e.target.value })} /></label>
          <label>Título de la sección de historia<input maxLength={180} value={settings.story_title} onChange={(e) => setSettings({ ...settings, story_title: e.target.value })} /></label>
          <label>Texto de la sección de historia<textarea rows={3} maxLength={250} value={settings.story_text} onChange={(e) => setSettings({ ...settings, story_text: e.target.value })} /></label>
          <label>Título del cierre<input maxLength={180} value={settings.closing_title} onChange={(e) => setSettings({ ...settings, closing_title: e.target.value })} /></label>
          <h2 className="module-form-heading">Contacto y pagos</h2>
          <label>Correo de soporte<input required type="email" value={settings.contact_email} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} /></label>
          <label>WhatsApp del botón flotante y de contacto<input required inputMode="tel" value={settings.whatsapp_number} onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value.replace(/[^\d+]/g, "") })} placeholder="593… con código de país" /><small>Incluye el código de país, sin espacios. Ejemplo: 593…</small></label>
          <label>Enlace de Instagram<input type="url" value={settings.instagram_url} onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })} /></label>
          <label>Cuentas e instrucciones principales<textarea rows={6} value={settings.bank_primary} onChange={(e) => setSettings({ ...settings, bank_primary: e.target.value })} /></label>
          <label>Otras cuentas e instrucciones<textarea rows={8} value={settings.bank_other} onChange={(e) => setSettings({ ...settings, bank_other: e.target.value })} /></label>
          <p className="module-note">Las instrucciones bancarias se muestran al público en el paso de pago por transferencia. Verifica los datos antes de guardar.</p><button className="admin-create-button" disabled={busy}>Guardar cambios <span>→</span></button>
        </form>}

        {section === "gallery" && <><form className="admin-form-card gallery-upload-form" onSubmit={uploadImage}>
          <label>Título de la imagen<input required name="caption" maxLength={100} placeholder="Ej. Una bienvenida cálida" /></label><label>Texto alternativo<textarea required name="altText" maxLength={180} rows={2} placeholder="Describe la imagen para accesibilidad" /></label><label>Imagen del carrusel<input required name="image" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG o WebP · máximo 5 MB. El carrusel muestra hasta 3 imágenes; quita una para reemplazarla.</small></label><button className="admin-create-button" disabled={busy || gallery.length >= 3}>Subir al carrusel <span>↑</span></button>
        </form><div className="module-gallery-grid">{gallery.map((image) => <article className="module-gallery-card" key={image.id}><img src={image.imageUrl} alt={image.altText} /><div><b>{image.caption}</b><small>{image.altText}</small><button className="archive-action" onClick={() => void removeImage(image.id)}>Quitar del carrusel</button></div></article>)}{!busy && gallery.length === 0 && <div className="empty-events">Aún no agregas imágenes. Se mostrarán las imágenes actuales hasta que subas nuevas.</div>}</div></>}

        {section === "coupons" && <><form className="admin-form-card coupon-create-form" onSubmit={createCoupon}><label>Código<input name="code" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_-]+" placeholder="AGAPE10" /></label><label>Tipo de descuento<select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}><option value="percent">Porcentaje</option><option value="fixed">Monto fijo · USD</option></select></label><label>{discountType === "percent" ? "Descuento · %" : "Descuento · USD"}<input name="amount" required type="number" min="1" max={discountType === "percent" ? "100" : "100000"} step="1" /></label><label>Válido desde<input name="startsAt" type="date" /></label><label>Válido hasta<input name="endsAt" type="date" /></label><label>Usos máximos<input name="maxUses" type="number" min="1" placeholder="Sin límite" /></label><button className="admin-create-button" disabled={busy}>Crear código <span>＋</span></button></form><section className="admin-panel"><div className="panel-heading"><div><h2>Códigos creados</h2><p>Los códigos activos pueden validarse en el resumen de reserva.</p></div></div>{coupons.length ? <div className="module-table-wrap"><table className="module-table"><thead><tr><th>CÓDIGO</th><th>DESCUENTO</th><th>VIGENCIA</th><th>USOS</th><th>ESTADO</th><th /></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td><b>{coupon.code}</b></td><td>{coupon.discountType === "percent" ? `${(coupon.amount / 100).toFixed(0)}%` : `$${(coupon.amount / 100).toFixed(2)}`}</td><td>{coupon.startsAt || "Desde ahora"} – {coupon.endsAt || "Sin vencimiento"}</td><td>{coupon.usedCount}{coupon.maxUses ? ` / ${coupon.maxUses}` : " / ∞"}</td><td>{coupon.active ? "Activo" : "Inactivo"}</td><td>{coupon.active && <button className="archive-action" onClick={() => void deactivateCoupon(coupon.id)}>Desactivar</button>}</td></tr>)}</tbody></table></div> : <div className="empty-events">Todavía no hay códigos promocionales.</div>}</section></>}

        {section === "customers" && <section className="admin-panel"><div className="panel-heading"><div><h2>Solicitudes registradas</h2><p>Revisa comprobantes, pagos con tarjeta o transferencia y cambia el estado. Al confirmar el pago se envía el pase QR al correo.</p></div></div>{customers.length ? <div className="module-table-wrap"><table className="module-table"><thead><tr><th>CLIENTE</th><th>CONTACTO</th><th>EVENTO</th><th>PERFIL</th><th>RESERVA</th><th>PAGO / COMPROBANTE</th><th>CÉDULA</th><th>ESTADO Y PASE</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><b>{customer.name}</b><small>{customer.reference} · {new Date(customer.createdAt).toLocaleDateString("es-EC")}</small></td><td><a href={`mailto:${customer.email}`}>{customer.email}</a><small><a href={`tel:${customer.phone}`}>{customer.phone}</a></small></td><td>{customer.eventTitle || "Evento archivado"}<small>{customer.eventDate}</small></td><td>{customer.age} · {customer.gender}<small>{customer.intention} · {customer.cocktail}</small></td><td>{(customer.totalCents / 100).toLocaleString("es-EC", { style: "currency", currency: "USD" })}<small>{customer.couponCode ? `Cupón ${customer.couponCode}` : "Sin cupón"}</small></td><td>{customer.paymentMethod === "card" ? "Tarjeta · PayPhone" : customer.paymentMethod === "transfer" ? "Transferencia" : "Sin registrar"}{customer.providerTransactionId && <small>Transacción {customer.providerTransactionId}</small>}{customer.hasReceipt && <small><a href={`/api/admin/customers/${customer.id}/receipt`} target="_blank" rel="noreferrer">Ver comprobante · {customer.receiptFileName}</a></small>}{customer.proofUploadedAt && <small>Subido {new Date(customer.proofUploadedAt).toLocaleString("es-EC")}</small>}</td><td><button className="archive-action" onClick={() => setRevealIds((old) => old.includes(customer.id) ? old.filter((id) => id !== customer.id) : [...old, customer.id])}>{revealIds.includes(customer.id) ? customer.cedula : "Ver identificador"}</button></td><td><select aria-label={`Estado de ${customer.name}`} value={customer.status} disabled={busy} onChange={(event) => void updateCustomerStatus(customer.id, event.target.value)}><option value="pending_payment">Pendiente de pago</option><option value="payment_review">Pago en revisión</option><option value="payment_confirmed">Pago confirmado</option><option value="approved">Aprobada</option><option value="declined">Rechazada</option><option value="expired">Expirada</option><option value="cancelled">Cancelada</option><option value="refunded">Reembolsada</option></select><small>{customer.confirmationEmailSentAt ? `Pase enviado · ${new Date(customer.confirmationEmailSentAt).toLocaleString("es-EC")}` : "Pase aún no enviado"}</small>{["payment_confirmed", "approved"].includes(customer.status) && <button className="archive-action" disabled={busy} onClick={() => void resendCustomerEmail(customer.id)}>Enviar / reenviar pase QR</button>}</td></tr>)}</tbody></table></div> : !busy && <div className="empty-events"><span>◉</span><b>Aún no hay solicitudes</b><p>Las solicitudes aparecerán cuando una persona acepte el tratamiento de datos y continúe al pago.</p></div>}</section>}
      </div>
    </section>
  </main>;
}
