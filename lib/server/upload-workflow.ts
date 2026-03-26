import { AttachmentKind, TradeAttachment } from "@/lib/domain/types";
import { makeId } from "@/lib/domain/utils";
import { getUploadClaimLifetimeMs } from "@/lib/server/upload-config";
import {
  consumeStagedUploads,
  discardStagedUpload,
  pruneExpiredStagedUploads,
  registerStagedUpload
} from "@/lib/server/upload-staging";
import { createSignedUploadClaim, deleteUpload, saveUpload, verifySignedUploadClaim } from "@/lib/server/uploads";

export type PreuploadedImageResult = {
  fileName: string;
  storagePath: string;
  uploadToken: string;
};

export type TradeAttachmentClaimRow = {
  kind: AttachmentKind;
  caption: string;
  uploadToken?: string;
};

export async function createPreuploadedImage(userId: string, file: File): Promise<PreuploadedImageResult> {
  await pruneExpiredStagedUploads();
  const upload = await saveUpload(file);
  const uploadToken = createSignedUploadClaim(upload, userId);

  await registerStagedUpload(
    userId,
    upload.fileName,
    upload.storagePath,
    new Date(Date.now() + getUploadClaimLifetimeMs()).toISOString()
  );

  return {
    fileName: upload.fileName,
    storagePath: upload.storagePath,
    uploadToken
  };
}

export async function discardPreuploadedImage(userId: string, uploadToken: string) {
  await pruneExpiredStagedUploads();
  const upload = verifySignedUploadClaim(uploadToken, userId);
  await deleteUpload(upload.fileName);
  await discardStagedUpload(upload.fileName);
}

export async function buildTradeAttachmentsFromClaims(rows: TradeAttachmentClaimRow[], userId: string) {
  await pruneExpiredStagedUploads();

  const attachments: TradeAttachment[] = [];
  const consumedFileNames: string[] = [];

  for (const row of rows) {
    const hasFile = Boolean(row.uploadToken);
    const hasCaption = row.caption.trim().length > 0;

    if (!hasFile && !hasCaption) {
      continue;
    }

    if (hasFile !== hasCaption) {
      throw new Error("Every uploaded image needs both a file and a caption.");
    }

    const upload = verifySignedUploadClaim(row.uploadToken as string, userId);
    consumedFileNames.push(upload.fileName);
    attachments.push({
      id: makeId("attachment"),
      tradeId: "",
      kind: row.kind,
      storagePath: upload.storagePath,
      caption: row.caption,
      uploadedAt: new Date().toISOString(),
      fileName: upload.fileName
    });
  }

  return { attachments, consumedFileNames };
}

export async function finalizeConsumedTradeUploads(fileNames: string[]) {
  if (fileNames.length === 0) {
    return;
  }

  await consumeStagedUploads(fileNames);
}

export async function runExpiredUploadCleanup() {
  return pruneExpiredStagedUploads();
}
