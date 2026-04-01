import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Subscription = {
  id: string;
  user_id: string;
  status: string | null;
  trial_ends_at: string | null;
};

export async function getSubscription(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,user_id,status,trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Subscription | null;
}

export function isActiveOrTrial(subscription: Subscription | null) {
  if (!subscription) return false;

  if (subscription.status === "active") return true;

  if (subscription.status === "trial") {
    if (!subscription.trial_ends_at) return false;
    return new Date(subscription.trial_ends_at).getTime() > Date.now();
  }

  return false;
}
