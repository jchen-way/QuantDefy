"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { regenerateInsightsAction } from "@/app/insights/actions";

export function InsightRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const statusMessage = error ?? warning ?? success;
  const statusTone = error ? "error" : warning ? "warning" : success ? "success" : null;

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const response = await regenerateInsightsAction();

              if (!response.success) {
                setSuccess(null);
                setWarning(null);
                setError(response.error);
                return;
              }

              setError(null);
              setWarning(response.warning);
              setSuccess(response.successMessage);
              router.refresh();
            })
          }
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              Generating insights
            </>
          ) : (
            "Refresh insights"
          )}
        </button>
      </div>
      {!isPending && statusMessage && statusTone ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 max-w-sm rounded-[1.1rem] border border-white/10 bg-[#111927]/92 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div
            className={
              statusTone === "error"
                ? "text-sm leading-6 text-red"
                : statusTone === "warning"
                  ? "text-sm leading-6 text-amber-200/90"
                  : "text-sm leading-6 metric-positive"
            }
          >
            {statusMessage}
          </div>
        </div>
      ) : null}
    </>
  );
}
