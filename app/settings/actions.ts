"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/server/auth";
import { getSettings, saveSettings } from "@/lib/server/store";

const settingsSchema = z.object({
  displayName: z.string().trim().min(1),
  email: z.string().email(),
  timezone: z.string().trim().min(1),
  defaultRisk: z.number().nonnegative(),
  defaultCapital: z.number().nonnegative(),
  aiInsightsEnabled: z.boolean(),
  insightMode: z.enum(["local", "semantic"]),
  strategyTaxonomy: z.string().trim().min(1),
  customTradeTypes: z.string().trim().optional(),
  customSetupTypes: z.string().trim().optional()
});

export type SettingsActionState = {
  error: string | null;
  savedInsightMode?: "local" | "semantic";
  submitted?: {
    displayName: string;
    email: string;
    timezone: string;
    defaultRisk: string;
    aiInsightsEnabled: boolean;
    insightMode: "local" | "semantic";
    strategyTaxonomy: string[];
    customTradeTypes: string[];
    customSetupTypes: string[];
  };
  success: boolean;
};

function parseTokenList(value: FormDataEntryValue | string | null | undefined, fallback: string[] = []) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return fallback;
    }

    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } catch {
    return fallback;
  }
}

export async function saveSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const existingSubmitted = {
    displayName: typeof formData.get("displayName") === "string" ? String(formData.get("displayName")) : "",
    email: typeof formData.get("email") === "string" ? String(formData.get("email")) : "",
    timezone: typeof formData.get("timezone") === "string" ? String(formData.get("timezone")) : "",
    defaultRisk: typeof formData.get("defaultRisk") === "string" ? String(formData.get("defaultRisk")) : "",
    aiInsightsEnabled: formData.get("aiInsightsEnabled") === "on",
    insightMode: formData.get("insightMode") === "semantic" ? "semantic" : "local",
    strategyTaxonomy: parseTokenList(formData.get("strategyTaxonomy"), []),
    customTradeTypes: parseTokenList(formData.get("customTradeTypes"), []),
    customSetupTypes: parseTokenList(formData.get("customSetupTypes"), [])
  } as const;

  try {
    const user = await requireCurrentUser();
    const existing = await getSettings(user.id);
    const payload = settingsSchema.parse({
      displayName: formData.get("displayName"),
      email: formData.get("email"),
      timezone: formData.get("timezone"),
      defaultRisk: Number(formData.get("defaultRisk")),
      defaultCapital: Number(formData.get("defaultCapital")),
      aiInsightsEnabled: formData.get("aiInsightsEnabled") === "on",
      insightMode: formData.get("insightMode"),
      strategyTaxonomy: JSON.stringify(parseTokenList(formData.get("strategyTaxonomy"), existing.strategyTaxonomy)),
      customTradeTypes: JSON.stringify(parseTokenList(formData.get("customTradeTypes"), [])),
      customSetupTypes: JSON.stringify(parseTokenList(formData.get("customSetupTypes"), []))
    });

    await saveSettings({
      ...existing,
      userId: user.id,
      displayName: payload.displayName,
      email: payload.email,
      timezone: payload.timezone,
      defaultRisk: payload.defaultRisk,
      defaultCapital: payload.defaultCapital,
      aiInsightsEnabled: payload.aiInsightsEnabled,
      insightMode: payload.insightMode,
      customTradeTypes: parseTokenList(payload.customTradeTypes, []),
      customSetupTypes: parseTokenList(payload.customSetupTypes, []),
      strategyTaxonomy: parseTokenList(payload.strategyTaxonomy, existing.strategyTaxonomy)
    });
    revalidatePath("/settings");
    revalidatePath("/app");
    revalidatePath("/analytics");
    revalidatePath("/trades");
    revalidatePath("/trades/new");
    revalidatePath("/insights");
    return {
      error: null,
      success: true,
      savedInsightMode: payload.insightMode,
      submitted: {
        ...existingSubmitted,
        displayName: payload.displayName,
        email: payload.email,
        timezone: payload.timezone,
        defaultRisk: String(payload.defaultRisk),
        aiInsightsEnabled: payload.aiInsightsEnabled,
        insightMode: payload.insightMode,
        strategyTaxonomy: parseTokenList(payload.strategyTaxonomy, existing.strategyTaxonomy),
        customTradeTypes: parseTokenList(payload.customTradeTypes, []),
        customSetupTypes: parseTokenList(payload.customSetupTypes, [])
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.issues[0]?.message ?? "Please correct the settings form.",
        savedInsightMode: undefined,
        submitted: existingSubmitted,
        success: false
      };
    }

    return {
      error: error instanceof Error ? error.message : "Unable to save settings.",
      savedInsightMode: undefined,
      submitted: existingSubmitted,
      success: false
    };
  }
}
