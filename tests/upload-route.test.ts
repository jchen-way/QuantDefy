import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const getAttachmentForUser = vi.fn();
const readUpload = vi.fn();
const saveUpload = vi.fn();
const deleteUpload = vi.fn();
const createSignedUploadClaim = vi.fn();
const verifySignedUploadClaim = vi.fn();
const createPreuploadedImage = vi.fn();
const discardPreuploadedImage = vi.fn();

vi.mock("../lib/server/auth", () => ({
  getCurrentUser
}));

vi.mock("../lib/server/store", () => ({
  getAttachmentForUser
}));

vi.mock("../lib/server/uploads", () => ({
  readUpload,
  saveUpload,
  deleteUpload,
  createSignedUploadClaim,
  verifySignedUploadClaim
}));

vi.mock("../lib/server/upload-workflow", () => ({
  createPreuploadedImage,
  discardPreuploadedImage
}));

async function importRoute() {
  vi.resetModules();
  return import("../app/api/uploads/[fileName]/route");
}

async function importUploadMutationRoute() {
  vi.resetModules();
  return import("../app/api/uploads/route");
}

describe("protected upload route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getAttachmentForUser.mockReset();
    readUpload.mockReset();
    saveUpload.mockReset();
    deleteUpload.mockReset();
    createSignedUploadClaim.mockReset();
    verifySignedUploadClaim.mockReset();
    createPreuploadedImage.mockReset();
    discardPreuploadedImage.mockReset();
  });

  it("returns 401 when no user session is present", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { GET } = await importRoute();
    const response = await GET(new NextRequest("http://localhost/api/uploads/test.png"), {
      params: Promise.resolve({ fileName: "test.png" })
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0, must-revalidate");
  });

  it("returns 404 when the attachment does not belong to the user", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    getAttachmentForUser.mockResolvedValue(null);
    const { GET } = await importRoute();
    const response = await GET(new NextRequest("http://localhost/api/uploads/test.png"), {
      params: Promise.resolve({ fileName: "test.png" })
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0, must-revalidate");
  });

  it("returns the protected binary when the user owns the attachment", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    getAttachmentForUser.mockResolvedValue({ id: "attachment_1" });
    readUpload.mockResolvedValue(Buffer.from([1, 2, 3]));
    const { GET } = await importRoute();
    const response = await GET(new NextRequest("http://localhost/api/uploads/test.png"), {
      params: Promise.resolve({ fileName: "test.png" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0, must-revalidate");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
  });
});

describe("upload mutation route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    saveUpload.mockReset();
    deleteUpload.mockReset();
    createSignedUploadClaim.mockReset();
    verifySignedUploadClaim.mockReset();
    createPreuploadedImage.mockReset();
    discardPreuploadedImage.mockReset();
  });

  it("returns 401 when preuploading without a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await importUploadMutationRoute();
    const request = new NextRequest("http://localhost/api/uploads", {
      method: "POST",
      body: new FormData()
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("rejects empty upload payloads", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    const { POST } = await importUploadMutationRoute();
    const request = new NextRequest("http://localhost/api/uploads", {
      method: "POST",
      body: new FormData()
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Select an image to upload." });
  });

  it("returns a signed upload claim for valid preuploads", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    createPreuploadedImage.mockResolvedValue({
      fileName: "upload_1.png",
      storagePath: "/api/uploads/upload_1.png",
      uploadToken: "signed-upload-claim"
    });

    const { POST } = await importUploadMutationRoute();
    const formData = new FormData();
    formData.append("file", new File([Uint8Array.from([1])], "chart.png", { type: "image/png" }));
    const request = new NextRequest("http://localhost/api/uploads", {
      method: "POST",
      body: formData
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      fileName: "upload_1.png",
      storagePath: "/api/uploads/upload_1.png",
      uploadToken: "signed-upload-claim"
    });
    expect(createPreuploadedImage).toHaveBeenCalled();
  });

  it("deletes a claimed upload for the current user", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    discardPreuploadedImage.mockResolvedValue(undefined);

    const { DELETE } = await importUploadMutationRoute();
    const request = new NextRequest("http://localhost/api/uploads", {
      method: "DELETE",
      body: JSON.stringify({ uploadToken: "signed-upload-claim" }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(discardPreuploadedImage).toHaveBeenCalledWith("user_1", "signed-upload-claim");
  });

  it("returns validation errors when saveUpload rejects", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    createPreuploadedImage.mockRejectedValue(new Error("Uploads must be PNG, JPG, WebP, or GIF images."));

    const { POST } = await importUploadMutationRoute();
    const formData = new FormData();
    formData.append("file", new File(["bad"], "chart.svg", { type: "image/svg+xml" }));
    const request = new NextRequest("http://localhost/api/uploads", {
      method: "POST",
      body: formData
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Uploads must be PNG, JPG, WebP, or GIF images."
    });
  });

  it("returns 400 for invalid upload claims on delete", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    discardPreuploadedImage.mockImplementation(() => {
      throw new Error("Invalid upload reference.");
    });

    const { DELETE } = await importUploadMutationRoute();
    const request = new NextRequest("http://localhost/api/uploads", {
      method: "DELETE",
      body: JSON.stringify({ uploadToken: "bad-claim" }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await DELETE(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid upload reference." });
  });

  it("returns 400 for malformed delete payloads", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });

    const { DELETE } = await importUploadMutationRoute();
    const request = new NextRequest("http://localhost/api/uploads", {
      method: "DELETE",
      body: "{not-json",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });
});
