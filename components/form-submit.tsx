"use client";

import { useFormStatus } from "react-dom";

type FormSubmitProps = {
  idleLabel: string;
  pendingLabel: string;
  disabled?: boolean;
};

export function FormSubmit({ idleLabel, pendingLabel, disabled = false }: FormSubmitProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
