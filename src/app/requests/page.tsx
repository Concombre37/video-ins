"use client";

import { PageLayout } from "@/components/PageLayout";
import { useSpace } from "@/components/SpaceProvider";
import type { RequestStatus, RetouchRequest } from "@/lib/requests-store";
import { cn } from "@/lib/utils";
import { Clock, Download, Film, Loader2, MessageSquareText, Send, Upload } from "lucide-react";
import type { NextPage } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  nouvelle: { label: "Nouvelle", cls: "bg-amber-500/15 text-amber-300" },
  en_cours: { label: "En cours", cls: "bg-primary/15 text-primary" },
  livree: { label: "Livrée", cls: "bg-emerald-500/15 text-emerald-300" },
  fermee: { label: "Fermée", cls: "bg-secondary text-muted-foreground" },
};
const when = (t: number) => new Date(t).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function RequestCard({ r, admin, onChanged }: { r: RetouchRequest; admin: boolean; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const patch = async (body: { status?: RequestStatus; text?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erreur ${res.status}`);
      setText("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const deliver = (file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("note", text);
    form.set("request", r.id);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/media/${r.target.id}/versions`);
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        setText("");
        onChanged();
      } else {
        try {
          setError(JSON.parse(xhr.responseText).error);
        } catch {
          setError(`Erreur ${xhr.status}`);
        }
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Connexion interrompue");
    };
    setProgress(0);
    xhr.send(form);
  };

  const fileHref =
    r.target.type === "media" ? `/api/media/${r.target.id}/file` : `/generate?project=${r.target.id}`;

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-background-elevated p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Film className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">{r.target.title}</span>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground-dim">
            <Clock className="w-3.5 h-3.5" /> {when(r.createdAt)} · par {r.byName}
            {r.timecode && <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">à {r.timecode}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {admin ? (
            <select
              value={r.status}
              disabled={busy}
              onChange={(e) => patch({ status: e.target.value as RequestStatus })}
              className={cn("rounded-md border-0 px-2 py-1 text-xs font-semibold", STATUS[r.status].cls)}
              aria-label="Statut"
            >
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
          )}
          <Link href={fileHref} target={r.target.type === "media" ? "_blank" : undefined} className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-xs text-foreground hover:bg-secondary/70">
            <Download className="w-3.5 h-3.5" /> {r.target.type === "media" ? "Dernière version" : "Ouvrir le projet"}
          </Link>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {r.messages.map((m, i) => (
          <li key={i} className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", m.staff ? "self-start bg-primary/10" : "self-end bg-secondary")}>
            <div className="mb-0.5 text-[11px] text-muted-foreground">
              {m.staff ? `${m.byName} · équipe HytLabs` : m.byName} · {when(m.at)}
            </div>
            <p className="whitespace-pre-wrap text-foreground">{m.text}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={admin ? "Réponse au client (ou note jointe à la version livrée)" : "Ajouter une précision…"}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => patch({ text })}
            disabled={busy || !text.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer
          </button>
        </div>
        {admin && r.target.type === "media" && (
          <label className="flex cursor-pointer items-center gap-2 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
            {progress != null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {progress != null ? `Envoi… ${Math.round(progress * 100)} %` : "Livrer la version retouchée (passe la demande en « Livrée »)"}
            <input type="file" className="hidden" disabled={progress != null} onChange={(e) => e.target.files?.[0] && deliver(e.target.files[0])} />
          </label>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </article>
  );
}

/** Pour l'équipe : retouches ouvertes dans les autres espaces (la page ne montre que l'espace actif). */
function OtherSpaces() {
  const { me } = useSpace();
  const [others, setOthers] = useState<{ id: string; name: string; openRequests: number }[]>([]);
  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { spaces: [] }))
      .then((d) => setOthers(d.spaces.filter((s: { id: string; openRequests: number }) => s.id !== me.space && s.openRequests > 0)))
      .catch(() => undefined);
  }, [me.space]);
  if (!others.length) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
      {others.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3">
          <span className="text-foreground">
            {s.openRequests} retouche{s.openRequests > 1 ? "s" : ""} ouverte{s.openRequests > 1 ? "s" : ""} dans <strong>{s.name}</strong>
          </span>
          <button
            onClick={async () => {
              await fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space: s.id }) });
              window.location.href = "/requests";
            }}
            className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary-hover"
          >
            Voir
          </button>
        </div>
      ))}
    </div>
  );
}

function Requests() {
  const { me } = useSpace();
  const [list, setList] = useState<RetouchRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/requests", { cache: "no-store" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setList(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => (list ?? []).filter((r) => showClosed || (r.status !== "fermee" && r.status !== "livree")),
    [list, showClosed],
  );
  const hidden = (list?.length ?? 0) - shown.length;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Retouches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tes demandes de modification et les réponses de l&apos;équipe HytLabs. Pour en créer une, ouvre une vidéo dans la{" "}
            <Link href="/media" className="text-primary hover:underline">médiathèque</Link>.
            {me.user.admin && " (Vue admin : tu peux répondre, changer le statut et livrer la version retouchée.)"}
          </p>
        </div>
        {(list?.length ?? 0) > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-[var(--primary)]" />
            Afficher aussi les demandes livrées et fermées{hidden > 0 && !showClosed ? ` (${hidden})` : ""}
          </label>
        )}
        {me.user.admin && <OtherSpaces />}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!list && !error && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        {list && shown.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <MessageSquareText className="w-8 h-8" />
            Aucune demande en cours.
          </div>
        )}
        {shown.map((r) => (
          <RequestCard key={r.id} r={r} admin={me.user.admin} onChanged={load} />
        ))}
      </div>
    </main>
  );
}

const RequestsPage: NextPage = () => (
  <PageLayout>
    <Requests />
  </PageLayout>
);

export default RequestsPage;
