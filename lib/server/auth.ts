import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserAccount, UserSettings } from "@/lib/domain/types";
import { assertNotRateLimited, clearAuthFailures, recordAuthFailure } from "@/lib/server/auth-rate-limit";
import {
  createSession,
  createUser,
  deleteSession,
  getSession,
  getSettings,
  getUserByEmail,
  getUserById
} from "@/lib/server/store";
import { makeId } from "@/lib/domain/utils";

const sessionCookieName = "quantdefy_session";
const legacySessionCookieNames = ["trade_logger_session"];
const sessionDurationMs = 1000 * 60 * 60 * 24 * 14;
const oauthPlaceholderPasswordHash = "oauth_google:00";

function buildRateLimitIdentifiers(email: string, clientIp?: string | null) {
  const identifiers = [`email:${email.trim().toLowerCase()}`];
  const normalizedIp = clientIp?.trim();

  if (normalizedIp) {
    identifiers.push(`ip:${normalizedIp.toLowerCase()}`);
  }

  return identifiers;
}

async function assertRateLimitForIdentifiers(
  scope: "login" | "register",
  identifiers: string[]
) {
  for (const identifier of identifiers) {
    await assertNotRateLimited(scope, identifier);
  }
}

async function recordAuthFailureForIdentifiers(
  scope: "login" | "register",
  identifiers: string[]
) {
  await Promise.all(identifiers.map((identifier) => recordAuthFailure(scope, identifier)));
}

async function clearAuthFailuresForIdentifiers(
  scope: "login" | "register",
  identifiers: string[]
) {
  await Promise.all(identifiers.map((identifier) => clearAuthFailures(scope, identifier)));
}

function hashPassword(password: string, salt?: string) {
  const nextSalt = salt ?? randomBytes(16).toString("hex");
  const derived = scryptSync(password, nextSalt, 64).toString("hex");
  return `${nextSalt}:${derived}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, existing] = passwordHash.split(":");

  if (!salt || !existing) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(existing, "hex");

  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function buildDefaultUserSettings(args: {
  userId: string;
  displayName: string;
  email: string;
  timezone: string;
}): UserSettings {
  return {
    userId: args.userId,
    displayName: args.displayName,
    email: args.email,
    timezone: args.timezone.trim(),
    defaultRisk: 350,
    defaultCapital: 6000,
    aiInsightsEnabled: true,
    insightMode: "local",
    privacyMode: "private-cloud",
    customTradeTypes: [],
    customSetupTypes: [],
    strategyTaxonomy: ["ORB", "Trend Pullback", "Failed Breakout", "Support Reclaim", "Gamma Momentum"]
  };
}

async function setSessionCookie(sessionId: string, expiresAt: string) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  for (const legacyName of legacySessionCookieNames) {
    cookieStore.delete(legacyName);
  }
}

async function getSessionCookieValue() {
  const cookieStore = await cookies();
  const current = cookieStore.get(sessionCookieName)?.value;

  if (current) {
    return current;
  }

  for (const legacyName of legacySessionCookieNames) {
    const legacyValue = cookieStore.get(legacyName)?.value;
    if (legacyValue) {
      return legacyValue;
    }
  }

  return null;
}

export async function registerWithPassword(input: {
  displayName: string;
  email: string;
  password: string;
  timezone: string;
  clientIp?: string | null;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const rateLimitIdentifiers = buildRateLimitIdentifiers(normalizedEmail, input.clientIp);
  await assertRateLimitForIdentifiers("register", rateLimitIdentifiers);

  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    await recordAuthFailureForIdentifiers("register", rateLimitIdentifiers);
    throw new Error("Unable to create account.");
  }

  const userId = makeId("user");
  const user: UserAccount = {
    id: userId,
    email: normalizedEmail,
    displayName: input.displayName.trim(),
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString()
  };
  const settings = buildDefaultUserSettings({
    userId,
    displayName: user.displayName,
    email: user.email,
    timezone: input.timezone
  });

  try {
    await createUser(user, settings);
  } catch (error) {
    if (error instanceof Error && error.message === "An account with this email already exists.") {
      await recordAuthFailureForIdentifiers("register", rateLimitIdentifiers);
      throw new Error("Unable to create account.");
    }

    throw error;
  }
  await clearAuthFailuresForIdentifiers("register", rateLimitIdentifiers);
  return createUserSession(user.id);
}

export async function loginWithPassword(email: string, password: string, clientIp?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  const rateLimitIdentifiers = buildRateLimitIdentifiers(normalizedEmail, clientIp);
  await assertRateLimitForIdentifiers("login", rateLimitIdentifiers);

  const user = await getUserByEmail(normalizedEmail);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    await recordAuthFailureForIdentifiers("login", rateLimitIdentifiers);
    throw new Error("Invalid email or password.");
  }

  await clearAuthFailuresForIdentifiers("login", rateLimitIdentifiers);
  return createUserSession(user.id);
}

export async function loginWithGoogle(input: {
  email: string;
  displayName: string;
  timezone?: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  let user = await getUserByEmail(normalizedEmail);

  if (!user) {
    const userId = makeId("user");
    user = {
      id: userId,
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      passwordHash: oauthPlaceholderPasswordHash,
      createdAt: new Date().toISOString()
    };

    await createUser(
      user,
      buildDefaultUserSettings({
        userId,
        displayName: user.displayName,
        email: user.email,
        timezone: input.timezone ?? "America/New_York"
      })
    );
  } else if (user.passwordHash !== oauthPlaceholderPasswordHash) {
    throw new Error(
      "This email already has a password-based QuantDefy account. Sign in with your password for now."
    );
  }

  return createUserSession(user.id);
}

export async function createUserSession(userId: string) {
  const sessionId = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();
  await createSession({
    id: sessionId,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt
  });
  await setSessionCookie(sessionId, expiresAt);
}

export async function logoutCurrentSession() {
  const sessionId = await getSessionCookieValue();

  if (sessionId) {
    await deleteSession(sessionId);
  }

  await clearSessionCookie();
}

export async function getCurrentUser() {
  const sessionId = await getSessionCookieValue();

  if (!sessionId) {
    return null;
  }

  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteSession(session.id);
    return null;
  }

  return getUserById(session.userId);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireCurrentSettings() {
  const user = await requireCurrentUser();
  return getSettings(user.id);
}

export function isAdminEmail(email: string) {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export function isAdminUser(user: Pick<UserAccount, "email"> | null | undefined) {
  return Boolean(user && isAdminEmail(user.email));
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();
  if (!isAdminUser(user)) {
    redirect("/app");
  }
  return user;
}
