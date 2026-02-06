"use client";

import { useState } from "react";
import { validateUsername } from "@/lib/moderation";

export function UsernameModal({
  onConfirm,
}: {
  onConfirm: (name: string) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string) {
    setInput(value);
    if (value.trim().length > 0) {
      const check = validateUsername(value.trim());
      setError(check.valid ? null : check.error ?? null);
    } else {
      setError(null);
    }
  }

  function handleSubmit() {
    const trimmed = input.trim();
    const check = validateUsername(trimmed);
    if (!check.valid) {
      setError(check.error ?? "Invalid name");
      return;
    }
    onConfirm(trimmed);
  }

  const isValid = input.trim().length >= 2 && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl ring-1 ring-border">
        <h2 className="mb-1 text-center text-lg font-bold">
          Pick a name to join chat
        </h2>
        <p className="mb-5 text-center text-sm text-muted">
          Letters, numbers, _ and - only
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="YourName"
            maxLength={20}
            autoFocus
            className="mb-1 w-full rounded-lg bg-background px-4 py-3 text-center text-sm text-foreground placeholder:text-muted/60 outline-none ring-1 ring-border transition-shadow focus:ring-accent"
          />
          {error && (
            <p className="mb-2 text-center text-xs text-red-400">{error}</p>
          )}
          {!error && <div className="mb-2 h-4" />}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join Chat
          </button>
        </form>
      </div>
    </div>
  );
}
