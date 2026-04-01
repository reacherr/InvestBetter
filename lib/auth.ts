import type { SupabaseClient } from "@supabase/supabase-js";

type ProvisioningResult = {
  hasSipConfig: boolean;
};

export async function ensureFirstLoginProvisioning(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProvisioningResult> {
  const { data: existingProfile, error: profileSelectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileSelectError) {
    throw profileSelectError;
  }

  if (!existingProfile) {
    const { error: profileInsertError } = await supabase
      .from("profiles")
      .insert({ id: userId });

    if (profileInsertError) {
      throw profileInsertError;
    }
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
      throw subscriptionInsertError;
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

