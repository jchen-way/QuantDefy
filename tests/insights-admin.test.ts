import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCurrentUser = vi.fn();
const isAdminUser = vi.fn();
const getStoreSummary = vi.fn();
const regenerateInsights = vi.fn();
const getLatestSemanticInsightsSnapshot = vi.fn();
const isSemanticInsightsAvailable = vi.fn();
const assertSemanticRefreshAllowed = vi.fn();
const recordSemanticRefresh = vi.fn();
const revalidatePath = vi.fn();

vi.mock("../lib/server/auth", () => ({
  requireCurrentUser,
  isAdminUser
}));

vi.mock("../lib/server/store", () => ({
  getStoreSummary,
  regenerateInsights
}));

vi.mock("../lib/server/semantic-insights", () => ({
  getLatestSemanticInsightsSnapshot,
  isSemanticInsightsAvailable
}));

vi.mock("../lib/server/semantic-usage", () => ({
  assertSemanticRefreshAllowed,
  recordSemanticRefresh
}));

vi.mock("next/cache", () => ({
  revalidatePath
}));

describe("insight refresh admin behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user_admin", email: "admin@example.com" });
    getStoreSummary.mockResolvedValue({
      settings: { aiInsightsEnabled: true, insightMode: "semantic" }
    });
    regenerateInsights.mockResolvedValue(undefined);
    isSemanticInsightsAvailable.mockReturnValue(true);
    getLatestSemanticInsightsSnapshot.mockResolvedValue({ payload: {} });
  });

  it("skips quota enforcement for admins", async () => {
    isAdminUser.mockReturnValue(true);

    const { regenerateInsightsAction } = await import("../app/insights/actions");
    const result = await regenerateInsightsAction();

    expect(assertSemanticRefreshAllowed).not.toHaveBeenCalled();
    expect(recordSemanticRefresh).toHaveBeenCalledWith("user_admin");
    expect(result.success).toBe(true);
  });

  it("enforces quota for non-admin users", async () => {
    isAdminUser.mockReturnValue(false);

    const { regenerateInsightsAction } = await import("../app/insights/actions");
    await regenerateInsightsAction();

    expect(assertSemanticRefreshAllowed).toHaveBeenCalledWith("user_admin");
  });
});
