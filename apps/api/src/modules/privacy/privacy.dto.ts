import { settingsSchema } from "@cs2/contracts";
import type { z } from "zod";

/** PUT /v1/settings body and GET/PUT response. */
export const settingsRequestSchema = settingsSchema;
export type SettingsDto = z.infer<typeof settingsSchema>;
