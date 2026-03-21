import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const originalCwd = process.cwd();
const originalDatabaseUrl = process.env.DATABASE_URL;

async function importRuntimeModules() {
  vi.resetModules();
  const uploads = await import("../lib/server/uploads");
  const store = await import("../lib/server/store");
  return { uploads, store };
}

beforeEach(async (context) => {
  process.env.DATABASE_URL = "";
  const tempDir = await mkdtemp(path.join(tmpdir(), "quantdefy-test-"));
  process.chdir(tempDir);
  context.onTestFinished(() => {
    process.chdir(originalCwd);
    process.env.DATABASE_URL = originalDatabaseUrl;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("local upload runtime", () => {
  it("saves, reads, and deletes raster uploads through the local adapter", async () => {
    const { uploads } = await importRuntimeModules();
    const file = new File([Uint8Array.from([1, 2, 3, 4])], "chart.png", { type: "image/png" });

    const saved = await uploads.saveUpload(file);
    expect(uploads.getUploadRuntimeMode()).toBe("local");
    expect(saved.storagePath).toBe(`/api/uploads/${saved.fileName}`);

    const content = await uploads.readUpload(saved.fileName);
    expect(Array.from(content)).toEqual([1, 2, 3, 4]);

    await uploads.deleteUpload(saved.fileName);
    await expect(stat(path.join(process.cwd(), "data", "runtime", "uploads", saved.fileName))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects non-raster uploads in the local adapter", async () => {
    const { uploads } = await importRuntimeModules();
    const file = new File(["<svg></svg>"], "chart.svg", { type: "image/svg+xml" });

    await expect(uploads.saveUpload(file)).rejects.toThrow("Uploads must be PNG, JPG, WebP, or GIF images.");
  });
});

describe("file store runtime", () => {
  it("deletes attachment files when a trade is deleted", async () => {
    const { uploads, store } = await importRuntimeModules();
    const savedUpload = await uploads.saveUpload(
      new File([Uint8Array.from([9, 8, 7])], "setup.png", { type: "image/png" })
    );

    await store.saveTrade({
      id: "trade_local_delete",
      userId: "user_demo",
      symbol: "SPY",
      assetClass: "stock",
      instrumentLabel: "SPY ETF",
      direction: "long",
      tradeType: "Reversal",
      setupType: "Demand Reversal",
      status: "closed",
      openedAt: "2026-03-19T12:05:00-04:00",
      closedAt: "2026-03-19T14:13:00-04:00",
      thesis: "Test thesis for deletion flow.",
      reasonForEntry: "Clear entry reason.",
      reasonForExit: "Clear exit reason.",
      preTradePlan: "Defined risk and trigger.",
      postTradeReview: "Post trade review.",
      capitalAllocated: 620,
      plannedRisk: 200,
      fees: 0,
      notes: "",
      fills: [
        {
          id: "fill_local_1",
          tradeId: "trade_local_delete",
          side: "entry",
          filledAt: "2026-03-19T12:05:00-04:00",
          quantity: 2,
          price: 3.1
        },
        {
          id: "fill_local_2",
          tradeId: "trade_local_delete",
          side: "exit",
          filledAt: "2026-03-19T14:13:00-04:00",
          quantity: 2,
          price: 3.6
        }
      ],
      attachments: [
        {
          id: "attachment_local_1",
          tradeId: "trade_local_delete",
          kind: "setup",
          storagePath: savedUpload.storagePath,
          caption: "Setup image",
          uploadedAt: "2026-03-19T15:00:00-04:00",
          fileName: savedUpload.fileName
        }
      ],
      tags: []
    });

    await store.deleteTrade("trade_local_delete", "user_demo");

    await expect(stat(path.join(process.cwd(), "data", "runtime", "uploads", savedUpload.fileName))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("deletes orphaned attachment files when a trade is resaved without them", async () => {
    const { uploads, store } = await importRuntimeModules();
    const originalUpload = await uploads.saveUpload(
      new File([Uint8Array.from([3, 2, 1])], "setup.png", { type: "image/png" })
    );

    const baseTrade = {
      id: "trade_local_replace",
      userId: "user_demo",
      symbol: "SPY",
      assetClass: "stock" as const,
      instrumentLabel: "SPY ETF",
      direction: "long" as const,
      tradeType: "Reversal",
      setupType: "Demand Reversal",
      status: "closed" as const,
      openedAt: "2026-03-19T12:05:00-04:00",
      closedAt: "2026-03-19T14:13:00-04:00",
      thesis: "Test thesis for attachment replacement.",
      reasonForEntry: "Clear entry reason.",
      reasonForExit: "Clear exit reason.",
      preTradePlan: "Defined risk and trigger.",
      postTradeReview: "Post trade review.",
      capitalAllocated: 620,
      plannedRisk: 200,
      fees: 0,
      notes: "",
      fills: [
        {
          id: "fill_replace_1",
          tradeId: "trade_local_replace",
          side: "entry" as const,
          filledAt: "2026-03-19T12:05:00-04:00",
          quantity: 2,
          price: 3.1
        },
        {
          id: "fill_replace_2",
          tradeId: "trade_local_replace",
          side: "exit" as const,
          filledAt: "2026-03-19T14:13:00-04:00",
          quantity: 2,
          price: 3.6
        }
      ],
      attachments: [
        {
          id: "attachment_replace_1",
          tradeId: "trade_local_replace",
          kind: "setup" as const,
          storagePath: originalUpload.storagePath,
          caption: "Original image",
          uploadedAt: "2026-03-19T15:00:00-04:00",
          fileName: originalUpload.fileName
        }
      ],
      tags: []
    };

    await store.saveTrade(baseTrade);
    await store.saveTrade({
      ...baseTrade,
      attachments: []
    });

    await expect(stat(path.join(process.cwd(), "data", "runtime", "uploads", originalUpload.fileName))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("deletes attachment files when a single attachment is removed from a trade", async () => {
    const { uploads, store } = await importRuntimeModules();
    const savedUpload = await uploads.saveUpload(
      new File([Uint8Array.from([5, 4, 3])], "setup.png", { type: "image/png" })
    );

    await store.saveTrade({
      id: "trade_local_attachment_delete",
      userId: "user_demo",
      symbol: "QQQ",
      assetClass: "stock",
      instrumentLabel: "QQQ ETF",
      direction: "long",
      tradeType: "Trend",
      setupType: "Pullback",
      status: "closed",
      openedAt: "2026-03-18T10:00:00-04:00",
      closedAt: "2026-03-18T11:00:00-04:00",
      thesis: "Test thesis for single attachment delete.",
      reasonForEntry: "Clear entry reason.",
      reasonForExit: "Clear exit reason.",
      preTradePlan: "Defined risk and trigger.",
      postTradeReview: "Post trade review.",
      capitalAllocated: 1000,
      plannedRisk: 100,
      fees: 0,
      notes: "",
      fills: [
        {
          id: "fill_attachment_delete_1",
          tradeId: "trade_local_attachment_delete",
          side: "entry",
          filledAt: "2026-03-18T10:00:00-04:00",
          quantity: 10,
          price: 100
        },
        {
          id: "fill_attachment_delete_2",
          tradeId: "trade_local_attachment_delete",
          side: "exit",
          filledAt: "2026-03-18T11:00:00-04:00",
          quantity: 10,
          price: 101
        }
      ],
      attachments: [
        {
          id: "attachment_local_delete_single",
          tradeId: "trade_local_attachment_delete",
          kind: "setup",
          storagePath: savedUpload.storagePath,
          caption: "Delete me",
          uploadedAt: "2026-03-18T11:05:00-04:00",
          fileName: savedUpload.fileName
        }
      ],
      tags: []
    });

    await store.deleteAttachment("trade_local_attachment_delete", "attachment_local_delete_single", "user_demo");

    await expect(stat(path.join(process.cwd(), "data", "runtime", "uploads", savedUpload.fileName))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("persists file-backed store state with seeded runtime and summaries", async () => {
    const { store } = await importRuntimeModules();
    const summary = await store.getStoreSummary("user_demo");

    expect(store.getStoreRuntimeMode()).toBe("file");
    expect(summary.settings.userId).toBe("user_demo");
    expect(summary.trades.length).toBeGreaterThan(0);
  });
});
