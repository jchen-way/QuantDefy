import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalUploadRuntime = process.env.UPLOAD_RUNTIME;
const originalVercel = process.env.VERCEL;
const originalVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => {
  vi.resetModules();
  process.env.DATABASE_URL = "";
  process.env.UPLOAD_RUNTIME = "local";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
});

afterEach(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
  process.env.UPLOAD_RUNTIME = originalUploadRuntime;
  process.env.VERCEL = originalVercel;
  process.env.VERCEL_ENV = originalVercelEnv;
});

describe("deployment runtime guards", () => {
  it("rejects the file-backed store on Vercel", async () => {
    const storeCore = await import("../lib/server/store-core");
    expect(() => storeCore.getStoreBackend()).toThrow(
      "Vercel deployments require DATABASE_URL. The local file-backed store is development-only."
    );
  });

  it("rejects local uploads on Vercel", async () => {
    const uploads = await import("../lib/server/uploads");
    expect(() => uploads.getUploadRuntimeMode()).toThrow(
      "Vercel deployments require UPLOAD_RUNTIME=s3. Local upload storage is development-only."
    );
  });

  it("allows Neon plus S3 on Vercel", async () => {
    process.env.DATABASE_URL = "postgres://user:password@host/db";
    process.env.UPLOAD_RUNTIME = "s3";

    const storeCore = await import("../lib/server/store-core");
    const uploads = await import("../lib/server/uploads");

    expect(storeCore.getStoreBackend()).toBe("neon");
    expect(uploads.getUploadRuntimeMode()).toBe("s3");
  });
});
