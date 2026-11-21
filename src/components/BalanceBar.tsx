"use client";

import { eur } from "@/lib/spaces";
import { usd } from "@/lib/video-settings";
import { Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type OpenRouter =
  | { provider: "anthropic" }
  | { provider: "openrouter"; limit: number | null; remaining: number | null; usage: number }
  | { provider: "openrouter"; error: string };

interface Balance {
  credit: { creditEur: number; spentEur: number; remainingEur: number } | null;
  openrouter: OpenRouter | null;
}

function Meter({ ratio }: { ratio: number }) {
  const low = ratio < 0.15;
  return (
    <span className="hidden sm:block h-1.5 w-32 rounded-full bg-secondary overflow-hidden" aria-hidden>
      <span className={`block h-full rounded-full ${low ? "bg-red-500" : "bg-primary"}`} style={{ width: `${ratio * 100}%` }} />
    </span>
  );
}

/** Bandeau du bas : crédit restant de l'espace et, pour les admins, solde OpenRouter. */
export function BalanceBar() {
  const [balance, setBalance] = useState<Balance | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/balance", { cache: "no-store" });
      if (res.ok) setBalance(await res.json());
    } catch {
      /* hors ligne : on garde l'affichage précédent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    // OpenRouter met quelques secondes à compter une dépense
    const onRefresh = () => {
      setTimeout(load, 1_500);
      setTimeout(load, 25_000);
    };
    window.addEventListener("bf-balance-refresh", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("bf-balance-refresh", onRefresh);
    };
  }, [load]);

  const c = balance?.credit;
  const o = balance?.openrouter;
  let orText: string | null = null;
  let orRatio: number | null = null;
  if (o?.provider === "anthropic") orText = "Clé Anthropic directe";
  else if (o && "error" in o) orText = `OpenRouter indisponible (${o.error})`;
  else if (o && "usage" in o) {
    if (o.remaining != null && o.limit) {
      orText = `OpenRouter : ${usd(o.remaining)} restants sur ${usd(o.limit)}`;
      orRatio = Math.max(0, Math.min(1, o.remaining / o.limit));
    } else orText = `OpenRouter : ${usd(o.usage)} dépensés`;
  }
  const cRatio = c && c.creditEur > 0 ? Math.max(0, Math.min(1, c.remainingEur / c.creditEur)) : null;

  return (
    <footer className="shrink-0 flex flex-wrap items-center gap-x-6 gap-y-1 px-6 md:px-10 py-2 border-t border-border-dim text-xs text-muted-foreground">
      {!balance && <span className="flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> Solde : chargement…</span>}
      {c && (
        <span className={`flex items-center gap-2 ${c.remainingEur <= 0 ? "text-red-400" : ""}`}>
          <Wallet className="w-3.5 h-3.5" />
          Crédit restant : <strong className="text-foreground">{eur(Math.max(0, c.remainingEur))}</strong>
          {c.creditEur > 0 && <span className="text-muted-foreground-dim">sur {eur(c.creditEur)}</span>}
          {cRatio != null && <Meter ratio={cRatio} />}
        </span>
      )}
      {orText && (
        <span className="flex items-center gap-2">
          {!c && <Wallet className="w-3.5 h-3.5" />}
          {orText}
          {orRatio != null && <Meter ratio={orRatio} />}
        </span>
      )}
      {c && c.remainingEur <= 0 && (
        <span className="ml-auto text-red-400">Crédit épuisé : demande une recharge à l&apos;équipe HytLabs.</span>
      )}
    </footer>
  );
}
