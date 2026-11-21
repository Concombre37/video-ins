"use client";

/* eslint-disable @next/next/no-img-element */
import { PageLayout } from "@/components/PageLayout";
import { useSpace } from "@/components/SpaceProvider";
import type { ProjectSummary } from "@/lib/history-store";
import type { MediaItem } from "@/lib/media-store";
import { cn } from "@/lib/utils";
import {
  Download,
  Eye,
  Film,
  ImageIcon,
  Loader2,
  MessageSquarePlus,
  Music2,
  PenLine,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import type { NextPage } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const dateFmt = (t: number) => new Date(t).toLocaleDateString("fr-FR", { dateStyle: "medium" });
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;

/** Élément affiché : média de la médiathèque ou vidéo exportée depuis un projet du studio. */
type Entry =
  | { kind: "media"; key: string; title: string; type: MediaItem["kind"]; date: number; item: MediaItem }
  | { kind: "studio"; key: string; title: string; type: "video"; date: number; project: ProjectSummary };

type Filter = "all" | "video" | "image" | "audio" | "studio";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "video", label: "Vidéos" },
  { id: "image", label: "Visuels" },
  { id: "audio", label: "Sons" },
  { id: "studio", label: "Créées dans le studio" },
];

const fileUrl = (e: Entry, opts: { v?: number; download?: boolean } = {}) => {
  if (e.kind === "media") {
    const q = new URLSearchParams();
    if (opts.v) q.set("v", String(opts.v));
    if (opts.download) q.set("download", "");
    const qs = q.toString();
    return `/api/media/${e.item.id}/file${qs ? `?${qs}` : ""}`;
  }
  const r = e.project.renders[0];
  return `/api/history/${e.project.id}/renders/${r.file}${opts.download ? "?download" : ""}`;
};

/** Envoi avec barre de progression (fetch ne la donne pas). */
function upload(url: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* réponse non JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body.error ?? `Erreur ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Connexion interrompue"));
    xhr.send(form);
  });
}

function Preview({ e, className }: { e: Entry; className?: string }) {
  if (e.type === "image") return <img src={fileUrl(e)} alt="" loading="lazy" className={cn("object-contain", className)} />;
  if (e.type === "audio") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 p-4", className)}>
        <Music2 className="w-10 h-10 text-primary" />
        <audio src={fileUrl(e)} controls preload="none" className="w-full" />
      </div>
    );
  }
  const poster = e.kind === "media" && e.item.hasPoster ? `/api/media/${e.item.id}/poster` : undefined;
  return (
    <video
      src={fileUrl(e)}
      poster={poster}
      preload={poster ? "none" : "metadata"}
      muted
      playsInline
      loop
      onMouseEnter={(ev) => ev.currentTarget.play().catch(() => undefined)}
      onMouseLeave={(ev) => ev.currentTarget.pause()}
      className={cn("object-contain", className)}
    />
  );
}

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div
        className={cn(
          "relative max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-border bg-background-elevated p-5 shadow-2xl",
          wide ? "max-w-5xl" : "max-w-lg",
        )}
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function RequestForm({ e, timecode, onDone }: { e: Entry; timecode?: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [tc, setTc] = useState(timecode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: e.kind === "media" ? "media" : "project",
          targetId: e.kind === "media" ? e.item.id : e.project.id,
          text,
          timecode: tc,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Demande envoyée</h2>
        <p className="text-sm text-muted-foreground">
          L&apos;IA s&apos;en occupe tout de suite : la nouvelle version arrive dans la médiathèque en quelques minutes et
          tu es prévenu par email. Suis l&apos;avancement dans{" "}
          <Link href="/requests" className="text-primary hover:underline">Retouches</Link>. Si l&apos;IA n&apos;y arrive pas,
          l&apos;équipe HytLabs prend le relais.
        </p>
        <button onClick={onDone} className="self-end rounded-lg bg-secondary px-4 py-2 text-sm text-foreground hover:bg-primary hover:text-primary-foreground">
          Fermer
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="pr-8 text-lg font-semibold text-foreground">Demander une retouche</h2>
      <p className="text-sm text-muted-foreground">« {e.title} »</p>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Ce qu&apos;il faut changer
        <textarea
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          rows={5}
          autoFocus
          placeholder="Ex. : changer le prix en 29 €, mettre notre adresse à la fin, logo plus gros, musique moins forte…"
          className="rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none focus:border-primary"
        />
      </label>
      {e.type === "video" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          À quel moment de la vidéo ? (facultatif)
          <input
            value={tc}
            onChange={(ev) => setTc(ev.target.value)}
            placeholder="Ex. : 0:52, ou « à la fin »"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none focus:border-primary"
          />
        </label>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={send}
        disabled={busy || text.trim().length < 3}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />} Envoyer la demande
      </button>
    </div>
  );
}

function Viewer({ e, admin, onRequest, onChanged }: { e: Entry; admin: boolean; onRequest: (tc?: string) => void; onChanged: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const versions = e.kind === "media" ? [...e.item.versions].reverse() : [];
  const [v, setV] = useState<number | undefined>(undefined);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const src = fileUrl(e, { v });

  const deliver = async (file: File) => {
    if (e.kind !== "media") return;
    const form = new FormData();
    form.set("file", file);
    form.set("note", note);
    setError(null);
    try {
      setProgress(0);
      await upload(`/api/media/${e.item.id}/versions`, form, setProgress);
      setNote("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex max-h-[80vh] items-center justify-center rounded-xl bg-black">
        {e.type === "image" ? (
          <img src={src} alt="" className="max-h-[80vh] max-w-full object-contain" />
        ) : e.type === "audio" ? (
          <audio key={src} src={src} controls autoPlay className="w-full p-6" />
        ) : (
          <video key={src} ref={videoRef} src={src} controls autoPlay playsInline className="max-h-[80vh] max-w-full" />
        )}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="pr-8 text-lg font-semibold leading-snug text-foreground">{e.title}</h2>
        <div className="flex flex-col gap-2">
          <a
            href={fileUrl(e, { v, download: true })}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Download className="w-4 h-4" /> Télécharger
          </a>
          <button
            onClick={() => onRequest(videoRef.current ? fmtTime(videoRef.current.currentTime) : undefined)}
            className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-foreground hover:bg-secondary/70"
          >
            <MessageSquarePlus className="w-4 h-4" /> Demander une retouche
            {e.type === "video" && <span className="text-xs text-muted-foreground">(à cet instant)</span>}
          </button>
          {e.kind === "studio" && (
            <Link
              href={`/generate?project=${e.project.id}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-foreground hover:bg-secondary/70"
            >
              <Sparkles className="w-4 h-4" /> Modifier avec l&apos;IA
            </Link>
          )}
        </div>

        {versions.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Versions</h3>
            {versions.map((x, i) => {
              const current = v ? v === x.n : i === 0;
              return (
                <button
                  key={x.n}
                  onClick={() => setV(i === 0 ? undefined : x.n)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    current ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  <span className="font-semibold">Version {x.n}</span>
                  {i === 0 && " · la plus récente"} · {dateFmt(x.createdAt)} · {mb(x.size)}
                  {x.note && <span className="mt-1 block text-muted-foreground">{x.note}</span>}
                </button>
              );
            })}
          </div>
        )}

        {admin && e.kind === "media" && (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Livrer une nouvelle version</h3>
            <input
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Note pour le client (facultatif)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground hover:bg-secondary/70">
              {progress != null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {progress != null ? `Envoi… ${Math.round(progress * 100)} %` : "Choisir le fichier"}
              <input type="file" className="hidden" disabled={progress != null} onChange={(ev) => ev.target.files?.[0] && deliver(ev.target.files[0])} />
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const MediaPage: NextPage = () => (
  <PageLayout>
    <MediaLibrary />
  </PageLayout>
);

function MediaLibrary() {
  const { me } = useSpace();
  const admin = me.user.admin;
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [requesting, setRequesting] = useState<{ e: Entry; tc?: string } | null>(null);
  const [uploads, setUploads] = useState<{ name: string; p: number; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        fetch("/api/media", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Erreur ${r.status}`)))),
        fetch("/api/history", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setMedia(m);
      setProjects(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = (media ?? []).map((item) => ({ kind: "media", key: `m-${item.id}`, title: item.title, type: item.kind, date: item.updatedAt, item }));
    for (const p of projects) {
      // les projets de retouche d'un média sont déjà livrés comme versions de ce média
      if (p.renders.length && !p.sourceMediaId) list.push({ kind: "studio", key: `p-${p.id}`, title: p.title, type: "video", date: p.renders[0].createdAt, project: p });
    }
    return list.sort((a, b) => b.date - a.date);
  }, [media, projects]);

  const categories = useMemo(
    () => [...new Set((media ?? []).map((m) => m.category).filter((c): c is string => !!c))].sort(),
    [media],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "studio" ? e.kind !== "studio" : filter !== "all" && e.type !== filter) return false;
      if (category && (e.kind !== "media" || e.item.category !== category)) return false;
      return !q || e.title.toLowerCase().includes(q);
    });
  }, [entries, filter, category, query]);

  const sendFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      if (category) form.set("category", category);
      setUploads((u) => [...u, { name: file.name, p: 0 }]);
      const set = (patch: { p?: number; error?: string }) =>
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, ...patch } : x)));
      try {
        await upload("/api/media", form, (p) => set({ p }));
        setUploads((u) => u.filter((x) => x.name !== file.name));
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    load();
  };

  const remove = async (e: Entry) => {
    if (e.kind !== "media") return;
    if (!window.confirm(`Supprimer « ${e.title} » de la médiathèque ?\nCette action est définitive.`)) return;
    const res = await fetch(`/api/media/${e.item.id}`, { method: "DELETE" });
    if (!res.ok) window.alert((await res.json().catch(() => ({}))).error ?? "Suppression impossible");
    load();
  };

  const canDelete = (e: Entry) => e.kind === "media" && (admin || (e.item.source === "envoi" && e.item.versions[0]?.by === me.user.email));

  return (
    <main
      className="relative flex-1 overflow-y-auto"
      onDragOver={(ev) => {
        ev.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(ev) => ev.currentTarget === ev.target && setDragging(false)}
      onDrop={(ev) => {
        ev.preventDefault();
        setDragging(false);
        if (ev.dataTransfer.files.length) sendFiles(ev.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 text-lg font-semibold text-primary">
          Dépose tes fichiers pour les ajouter à la médiathèque
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Médiathèque</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Toutes les vidéos et visuels créés pour {me.spaces.find((s) => s.id === me.space)?.name}. Regarde-les,
              télécharge-les, demande une retouche, ou ajoute tes propres photos et vidéos.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
            <UploadCloud className="w-4 h-4" /> Ajouter des fichiers
            <input type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={(ev) => ev.target.files && sendFiles(ev.target.files)} />
          </label>
        </div>

        {uploads.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-xl border border-border bg-background-elevated p-3 text-xs">
            {uploads.map((u) => (
              <li key={u.name} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-foreground">{u.name}</span>
                {u.error ? (
                  <span className="text-red-400">{u.error}</span>
                ) : (
                  <span className="h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full bg-primary" style={{ width: `${u.p * 100}%` }} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-elevated p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(ev) => setCategory(ev.target.value)}
              className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-foreground"
              aria-label="Catégorie"
            >
              <option value="">Toutes les campagnes</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <label className="flex flex-1 min-w-[200px] items-center gap-2 rounded-lg border border-border bg-background-elevated px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-400">Impossible de charger la médiathèque : {error}</p>}
        {!media && !error && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        {media && entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            La médiathèque est vide pour l&apos;instant. Ajoute des fichiers ou{" "}
            <Link href="/" className="text-primary hover:underline">crée une vidéo</Link>.
          </div>
        )}
        {media && entries.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Aucun fichier ne correspond.</p>}

        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {shown.map((e) => {
            const versions = e.kind === "media" ? e.item.versions.length : 1;
            const Icon = e.type === "image" ? ImageIcon : e.type === "audio" ? Music2 : Film;
            return (
              <article key={e.key} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background-elevated">
                <button onClick={() => setViewing(e)} className="relative flex h-[260px] items-center justify-center bg-black/40" title="Voir">
                  <Preview e={e} className="max-h-full max-w-full" />
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    <Icon className="w-3 h-3" />
                    {e.kind === "studio" ? "Studio" : e.item.format ?? (e.type === "image" ? "Visuel" : e.type === "audio" ? "Son" : "Vidéo")}
                  </span>
                  {versions > 1 && (
                    <span className="absolute right-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">v{versions}</span>
                  )}
                </button>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <h2 className="line-clamp-2 text-sm font-semibold text-foreground" title={e.title}>
                    {e.title}
                  </h2>
                  <p className="text-[11px] text-muted-foreground-dim">
                    {e.kind === "media" && e.item.category ? `${e.item.category} · ` : ""}
                    {dateFmt(e.date)}
                    {e.kind === "media" && e.item.source === "envoi" ? " · envoyé par le client" : ""}
                  </p>
                  <div className="mt-auto flex items-center gap-1 pt-1">
                    <button onClick={() => setViewing(e)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Voir">
                      <Eye className="w-4 h-4" />
                    </button>
                    <a href={fileUrl(e, { download: true })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Télécharger">
                      <Download className="w-4 h-4" />
                    </a>
                    <button onClick={() => setRequesting({ e })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Demander une retouche">
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    {e.kind === "studio" && (
                      <Link href={`/generate?project=${e.project.id}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Modifier avec l'IA">
                        <PenLine className="w-4 h-4" />
                      </Link>
                    )}
                    {canDelete(e) && (
                      <button onClick={() => remove(e)} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-red-400" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {viewing && !requesting && (
        <Modal wide onClose={() => setViewing(null)}>
          <Viewer
            e={viewing}
            admin={admin}
            onRequest={(tc) => setRequesting({ e: viewing, tc })}
            onChanged={async () => {
              await load();
              setViewing(null);
            }}
          />
        </Modal>
      )}
      {requesting && (
        <Modal onClose={() => setRequesting(null)}>
          <RequestForm e={requesting.e} timecode={requesting.tc} onDone={() => { setRequesting(null); setViewing(null); }} />
        </Modal>
      )}
    </main>
  );
}

export default MediaPage;
