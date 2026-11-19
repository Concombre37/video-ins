"use client";

import { PageLayout } from "@/components/PageLayout";
import type { ProjectSummary } from "@/lib/history-store";
import { cn } from "@/lib/utils";
import { FORMATS, usd } from "@/lib/video-settings";
import { Clock, Coins, Download, Film, Loader2, Music, PenLine, Plus, Search, Trash2 } from "lucide-react";
import type { NextPage } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const dateFmt = (t: number) => new Date(t).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
const modelLabel = (m?: string) => (m?.includes("haiku") ? "Haiku" : m?.includes("sonnet") ? "Sonnet" : (m ?? "—"));

function Stat({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background-elevated/60 px-4 py-3">
      <Icon className="w-5 h-5 text-primary" />
      <div>
        <div className="text-lg font-semibold leading-tight text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

const HistoryPage: NextPage = () => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyRendered, setOnlyRendered] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setProjects(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (p: ProjectSummary) => {
    if (!window.confirm(`Supprimer « ${p.title.slice(0, 60)} » et ses ${p.renders.length} vidéo(s) ?\nCette action est définitive.`)) return;
    await fetch(`/api/history/${p.id}`, { method: "DELETE" });
    load();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter(
      (p) => (!q || p.title.toLowerCase().includes(q)) && (!onlyRendered || p.renders.length > 0),
    );
  }, [projects, query, onlyRendered]);

  const totals = useMemo(() => {
    const list = projects ?? [];
    return {
      projects: list.length,
      renders: list.reduce((n, p) => n + p.renders.length, 0),
      cost: list.reduce((n, p) => n + (p.totalCost ?? 0), 0),
    };
  }, [projects]);

  return (
    <PageLayout>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-6 py-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Historique des vidéos</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Chaque génération est enregistrée automatiquement, et chaque MP4 exporté aussi.
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Plus className="w-4 h-4" /> Nouvelle vidéo
            </Link>
          </div>

          {projects && projects.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat icon={PenLine} label="projets" value={String(totals.projects)} />
              <Stat icon={Film} label="MP4 exportés" value={String(totals.renders)} />
              <Stat icon={Coins} label="dépensés en génération" value={usd(totals.cost)} />
            </div>
          )}

          {projects && projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-1 min-w-[220px] items-center gap-2 rounded-lg border border-border bg-background-elevated px-3 py-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher dans les demandes…"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={onlyRendered} onChange={(e) => setOnlyRendered(e.target.checked)} className="accent-[var(--primary)]" />
                Seulement les vidéos exportées
              </label>
            </div>
          )}

          {error && <p className="text-sm text-red-400">Impossible de charger l&apos;historique : {error}</p>}
          {!projects && !error && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
          {projects?.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Aucune vidéo pour l&apos;instant.{" "}
              <Link href="/" className="text-primary hover:underline">
                Crée ta première pub
              </Link>
              .
            </div>
          )}
          {projects && projects.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun projet ne correspond à la recherche.</p>
          )}

          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {filtered.map((p) => {
              const f = FORMATS[p.format] ?? FORMATS["9:16"];
              return (
                <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-background-elevated">
                  <div className="flex h-[300px] items-center justify-center bg-black/40">
                    {p.renders[0] ? (
                      <video
                        src={`/api/history/${p.id}/renders/${p.renders[0].file}`}
                        controls
                        preload="metadata"
                        className="max-h-full max-w-full"
                        style={{ aspectRatio: `${f.width} / ${f.height}` }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground-dim">
                        <Film className="w-8 h-8" />
                        Pas encore exportée en MP4
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <h2 className="line-clamp-3 text-sm font-semibold text-foreground" title={p.title}>
                      {p.title}
                    </h2>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{p.format}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                        {(p.durationInFrames / p.fps).toFixed(1).replace(".", ",")} s
                      </span>
                      <span className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                        <Music className="w-3 h-3" />
                        {p.musicLabel}
                      </span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{modelLabel(p.model)}</span>
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">{usd(p.totalCost ?? 0)}</span>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground-dim">
                      <Clock className="w-3.5 h-3.5" />
                      {dateFmt(p.updatedAt)} · {p.prompts} demande{p.prompts > 1 ? "s" : ""}
                    </p>

                    {p.renders.length > 0 && (
                      <ul className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
                        {p.renders.map((r, i) => (
                          <li key={r.file} className="flex items-center justify-between gap-2">
                            <span className={cn(i === 0 && "text-foreground")}>
                              MP4 du {dateFmt(r.createdAt)} · {mb(r.size)}
                            </span>
                            <a
                              href={`/api/history/${p.id}/renders/${r.file}?download`}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <Download className="w-3.5 h-3.5" /> Télécharger
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-1">
                      <Link
                        href={`/generate?project=${p.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm text-foreground hover:bg-primary hover:text-primary-foreground"
                      >
                        <PenLine className="w-4 h-4" /> Ouvrir et retoucher
                      </Link>
                      <button
                        onClick={() => remove(p)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400"
                        title="Supprimer le projet et ses vidéos"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>
    </PageLayout>
  );
};

export default HistoryPage;
