import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieState = new Map<string, string>();
const deleteCookie = vi.fn((name: string) => cookieState.delete(name));
const setCookie = vi.fn((name: string, value: string) => cookieState.set(name, value));
const getCookie = vi.fn((name: string) => {
  const value = cookieState.get(name);
  return value ? { value } : undefined;
});

const getSession = vi.fn();
const getUserById = vi.fn();
const deleteSession = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: getCookie,
    set: setCookie,
    delete: deleteCookie
  })
}));

vi.mock("../lib/server/store", () => ({
  getSession,
  getUserById,
  deleteSession,
  getSettings: vi.fn(),
  getUserByEmail: vi.fn(),
  createSession: vi.fn(),
  createUser: vi.fn()
}));

async function importAuth() {
  vi.resetModules();
  return import("../lib/server/auth");
}

describe("auth session helpers", () => {
  beforeEach(() => {
    cookieState.clear();
    deleteCookie.mockClear();
    setCookie.mockClear();
    getCookie.mockClear();
    getSession.mockReset();
    getUserById.mockReset();
    deleteSession.mockReset();
  });

  it("accepts the legacy session cookie name during transition", async () => {
    cookieState.set("trade_logger_session", "legacy-session");
    getSession.mockResolvedValue({
      id: "legacy-session",
      userId: "user_1",
      expiresAt: "2099-01-01T00:00:00.000Z"
    });
    getUserById.mockResolvedValue({ id: "user_1", email: "a@b.com" });

    const auth = await importAuth();
    const user = await auth.getCurrentUser();

    expect(user).toEqual({ id: "user_1", email: "a@b.com" });
  });

  it("clears both current and legacy cookie names on logout", async () => {
    cookieState.set("quantdefy_session", "session-current");
    deleteSession.mockResolvedValue(undefined);
    const auth = await importAuth();

    await auth.logoutCurrentSession();

    expect(deleteSession).toHaveBeenCalledWith("session-current");
    expect(deleteCookie).toHaveBeenCalledWith("quantdefy_session");
    expect(deleteCookie).toHaveBeenCalledWith("trade_logger_session");
  });

  it("clears stale cookies when the stored session no longer exists", async () => {
    cookieState.set("quantdefy_session", "missing-session");
    getSession.mockResolvedValue(null);
    const auth = await importAuth();

    const user = await auth.getCurrentUser();

    expect(user).toBeNull();
    expect(deleteCookie).toHaveBeenCalledWith("quantdefy_session");
    expect(deleteCookie).toHaveBeenCalledWith("trade_logger_session");
  });

  it("deletes expired sessions and clears cookies", async () => {
    cookieState.set("quantdefy_session", "expired-session");
    getSession.mockResolvedValue({
      id: "expired-session",
      userId: "user_1",
      expiresAt: "2000-01-01T00:00:00.000Z"
    });
    const auth = await importAuth();

    const user = await auth.getCurrentUser();

    expect(user).toBeNull();
    expect(deleteSession).toHaveBeenCalledWith("expired-session");
    expect(deleteCookie).toHaveBeenCalledWith("quantdefy_session");
    expect(deleteCookie).toHaveBeenCalledWith("trade_logger_session");
  });

  it("deletes orphaned sessions when the user no longer exists", async () => {
    cookieState.set("quantdefy_session", "orphaned-session");
    getSession.mockResolvedValue({
      id: "orphaned-session",
      userId: "user_missing",
      expiresAt: "2099-01-01T00:00:00.000Z"
    });
    getUserById.mockResolvedValue(null);
    const auth = await importAuth();

    const user = await auth.getCurrentUser();

    expect(user).toBeNull();
    expect(deleteSession).toHaveBeenCalledWith("orphaned-session");
    expect(deleteCookie).toHaveBeenCalledWith("quantdefy_session");
    expect(deleteCookie).toHaveBeenCalledWith("trade_logger_session");
  });
});
