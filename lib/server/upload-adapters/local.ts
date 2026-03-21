import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { makeId } from "@/lib/domain/utils";
import { getLocalUploadDir } from "@/lib/server/runtime-paths";
import { SavedUpload, UploadAdapter } from "@/lib/server/upload-adapters/types";

const maxUploadSizeBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function getFullUploadPath(fileName: string) {
  return path.join(getLocalUploadDir(), fileName);
}

async function ensureUploadDir() {
  await mkdir(getLocalUploadDir(), { recursive: true });
}

function validateUpload(file: File) {
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".bin";

  if (!allowedMimeTypes.has(file.type) || !allowedExtensions.has(extension.toLowerCase())) {
    throw new Error("Uploads must be PNG, JPG, WebP, or GIF images.");
  }

  if (file.size > maxUploadSizeBytes) {
    throw new Error("Uploads must be 10 MB or smaller.");
  }

  return extension;
}

async function save(file: File): Promise<SavedUpload> {
  await ensureUploadDir();
  const extension = validateUpload(file);

  const id = makeId("upload");
  const fileName = `${id}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fullPath = getFullUploadPath(fileName);
  await writeFile(fullPath, buffer);
  return {
    fileName,
    storagePath: `/api/uploads/${fileName}`
  };
}

async function read(fileName: string) {
  const fullPath = getFullUploadPath(fileName);
  try {
    await stat(fullPath);
  } catch {
    notFound();
  }

  return readFile(fullPath);
}

async function remove(fileName: string) {
  const fullPath = getFullUploadPath(fileName);

  try {
    await unlink(fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export const localUploadAdapter: UploadAdapter = {
  mode: "local",
  save,
  read,
  remove
};
