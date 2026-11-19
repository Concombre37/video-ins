import { NextResponse } from "next/server";
import { deleteProject, getProject } from "@/lib/history-store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const project = await getProject((await params).id);
  if (!project) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteProject((await params).id);
  return NextResponse.json({ ok: true });
}
