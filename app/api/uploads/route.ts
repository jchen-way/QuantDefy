import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { createPreuploadedImage, discardPreuploadedImage } from "@/lib/server/upload-workflow";

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
    const upload = await createPreuploadedImage(user.id, fileEntry);
    return NextResponse.json(upload, { headers: uploadRouteHeaders });
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
    const body = (await request.json()) as { uploadToken?: string };
    if (typeof body.uploadToken !== "string" || body.uploadToken.trim().length === 0) {
      return NextResponse.json({ error: "Upload reference is required." }, { status: 400, headers: uploadRouteHeaders });
    }

    await discardPreuploadedImage(user.id, body.uploadToken);

    return NextResponse.json({ success: true }, { headers: uploadRouteHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove this image.";
    const status = message === "Unable to parse JSON body." ? 400 : 400;
    return NextResponse.json({ error: message }, { status, headers: uploadRouteHeaders });
  }
}
