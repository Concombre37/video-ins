import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { extOf, MAX_UPLOAD, putSource, SOURCE_ROLE_LABEL, type SourceRole } from "@/lib/media-store";

export const dynamic = "force-dynamic";

/** Ajoute un fichier source à un média (équipe HytLabs). Formulaire : file, role, label. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext({ admin: true });
  if (ctx instanceof Response) return ctx;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 1) return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "Fichier trop gros (400 Mo maximum)" }, { status: 413 });
  const roleIn = String(form?.get("role") || "autre");
  const role: SourceRole = roleIn in SOURCE_ROLE_LABEL ? (roleIn as SourceRole) : "autre";
  const ext = extOf(file.name) || "bin";
  const base = file.name.slice(0, file.name.length - ext.length - 1).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "fichier";
  try {
    await putSource(ctx.space, (await params).id, {
      name: `${base}.${ext.replace(/[^a-z0-9]/g, "").slice(0, 8)}`,
      label: String(form?.get("label") || file.name),
      role,
      data: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
