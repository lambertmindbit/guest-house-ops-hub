import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import { isStorageConfigured, uploadObject, signedUrl, deleteObject } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function ext(type: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[type] ?? "bin";
}

// The browser-supplied MIME type is client-controlled, so verify the file's
// actual magic bytes match a real jpg/png/webp/pdf before trusting/storing it.
function sniffType(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
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

  // Trust the bytes, not the label: the real file type must be an allowed one.
  const buf = await file.arrayBuffer();
  const detected = sniffType(buf);
  if (!detected || !ALLOWED.includes(detected)) {
    return fail("That file doesn't look like a JPG, PNG, WEBP, or PDF.", 422);
  }

  const path = `${id}/id-${Date.now()}.${ext(detected)}`;
  await uploadObject(path, buf, detected);

  // Best-effort cleanup of a previous document this one replaces.
  if (guest.idDocumentPath && guest.idDocumentPath !== path) {
    await deleteObject(guest.idDocumentPath).catch(() => {});
  }
  // A stored document satisfies the "ID uploaded" compliance flag; stamp the
  // upload time so the retention purge can age it out.
  await prisma.guest.update({ where: { id }, data: { idDocumentPath: path, idUploaded: true, idUploadedAt: new Date() } });
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
  await prisma.guest.update({ where: { id }, data: { idDocumentPath: null, idUploaded: false, idUploadedAt: null } });
  return ok({ deleted: true });
}
