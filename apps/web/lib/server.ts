import { cookies } from "next/headers";
import { NextResponse } from "next/server";
export const COOKIE = "cs2_owner";
export const apiUrl = () => process.env.API_URL ?? "http://127.0.0.1:4000";
export { sameOrigin } from "./origin";
export async function ownerToken() {
  return (await cookies()).get(COOKIE)?.value;
}
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function validSession(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}
