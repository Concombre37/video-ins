"use client";

import { setActiveBrand } from "@/remotion/active-brand";
import type { SpaceId, SpaceInfo } from "@/lib/spaces";
import { Loader2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Me {
  /** pastille du menu Retouches */
  badge: number;
  user: { name: string; email: string; admin: boolean };
  space: SpaceId;
  spaces: SpaceInfo[];
  credit: { creditEur: number; spentEur: number; remainingEur: number } | null;
}

const Ctx = createContext<{ me: Me; switchSpace: (s: SpaceId) => Promise<void>; reload: () => Promise<void> } | null>(null);

/**
 * Données de l'utilisateur et de l'espace actif, chargées une fois par page.
 * Imbriqué dans un autre SpaceProvider, il ne recharge rien.
 */
export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const parent = useContext(Ctx);
  return parent ? <>{children}</> : <SpaceLoader>{children}</SpaceLoader>;
}

function SpaceLoader({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = `/api/auth/login?return=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: Me = await res.json();
      setActiveBrand(data.space);
      document.documentElement.dataset.space = data.space;
      setMe(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const switchSpace = useCallback(async (space: SpaceId) => {
    await fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space }) });
    // les projets, la médiathèque et l'identité changent : on repart de l'accueil
    window.location.href = "/";
  }, []);

  if (!me) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-sm text-muted-foreground">
        {error ? `Impossible de charger le studio : ${error}` : <Loader2 className="w-6 h-6 animate-spin text-primary" />}
      </div>
    );
  }
  return <Ctx.Provider value={{ me, switchSpace, reload }}>{children}</Ctx.Provider>;
}

export function useSpace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSpace hors de SpaceProvider");
  return v;
}
