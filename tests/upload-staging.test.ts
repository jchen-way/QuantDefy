import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const originalCwd = process.cwd();
const originalDatabaseUrl = process.env.DATABASE_URL;

async function importUploadModules() {
  vi.resetModules();
  const uploads = await import("../lib/server/uploads");
  const staging = await import("../lib/server/upload-staging");
  return { uploads, staging };
}

beforeEach(async (context) => {
  process.env.DATABASE_URL = "";
  const tempDir = await mkdtemp(path.join(tmpdir(), "quantdefy-staging-"));
  process.chdir(tempDir);
  context.onTestFinished(() => {
    process.chdir(originalCwd);
    process.env.DATABASE_URL = originalDatabaseUrl;
  });
});

describe("staged upload cleanup", () => {
  it("prunes expired staged uploads and deletes the underlying file", async () => {
    const { uploads, staging } = await importUploadModules();
    const saved = await uploads.saveUpload(
      new File([Uint8Array.from([1, 2, 3])], "setup.png", { type: "image/png" })
    );

    await staging.registerStagedUpload(
      "user_1",
      saved.fileName,
      saved.storagePath,
      new Date(Date.now() - 60_000).toISOString()
    );

    await staging.pruneExpiredStagedUploads();

    await expect(stat(path.join(process.cwd(), "data", "runtime", "uploads", saved.fileName))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("consumes staged uploads without deleting the persisted file", async () => {
    const { uploads, staging } = await importUploadModules();
    const saved = await uploads.saveUpload(
      new File([Uint8Array.from([4, 5, 6])], "winner.png", { type: "image/png" })
    );

    await staging.registerStagedUpload(
      "user_1",
      saved.fileName,
      saved.storagePath,
      new Date(Date.now() + 60_000).toISOString()
    );

    await staging.consumeStagedUploads([saved.fileName]);

    await expect(stat(path.join(process.cwd(), "data", "runtime", "uploads", saved.fileName))).resolves.toBeTruthy();
  });
});
