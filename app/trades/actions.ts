"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  attachmentKindValues,
  setupTypeOptions,
  tagCategoryValues,
  tradeTypeOptions
} from "@/lib/domain/catalog";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  deleteAttachment,
  deleteTrade,
  getSettings,
  getStoreSummary,
  getTrade,
  saveFilterPresets,
  saveSettings,
  saveTrade
} from "@/lib/server/store";
import { buildTradeAttachmentsFromClaims, finalizeConsumedTradeUploads } from "@/lib/server/upload-workflow";
import {
  AttachmentKind,
  FillSide,
  TagCategory,
  Trade,
  TradeAttachment,
  TradeFilterPreset,
  TradeFill,
  TradeTag
} from "@/lib/domain/types";
import { deriveCapitalAllocatedFromFills, makeId, parseDateTimeInTimeZone } from "@/lib/domain/utils";

const fillSideValues = ["entry", "exit"] as const;

const fillSchema = z.object({
  id: z.string(),
  side: z.enum(fillSideValues),
  filledDate: z.string().min(1),
  filledTime: z.string().min(1),
  quantity: z.string().trim().min(1),
  price: z.string().trim().min(1)
});

const tagSchema = z.object({
  id: z.string(),
  category: z.enum(tagCategoryValues),
  value: z.string().min(1)
});

const attachmentRowSchema = z.object({
  id: z.string(),
  kind: z.enum(attachmentKindValues),
  caption: z.string(),
  uploadToken: z.string().optional()
});

const tradeSchema = z.object({
  symbol: z.string().trim().min(1),
  assetClass: z.enum(["stock", "option"]),
  instrumentLabel: z.string().trim().min(1),
  direction: z.enum(["long", "short"]),
  tradeType: z.string().trim().min(1),
  setupType: z.string().trim().min(1),
  status: z.enum(["open", "closed"]),
  thesis: z.string().trim().min(10),
  reasonForEntry: z.string().trim().min(5),
  reasonForExit: z.string().trim().optional(),
  preTradePlan: z.string().trim().min(5),
  postTradeReview: z.string().trim().optional(),
  plannedRisk: z.string().trim().min(1),
  notes: z.string().trim().optional()
});

const presetSchema = z.object({
  name: z.string().trim().min(1).max(40),
  symbol: z.string().trim().max(24).optional(),
  setupType: z.string().trim().min(1),
  direction: z.enum(["long", "short", "all"] as const),
  result: z.enum(["win", "loss", "scratch", "open", "all"] as const),
  durationBucket: z.enum(["scalp", "intraday", "session", "swing", "position", "open", "all"] as const)
});

export type TradeActionState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  submitted?: {
    draftJson: string | null;
    fillsJson: string | null;
    tagsJson: string | null;
    attachmentRowsJson: string | null;
  };
};

export type PresetActionResult = {
  error: string | null;
  success: boolean;
};

export type AttachmentActionResult = {
  error: string | null;
  success: boolean;
};

function resolvePersistedId(id: string, prefix: "fill" | "tag" | "attachment") {
  if (!id || id.startsWith(`${prefix}_new_`)) {
    return makeId(prefix);
  }

  return id;
}

function buildSubmittedState(formData: FormData) {
  return {
    draftJson: typeof formData.get("draftJson") === "string" ? (formData.get("draftJson") as string) : null,
    fillsJson: typeof formData.get("fillsJson") === "string" ? (formData.get("fillsJson") as string) : null,
    tagsJson: typeof formData.get("tagsJson") === "string" ? (formData.get("tagsJson") as string) : null,
    attachmentRowsJson:
      typeof formData.get("attachmentRowsJson") === "string"
        ? (formData.get("attachmentRowsJson") as string)
        : null
  };
}

function mapTradeZodErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path[0];
    if (typeof path !== "string" || fieldErrors[path]) {
      continue;
    }

    switch (path) {
      case "thesis":
        fieldErrors[path] = "Thesis needs at least 10 characters.";
        break;
      case "reasonForEntry":
        fieldErrors[path] = "Reason for entry needs at least 5 characters.";
        break;
      case "preTradePlan":
        fieldErrors[path] = "Pre-trade plan needs at least 5 characters.";
        break;
      case "symbol":
        fieldErrors[path] = "Enter a symbol.";
        break;
      case "instrumentLabel":
        fieldErrors[path] = "Enter an instrument label.";
        break;
      case "tradeType":
        fieldErrors[path] = "Enter a trade type.";
        break;
      case "setupType":
        fieldErrors[path] = "Enter a setup type.";
        break;
      case "plannedRisk":
        fieldErrors[path] = "Enter planned risk.";
        break;
      default:
        fieldErrors[path] = issue.message;
    }
  }

  return fieldErrors;
}

function parseJsonField<T>(value: FormDataEntryValue | null, schema: z.ZodSchema<T>) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Malformed payload.");
  }

  const raw = JSON.parse(value);
  return schema.parse(raw);
}

function parseRequiredNumber(value: FormDataEntryValue | null, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  const number = Number(value);
  if (Number.isNaN(number) || number < 0) {
    throw new Error(`${fieldName} must be a valid non-negative number.`);
  }

  return number;
}

function parsePositiveNumber(value: string, fieldName: string) {
  const number = Number(value);
  if (Number.isNaN(number) || number <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }

  return number;
}

function validateFillSequence(fills: TradeFill[], status: Trade["status"]) {
  let netQuantity = 0;
  let sawEntry = false;

  for (const fill of fills) {
    if (fill.side === "entry") {
      sawEntry = true;
      netQuantity += fill.quantity;
      continue;
    }

    if (!sawEntry) {
      throw new Error("Exit fills cannot occur before the first entry fill.");
    }

    netQuantity -= fill.quantity;

    if (netQuantity < 0) {
      throw new Error("Exit quantity cannot exceed the current open position.");
    }
  }

  if (status === "open" && fills.some((fill) => fill.side === "exit")) {
    throw new Error("Open trades cannot include exit fills.");
  }

  if (status === "closed" && netQuantity !== 0) {
    throw new Error("Closed trades must fully flatten the position.");
  }
}

function sortFills(fills: TradeFill[]) {
  return [...fills].sort((left, right) => new Date(left.filledAt).getTime() - new Date(right.filledAt).getTime());
}

async function collectAttachments(formData: FormData, userId: string) {
  const rows = parseJsonField(
    formData.get("attachmentRowsJson"),
    z.array(attachmentRowSchema)
  );
  return buildTradeAttachmentsFromClaims(
    rows.map((row) => ({
      kind: row.kind as AttachmentKind,
      caption: row.caption,
      uploadToken: row.uploadToken
    })),
    userId
  );
}

export async function saveTradeAction(
  tradeId: string | null,
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  let savedTradeId = tradeId ?? "";
  const submitted = buildSubmittedState(formData);

  try {
    const user = await requireCurrentUser();
    const settings = await getSettings(user.id);
    const timezone = settings.timezone;

    const payload = parseJsonField(formData.get("draftJson"), tradeSchema);

    const fills = sortFills(
      parseJsonField(formData.get("fillsJson"), z.array(fillSchema)).map((fill) => ({
        id: resolvePersistedId(fill.id, "fill"),
        tradeId: tradeId ?? "",
        side: fill.side as FillSide,
        filledAt: parseDateTimeInTimeZone(`${fill.filledDate}T${fill.filledTime}`, timezone),
        quantity: parsePositiveNumber(fill.quantity, "Fill quantity"),
        price: parsePositiveNumber(fill.price, "Fill price")
      }))
    );
    const tags = parseJsonField(formData.get("tagsJson"), z.array(tagSchema)).map((tag) => ({
      id: resolvePersistedId(tag.id, "tag"),
      tradeId: tradeId ?? "",
      category: tag.category as TagCategory,
      value: tag.value
    }));
    const attachmentResult = await collectAttachments(formData, user.id);
    const newAttachments = attachmentResult.attachments;

    if (fills.filter((fill) => fill.side === "entry").length === 0) {
      return { error: "At least one entry fill is required.", submitted };
    }

    if (payload.status === "closed" && fills.filter((fill) => fill.side === "exit").length === 0) {
      return { error: "Closed trades need at least one exit fill.", submitted };
    }

    validateFillSequence(fills, payload.status);

    const existing = tradeId ? await getTrade(tradeId, user.id) : null;
    const nextTradeId = tradeId ?? makeId("trade");
    const closedAt =
      payload.status === "closed"
        ? fills.filter((fill) => fill.side === "exit").at(-1)?.filledAt ?? null
        : null;

    const trade: Trade = {
      id: nextTradeId,
      userId: existing?.userId ?? user.id,
      symbol: payload.symbol.toUpperCase(),
      assetClass: payload.assetClass,
      instrumentLabel: payload.instrumentLabel,
      direction: payload.direction,
      tradeType: payload.tradeType.trim(),
      setupType: payload.setupType.trim(),
      status: payload.status,
      openedAt: fills[0].filledAt,
      closedAt,
      thesis: payload.thesis,
      reasonForEntry: payload.reasonForEntry,
      reasonForExit: payload.reasonForExit ?? "",
      preTradePlan: payload.preTradePlan,
      postTradeReview: payload.postTradeReview ?? "",
      capitalAllocated: deriveCapitalAllocatedFromFills(fills, payload.assetClass),
      plannedRisk: parseRequiredNumber(payload.plannedRisk, "Planned risk"),
      fees: existing?.fees ?? 0,
      notes: payload.notes ?? "",
      fills: fills.map((fill) => ({ ...fill, tradeId: nextTradeId })),
      attachments: [
        ...(existing?.attachments ?? []),
        ...newAttachments.map((attachment) => ({
          ...attachment,
          tradeId: nextTradeId
        }))
      ],
      tags: tags.map((tag) => ({ ...tag, tradeId: nextTradeId }))
    };

    const normalizedTradeType = trade.tradeType.trim();
    const normalizedSetupType = trade.setupType.trim();

    const shouldPersistTradeType =
      normalizedTradeType.length > 0 &&
      !settings.customTradeTypes.includes(normalizedTradeType) &&
      !tradeTypeOptions.some((option) => option.label.toLowerCase() === normalizedTradeType.toLowerCase());
    const shouldPersistSetupType =
      normalizedSetupType.length > 0 &&
      !settings.customSetupTypes.includes(normalizedSetupType) &&
      !setupTypeOptions.some((option) => option.label.toLowerCase() === normalizedSetupType.toLowerCase());

    if (shouldPersistTradeType || shouldPersistSetupType) {
      await saveSettings({
        ...settings,
        customTradeTypes: shouldPersistTradeType
          ? [...settings.customTradeTypes, normalizedTradeType]
          : settings.customTradeTypes,
        customSetupTypes: shouldPersistSetupType
          ? [...settings.customSetupTypes, normalizedSetupType]
          : settings.customSetupTypes
      });
    }
    await saveTrade(trade);
    try {
      await finalizeConsumedTradeUploads(attachmentResult.consumedFileNames);
    } catch (error) {
      console.error("Failed to consume staged uploads after trade save.", error);
    }
    savedTradeId = nextTradeId;
    revalidatePath("/app");
    revalidatePath("/trades");
    revalidatePath("/analytics");
    revalidatePath("/insights");
    revalidatePath(`/trades/${nextTradeId}`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: Object.values(mapTradeZodErrors(error))[0] ?? "Please correct the trade form inputs.",
        fieldErrors: mapTradeZodErrors(error),
        submitted
      };
    }

    return {
      error: error instanceof Error ? error.message : "Unable to save trade.",
      submitted
    };
  }

  redirect(`/trades/${savedTradeId}`);
}

export async function saveTradeFilterPresetAction(input: {
  name: string;
  symbol?: string;
  setupType: TradeFilterPreset["setupType"] | "all";
  direction: TradeFilterPreset["direction"] | "all";
  result: TradeFilterPreset["result"] | "all";
  durationBucket: TradeFilterPreset["durationBucket"] | "all";
}): Promise<PresetActionResult> {
  try {
    const user = await requireCurrentUser();
    const payload = presetSchema.parse(input);
    const summary = await getStoreSummary(user.id);
    const nextPreset: TradeFilterPreset = {
      id: makeId("preset"),
      userId: user.id,
      name: payload.name,
      symbol: payload.symbol?.trim() ? payload.symbol.trim().toUpperCase() : undefined,
      setupType: payload.setupType,
      direction: payload.direction,
      result: payload.result,
      durationBucket: payload.durationBucket
    };

    await saveFilterPresets(user.id, [
      ...summary.filterPresets.filter((preset) => preset.name.toLowerCase() !== payload.name.trim().toLowerCase()),
      nextPreset
    ]);
    revalidatePath("/trades");

    return {
      error: null,
      success: true
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.issues[0]?.message ?? "Unable to save this preset.",
        success: false
      };
    }

    return {
      error: error instanceof Error ? error.message : "Unable to save this preset.",
      success: false
    };
  }
}

export async function deleteTradeFilterPresetAction(presetId: string): Promise<PresetActionResult> {
  try {
    const user = await requireCurrentUser();
    const summary = await getStoreSummary(user.id);
    await saveFilterPresets(
      user.id,
      summary.filterPresets.filter((preset) => preset.id !== presetId)
    );
    revalidatePath("/trades");

    return {
      error: null,
      success: true
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to delete this preset.",
      success: false
    };
  }
}

export async function deleteTradeAction(tradeId: string) {
  const user = await requireCurrentUser();
  await deleteTrade(tradeId, user.id);
  revalidatePath("/app");
  revalidatePath("/trades");
  revalidatePath("/analytics");
  revalidatePath("/insights");
  redirect("/trades");
}

export async function deleteTradeAttachmentAction(
  tradeId: string,
  attachmentId: string
): Promise<AttachmentActionResult> {
  try {
    const user = await requireCurrentUser();
    await deleteAttachment(tradeId, attachmentId, user.id);
    revalidatePath(`/trades/${tradeId}`);
    revalidatePath("/trades");
    revalidatePath("/app");
    revalidatePath("/analytics");
    revalidatePath("/insights");
    return {
      error: null,
      success: true
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to delete this image.",
      success: false
    };
  }
}
