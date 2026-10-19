/** Largest demo the upload proxy accepts (shared by the upload screen and the server). */
export const MAX_DEMO_BYTES = 500 * 1024 * 1024;
/** The same limit in whole megabytes, for labels. */
export const MAX_DEMO_MB = Math.round(MAX_DEMO_BYTES / (1024 * 1024));
