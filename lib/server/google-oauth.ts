import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const googleOauthStateCookieName = "quantdefy_google_oauth_state";
const googleOauthCodeVerifierCookieName = "quantdefy_google_oauth_verifier";
const googleOauthStateDurationMs = 10 * 60 * 1000;

type GoogleOauthTokenResponse = {
  access_token?: string;
  token_type?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export function isGoogleOauthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Google sign-in is not configured.");
  }
  return clientId;
}

function getGoogleClientSecret() {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new Error("Google sign-in is not configured.");
  }
  return clientSecret;
}

export function buildGoogleOauthRedirectUri(request: NextRequest) {
  return new URL("/auth/google/callback", request.url).toString();
}

function encodeBase64Url(value: Buffer | string) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildGoogleOauthCodeChallenge(verifier: string) {
  return encodeBase64Url(createHash("sha256").update(verifier).digest());
}

function timingSafeEqualStrings(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function createGoogleOauthFlow() {
  const state = randomBytes(24).toString("hex");
  const codeVerifier = encodeBase64Url(randomBytes(48));
  const cookieStore = await cookies();
  cookieStore.set(googleOauthStateCookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + googleOauthStateDurationMs)
  });
  cookieStore.set(googleOauthCodeVerifierCookieName, codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + googleOauthStateDurationMs)
  });
  return {
    state,
    codeChallenge: buildGoogleOauthCodeChallenge(codeVerifier)
  };
}

export async function consumeGoogleOauthFlow(expectedState: string) {
  const cookieStore = await cookies();
  const actualState = cookieStore.get(googleOauthStateCookieName)?.value;
  const codeVerifier = cookieStore.get(googleOauthCodeVerifierCookieName)?.value;
  cookieStore.delete(googleOauthStateCookieName);
  cookieStore.delete(googleOauthCodeVerifierCookieName);

  if (!actualState || !expectedState || !codeVerifier) {
    return null;
  }

  if (!timingSafeEqualStrings(actualState, expectedState)) {
    return null;
  }

  return codeVerifier;
}

export function buildGoogleOauthUrl(request: NextRequest, state: string, codeChallenge: string) {
  const redirectUri = buildGoogleOauthRedirectUri(request);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleCodeForUser(
  request: NextRequest,
  code: string,
  codeVerifier: string
) {
  const redirectUri = buildGoogleOauthRedirectUri(request);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  if (!tokenResponse.ok) {
    throw new Error("Google sign-in could not be completed.");
  }

  const tokenPayload = (await tokenResponse.json()) as GoogleOauthTokenResponse;
  const accessToken = tokenPayload.access_token?.trim();
  if (!accessToken) {
    throw new Error("Google sign-in could not be completed.");
  }

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!userResponse.ok) {
    throw new Error("Google sign-in could not be completed.");
  }

  const profile = (await userResponse.json()) as GoogleUserInfo;
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.email_verified !== true) {
    throw new Error("Google sign-in requires a verified email address.");
  }

  return {
    email,
    displayName: profile.name?.trim() || email.split("@")[0] || "Trader"
  };
}
