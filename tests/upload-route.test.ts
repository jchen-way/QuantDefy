import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const getAttachmentForUser = vi.fn();
const readUpload = vi.fn();

vi.mock("../lib/server/auth", () => ({
  getCurrentUser
}));

vi.mock("../lib/server/store", () => ({
  getAttachmentForUser
}));

vi.mock("../lib/server/uploads", () => ({
  readUpload
}));

async function importRoute() {
  vi.resetModules();
  return import("../app/api/uploads/[fileName]/route");
}

describe("protected upload route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getAttachmentForUser.mockReset();
    readUpload.mockReset();
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
