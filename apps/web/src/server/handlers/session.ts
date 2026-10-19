import { json, ownerToken } from "../session";
import { localDemoToken } from "../config";
// Lets the browser know whether a session cookie exists without a failing 401 request.
export async function GET() {
  return json({
    hasSession: !!(await ownerToken()),
    devLogin: !!localDemoToken(),
  });
}
