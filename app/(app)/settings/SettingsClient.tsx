"use client";

import { useState, useTransition } from "react";

import { saveTelegramChatId, sendTelegramTest } from "./actions";

type Props = {
  initialTelegramChatId: string | null;
  botUsername: string | null;
};

export function SettingsClient({ initialTelegramChatId, botUsername }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await saveTelegramChatId(formData);
        setMessage("Saved.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  async function onTest() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await sendTelegramTest();
        setMessage("Test message sent.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send test.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          Telegram notifications
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Monthly multiplier reminders are sent the evening before your SIP date.
          Get your chat ID from your bot (e.g. message{" "}
          {botUsername ? (
            <span className="font-mono text-zinc-800 dark:text-zinc-200">
              @{botUsername.replace(/^@/, "")}
            </span>
          ) : (
            "your bot"
          )}
          ) and paste the ID below.
        </p>

        <form action={onSave} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Telegram chat ID
            </span>
            <input
              name="telegram_chat_id"
              type="text"
              defaultValue={initialTelegramChatId ?? ""}
              placeholder="e.g. 123456789"
              className="mt-2 h-11 w-full max-w-md rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onTest}
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Send test message
            </button>
          </div>
        </form>

        {message ? (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </section>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Email notifications are not enabled in this MVP build.
      </p>
    </div>
  );
}
