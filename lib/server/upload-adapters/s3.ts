import {
  DeleteMarkerEntry,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectVersionsCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { notFound } from "next/navigation";
import { makeId } from "@/lib/domain/utils";
import { SavedUpload, UploadAdapter } from "@/lib/server/upload-adapters/types";

const maxUploadSizeBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured for UPLOAD_RUNTIME=s3.`);
  }

  return value;
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

function getKeyPrefix() {
  const prefix = process.env.S3_KEY_PREFIX?.trim().replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix}/` : "uploads/";
}

function getObjectKey(fileName: string) {
  return `${getKeyPrefix()}${fileName}`;
}

function getS3Client() {
  return new S3Client({
    region: getRequiredEnv("S3_REGION"),
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: getRequiredEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("S3_SECRET_ACCESS_KEY")
    }
  });
}

type VersionedEntry = {
  Key?: string;
  VersionId?: string;
};

async function listVersionedEntriesForKey(client: S3Client, key: string) {
  const bucket = getRequiredEnv("S3_BUCKET");
  const entries: VersionedEntry[] = [];
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  while (true) {
    const response = await client.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        Prefix: key,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker
      })
    );

    entries.push(
      ...(response.Versions ?? []).filter((item) => item.Key === key),
      ...(response.DeleteMarkers ?? []).filter((item): item is DeleteMarkerEntry => item.Key === key)
    );

    if (!response.IsTruncated) {
      break;
    }

    keyMarker = response.NextKeyMarker;
    versionIdMarker = response.NextVersionIdMarker;
  }

  return entries;
}

async function streamToBuffer(body: unknown) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  if (Symbol.asyncIterator in Object(body)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported object storage response body.");
}

async function save(file: File): Promise<SavedUpload> {
  const extension = validateUpload(file);
  const fileName = `${makeId("upload")}${extension}`;
  const body = Buffer.from(await file.arrayBuffer());
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getRequiredEnv("S3_BUCKET"),
      Key: getObjectKey(fileName),
      Body: body,
      ContentType: file.type
    })
  );

  return {
    fileName,
    storagePath: `/api/uploads/${fileName}`
  };
}

async function read(fileName: string) {
  const client = getS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: getRequiredEnv("S3_BUCKET"),
        Key: getObjectKey(fileName)
      })
    );

    return streamToBuffer(response.Body);
  } catch (error) {
    if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey") {
      notFound();
    }
    throw error;
  }
}

async function remove(fileName: string) {
  const client = getS3Client();
  const bucket = getRequiredEnv("S3_BUCKET");
  const key = getObjectKey(fileName);

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  try {
    const versionedEntries = await listVersionedEntriesForKey(client, key);
    const objects = versionedEntries
      .filter((entry) => entry.VersionId)
      .map((entry) => ({
        Key: key,
        VersionId: entry.VersionId
      }));

    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects,
            Quiet: true
          }
        })
      );
    }
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "AccessDenied" || name === "NotImplemented") {
      return;
    }
    throw error;
  }
}

export const s3UploadAdapter: UploadAdapter = {
  mode: "s3",
  save,
  read,
  remove
};
