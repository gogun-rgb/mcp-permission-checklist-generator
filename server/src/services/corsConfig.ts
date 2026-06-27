const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

export function parseAllowedOrigins(value: string | undefined): Set<string> {
  const origins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(origins && origins.length > 0 ? origins : defaultAllowedOrigins);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>
): boolean {
  return !origin || allowedOrigins.has(origin);
}
