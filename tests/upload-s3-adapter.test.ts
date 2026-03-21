import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const send = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = send;
  }

  class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class GetObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class DeleteObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class DeleteObjectsCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class ListObjectVersionsCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }

  class NoSuchKey extends Error {}

  return {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    ListObjectVersionsCommand,
    NoSuchKey
  };
});

const originalCwd = process.cwd();
const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  UPLOAD_RUNTIME: process.env.UPLOAD_RUNTIME,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  S3_KEY_PREFIX: process.env.S3_KEY_PREFIX
};

async function importUploads() {
  vi.resetModules();
  return import("../lib/server/uploads");
}

beforeEach(async (context) => {
  send.mockReset();
  process.env.DATABASE_URL = "";
  process.env.UPLOAD_RUNTIME = "s3";
  process.env.S3_BUCKET = "test-bucket";
  process.env.S3_REGION = "us-east-1";
  process.env.S3_ACCESS_KEY_ID = "key";
  process.env.S3_SECRET_ACCESS_KEY = "secret";
  process.env.S3_ENDPOINT = "https://example.invalid";
  process.env.S3_FORCE_PATH_STYLE = "false";
  process.env.S3_KEY_PREFIX = "trade-images";
  const tempDir = await mkdtemp(path.join(tmpdir(), "quantdefy-s3-upload-"));
  process.chdir(tempDir);
  context.onTestFinished(() => {
    process.chdir(originalCwd);
    Object.assign(process.env, originalEnv);
  });
});

describe("s3 upload runtime", () => {
  it("saves, reads, and deletes through the s3 adapter", async () => {
    const uploads = await importUploads();
    send.mockResolvedValueOnce({});
    send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => Uint8Array.from([7, 8, 9])
      }
    });

    const saved = await uploads.saveUpload(
      new File([Uint8Array.from([1, 2, 3])], "chart.png", { type: "image/png" })
    );

    send.mockResolvedValueOnce({});
    send.mockResolvedValueOnce({
      Versions: [{ Key: `trade-images/${saved.fileName}`, VersionId: "v1" }],
      DeleteMarkers: [{ Key: `trade-images/${saved.fileName}`, VersionId: "dm1" }],
      IsTruncated: false
    });
    send.mockResolvedValueOnce({});

    expect(uploads.getUploadRuntimeMode()).toBe("s3");
    expect(saved.storagePath).toBe(`/api/uploads/${saved.fileName}`);
    expect(send).toHaveBeenCalledTimes(1);

    const content = await uploads.readUpload(saved.fileName);
    expect(Array.from(content)).toEqual([7, 8, 9]);

    await uploads.deleteUpload(saved.fileName);
    expect(send).toHaveBeenCalledTimes(5);
    expect(send.mock.calls[2]?.[0]?.input).toMatchObject({
      Bucket: "test-bucket",
      Key: `trade-images/${saved.fileName}`
    });
    expect(send.mock.calls[3]?.[0]?.input).toMatchObject({
      Bucket: "test-bucket",
      Prefix: `trade-images/${saved.fileName}`
    });
    expect(send.mock.calls[4]?.[0]?.input).toMatchObject({
      Bucket: "test-bucket",
      Delete: {
        Objects: [
          { Key: `trade-images/${saved.fileName}`, VersionId: "v1" },
          { Key: `trade-images/${saved.fileName}`, VersionId: "dm1" }
        ],
        Quiet: true
      }
    });
  });
});
