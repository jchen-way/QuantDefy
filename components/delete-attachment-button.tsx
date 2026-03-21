"use client";

import { useTransition } from "react";
import { deleteTradeAttachmentAction } from "@/app/trades/actions";

type DeleteAttachmentButtonProps = {
  tradeId: string;
  attachmentId: string;
  compact?: boolean;
};

export function DeleteAttachmentButton({
  tradeId,
  attachmentId,
  compact = false
}: DeleteAttachmentButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm("Delete this image from the trade record?");
        if (!confirmed) {
          return;
        }

        startTransition(async () => {
          await deleteTradeAttachmentAction(tradeId, attachmentId);
        });
      }}
      className={
        compact
          ? "rounded-full border border-white/12 bg-[#0b1220]/80 px-3 py-1.5 text-xs font-medium text-white/72 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          : "rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white/72 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {isPending ? "Deleting" : "Delete"}
    </button>
  );
}
