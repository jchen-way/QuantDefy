import { afterAll, beforeEach, describe, expect, it } from "vitest";

const originalAdminEmails = process.env.ADMIN_EMAILS;

beforeEach(() => {
  process.env.ADMIN_EMAILS = "admin@example.com,ops@example.com";
});

describe("google/admin auth helpers", () => {
  it("matches admin emails case-insensitively", async () => {
    const auth = await import("../lib/server/auth");

    expect(auth.isAdminEmail("ADMIN@example.com")).toBe(true);
    expect(auth.isAdminEmail("user@example.com")).toBe(false);
    expect(auth.isAdminUser({ email: "ops@example.com" } as never)).toBe(true);
  });
});

afterAll(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});
