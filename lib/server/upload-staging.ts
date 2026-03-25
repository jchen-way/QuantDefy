import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getUploadClaimLifetimeMs } from "@/lib/server/upload-config";
import { deleteUpload } from "@/lib/server/uploads";
import { getRuntimeDataDir } from "@/lib/server/runtime-paths";
import { getStoreBackend } from "@/lib/server/store-core";
import { ensureNeonSchema, getNeonSql, queryRows } from "@/lib/server/store-neon";

type StagedUploadEntry = {
  userId: string;
  fileName: string;
  storagePath: string;
  expiresAt: string;
};

type StagedUploadRow = {
  user_id: string;
  file_name: string;
  storage_path: string;
  expires_at: string;
};

function getStagingFilePath() {
  return path.join(getRuntimeDataDir(), "staged-uploads.json");
}

let stagingWriteQueue: Promise<void> = Promise.resolve();

async function ensureStagingFile() {
  const runtimeDir = getRuntimeDataDir();
  const stagingFilePath = getStagingFilePath();
  await mkdir(runtimeDir, { recursive: true });

  try {
    await stat(stagingFilePath);
  } catch {
    await writeFile(stagingFilePath, "[]", "utf8");
  }
}

async function readFileEntries(): Promise<StagedUploadEntry[]> {
  await ensureStagingFile();
  const file = await readFile(getStagingFilePath(), "utf8");
  const parsed = JSON.parse(file) as StagedUploadEntry[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeFileEntries(entries: StagedUploadEntry[]) {
  await ensureStagingFile();
  await writeFile(getStagingFilePath(), JSON.stringify(entries, null, 2), "utf8");
}

async function withFileStagingLock<T>(operation: () => Promise<T>) {
  const next = stagingWriteQueue.then(operation, operation);
  stagingWriteQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function ensureNeonStagingSchema() {
  await ensureNeonSchema();
  const sql = getNeonSql();
  await sql.query(`
    CREATE TABLE IF NOT EXISTS staged_uploads (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT PRIMARY KEY,
      storage_path TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await sql.query(
    "CREATE INDEX IF NOT EXISTS staged_uploads_user_id_expires_at_idx ON staged_uploads (user_id, expires_at ASC)"
  );
}

export async function pruneExpiredStagedUploads(now = Date.now()) {
  if (getStoreBackend() === "neon") {
    await ensureNeonStagingSchema();
    const sql = getNeonSql();
    const cutoff = new Date(now).toISOString();
    const expired = await queryRows<StagedUploadRow>(
      sql,
      `SELECT user_id, file_name, storage_path, expires_at
       FROM staged_uploads
       WHERE expires_at <= $1`,
      [cutoff]
    );

    await Promise.all(expired.map((entry) => deleteUpload(entry.file_name)));

    if (expired.length > 0) {
      await sql.query("DELETE FROM staged_uploads WHERE expires_at <= $1", [cutoff]);
    }

    return;
  }

  await withFileStagingLock(async () => {
    const entries = await readFileEntries();
    const nextEntries: StagedUploadEntry[] = [];

    for (const entry of entries) {
      if (Date.parse(entry.expiresAt) <= now) {
        await deleteUpload(entry.fileName);
        continue;
      }

      nextEntries.push(entry);
    }

    await writeFileEntries(nextEntries);
  });
}

export async function registerStagedUpload(userId: string, fileName: string, storagePath: string, expiresAt: string) {
  await pruneExpiredStagedUploads();

  if (getStoreBackend() === "neon") {
    await ensureNeonStagingSchema();
    const sql = getNeonSql();
    await sql.query(
      `INSERT INTO staged_uploads (user_id, file_name, storage_path, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (file_name)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         storage_path = EXCLUDED.storage_path,
         expires_at = EXCLUDED.expires_at`,
      [userId, fileName, storagePath, expiresAt]
    );
    return;
  }

  await withFileStagingLock(async () => {
    const entries = await readFileEntries();
    const nextEntries = entries.filter((entry) => entry.fileName !== fileName);
    nextEntries.push({ userId, fileName, storagePath, expiresAt });
    await writeFileEntries(nextEntries);
  });
}

export async function consumeStagedUploads(fileNames: string[]) {
  if (fileNames.length === 0) {
    return;
  }

  await pruneExpiredStagedUploads();

  if (getStoreBackend() === "neon") {
    await ensureNeonStagingSchema();
    const sql = getNeonSql();
    await sql.query("DELETE FROM staged_uploads WHERE file_name = ANY($1)", [fileNames]);
    return;
  }

  await withFileStagingLock(async () => {
    const fileNameSet = new Set(fileNames);
    const entries = await readFileEntries();
    await writeFileEntries(entries.filter((entry) => !fileNameSet.has(entry.fileName)));
  });
}

export async function discardStagedUpload(fileName: string) {
  await consumeStagedUploads([fileName]);
}
