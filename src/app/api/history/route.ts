import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { isValidId, listProjects, saveProject, type Project } from "@/lib/history-store";
import { DEFAULT_FORMAT, DEFAULT_VOLUME, isVideoFormat, parseMusic } from "@/lib/video-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  return NextResponse.json(await listProjects(ctx.space));
}

/** Crée ou met à jour un projet de l'espace actif (appelé après chaque génération). */
export async function POST(req: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const body = (await req.json()) as Partial<Project>;
  if (!body.id || !isValidId(body.id) || typeof body.code !== "string") {
    return NextResponse.json({ error: "Projet invalide" }, { status: 400 });
  }
  const now = Date.now();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const totalCost = messages.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);
  const saved = await saveProject(ctx.space, {
    id: body.id,
    title: String(body.title ?? "Sans titre").slice(0, 200),
    createdAt: now,
    updatedAt: now,
    code: body.code,
    fps: Number(body.fps) || 30,
    durationInFrames: Number(body.durationInFrames) || 150,
    model: body.model,
    messages,
    productImages: Array.isArray(body.productImages)
      ? body.productImages.filter((i) => typeof i === "string")
      : [],
    format: isVideoFormat(body.format) ? body.format : DEFAULT_FORMAT,
    music: parseMusic(body.music),
    volume: Math.min(1, Math.max(0, Number(body.volume ?? DEFAULT_VOLUME))),
    totalCost,
  });
  return NextResponse.json({ id: saved.id, updatedAt: saved.updatedAt });
}
