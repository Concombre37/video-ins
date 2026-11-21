import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { deleteProject, getProject } from "@/lib/history-store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const project = await getProject(ctx.space, (await params).id);
  if (!project) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  await deleteProject(ctx.space, (await params).id);
  return NextResponse.json({ ok: true });
}
