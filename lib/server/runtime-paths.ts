import path from "node:path";

export function getRuntimeDataDir() {
  const configured = process.env.RUNTIME_DATA_DIR?.trim();

  if (!configured) {
    return path.join(process.cwd(), "data", "runtime");
  }

  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export function getFileStorePath() {
  return path.join(getRuntimeDataDir(), "store.json");
}

export function getLocalUploadDir() {
  return path.join(getRuntimeDataDir(), "uploads");
}

export function getSemanticInsightCachePath() {
  return path.join(getRuntimeDataDir(), "semantic-insights.json");
}
