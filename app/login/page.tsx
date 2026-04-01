"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleContinueWithGoogle() {
    setIsLoading(true);
    setErrorMessage(null);

    const origin =
      typeof window === "undefined" ? "" : window.location.origin;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/api/auth/callback`,
      },
    });

    if (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Continue with Google to access your dashboard.
        </p>

        <button
          type="button"
          onClick={handleContinueWithGoogle}
          disabled={isLoading}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {isLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

