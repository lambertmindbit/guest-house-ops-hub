import { z } from "zod";

// Guest-facing room content the owner authors in Settings and the assistant
// shows when listing rooms. Photos are owner-pasted URLs (same pattern as
// FaqEntry.media) — no upload/storage involved.
export const roomPhotosSchema = z
  .array(z.string().url().max(1000))
  .max(8)
  .nullable()
  .optional();

export const roomFacingSchema = z.string().trim().max(60).nullable().optional();
export const roomViewSchema = z.string().trim().max(60).nullable().optional();
