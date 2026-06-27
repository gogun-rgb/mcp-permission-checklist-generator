const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
];

export function parseAllowedOrigins(value: string | undefined): Set<string> {
  const origins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(origins && origins.length > 0 ? origins : defaultAllowedOrigins);
}

export function addRenderExternalOrigin(
  allowedOrigins: Set<string>,
  hostname: string | undefined
): Set<string> {
  const normalizedHostname = hostname?.trim();

  if (normalizedHostname) {
    allowedOrigins.add(`https://${normalizedHostname}`);
  }

  return allowedOrigins;
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>
): boolean {
  return !origin || allowedOrigins.has(origin);
}
