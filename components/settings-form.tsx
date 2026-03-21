"use client";

import { useActionState } from "react";
import { saveSettingsAction, SettingsActionState } from "@/app/settings/actions";
import { UserSettings } from "@/lib/domain/types";
import { FormSubmit } from "@/components/form-submit";
import { TokenListField } from "@/components/token-list-field";
import { timezoneOptions } from "@/lib/domain/catalog";
import { fieldClass, selectFieldClass } from "@/lib/ui/form-styles";

const initialState: SettingsActionState = {
  error: null,
  savedInsightMode: undefined,
  success: false
};

type SettingsFormProps = {
  settings: UserSettings;
  semanticInsightsAvailable?: boolean;
};

export function SettingsForm({ settings, semanticInsightsAvailable = false }: SettingsFormProps) {
  const [state, formAction] = useActionState(saveSettingsAction, initialState);
  const currentValues = {
    displayName: state.submitted?.displayName ?? settings.displayName,
    email: state.submitted?.email ?? settings.email,
    timezone: state.submitted?.timezone ?? settings.timezone,
    defaultRisk: state.submitted?.defaultRisk ?? String(settings.defaultRisk),
    aiInsightsEnabled: state.submitted?.aiInsightsEnabled ?? settings.aiInsightsEnabled,
    insightMode: state.submitted?.insightMode ?? state.savedInsightMode ?? settings.insightMode,
    strategyTaxonomy: state.submitted?.strategyTaxonomy ?? settings.strategyTaxonomy,
    customTradeTypes: state.submitted?.customTradeTypes ?? settings.customTradeTypes,
    customSetupTypes: state.submitted?.customSetupTypes ?? settings.customSetupTypes
  };
  const timezoneChoices = timezoneOptions.some((option) => option.value === currentValues.timezone)
    ? timezoneOptions
    : [{ value: currentValues.timezone, label: currentValues.timezone, detail: currentValues.timezone }, ...timezoneOptions];

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">Profile</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              These settings shape journal defaults and weekly insight timing.
            </p>
          </div>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Display name</span>
              <input name="displayName" defaultValue={currentValues.displayName} className={fieldClass} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Email</span>
              <input name="email" type="email" defaultValue={currentValues.email} className={fieldClass} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Timezone</span>
              <select name="timezone" defaultValue={currentValues.timezone} className={selectFieldClass}>
                {timezoneChoices.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.detail})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">Defaults</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Set the journal baseline so new trades start from your usual risk model.
            </p>
          </div>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Default risk</span>
              <input name="defaultRisk" type="number" step="0.01" defaultValue={currentValues.defaultRisk} className={fieldClass} />
            </label>
            <input type="hidden" name="defaultCapital" value={String(settings.defaultCapital)} />
            <TokenListField
              key={`strategy-${currentValues.strategyTaxonomy.join("|")}`}
              name="strategyTaxonomy"
              label="Strategy taxonomy"
              initialValues={currentValues.strategyTaxonomy}
              suggestions={["ORB", "Trend Pullback", "Failed Breakout", "Support Reclaim", "Gamma Momentum"]}
              placeholder="Type a strategy and press Enter"
              description="Build the strategy vocabulary your journal should group around."
            />
            <TokenListField
              key={`trade-types-${currentValues.customTradeTypes.join("|")}`}
              name="customTradeTypes"
              label="Custom trade types"
              initialValues={currentValues.customTradeTypes}
              suggestions={["Opening drive", "Trend continuation", "Breakout", "Reversal", "Swing", "News reaction"]}
              placeholder="Add a trade type"
              description="Trade form suggestions will use these, and new trade labels still get learned automatically."
            />
            <TokenListField
              key={`setup-types-${currentValues.customSetupTypes.join("|")}`}
              name="customSetupTypes"
              label="Custom setup types"
              initialValues={currentValues.customSetupTypes}
              suggestions={["Demand reversal", "Supply reversal", "ORB", "Trend pullback", "Failed breakout"]}
              placeholder="Add a setup type"
              description="Keep this list tight so setup distributions and insights stay readable."
            />
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink">
              <input type="checkbox" name="aiInsightsEnabled" defaultChecked={currentValues.aiInsightsEnabled} />
              Enable hybrid AI insight summaries
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-ink">Insight mode</span>
              <select
                key={currentValues.insightMode}
                name="insightMode"
                defaultValue={currentValues.insightMode}
                className={selectFieldClass}
              >
                <option value="local">Local pattern engine</option>
                <option value="semantic">Semantic retrieval (premium)</option>
              </select>
              <p className="text-sm leading-6 text-muted">
                {semanticInsightsAvailable
                  ? "Premium semantic retrieval is available and can use embedding-backed similarity across notes, tags, and image captions."
                  : "Semantic retrieval needs an API key at runtime. Without one, the app falls back to the local pattern engine."}
              </p>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {state.error ? <span className="text-red">{state.error}</span> : null}
          {!state.error && state.success ? <span className="metric-positive">Settings saved.</span> : null}
        </div>
        <FormSubmit idleLabel="Save settings" pendingLabel="Saving settings" />
      </div>
    </form>
  );
}
