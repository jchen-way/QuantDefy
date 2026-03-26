import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runExpiredUploadCleanup = vi.fn();

vi.mock("../lib/server/upload-workflow", () => ({
  runExpiredUploadCleanup
}));

async function importRoute() {
  vi.resetModules();
  return import("../app/api/cron/cleanup-uploads/route");
}

describe("upload cleanup cron route", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach((context) => {
    runExpiredUploadCleanup.mockReset();
    process.env.CRON_SECRET = "cron-secret";
    context.onTestFinished(() => {
      process.env.CRON_SECRET = originalCronSecret;
    });
  });

  it("returns 401 when the cron secret is missing or wrong", async () => {
    const { GET } = await importRoute();
    const response = await GET(new NextRequest("http://localhost/api/cron/cleanup-uploads"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns the number of pruned uploads for authorized requests", async () => {
    runExpiredUploadCleanup.mockResolvedValue(3);
    const { GET } = await importRoute();
    const response = await GET(
      new NextRequest("http://localhost/api/cron/cleanup-uploads", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      prunedCount: 3
    });
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    process.env.CRON_SECRET = "";
    const { GET } = await importRoute();
    const response = await GET(
      new NextRequest("http://localhost/api/cron/cleanup-uploads", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "CRON_SECRET must be configured for cleanup cron access."
    });
  });
});
