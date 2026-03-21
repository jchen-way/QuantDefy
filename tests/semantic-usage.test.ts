import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const originalCwd = process.cwd();
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalWindow = process.env.SEMANTIC_REFRESH_WINDOW_MS;
const originalCooldown = process.env.SEMANTIC_REFRESH_COOLDOWN_MS;
const originalLimit = process.env.SEMANTIC_REFRESH_MAX_PER_WINDOW;

async function importUsageModule() {
  vi.resetModules();
  return import("../lib/server/semantic-usage");
}

beforeEach(async (context) => {
  process.env.DATABASE_URL = "";
  process.env.SEMANTIC_REFRESH_WINDOW_MS = "3600000";
  process.env.SEMANTIC_REFRESH_COOLDOWN_MS = "600000";
  process.env.SEMANTIC_REFRESH_MAX_PER_WINDOW = "2";
  const tempDir = await mkdtemp(path.join(tmpdir(), "quantdefy-semantic-usage-"));
  process.chdir(tempDir);
  context.onTestFinished(() => {
    process.chdir(originalCwd);
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.SEMANTIC_REFRESH_WINDOW_MS = originalWindow;
    process.env.SEMANTIC_REFRESH_COOLDOWN_MS = originalCooldown;
    process.env.SEMANTIC_REFRESH_MAX_PER_WINDOW = originalLimit;
  });
});

describe("semantic usage guard", () => {
  it("blocks refreshes during the cooldown window", async () => {
    const usage = await importUsageModule();

    await usage.recordSemanticRefresh("user_demo", "2026-03-21T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T10:05:00.000Z"));

    await expect(usage.assertSemanticRefreshAllowed("user_demo")).rejects.toThrow("cooling down");

    vi.useRealTimers();
  });

  it("blocks once the rolling window limit is reached", async () => {
    const usage = await importUsageModule();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T10:30:00.000Z"));
    await usage.recordSemanticRefresh("user_demo", "2026-03-21T09:35:00.000Z");
    await usage.recordSemanticRefresh("user_demo", "2026-03-21T10:00:00.000Z");

    await expect(usage.assertSemanticRefreshAllowed("user_demo")).rejects.toThrow("limit reached");

    vi.useRealTimers();
  });

  it("prunes expired entries from the file runtime", async () => {
    const usage = await importUsageModule();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T10:30:00.000Z"));
    await usage.recordSemanticRefresh("user_demo", "2026-03-21T08:00:00.000Z");
    await usage.recordSemanticRefresh("user_demo", "2026-03-21T09:45:00.000Z");

    const entries = await usage.listSemanticRefreshUsage("user_demo");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.refreshedAt).toBe("2026-03-21T09:45:00.000Z");

    const persisted = JSON.parse(
      await readFile(path.join(tempDirFromCwd(), "data", "runtime", "semantic-usage.json"), "utf8")
    ) as Array<{ refreshedAt: string }>;
    expect(persisted).toHaveLength(1);

    vi.useRealTimers();
  });
});

function tempDirFromCwd() {
  return process.cwd();
}
