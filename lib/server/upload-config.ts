const defaultUploadClaimLifetimeMs = 1000 * 60 * 60 * 24;

function parsePositiveIntEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getUploadClaimLifetimeMs() {
  return parsePositiveIntEnv("UPLOAD_TOKEN_TTL_MS", defaultUploadClaimLifetimeMs);
}
