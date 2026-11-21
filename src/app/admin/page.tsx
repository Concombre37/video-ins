"use client";

/* eslint-disable @next/next/no-img-element */
import { PageLayout } from "@/components/PageLayout";
import { useSpace } from "@/components/SpaceProvider";
import type { BudgetEntry } from "@/lib/budget-store";
import { eur, type SpaceInfo } from "@/lib/spaces";
import { Loader2, Plus } from "lucide-react";
import type { NextPage } from "next";
import { useCallback, useEffect, useState } from "react";

interface Overview {
  spaces: (SpaceInfo & {
    projects: number;
    media: number;
    openRequests: number;
    credit: { creditEur: number; spentEur: number; remainingEur: number; entries: BudgetEntry[] } | null;
  })[];
}

const KIND: Record<BudgetEntry["kind"], string> = { generation: "Génération", retouche: "Retouche IA", credit: "Crédit" };

function CreditForm({ space, onDone }: { space: string; onDone: () => void }) {
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space, eur: Number(amount.replace(",", ".")), note }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erreur ${res.status}`);
      setNote("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        aria-label="Montant en euros (négatif pour retirer)"
      />
      <span className="text-sm text-muted-foreground">€</span>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (ex. : facture n°…)"
        className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <button
        onClick={submit}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter au crédit
      </button>
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Admin() {
  const { me, switchSpace } = useSpace();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setData(await res.json());
      window.dispatchEvent(new Event("bf-balance-refresh"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!me.user.admin) {
    return <main className="flex-1 p-10 text-sm text-muted-foreground">Page réservée aux administrateurs.</main>;
  }
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crédit des espaces clients et activité. L&apos;accès des comptes se règle sur hytlabs.com : profil de
            l&apos;utilisateur → « Studio vidéo ».
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!data && !error && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        {data?.spaces.map((s) => (
          <section key={s.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background-elevated p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src={s.logo} alt="" className="h-7 w-auto" />
                <h2 className="text-lg font-semibold text-foreground">{s.name}</h2>
              </div>
              {me.space !== s.id && (
                <button onClick={() => switchSpace(s.id)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-secondary/70">
                  Ouvrir cet espace
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <div className="rounded-lg bg-background p-3"><div className="text-lg font-semibold text-foreground">{s.projects}</div><div className="text-xs text-muted-foreground">projets studio</div></div>
              <div className="rounded-lg bg-background p-3"><div className="text-lg font-semibold text-foreground">{s.media}</div><div className="text-xs text-muted-foreground">fichiers en médiathèque</div></div>
              <div className="rounded-lg bg-background p-3"><div className="text-lg font-semibold text-foreground">{s.openRequests}</div><div className="text-xs text-muted-foreground">retouches ouvertes</div></div>
              <div className="rounded-lg bg-background p-3">
                <div className="text-lg font-semibold text-foreground">{s.credit ? eur(s.credit.remainingEur) : "Illimité"}</div>
                <div className="text-xs text-muted-foreground">{s.credit ? `crédit restant (dépensé : ${eur(s.credit.spentEur)})` : "solde OpenRouter global"}</div>
              </div>
            </div>
            {s.credit && (
              <>
                <CreditForm space={s.id} onDone={load} />
                {s.credit.entries.length > 0 && (
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">Date</th>
                        <th className="py-1 font-medium">Type</th>
                        <th className="py-1 font-medium">Par</th>
                        <th className="py-1 text-right font-medium">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.credit.entries.map((e, i) => (
                        <tr key={i} className="border-t border-border-dim">
                          <td className="py-1 text-muted-foreground">{new Date(e.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                          <td className="py-1 text-foreground">{KIND[e.kind]}{e.note ? ` · ${e.note}` : ""}</td>
                          <td className="py-1 text-muted-foreground">{e.by}</td>
                          <td className={`py-1 text-right ${e.eur > 0 ? "text-emerald-300" : "text-foreground"}`}>
                            {e.eur > 0 ? "+" : ""}
                            {e.eur.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

const AdminPage: NextPage = () => (
  <PageLayout>
    <Admin />
  </PageLayout>
);

export default AdminPage;
