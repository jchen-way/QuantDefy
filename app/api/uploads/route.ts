import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getUploadClaimLifetimeMs } from "@/lib/server/upload-config";
import {
  discardStagedUpload,
  pruneExpiredStagedUploads,
  registerStagedUpload
} from "@/lib/server/upload-staging";
import { createSignedUploadClaim, deleteUpload, saveUpload, verifySignedUploadClaim } from "@/lib/server/uploads";

const uploadRouteHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff"
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: uploadRouteHeaders });
  }

  const formData = await request.formData();
  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return NextResponse.json({ error: "Select an image to upload." }, { status: 400, headers: uploadRouteHeaders });
  }

  try {
    await pruneExpiredStagedUploads();
    const upload = await saveUpload(fileEntry);
    const uploadToken = createSignedUploadClaim(upload, user.id);
    await registerStagedUpload(
      user.id,
      upload.fileName,
      upload.storagePath,
      new Date(Date.now() + getUploadClaimLifetimeMs()).toISOString()
    );

    return NextResponse.json(
      {
        fileName: upload.fileName,
        storagePath: upload.storagePath,
        uploadToken
      },
      { headers: uploadRouteHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload this image.";
    const status = message.startsWith("Uploads must") ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: uploadRouteHeaders });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: uploadRouteHeaders });
  }

  try {
    await pruneExpiredStagedUploads();
    const body = (await request.json()) as { uploadToken?: string };
    if (typeof body.uploadToken !== "string" || body.uploadToken.trim().length === 0) {
      return NextResponse.json({ error: "Upload reference is required." }, { status: 400, headers: uploadRouteHeaders });
    }

    const upload = verifySignedUploadClaim(body.uploadToken, user.id);
    await deleteUpload(upload.fileName);
    await discardStagedUpload(upload.fileName);

    return NextResponse.json({ success: true }, { headers: uploadRouteHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove this image.";
    const status = message === "Unable to parse JSON body." ? 400 : 400;
    return NextResponse.json({ error: message }, { status, headers: uploadRouteHeaders });
  }
}
