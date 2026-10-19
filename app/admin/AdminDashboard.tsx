"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type EventRecord = {
  id: string;
  title: string;
  venue: string;
  description: string;
  eventDate: string;
  arrivalTime: string;
  startTime: string;
  minAge: number;
  maxAge: number;
  womenCapacity: number;
  menCapacity: number;
  womenPriceCents: number;
  menPriceCents: number;
  status: "draft" | "published" | "archived";
};

type EventDraft = Omit<EventRecord, "id" | "status"> & { status: "draft" | "published" };

const emptyDraft: EventDraft = {
  title: "", venue: "Quito, Ecuador", description: "", eventDate: "", arrivalTime: "19:00",
  startTime: "19:30", minAge: 30, maxAge: 45, womenCapacity: 20, menCapacity: 20,
  womenPriceCents: 0, menPriceCents: 0, status: "draft",
};

const dateLabel = (value: string) => new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium", timeZone: "UTC",
}).format(new Date(`${value}T12:00:00Z`));

const currency = (cents: number) => new Intl.NumberFormat("es-EC", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
}).format(cents / 100);

export default function AdminDashboard({ organizerName }: { organizerName: string }) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/events", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los eventos.");
      setEvents(data.events);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al cargar los eventos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const counts = useMemo(() => ({
    total: events.filter((event) => event.status !== "archived").length,
    published: events.filter((event) => event.status === "published").length,
    draft: events.filter((event) => event.status === "draft").length,
    archived: events.filter((event) => event.status === "archived").length,
  }), [events]);

  const filteredEvents = useMemo(() => events.filter((event) =>
    (filter === "all" || event.status === filter) &&
    `${event.title} ${event.venue} ${event.eventDate}`.toLowerCase().includes(query.toLowerCase())
  ), [events, filter, query]);

  function createEvent() {
    setEditingId(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  }

  function editEvent(event: EventRecord) {
    setEditingId(event.id);
    const { id: _id, ...rest } = event;
    setDraft({ ...rest, status: event.status === "published" ? "published" : "draft" });
    setModalOpen(true);
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const payload = {
      ...draft,
      minAge: Number(draft.minAge), maxAge: Number(draft.maxAge),
      womenCapacity: Number(draft.womenCapacity), menCapacity: Number(draft.menCapacity),
      womenPriceCents: Math.round(Number(draft.womenPriceCents) * 100),
      menPriceCents: Math.round(Number(draft.menPriceCents) * 100),
    };
    try {
      const response = await fetch("/api/admin/events", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el evento.");
      setModalOpen(false);
      setMessage(editingId ? "Cambios guardados." : "Evento creado.");
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al guardar el evento.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveEvent(event: EventRecord) {
    if (!window.confirm(`¿Archivar “${event.title}”? Dejará de mostrarse al público, pero seguirá en el historial.`)) return;
    const response = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "No se pudo archivar el evento.");
      return;
    }
    setMessage("Evento archivado. Se conserva en el historial.");
    await loadEvents();
  }

  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-logo" href="/" aria-label="Volver a Ágape"><span>Á</span><b>ÁGAPE<small>CONEXIÓN HUMANA REAL</small></b></a>
        <div className="sidebar-caption">GESTIÓN</div>
        <a className="sidebar-link active" href="#eventos"><span>◫</span> Eventos</a>
        <a className="sidebar-link" href="#ayuda"><span>◇</span> Guía rápida</a>
        <div className="sidebar-bottom"><div className="organizer-avatar">{organizerName.slice(0, 1).toUpperCase()}</div><div><b>{organizerName}</b><small>Organizador autorizado</small></div></div>
      </aside>

      <section className="admin-main" id="eventos">
        <header className="admin-topbar"><a href="/" className="back-to-site">← Ver sitio público</a><span className="secure-label"><i /> PANEL PRIVADO</span></header>
        <div className="admin-content">
          <div className="admin-heading-row"><div><p className="admin-eyebrow">CENTRO DE CONTROL · ÁGAPE</p><h1>Eventos con intención.</h1><p className="admin-subtitle">Organiza fechas, cupos y precios desde un solo lugar.</p></div><button className="admin-create-button" onClick={createEvent}><span>＋</span> Crear evento</button></div>

          <div className="admin-stats">
            <article><span className="stat-icon">◫</span><div><small>EVENTOS ACTIVOS</small><b>{counts.total}</b><em>En agenda</em></div></article>
            <article><span className="stat-icon green">↗</span><div><small>PUBLICADOS</small><b>{counts.published}</b><em>Visibles en la web</em></div></article>
            <article><span className="stat-icon gold">◷</span><div><small>BORRADORES</small><b>{counts.draft}</b><em>Solo equipo</em></div></article>
            <article><span className="stat-icon gray">▤</span><div><small>ARCHIVADOS</small><b>{counts.archived}</b><em>En historial</em></div></article>
          </div>

          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Tu agenda</h2><p>Administra lo que verá el público.</p></div><button className="refresh-button" onClick={() => void loadEvents()} aria-label="Actualizar lista">↻</button></div>
            <div className="event-toolbar"><div className="admin-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar evento o lugar" /></div><div className="filter-tabs" aria-label="Filtrar eventos">{(["all", "published", "draft", "archived"] as const).map((key) => <button key={key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>{key === "all" ? "Todos" : key === "published" ? "Publicados" : key === "draft" ? "Borradores" : "Archivados"}</button>)}</div></div>

            {message && <div className="admin-message" role="status">{message}</div>}
            {loading ? <div className="empty-events"><span className="loading-orbit">◌</span><b>Cargando agenda</b><p>Un momento mientras sincronizamos tus eventos.</p></div> : filteredEvents.length === 0 ? <div className="empty-events"><span>✳</span><b>{events.length ? "No hay resultados" : "Tu próxima experiencia empieza aquí."}</b><p>{events.length ? "Prueba otro filtro o búsqueda." : "Crea un evento y publícalo cuando esté listo para recibir reservas."}</p><button onClick={createEvent}>Crear primer evento <span>→</span></button></div> : (
              <div className="event-table-wrap"><table className="event-table"><thead><tr><th>EVENTO</th><th>FECHA Y HORA</th><th>RANGO DE EDAD</th><th>CUPOS</th><th>PRECIO DESDE</th><th>ESTADO</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{filteredEvents.map((event) => <tr key={event.id}>
                <td><div className="table-event-name"><span className="event-monogram">{event.title.slice(0, 1).toUpperCase()}</span><div><b>{event.title}</b><small>{event.venue}</small></div></div></td>
                <td><b>{dateLabel(event.eventDate)}</b><small>{event.arrivalTime} · empieza {event.startTime}</small></td>
                <td>{event.minAge}–{event.maxAge} años</td>
                <td>{event.womenCapacity + event.menCapacity} <small>lugares</small></td>
                <td>{currency(Math.min(event.womenPriceCents, event.menPriceCents))}</td>
                <td><span className={`status-badge ${event.status}`}>{event.status === "published" ? "Publicado" : event.status === "draft" ? "Borrador" : "Archivado"}</span></td>
                <td><div className="row-actions"><button onClick={() => editEvent(event)} aria-label={`Editar ${event.title}`}>Editar</button>{event.status !== "archived" && <button className="archive-action" onClick={() => void archiveEvent(event)} aria-label={`Archivar ${event.title}`}>Archivar</button>}</div></td>
              </tr>)}</tbody></table></div>
            )}
          </section>

          <section className="admin-help" id="ayuda"><div className="help-seal">Á</div><div><b>Antes de publicar</b><p>Revisa fecha, aforo, edades y precios. Los eventos publicados aparecen en el sitio público; los borradores y archivados solo los ve el equipo.</p></div><a href="/" aria-label="Volver al sitio">↗</a></section>
          <footer className="admin-footer">ÁGAPE <span>·</span> CONEXIÓN HUMANA REAL <small>Panel de organización</small></footer>
        </div>
      </section>

      {modalOpen && <div className="event-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}><section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
        <header><div><p className="admin-eyebrow">DETALLES DE LA EXPERIENCIA</p><h2 id="event-modal-title">{editingId ? "Editar evento" : "Crear evento"}</h2><p>Completa la información que verá tu comunidad.</p></div><button onClick={() => setModalOpen(false)} aria-label="Cerrar">×</button></header>
        <form onSubmit={saveEvent}>
          <div className="modal-fields"><label className="wide-field">Nombre del evento<input required maxLength={100} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej. Una noche para conversar" /></label>
          <label>Lugar<input required maxLength={120} value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} /></label>
          <label>Fecha<input required type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} /></label>
          <label>Hora de llegada<input required type="time" value={draft.arrivalTime} onChange={(e) => setDraft({ ...draft, arrivalTime: e.target.value })} /></label>
          <label>Hora de inicio<input required type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} /></label>
          <label>Edad mínima<input required type="number" min="18" max="99" value={draft.minAge} onChange={(e) => setDraft({ ...draft, minAge: Number(e.target.value) })} /></label>
          <label>Edad máxima<input required type="number" min="18" max="99" value={draft.maxAge} onChange={(e) => setDraft({ ...draft, maxAge: Number(e.target.value) })} /></label>
          <label>Cupos mujeres<input required type="number" min="0" max="5000" value={draft.womenCapacity} onChange={(e) => setDraft({ ...draft, womenCapacity: Number(e.target.value) })} /></label>
          <label>Cupos hombres<input required type="number" min="0" max="5000" value={draft.menCapacity} onChange={(e) => setDraft({ ...draft, menCapacity: Number(e.target.value) })} /></label>
          <label>Precio mujeres · USD<input required type="number" min="0" step="0.01" value={draft.womenPriceCents / 100} onChange={(e) => setDraft({ ...draft, womenPriceCents: Math.round(Number(e.target.value) * 100) })} /></label>
          <label>Precio hombres · USD<input required type="number" min="0" step="0.01" value={draft.menPriceCents / 100} onChange={(e) => setDraft({ ...draft, menPriceCents: Math.round(Number(e.target.value) * 100) })} /></label>
          <label className="wide-field">Descripción<textarea rows={3} maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Cuenta en pocas líneas cómo será la experiencia." /></label>
          <label className="status-choice wide-field"><span>Visibilidad</span><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EventDraft["status"] })}><option value="draft">Guardar como borrador</option><option value="published">Publicar en el sitio</option></select></label>
          </div>
          <div className="modal-note"><span>✦</span> Al publicar, el evento se mostrará en el sitio público de Ágape.</div>
          <footer><button type="button" className="cancel-button" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="admin-create-button" disabled={saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear evento"}<span>→</span></button></footer>
        </form>
      </section></div>}
    </main>
  );
}
