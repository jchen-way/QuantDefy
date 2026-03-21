import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getAttachmentForUser } from "@/lib/server/store";
import { readUpload } from "@/lib/server/uploads";

const mimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

const protectedUploadHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff"
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const { fileName } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: protectedUploadHeaders }
    );
  }

  const attachment = await getAttachmentForUser(fileName, user.id);
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: protectedUploadHeaders });
  }

  const data = await readUpload(fileName);
  const body = new Uint8Array(data);
  const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";

  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
      ...protectedUploadHeaders,
      ...(mimeTypes[extension]
        ? {}
        : {
            "Content-Disposition": `attachment; filename="${fileName}"`
          })
    }
  });
}
