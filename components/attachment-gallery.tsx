"use client";

import { useEffect, useState } from "react";
import { DeleteAttachmentButton } from "@/components/delete-attachment-button";
import { TradeAttachment } from "@/lib/domain/types";
import { cn } from "@/lib/domain/utils";

type AttachmentGalleryProps = {
  tradeId: string;
  attachments: TradeAttachment[];
};

export function AttachmentGallery({ tradeId, attachments }: AttachmentGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedIndex(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex]);

  if (attachments.length === 0) {
    return (
      <div className="rounded-[1.4rem] border border-dashed border-edge bg-white/45 px-4 py-8 text-center text-sm text-muted">
        No images attached yet.
      </div>
    );
  }

  const selectedAttachment = selectedIndex === null ? null : attachments[selectedIndex];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.map((attachment, index) => (
          <div
            key={attachment.id}
            className="group overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/5 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="block h-full w-full text-left"
              >
                <img
                  src={attachment.storagePath}
                  alt={attachment.caption}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#09101b]/90 to-transparent px-4 py-4 opacity-0 transition group-hover:opacity-100">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">
                  Click to inspect
                </div>
              </div>
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  {attachment.kind}
                </div>
                <DeleteAttachmentButton tradeId={tradeId} attachmentId={attachment.id} compact />
              </div>
              <p className="text-sm leading-6 text-ink">{attachment.caption}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedAttachment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03060b]/86 p-4 backdrop-blur-md">
          <button
            type="button"
            aria-label="Close image viewer"
            className="absolute inset-0 cursor-zoom-out"
            onClick={() => setSelectedIndex(null)}
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#0e1622] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  {selectedAttachment.kind}
                </div>
                <div className="mt-2 text-base font-medium text-ink">{selectedAttachment.caption}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink transition hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="overflow-auto bg-[#080d15] p-4 sm:p-6">
              <img
                src={selectedAttachment.storagePath}
                alt={selectedAttachment.caption}
                className={cn(
                  "mx-auto h-auto max-h-none w-full rounded-[1.2rem] border border-white/8 bg-[#0b1018] object-contain",
                  "sm:max-w-[92vw] lg:max-w-[72rem]"
                )}
              />
            </div>
            <div className="flex items-center justify-end border-t border-white/8 px-5 py-4">
              <DeleteAttachmentButton tradeId={tradeId} attachmentId={selectedAttachment.id} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
