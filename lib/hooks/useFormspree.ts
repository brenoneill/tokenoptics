"use client";

import { useCallback, useState } from "react";

export type FormspreeStatus = "idle" | "submitting" | "success" | "error";

interface UseFormspreeOptions {
  formId: string;
  onSuccess?: (payload: Record<string, unknown>) => void | Promise<void>;
}

interface UseFormspreeResult {
  status: FormspreeStatus;
  error: string | null;
  submit: (payload: Record<string, unknown>) => Promise<boolean>;
  reset: () => void;
}

export function useFormspree({ formId, onSuccess }: UseFormspreeOptions): UseFormspreeResult {
  const [status, setStatus] = useState<FormspreeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: Record<string, unknown>) => {
      setStatus("submitting");
      setError(null);
      try {
        const res = await fetch(`https://formspree.io/f/${formId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { errors?: Array<{ message?: string }> }
            | null;
          const message = data?.errors?.[0]?.message ?? "Couldn't submit — please try again.";
          throw new Error(message);
        }
        await onSuccess?.(payload);
        setStatus("success");
        return true;
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Couldn't submit — please try again.");
        return false;
      }
    },
    [formId, onSuccess],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, submit, reset };
}
