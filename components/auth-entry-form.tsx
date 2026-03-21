"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthActionState, loginAction, registerAction } from "@/app/auth/actions";
import { FormSubmit } from "@/components/form-submit";
import { timezoneOptions } from "@/lib/domain/catalog";
import { fieldClass, selectFieldClass } from "@/lib/ui/form-styles";

const initialState: AuthActionState = {
  error: null
};

type AuthEntryFormProps = {
  mode: "login" | "register";
  googleEnabled?: boolean;
  authError?: string | null;
};

export function AuthEntryForm({ mode, googleEnabled = false, authError = null }: AuthEntryFormProps) {
  const [state, formAction] = useActionState(mode === "login" ? loginAction : registerAction, initialState);
  const submittedTimezone = state.submitted?.timezone || "America/New_York";
  const errorMessage = state.error ?? authError;

  return (
    <form action={formAction} className="space-y-5">
      {googleEnabled ? (
        <>
          <Link
            href="/auth/google"
            className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-ink transition hover:bg-white/10"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#091019]">
              G
            </span>
            Continue with Google
          </Link>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </>
      ) : null}
      {mode === "register" ? (
        <label className="block space-y-2 text-sm">
          <span className="text-white/72">Display name</span>
          <input
            name="displayName"
            placeholder="Jiawei Chen"
            className={fieldClass}
            defaultValue={state.submitted?.displayName ?? ""}
          />
        </label>
      ) : null}
      <label className="block space-y-2 text-sm">
        <span className="text-white/72">Email</span>
        <input
          name="email"
          type="email"
          placeholder="trader@example.com"
          className={fieldClass}
          defaultValue={state.submitted?.email ?? ""}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span className="text-white/72">Password</span>
        <input
          name="password"
          type="password"
          placeholder={mode === "login" ? "Enter password" : "Choose a password"}
          className={fieldClass}
        />
      </label>
      {mode === "register" ? (
        <label className="block space-y-2 text-sm">
          <span className="text-white/72">Timezone</span>
          <select name="timezone" defaultValue={submittedTimezone} className={selectFieldClass}>
            {timezoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.detail})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-400/18 bg-rose-400/8 px-4 py-3 text-sm leading-6 text-rose-100">
          {errorMessage}
        </div>
      ) : null}
      <FormSubmit
        idleLabel={mode === "login" ? "Sign in" : "Create account"}
        pendingLabel={mode === "login" ? "Signing in" : "Creating account"}
      />
    </form>
  );
}
