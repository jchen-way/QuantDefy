"use server";

import { revalidatePath } from "next/cache";
import { isAdminUser, requireCurrentUser } from "@/lib/server/auth";
import { getStoreSummary, regenerateInsights } from "@/lib/server/store";
import {
  getLatestSemanticInsightsSnapshot,
  isSemanticInsightsAvailable
} from "@/lib/server/semantic-insights";
import { assertSemanticRefreshAllowed, recordSemanticRefresh } from "@/lib/server/semantic-usage";

export type InsightRefreshResult = {
  error: string | null;
  successMessage: string | null;
  success: boolean;
  warning: string | null;
};

export async function regenerateInsightsAction(): Promise<InsightRefreshResult> {
  try {
    const user = await requireCurrentUser();
    const currentStore = await getStoreSummary(user.id);
    const semanticRequested =
      currentStore.settings.aiInsightsEnabled && currentStore.settings.insightMode === "semantic";
    const semanticAvailable = isSemanticInsightsAvailable();

    if (semanticRequested && semanticAvailable && !isAdminUser(user)) {
      await assertSemanticRefreshAllowed(user.id);
    }

    await regenerateInsights(user.id);
    const store = await getStoreSummary(user.id);
    let warning: string | null = null;
    let successMessage = "Insights refreshed.";

    if (semanticRequested && semanticAvailable) {
      const latestSnapshot = await getLatestSemanticInsightsSnapshot(user.id);
      if (latestSnapshot) {
        await recordSemanticRefresh(user.id);
        successMessage = "Premium insights refreshed.";
      } else {
        warning = "Insights refreshed.";
      }
    } else if (semanticRequested && !semanticAvailable) {
      warning = "Insights refreshed.";
    }

    revalidatePath("/app");
    revalidatePath("/analytics");
    revalidatePath("/insights");
    revalidatePath("/trades");

    return {
      error: null,
      success: true,
      successMessage,
      warning
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to regenerate insights.",
      success: false,
      successMessage: null,
      warning: null
    };
  }
}
