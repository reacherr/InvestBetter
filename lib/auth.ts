import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

type ProvisioningResult = {
  hasSipConfig: boolean;
};

export async function ensureFirstLoginProvisioning(
  supabase: SupabaseClient,
  user: User,
): Promise<ProvisioningResult> {
  if (!user.email) {
    throw new Error("User email missing from auth profile");
  }

  const userId = user.id;

  const { error: profileUpsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: user.email,
      name:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
    },
    { onConflict: "id" },
  );

  if (profileUpsertError) {
    throw profileUpsertError;
  }

  const { data: existingSubscription, error: subscriptionSelectError } =
    await supabase
      .from("subscriptions")
      .select("id,status,trial_ends_at")
      .eq("user_id", userId)
      .maybeSingle();

  if (subscriptionSelectError) {
    throw subscriptionSelectError;
  }

  if (!existingSubscription) {
    const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const { error: subscriptionInsertError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        status: "trial",
        trial_ends_at: trialEndsAt.toISOString(),
      });

    if (subscriptionInsertError) {
      // Handle select-then-insert race: unique(user_id) may already exist.
      // Postgres unique violation is 23505.
      if (
        typeof subscriptionInsertError === "object" &&
        subscriptionInsertError !== null &&
        "code" in subscriptionInsertError &&
        subscriptionInsertError.code === "23505"
      ) {
        // Another request created it first; safe to proceed.
      } else {
        throw subscriptionInsertError;
      }
    }
  }

  const { data: sipConfig, error: sipConfigSelectError } = await supabase
    .from("sip_configs")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (sipConfigSelectError) {
    throw sipConfigSelectError;
  }

  return { hasSipConfig: Boolean(sipConfig) };
}

export function getPostLoginDestination(result: ProvisioningResult) {
  return result.hasSipConfig ? "/dashboard" : "/configure";
}

