import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", user.id)
    .maybeSingle();

  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Notifications and account preferences.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mt-8">
        <SettingsClient
          initialTelegramChatId={profile?.telegram_chat_id ?? null}
          botUsername={botUsername}
        />
      </div>
    </main>
  );
}
