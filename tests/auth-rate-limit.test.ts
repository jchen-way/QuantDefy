import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const originalCwd = process.cwd();
const originalDatabaseUrl = process.env.DATABASE_URL;

async function importLimiter() {
  vi.resetModules();
  return import("../lib/server/auth-rate-limit");
}

async function importAuthActions() {
  vi.resetModules();
  return import("../app/auth/actions");
}

beforeEach(async (context) => {
  process.env.DATABASE_URL = "";
  const tempDir = await mkdtemp(path.join(tmpdir(), "quantdefy-auth-limit-"));
  process.chdir(tempDir);
  context.onTestFinished(() => {
    process.chdir(originalCwd);
    process.env.DATABASE_URL = originalDatabaseUrl;
  });
});

describe("auth rate limiting", () => {
  it("blocks repeated failed login attempts for the same identifier", async () => {
    const limiter = await importLimiter();

    for (let index = 0; index < 5; index += 1) {
      await limiter.recordAuthFailure("login", "Trader@Example.com");
    }

    await expect(limiter.assertNotRateLimited("login", "trader@example.com")).rejects.toThrow(
      "Too many sign-in attempts. Try again in 30 minutes."
    );
  });

  it("blocks repeated failed login attempts for the same IP key", async () => {
    const limiter = await importLimiter();

    for (let index = 0; index < 5; index += 1) {
      await limiter.recordAuthFailure("login", "ip:203.0.113.9");
    }

    await expect(limiter.assertNotRateLimited("login", "ip:203.0.113.9")).rejects.toThrow(
      "Too many sign-in attempts. Try again in 30 minutes."
    );
  });

  it("clears a limiter entry after a successful auth flow", async () => {
    const limiter = await importLimiter();

    for (let index = 0; index < 4; index += 1) {
      await limiter.recordAuthFailure("register", "trader@example.com");
    }

    await expect(limiter.assertNotRateLimited("register", "trader@example.com")).rejects.toThrow(
      "Too many registration attempts. Try again in 30 minutes."
    );

    await limiter.clearAuthFailures("register", "trader@example.com");

    await expect(limiter.assertNotRateLimited("register", "trader@example.com")).resolves.toBeUndefined();
  });

  it("returns friendly auth validation messages", async () => {
    const actions = await importAuthActions();
    const loginForm = new FormData();
    loginForm.set("email", "bad");
    loginForm.set("password", "short");

    const loginResult = await actions.loginAction({ error: null }, loginForm);
    expect(loginResult.error).toBe("Enter a valid email address.");

    const registerForm = new FormData();
    registerForm.set("displayName", "");
    registerForm.set("email", "trader@example.com");
    registerForm.set("password", "12345678");
    registerForm.set("timezone", "America/New_York");

    const registerResult = await actions.registerAction({ error: null }, registerForm);
    expect(registerResult.error).toBe("Enter your display name.");
    expect(registerResult.submitted?.email).toBe("trader@example.com");
  });
});
