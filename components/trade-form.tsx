"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveTradeAction, TradeActionState } from "@/app/trades/actions";
import {
  assetClassOptions,
  attachmentKindOptions,
  directionOptions,
  tagCategoryOptions,
  tradeStatusOptions,
  tradeTypeOptions,
  setupTypeOptions
} from "@/lib/domain/catalog";
import { AttachmentKind, TagCategory, Trade, TradeFill } from "@/lib/domain/types";
import { deriveCapitalAllocatedFromFills, toCurrency, toInputDateTimeInTimeZone } from "@/lib/domain/utils";
import { FormSubmit } from "@/components/form-submit";
import { fieldClass, selectFieldClass, textareaFieldClass } from "@/lib/ui/form-styles";

type FillDraft = {
  id: string;
  side: "entry" | "exit";
  filledDate: string;
  filledTime: string;
  quantity: string;
  price: string;
};

type TagDraft = {
  id: string;
  category: TagCategory;
  value: string;
};

type AttachmentDraft = {
  id: string;
  kind: AttachmentKind;
  caption: string;
};

type TradeDraft = {
  symbol: string;
  instrumentLabel: string;
  assetClass: Trade["assetClass"];
  direction: Trade["direction"];
  tradeType: string;
  setupType: string;
  status: Trade["status"];
  plannedRisk: string;
  thesis: string;
  reasonForEntry: string;
  reasonForExit: string;
  preTradePlan: string;
  postTradeReview: string;
  notes: string;
};

type TradeFormProps = {
  trade?: Trade | null;
  defaultRisk: number;
  timezone: string;
  customTradeTypes: string[];
  customSetupTypes: string[];
};

const initialActionState: TradeActionState = {
  error: null
};

function splitDateTime(iso: string | null | undefined, timezone: string) {
  const value = toInputDateTimeInTimeZone(iso, timezone);
  return {
    filledDate: value.slice(0, 10),
    filledTime: value.slice(11, 16)
  };
}

function createDefaultFill(timezone: string, side: FillDraft["side"] = "entry"): FillDraft {
  const { filledDate, filledTime } = splitDateTime(null, timezone);
  return {
    id: "fill_new_1",
    side,
    filledDate,
    filledTime,
    quantity: "1",
    price: ""
  };
}

function mapFills(fills: TradeFill[] | undefined, timezone: string): FillDraft[] {
  if (!fills || fills.length === 0) {
    return [createDefaultFill(timezone)];
  }

  return fills.map((fill) => {
    const split = splitDateTime(fill.filledAt, timezone);

    return {
      id: fill.id,
      side: fill.side,
      filledDate: split.filledDate,
      filledTime: split.filledTime,
      quantity: String(fill.quantity),
      price: String(fill.price)
    };
  });
}

function buildDraft(
  trade: Trade | null | undefined,
  defaultRisk: number
): TradeDraft {
  return {
    symbol: trade?.symbol ?? "",
    instrumentLabel: trade?.instrumentLabel ?? "",
    assetClass: trade?.assetClass ?? "stock",
    direction: trade?.direction ?? "long",
    tradeType: trade?.tradeType ?? tradeTypeOptions[0].label,
    setupType: trade?.setupType ?? setupTypeOptions[0].label,
    status: trade?.status ?? "open",
    plannedRisk: String(trade?.plannedRisk ?? defaultRisk),
    thesis: trade?.thesis ?? "",
    reasonForEntry: trade?.reasonForEntry ?? "",
    reasonForExit: trade?.reasonForExit ?? "",
    preTradePlan: trade?.preTradePlan ?? "",
    postTradeReview: trade?.postTradeReview ?? "",
    notes: trade?.notes ?? ""
  };
}

function parseDraftState<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function TradeForm({
  trade,
  defaultRisk,
  timezone,
  customTradeTypes,
  customSetupTypes
}: TradeFormProps) {
  const boundAction = saveTradeAction.bind(null, trade?.id ?? null);
  const [state, formAction] = useActionState(boundAction, initialActionState);
  const rowIdCounter = useRef(2);
  function makeRowId(prefix: string) {
    const nextId = `${prefix}_new_${rowIdCounter.current}`;
    rowIdCounter.current += 1;
    return nextId;
  }
  const [draft, setDraft] = useState<TradeDraft>(buildDraft(trade, defaultRisk));
  const [fills, setFills] = useState<FillDraft[]>(mapFills(trade?.fills, timezone));
  const [tags, setTags] = useState<TagDraft[]>(
    trade?.tags.map((tag) => ({
      id: tag.id,
      category: tag.category,
      value: tag.value
    })) ?? [{ id: "tag_new_1", category: "setup", value: "" }]
  );
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([
    {
      id: "attachment_new_1",
      kind: "setup",
      caption: ""
    }
  ]);

  useEffect(() => {
    if (!state.submitted) {
      return;
    }

    setDraft((current) => parseDraftState<TradeDraft>(state.submitted?.draftJson ?? null, current));
    setFills((current) => parseDraftState<FillDraft[]>(state.submitted?.fillsJson ?? null, current));
    setTags((current) => parseDraftState<TagDraft[]>(state.submitted?.tagsJson ?? null, current));
    setAttachments((current) =>
      parseDraftState<AttachmentDraft[]>(state.submitted?.attachmentRowsJson ?? null, current)
    );
  }, [state.submitted]);

  const tradeTypeSuggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...tradeTypeOptions.map((option) => option.label),
          ...customTradeTypes,
          ...(trade?.tradeType ? [trade.tradeType] : [])
        ])
      ),
    [customTradeTypes, trade?.tradeType]
  );

  const setupTypeSuggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...setupTypeOptions.map((option) => option.label),
          ...customSetupTypes,
          ...(trade?.setupType ? [trade.setupType] : [])
        ])
      ),
    [customSetupTypes, trade?.setupType]
  );

  const derivedCapitalAllocated = deriveCapitalAllocatedFromFills(
    fills.map((fill) => ({
      side: fill.side,
      quantity: Number(fill.quantity) || 0,
      price: Number(fill.price) || 0
    })),
    draft.assetClass
  );

  function updateDraft<K extends keyof TradeDraft>(key: K, value: TradeDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="draftJson" value={JSON.stringify(draft)} />
      <input type="hidden" name="fillsJson" value={JSON.stringify(fills)} />
      <input
        type="hidden"
        name="tagsJson"
        value={JSON.stringify(tags.filter((tag) => tag.value.trim().length > 0))}
      />
      <input type="hidden" name="attachmentRowsJson" value={JSON.stringify(attachments)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-ink">
              {trade ? `Review ${trade.symbol}` : "Log a new trade"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Keep this lightweight: core trade details here, then use the execution timeline below for every actual fill.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Symbol</span>
              <input
                value={draft.symbol}
                onChange={(event) => updateDraft("symbol", event.target.value)}
                className={fieldClass}
                placeholder="NVDA"
              />
              {fieldErrors.symbol ? <span className="text-xs text-red">{fieldErrors.symbol}</span> : null}
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Instrument label</span>
              <input
                value={draft.instrumentLabel}
                onChange={(event) => updateDraft("instrumentLabel", event.target.value)}
                className={fieldClass}
                placeholder="NVIDIA Corp"
              />
              {fieldErrors.instrumentLabel ? (
                <span className="text-xs text-red">{fieldErrors.instrumentLabel}</span>
              ) : null}
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Asset class</span>
              <select
                value={draft.assetClass}
                onChange={(event) => updateDraft("assetClass", event.target.value as Trade["assetClass"])}
                className={selectFieldClass}
              >
                {assetClassOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Direction</span>
              <select
                value={draft.direction}
                onChange={(event) => updateDraft("direction", event.target.value as Trade["direction"])}
                className={selectFieldClass}
              >
                {directionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Trade type</span>
              <input
                value={draft.tradeType}
                onChange={(event) => updateDraft("tradeType", event.target.value)}
                className={fieldClass}
                placeholder="Opening drive"
              />
              {fieldErrors.tradeType ? <span className="text-xs text-red">{fieldErrors.tradeType}</span> : null}
              <div className="flex flex-wrap gap-2">
                {tradeTypeSuggestions.slice(0, 6).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateDraft("tradeType", option)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted transition hover:border-white/20 hover:text-white"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Setup type</span>
              <input
                value={draft.setupType}
                onChange={(event) => updateDraft("setupType", event.target.value)}
                className={fieldClass}
                placeholder="ORB"
              />
              {fieldErrors.setupType ? <span className="text-xs text-red">{fieldErrors.setupType}</span> : null}
              <div className="flex flex-wrap gap-2">
                {setupTypeSuggestions.slice(0, 6).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateDraft("setupType", option)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted transition hover:border-white/20 hover:text-white"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Status</span>
              <select
                value={draft.status}
                onChange={(event) => updateDraft("status", event.target.value as Trade["status"])}
                className={selectFieldClass}
              >
                {tradeStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm sm:col-span-2">
              <span className="font-medium text-ink">Planned risk</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={draft.plannedRisk}
                onChange={(event) => updateDraft("plannedRisk", event.target.value)}
                className={fieldClass}
              />
              {fieldErrors.plannedRisk ? <span className="text-xs text-red">{fieldErrors.plannedRisk}</span> : null}
            </label>
            <div className="space-y-2 text-sm sm:col-span-2">
              <span className="font-medium text-ink">Capital allocated</span>
              <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="text-[1.2rem] font-semibold tracking-[-0.03em] text-ink">
                  {toCurrency(derivedCapitalAllocated)}
                </div>
                <div className="mt-1 text-xs leading-5 text-muted">
                  Derived automatically from the execution timeline
                  {draft.assetClass === "option" ? " with option contract value applied." : "."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
          <div className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Thesis</span>
              <textarea
                value={draft.thesis}
                onChange={(event) => updateDraft("thesis", event.target.value)}
                className={textareaFieldClass}
              />
              {fieldErrors.thesis ? <span className="text-xs text-red">{fieldErrors.thesis}</span> : null}
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Reason for entry</span>
              <textarea
                value={draft.reasonForEntry}
                onChange={(event) => updateDraft("reasonForEntry", event.target.value)}
                className={textareaFieldClass}
              />
              {fieldErrors.reasonForEntry ? (
                <span className="text-xs text-red">{fieldErrors.reasonForEntry}</span>
              ) : null}
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Reason for exit</span>
              <textarea
                value={draft.reasonForExit}
                onChange={(event) => updateDraft("reasonForExit", event.target.value)}
                className={textareaFieldClass}
                placeholder={draft.status === "open" ? "Leave blank until the trade is closed." : ""}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Pre-trade plan</span>
              <textarea
                value={draft.preTradePlan}
                onChange={(event) => updateDraft("preTradePlan", event.target.value)}
                className={textareaFieldClass}
              />
              {fieldErrors.preTradePlan ? (
                <span className="text-xs text-red">{fieldErrors.preTradePlan}</span>
              ) : null}
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Post-trade review</span>
              <textarea
                value={draft.postTradeReview}
                onChange={(event) => updateDraft("postTradeReview", event.target.value)}
                className={textareaFieldClass}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Notes</span>
              <textarea
                value={draft.notes}
                onChange={(event) => updateDraft("notes", event.target.value)}
                className={textareaFieldClass}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">Execution timeline</h3>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                Each row is one actual fill. Use an entry row for every buy/add and an exit row for every trim or close.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setFills((current) => [
                    ...current,
                    {
                      ...createDefaultFill(timezone, "entry"),
                      id: makeRowId("fill")
                    }
                  ])
                }
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-ink"
              >
                Add entry
              </button>
              <button
                type="button"
                onClick={() =>
                  setFills((current) => [
                    ...current,
                    {
                      ...createDefaultFill(timezone, "exit"),
                      id: makeRowId("fill")
                    }
                  ])
                }
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-ink"
              >
                Add exit
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {fills.map((fill, index) => (
              <div key={fill.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                    Fill {index + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFills((current) => current.filter((item) => item.id !== fill.id))}
                    className="text-sm text-muted"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[0.9fr_1fr_0.8fr_0.7fr_0.7fr]">
                  <select
                    value={fill.side}
                    onChange={(event) =>
                      setFills((current) =>
                        current.map((item) =>
                          item.id === fill.id ? { ...item, side: event.target.value as FillDraft["side"] } : item
                        )
                      )
                    }
                    className={selectFieldClass}
                  >
                    <option value="entry">Entry / add</option>
                    <option value="exit">Exit / trim</option>
                  </select>
                  <input
                    type="date"
                    value={fill.filledDate}
                    onChange={(event) =>
                      setFills((current) =>
                        current.map((item) =>
                          item.id === fill.id ? { ...item, filledDate: event.target.value } : item
                        )
                      )
                    }
                    className={fieldClass}
                  />
                  <input
                    type="time"
                    value={fill.filledTime}
                    onChange={(event) =>
                      setFills((current) =>
                        current.map((item) =>
                          item.id === fill.id ? { ...item, filledTime: event.target.value } : item
                        )
                      )
                    }
                    className={fieldClass}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={fill.quantity}
                    onChange={(event) =>
                      setFills((current) =>
                        current.map((item) =>
                          item.id === fill.id ? { ...item, quantity: event.target.value } : item
                        )
                      )
                    }
                    className={fieldClass}
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    value={fill.price}
                    onChange={(event) =>
                      setFills((current) =>
                        current.map((item) =>
                          item.id === fill.id ? { ...item, price: event.target.value } : item
                        )
                      )
                    }
                    className={fieldClass}
                    placeholder="Price"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">Tags</h3>
                <p className="text-sm leading-6 text-muted">Use a few normalized tags so the insights stay useful.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setTags((current) => [...current, { id: makeRowId("tag"), category: "lesson", value: "" }])
                }
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-ink"
              >
                Add tag
              </button>
            </div>
            <div className="space-y-3">
              {tags.map((tag) => (
                <div key={tag.id} className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr_auto]">
                  <select
                    value={tag.category}
                    onChange={(event) =>
                      setTags((current) =>
                        current.map((item) =>
                          item.id === tag.id ? { ...item, category: event.target.value as TagCategory } : item
                        )
                      )
                    }
                    className={selectFieldClass}
                  >
                    {tagCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={tag.value}
                    onChange={(event) =>
                      setTags((current) =>
                        current.map((item) => (item.id === tag.id ? { ...item, value: event.target.value } : item))
                      )
                    }
                    className={fieldClass}
                    placeholder="e.g. chased entry"
                  />
                  <button
                    type="button"
                    onClick={() => setTags((current) => current.filter((item) => item.id !== tag.id))}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">Image uploads</h3>
              <p className="text-sm leading-6 text-muted">Add setup or postmortem images with a short caption.</p>
            </div>
            <div className="space-y-3">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="space-y-3 rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                  <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
                    <select
                      value={attachment.kind}
                      onChange={(event) =>
                        setAttachments((current) =>
                          current.map((item) =>
                            item.id === attachment.id
                              ? { ...item, kind: event.target.value as AttachmentKind }
                              : item
                          )
                        )
                    }
                    className={selectFieldClass}
                  >
                      {attachmentKindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={attachment.caption}
                      onChange={(event) =>
                        setAttachments((current) =>
                          current.map((item) =>
                            item.id === attachment.id ? { ...item, caption: event.target.value } : item
                          )
                        )
                      }
                      className={fieldClass}
                      placeholder="What does this image show?"
                    />
                  </div>
                  <input
                    type="file"
                    name={`attachment-file-${attachment.id}`}
                    accept="image/*"
                    className="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setAttachments((current) => [
                    ...current,
                    {
                      id: makeRowId("attachment"),
                      kind: "setup",
                      caption: ""
                    }
                  ])
                }
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-ink"
              >
                Add image
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {state.error ? <span className="text-red">{state.error}</span> : null}
          {!state.error ? (
            <span className="text-muted">
              Open and close times are derived automatically from the first and last fills you enter.
            </span>
          ) : null}
        </div>
        <FormSubmit idleLabel={trade ? "Save trade" : "Create trade"} pendingLabel="Saving trade" />
      </div>
    </form>
  );
}
