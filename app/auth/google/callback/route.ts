import { NextRequest, NextResponse } from "next/server";
import { loginWithGoogle } from "@/lib/server/auth";
import {
  consumeGoogleOauthFlow,
  exchangeGoogleCodeForUser,
  isGoogleOauthConfigured
} from "@/lib/server/google-oauth";

function buildFailureRedirect(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isGoogleOauthConfigured()) {
    return buildFailureRedirect(request, "Google sign-in is not configured.");
  }

  const code = request.nextUrl.searchParams.get("code")?.trim();
  const state = request.nextUrl.searchParams.get("state")?.trim();

  if (!code || !state) {
    return buildFailureRedirect(request, "Google sign-in could not be completed.");
  }

  const codeVerifier = await consumeGoogleOauthFlow(state);
  if (!codeVerifier) {
    return buildFailureRedirect(request, "Google sign-in could not be verified.");
  }

  try {
    const profile = await exchangeGoogleCodeForUser(request, code, codeVerifier);
    await loginWithGoogle(profile);
  } catch (error) {
    return buildFailureRedirect(
      request,
      error instanceof Error ? error.message : "Google sign-in could not be completed."
    );
  }

  return NextResponse.redirect(new URL("/app", request.url));
}
