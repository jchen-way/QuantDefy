"use client";

import { useEffect, useRef, useState } from "react";
import { AttachmentKind } from "@/lib/domain/types";

export type AttachmentDraft = {
  id: string;
  kind: AttachmentKind;
  caption: string;
  uploadToken?: string;
  fileName?: string;
  originalFileName?: string;
  uploading?: boolean;
  uploadError?: string | null;
};

type UploadAttachmentResult = {
  fileName: string;
  uploadToken: string;
};

type UseTradeAttachmentsDraftArgs = {
  makeRowId: (prefix: string) => string;
};

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

export function createBlankAttachment(id: string): AttachmentDraft {
  return {
    id,
    kind: "setup",
    caption: "",
    uploadError: null
  };
}

export function useTradeAttachmentsDraft({ makeRowId }: UseTradeAttachmentsDraftArgs) {
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([
    createBlankAttachment("attachment_new_1")
  ]);
  const attachmentsRef = useRef(attachments);
  const removedAttachmentIdsRef = useRef(new Set<string>());

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const pendingAttachmentUploads = attachments.some((attachment) => attachment.uploading);

  async function discardUploadedImage(uploadToken: string) {
    await fetch("/api/uploads", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ uploadToken })
    });
  }

  function rehydrate(submittedAttachmentRowsJson: string | null) {
    setAttachments((current) => {
      const next = parseDraftState<AttachmentDraft[]>(submittedAttachmentRowsJson, current);
      return next.map((attachment) => {
        const existing = current.find((item) => item.id === attachment.id);
        return existing
          ? {
              ...existing,
              kind: attachment.kind,
              caption: attachment.caption,
              uploadToken: attachment.uploadToken
            }
          : attachment;
      });
    });
  }

  function updateKind(attachmentId: string, kind: AttachmentKind) {
    setAttachments((current) =>
      current.map((item) => (item.id === attachmentId ? { ...item, kind } : item))
    );
  }

  function updateCaption(attachmentId: string, caption: string) {
    setAttachments((current) =>
      current.map((item) => (item.id === attachmentId ? { ...item, caption } : item))
    );
  }

  async function uploadAttachmentFile(attachmentId: string, file: File) {
    const previousAttachment = attachmentsRef.current.find((item) => item.id === attachmentId);
    const previousUploadToken = previousAttachment?.uploadToken;

    setAttachments((current) =>
      current.map((item) =>
        item.id === attachmentId
          ? {
              ...item,
              uploading: true,
              uploadError: null
            }
          : item
      )
    );

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body
      });

      const payload = (await response.json()) as UploadAttachmentResult | { error?: string };
      const uploadError =
        typeof payload === "object" && payload !== null && "error" in payload ? payload.error : undefined;

      if (!response.ok || !("fileName" in payload) || !("uploadToken" in payload)) {
        throw new Error(uploadError ?? "Upload failed.");
      }

      if (removedAttachmentIdsRef.current.has(attachmentId)) {
        removedAttachmentIdsRef.current.delete(attachmentId);
        void discardUploadedImage(payload.uploadToken);
        return;
      }

      setAttachments((current) =>
        current.map((item) =>
          item.id === attachmentId
            ? {
                ...item,
                uploadToken: payload.uploadToken,
                fileName: payload.fileName,
                originalFileName: file.name,
                uploading: false,
                uploadError: null
              }
            : item
        )
      );

      if (previousUploadToken && previousUploadToken !== payload.uploadToken) {
        void discardUploadedImage(previousUploadToken);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setAttachments((current) =>
        current.map((item) =>
          item.id === attachmentId
            ? {
                ...item,
                uploadToken: previousAttachment?.uploadToken,
                fileName: previousAttachment?.fileName,
                originalFileName: previousAttachment?.originalFileName,
                uploading: false,
                uploadError: message
              }
            : item
        )
      );
    }
  }

  async function removeAttachmentRow(attachmentId: string) {
    const target = attachmentsRef.current.find((item) => item.id === attachmentId);
    removedAttachmentIdsRef.current.add(attachmentId);

    if (target?.uploadToken) {
      void discardUploadedImage(target.uploadToken);
    }

    setAttachments((current) => {
      const next = current.filter((item) => item.id !== attachmentId);
      return next.length > 0 ? next : [createBlankAttachment(makeRowId("attachment"))];
    });
  }

  function addAttachmentRow() {
    setAttachments((current) => [...current, createBlankAttachment(makeRowId("attachment"))]);
  }

  function serializeForSubmit() {
    return JSON.stringify(
      attachments.map(({ id, kind, caption, uploadToken }) => ({
        id,
        kind,
        caption,
        uploadToken
      }))
    );
  }

  return {
    attachments,
    pendingAttachmentUploads,
    rehydrate,
    updateKind,
    updateCaption,
    uploadAttachmentFile,
    removeAttachmentRow,
    addAttachmentRow,
    serializeForSubmit
  };
}
