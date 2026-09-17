export function postgresCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if (!("code" in error)) return null;
  const code = error.code;
  return typeof code === "string" ? code : null;
}

export function postgresMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
