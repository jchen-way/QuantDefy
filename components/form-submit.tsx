"use client";

import { useFormStatus } from "react-dom";

type FormSubmitProps = {
  idleLabel: string;
  pendingLabel: string;
};

export function FormSubmit({ idleLabel, pendingLabel }: FormSubmitProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
