import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { getBudget, remaining } from "@/lib/budget-store";
import { listProjects } from "@/lib/history-store";
import { listMedia } from "@/lib/media-store";
import { listRequests } from "@/lib/requests-store";
import { SPACE_IDS, SPACES } from "@/lib/spaces";

export const dynamic = "force-dynamic";

/** Vue d'ensemble de tous les espaces (admin). */
export async function GET() {
  const ctx = await requireContext({ admin: true });
  if (ctx instanceof Response) return ctx;
  const spaces = await Promise.all(
    SPACE_IDS.map(async (id) => {
      const [budget, projects, media, requests] = await Promise.all([
        SPACES[id].hasCredit ? getBudget(id) : null,
        listProjects(id),
        listMedia(id),
        listRequests(id),
      ]);
      return {
        ...SPACES[id],
        projects: projects.length,
        media: media.length,
        openRequests: requests.filter((r) => r.status === "nouvelle" || r.status === "en_cours").length,
        credit: budget
          ? { creditEur: budget.creditEur, spentEur: budget.spentEur, remainingEur: remaining(budget), entries: budget.entries.slice(-40).reverse() }
          : null,
      };
    }),
  );
  return NextResponse.json({ spaces });
}
