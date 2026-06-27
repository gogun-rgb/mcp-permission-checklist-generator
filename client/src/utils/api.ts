export function buildApiUrl(baseUrl: string | undefined, path: string): string {
  const normalizedBaseUrl = (baseUrl ?? "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return normalizedBaseUrl ? `${normalizedBaseUrl}${normalizedPath}` : normalizedPath;
}
