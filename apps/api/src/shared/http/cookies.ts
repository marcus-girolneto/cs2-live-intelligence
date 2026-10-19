import type { FastifyRequest } from "fastify";

/** Value of cookie `name` from the request, or undefined. */
export function readCookie(
  request: FastifyRequest,
  name: string,
): string | undefined {
  return request.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** An HttpOnly, SameSite=Lax, Path=/ cookie; `Secure` when the public URL is https. */
export function sessionCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  secure = false,
): string {
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

export const clearedCookie = (name: string): string =>
  sessionCookie(name, "", 0);
