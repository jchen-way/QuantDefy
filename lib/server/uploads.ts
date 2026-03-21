import { assertSupportedUploadRuntime } from "@/lib/server/deployment-env";
import { localUploadAdapter } from "@/lib/server/upload-adapters/local";
import { s3UploadAdapter } from "@/lib/server/upload-adapters/s3";
import { UploadAdapter, UploadRuntimeMode } from "@/lib/server/upload-adapters/types";

export function getUploadRuntimeMode(): UploadRuntimeMode {
  const configuredMode = process.env.UPLOAD_RUNTIME?.trim().toLowerCase();

  if (!configuredMode || configuredMode === "local") {
    assertSupportedUploadRuntime("local");
    return "local";
  }

  if (configuredMode === "s3") {
    assertSupportedUploadRuntime("s3");
    return "s3";
  }

  throw new Error(`Unsupported UPLOAD_RUNTIME "${configuredMode}".`);
}

function getUploadAdapter(): UploadAdapter {
  const mode = getUploadRuntimeMode();

  if (mode === "local") {
    return localUploadAdapter;
  }

  if (mode === "s3") {
    return s3UploadAdapter;
  }

  throw new Error(`Unsupported upload runtime mode "${mode}".`);
}

export async function saveUpload(file: File) {
  return getUploadAdapter().save(file);
}

export async function readUpload(fileName: string) {
  return getUploadAdapter().read(fileName);
}

export async function deleteUpload(fileName: string) {
  return getUploadAdapter().remove(fileName);
}
