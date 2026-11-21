import path from "node:path";
import { readJson, withLock, writeJson } from "./json-file";
import { spaceDir } from "./space-data";
import { SPACES, type SpaceId } from "./spaces";

/**
 * Crédit d'un espace (en euros). Chaque génération ou retouche IA retire son coût réel
 * (tokens × tarif OpenRouter, converti avec USD_EUR). Les admins ajoutent du crédit depuis /admin.
 * Un espace sans crédit (HytLabs) n'est pas limité : seul le solde OpenRouter global compte.
 */
export interface BudgetEntry {
  at: number;
  /** positif = crédit ajouté, négatif = dépense */
  eur: number;
  usd?: number;
  kind: "generation" | "retouche" | "credit";
  by: string;
  note?: string;
  projectId?: string;
}

export interface Budget {
  creditEur: number;
  spentEur: number;
  entries: BudgetEntry[];
}

const file = (space: SpaceId) => path.join(spaceDir(space), "budget.json");
const EMPTY: Budget = { creditEur: 0, spentEur: 0, entries: [] };

export const usdToEur = (usd: number) => usd * (Number(process.env.USD_EUR) || 0.87);

export async function getBudget(space: SpaceId): Promise<Budget> {
  return readJson(file(space), EMPTY);
}

export function remaining(b: Budget) {
  return Math.round((b.creditEur - b.spentEur) * 10000) / 10000;
}

/** Le crédit est-il suffisant pour lancer une génération ? */
export async function canSpend(space: SpaceId) {
  if (!SPACES[space].hasCredit) return true;
  return remaining(await getBudget(space)) > 0;
}

export async function charge(space: SpaceId, usd: number, e: Omit<BudgetEntry, "at" | "eur" | "usd">) {
  if (!SPACES[space].hasCredit || !(usd > 0)) return;
  await withLock(file(space), async () => {
    const b = await getBudget(space);
    const eur = Math.round(usdToEur(usd) * 10000) / 10000;
    b.spentEur = Math.round((b.spentEur + eur) * 10000) / 10000;
    b.entries.push({ ...e, at: Date.now(), eur: -eur, usd });
    b.entries = b.entries.slice(-2000);
    await writeJson(file(space), b);
  });
}

export async function addCredit(space: SpaceId, eur: number, by: string, note?: string) {
  return withLock(file(space), async () => {
    const b = await getBudget(space);
    b.creditEur = Math.round((b.creditEur + eur) * 100) / 100;
    b.entries.push({ at: Date.now(), eur, kind: "credit", by, note });
    await writeJson(file(space), b);
    return b;
  });
}
