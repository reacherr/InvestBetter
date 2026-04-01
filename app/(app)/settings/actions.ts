"use server";

import { revalidatePath } from "next/cache";

import { sendTelegramMessage } from "@/lib/telegram";
import { createClient } from "@/lib/supabase/server";

export async function saveTelegramChatId(formData: FormData) {
  const raw = formData.get("telegram_chat_id");
  const chatId =
    typeof raw === "string" ? raw.trim() || null : raw != null ? String(raw).trim() || null : null;

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ telegram_chat_id: chatId })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function sendTelegramTest() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const chatId = profile?.telegram_chat_id?.trim();
  if (!chatId) {
    throw new Error("Save your Telegram chat ID first.");
  }

  await sendTelegramMessage(
    chatId,
    "InvestBetter: test notification. If you see this, Telegram is set up correctly.",
  );
}
