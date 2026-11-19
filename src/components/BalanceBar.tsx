"use client";

import { usd } from "@/lib/video-settings";
import { Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Balance =
  | { provider: "anthropic" }
  | { provider: "openrouter"; limit: number | null; remaining: number | null; usage: number }
  | { provider: "openrouter"; error: string };

/** Bandeau du bas : solde OpenRouter restant (rafraîchi après chaque génération). */
export function BalanceBar() {
  const [balance, setBalance] = useState<Balance | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/balance", { cache: "no-store" });
      setBalance(await res.json());
    } catch {
      setBalance({ provider: "openrouter", error: "hors ligne" });
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    // OpenRouter met quelques secondes à compter une dépense
    const onRefresh = () => {
      setTimeout(load, 4_000);
      setTimeout(load, 25_000);
    };
    window.addEventListener("bf-balance-refresh", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("bf-balance-refresh", onRefresh);
    };
  }, [load]);

  let text = "Solde : chargement…";
  let ratio: number | null = null;
  if (balance?.provider === "anthropic") text = "Clé Anthropic directe (solde non disponible)";
  else if (balance && "error" in balance) text = `Solde indisponible (${balance.error})`;
  else if (balance && "usage" in balance) {
    if (balance.remaining != null && balance.limit) {
      text = `Solde OpenRouter : ${usd(balance.remaining)} restants sur ${usd(balance.limit)}`;
      ratio = Math.max(0, Math.min(1, balance.remaining / balance.limit));
    } else {
      text = `OpenRouter : ${usd(balance.usage)} dépensés (pas de plafond)`;
    }
  }
  const low = ratio != null && ratio < 0.15;

  return (
    <footer className="shrink-0 flex items-center gap-4 px-6 md:px-10 py-2 border-t border-border-dim text-xs text-muted-foreground">
      <span className={`flex items-center gap-2 ${low ? "text-red-400" : ""}`}>
        <Wallet className="w-3.5 h-3.5" />
        {text}
      </span>
      {ratio != null && (
        <span className="hidden sm:block h-1.5 w-32 rounded-full bg-secondary overflow-hidden" aria-hidden>
          <span
            className={`block h-full rounded-full ${low ? "bg-red-500" : "bg-primary"}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      )}
      {balance && "usage" in balance && balance.limit != null && (
        <span className="ml-auto hidden md:inline text-muted-foreground-dim">
          Dépensé : {usd(balance.usage)}
        </span>
      )}
    </footer>
  );
}
