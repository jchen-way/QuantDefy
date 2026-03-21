function isTruthyEnv(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export function isVercelDeployment() {
  return isTruthyEnv(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV?.trim());
}

export function assertSupportedStoreBackend(databaseUrl?: string) {
  if (isVercelDeployment() && !databaseUrl?.trim()) {
    throw new Error(
      "Vercel deployments require DATABASE_URL. The local file-backed store is development-only."
    );
  }
}

export function assertSupportedUploadRuntime(mode: string) {
  if (isVercelDeployment() && mode === "local") {
    throw new Error(
      "Vercel deployments require UPLOAD_RUNTIME=s3. Local upload storage is development-only."
    );
  }
}
