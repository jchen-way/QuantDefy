"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { cn } from "@/lib/domain/utils";
import { fieldClass } from "@/lib/ui/form-styles";

type TokenListFieldProps = {
  name: string;
  label: string;
  description: string;
  initialValues: string[];
  suggestions?: string[];
  placeholder: string;
};

function normalizeValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function TokenListField({
  name,
  label,
  description,
  initialValues,
  suggestions = [],
  placeholder
}: TokenListFieldProps) {
  const [values, setValues] = useState(() => normalizeValues(initialValues));
  const [draft, setDraft] = useState("");

  const availableSuggestions = useMemo(() => {
    const current = new Set(values.map((value) => value.toLowerCase()));
    return normalizeValues(suggestions).filter((value) => !current.has(value.toLowerCase()));
  }, [suggestions, values]);

  function addValue(nextValue: string) {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      return;
    }

    setValues((current) => normalizeValues([...current, trimmed]));
    setDraft("");
  }

  function removeValue(target: string) {
    setValues((current) => current.filter((value) => value !== target));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addValue(draft);
    }

    if (event.key === "Backspace" && !draft && values.length > 0) {
      event.preventDefault();
      removeValue(values[values.length - 1]);
    }
  }

  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input type="hidden" name={name} value={JSON.stringify(values)} />
      <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => removeValue(value)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm text-ink transition hover:bg-white/12"
            >
              <span>{value}</span>
              <span aria-hidden="true" className="text-white/45">
                ×
              </span>
            </button>
          ))}
        </div>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(fieldClass, "mt-3 border-white/8 bg-white/[0.03]")}
        />
        {availableSuggestions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {availableSuggestions.slice(0, 8).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => addValue(value)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/18 hover:bg-white/8 hover:text-ink"
              >
                {value}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-muted">{description}</p>
    </label>
  );
}
