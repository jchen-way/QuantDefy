"use client";

import { useTransition } from "react";
import { deleteTradeAction } from "@/app/trades/actions";

type DeleteTradeButtonProps = {
  tradeId: string;
};

export function DeleteTradeButton({ tradeId }: DeleteTradeButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm("Delete this trade and its attached journal data?");
        if (!confirmed) {
          return;
        }

        startTransition(async () => {
          await deleteTradeAction(tradeId);
        });
      }}
      className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/16 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Deleting" : "Delete trade"}
    </button>
  );
}
