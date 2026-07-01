import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import { isStorageConfigured, uploadObject, signedUrl, deleteObject } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function ext(type: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[type] ?? "bin";
}

// Upload (or replace) a guest's scanned ID document.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStorageConfigured()) return fail("ID document storage isn't configured.", 503);
  const { id } = await params;
  const guest = await prisma.guest.findUnique({ where: { id } });
  if (!guest) return fail("guest not found", 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("no file provided", 422);
  if (!ALLOWED.includes(file.type)) return fail("only JPG, PNG, WEBP, or PDF allowed", 422);
  if (file.size > MAX_BYTES) return fail("file too large (max 5 MB)", 422);

  const path = `${id}/id-${Date.now()}.${ext(file.type)}`;
  await uploadObject(path, await file.arrayBuffer(), file.type);

  // Best-effort cleanup of a previous document this one replaces.
  if (guest.idDocumentPath && guest.idDocumentPath !== path) {
    await deleteObject(guest.idDocumentPath).catch(() => {});
  }
  // A stored document satisfies the "ID uploaded" compliance flag.
  await prisma.guest.update({ where: { id }, data: { idDocumentPath: path, idUploaded: true } });
  return ok({ uploaded: true }, 201);
}

// Return a short-lived signed URL to view the document.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStorageConfigured()) return fail("ID document storage isn't configured.", 503);
  const { id } = await params;
  const guest = await prisma.guest.findUnique({ where: { id } });
  if (!guest?.idDocumentPath) return fail("no document on file", 404);
  return ok({ url: await signedUrl(guest.idDocumentPath) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guest = await prisma.guest.findUnique({ where: { id } });
  if (!guest?.idDocumentPath) return fail("no document on file", 404);
  if (isStorageConfigured()) await deleteObject(guest.idDocumentPath).catch(() => {});
  await prisma.guest.update({ where: { id }, data: { idDocumentPath: null, idUploaded: false } });
  return ok({ deleted: true });
}
