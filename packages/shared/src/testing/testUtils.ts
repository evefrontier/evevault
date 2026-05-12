// ─── test utility functions ────────────────────────────────────────────────

export function makeJwtPayload(claims: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  return `${b64url({ alg: "HS256" })}.${b64url(claims)}.sig`;
}
