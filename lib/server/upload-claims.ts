import { createHmac, timingSafeEqual } from "node:crypto";
import { SavedUpload } from "@/lib/server/upload-adapters/types";
import { getUploadClaimLifetimeMs } from "@/lib/server/upload-config";
const devFallbackSecret = "quantdefy-dev-upload-claims";

type UploadClaimPayload = {
  userId: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
  expiresAt: string;
};

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function getUploadClaimSecret() {
  const configured =
    process.env.UPLOAD_TOKEN_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (configured) {
    return configured;
  }

  const isHostedProduction =
    process.env.NODE_ENV === "production" &&
    Boolean(
      process.env.DATABASE_URL?.trim() ||
      process.env.UPLOAD_RUNTIME?.trim().toLowerCase() === "s3"
    );

  if (isHostedProduction) {
    throw new Error("UPLOAD_TOKEN_SECRET must be configured for hosted production upload claims.");
  }

  return devFallbackSecret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getUploadClaimSecret()).update(payload).digest("base64url");
}

export function createUploadClaimToken(upload: SavedUpload, userId: string) {
  const payload: UploadClaimPayload = {
    userId,
    fileName: upload.fileName,
    storagePath: upload.storagePath,
    uploadedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + getUploadClaimLifetimeMs()).toISOString()
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyUploadClaimToken(token: string, userId: string): SavedUpload {
  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    throw new Error("Invalid upload reference.");
  }

  const expectedSignature = signPayload(encodedPayload);
  const actualBuffer = fromBase64Url(encodedSignature);
  const expectedBuffer = fromBase64Url(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid upload reference.");
  }

  let payload: UploadClaimPayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as UploadClaimPayload;
  } catch {
    throw new Error("Invalid upload reference.");
  }

  if (
    !payload.userId ||
    !payload.fileName ||
    !payload.storagePath ||
    !payload.uploadedAt ||
    !payload.expiresAt
  ) {
    throw new Error("Invalid upload reference.");
  }

  if (payload.userId !== userId) {
    throw new Error("This upload belongs to a different account.");
  }

  if (Date.parse(payload.expiresAt) <= Date.now()) {
    throw new Error("This upload expired. Please upload the image again.");
  }

  return {
    fileName: payload.fileName,
    storagePath: payload.storagePath
  };
}
