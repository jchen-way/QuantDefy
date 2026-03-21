import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createGoogleOauthFlow = vi.fn();
const buildGoogleOauthUrl = vi.fn();
const isGoogleOauthConfigured = vi.fn();
const consumeGoogleOauthFlow = vi.fn();
const exchangeGoogleCodeForUser = vi.fn();
const loginWithGoogle = vi.fn();

vi.mock("../lib/server/google-oauth", () => ({
  createGoogleOauthFlow,
  buildGoogleOauthUrl,
  isGoogleOauthConfigured,
  consumeGoogleOauthFlow,
  exchangeGoogleCodeForUser
}));

vi.mock("../lib/server/auth", () => ({
  loginWithGoogle
}));

describe("google oauth routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("redirects login start to Google when configured", async () => {
    isGoogleOauthConfigured.mockReturnValue(true);
    createGoogleOauthFlow.mockResolvedValue({
      state: "state-123",
      codeChallenge: "challenge-123"
    });
    buildGoogleOauthUrl.mockReturnValue(new URL("https://accounts.google.com/o/oauth2/v2/auth?state=state-123"));

    const { GET } = await import("../app/auth/google/route");
    const response = await GET(new NextRequest("http://localhost:3000/auth/google"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(createGoogleOauthFlow).toHaveBeenCalledOnce();
    expect(buildGoogleOauthUrl).toHaveBeenCalledWith(expect.any(NextRequest), "state-123", "challenge-123");
  });

  it("redirects callback failures back to login", async () => {
    isGoogleOauthConfigured.mockReturnValue(true);
    consumeGoogleOauthFlow.mockResolvedValue(null);

    const { GET } = await import("../app/auth/google/callback/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/auth/google/callback?code=test-code&state=bad-state")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("authError=");
    expect(loginWithGoogle).not.toHaveBeenCalled();
  });

  it("creates a session and redirects to /app on successful callback", async () => {
    isGoogleOauthConfigured.mockReturnValue(true);
    consumeGoogleOauthFlow.mockResolvedValue("verifier-123");
    exchangeGoogleCodeForUser.mockResolvedValue({
      email: "admin@example.com",
      displayName: "Admin"
    });

    const { GET } = await import("../app/auth/google/callback/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/auth/google/callback?code=test-code&state=state-123")
    );

    expect(exchangeGoogleCodeForUser).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "test-code",
      "verifier-123"
    );
    expect(loginWithGoogle).toHaveBeenCalledWith({
      email: "admin@example.com",
      displayName: "Admin"
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/app");
  });
});
