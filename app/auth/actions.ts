"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginWithPassword, logoutCurrentSession, registerWithPassword } from "@/lib/server/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const registerSchema = z.object({
  displayName: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  timezone: z.string().trim().min(1)
});

export type AuthActionState = {
  error: string | null;
  submitted?: {
    displayName?: string;
    email?: string;
    timezone?: string;
  };
};

function buildSubmitted(formData: FormData) {
  return {
    displayName: typeof formData.get("displayName") === "string" ? String(formData.get("displayName")) : "",
    email: typeof formData.get("email") === "string" ? String(formData.get("email")) : "",
    timezone: typeof formData.get("timezone") === "string" ? String(formData.get("timezone")) : "America/New_York"
  };
}

function mapAuthError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];

    if (!issue) {
      return fallback;
    }

    const field = issue.path[0];
    if (field === "email") {
      return "Enter a valid email address.";
    }
    if (field === "password") {
      return "Passwords must be at least 8 characters.";
    }
    if (field === "displayName") {
      return "Enter your display name.";
    }
    if (field === "timezone") {
      return "Choose a timezone.";
    }

    return issue.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

async function getClientIp() {
  if (process.env.TRUST_PROXY_IP_HEADERS !== "true") {
    return null;
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  const realIp = requestHeaders.get("x-real-ip");
  return realIp?.trim() || null;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const submitted = buildSubmitted(formData);

  try {
    const payload = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password")
    });
    await loginWithPassword(payload.email, payload.password, await getClientIp());
  } catch (error) {
    return { error: mapAuthError(error, "Unable to sign in."), submitted };
  }

  redirect("/app");
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const submitted = buildSubmitted(formData);

  try {
    const payload = registerSchema.parse({
      displayName: formData.get("displayName"),
      email: formData.get("email"),
      password: formData.get("password"),
      timezone: formData.get("timezone")
    });
    await registerWithPassword({
      ...payload,
      clientIp: await getClientIp()
    });
  } catch (error) {
    return { error: mapAuthError(error, "Unable to create account."), submitted };
  }

  redirect("/app");
}

export async function logoutAction() {
  await logoutCurrentSession();
  redirect("/");
}
