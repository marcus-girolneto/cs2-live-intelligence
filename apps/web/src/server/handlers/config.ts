import { localDemoToken } from "../config";
import { json } from "../session";
export async function GET() {
  // True only when automatic local sign-in is explicitly enabled (automated tests).
  return json({ devLogin: !!localDemoToken() });
}
