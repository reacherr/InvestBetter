import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getPlanId, getRazorpay, RazorpayConfigError } from "@/lib/razorpay";
import { getSubscription, isActiveOrTrial } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeDisplayName(email: string, name: string | null): string {
  const raw = (name && name.trim().length >= 3 ? name.trim() : `User ${email.split("@")[0]}`).slice(
    0,
    50,
  );
  return raw.length >= 3 ? raw : `User ${email.slice(0, 40)}`;
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    redirect("/login");
  }

  const subscription = await getSubscription(user.id);
  if (subscription && isActiveOrTrial(subscription)) {
    redirect("/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email,name")
    .eq("id", user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email;
  const name =
    profile?.name ??
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null);

  const displayName = safeDisplayName(email, name);

  try {
    const planId = getPlanId();
    const rz = getRazorpay();

    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("razorpay_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = subRow?.razorpay_customer_id ?? null;

    if (!customerId) {
      const customer = await rz.customers.create({
        email,
        name: displayName,
        fail_existing: 0,
        notes: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const { error: upErr } = await supabase
        .from("subscriptions")
        .update({
          razorpay_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (upErr) {
        console.error("Failed to store Razorpay customer id", upErr.message);
        return NextResponse.redirect(
          new URL("/subscribe?error=save", origin),
        );
      }
    }

    // SDK types omit fields we pass; cast matches Razorpay dashboard subscription create API.
    const rzSub = await rz.subscriptions.create({
      plan_id: planId,
      customer_id: customerId,
      customer_notify: 1,
      total_count: 120,
      quantity: 1,
      notes: { supabase_user_id: user.id },
    } as never);

    if (!rzSub.short_url) {
      console.error("Razorpay subscription missing short_url", rzSub.id);
      return NextResponse.redirect(
        new URL("/subscribe?error=razorpay", origin),
      );
    }

    const { error: subUpErr } = await supabase
      .from("subscriptions")
      .update({
        razorpay_subscription_id: rzSub.id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (subUpErr) {
      console.error("Failed to store subscription id", subUpErr.message);
      return NextResponse.redirect(
        new URL("/subscribe?error=save", origin),
      );
    }

    return NextResponse.redirect(rzSub.short_url);
  } catch (e) {
    if (e instanceof RazorpayConfigError) {
      return NextResponse.redirect(
        new URL("/subscribe?error=config", origin),
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("subscribe checkout failed", msg);
    return NextResponse.redirect(
      new URL("/subscribe?error=razorpay", origin),
    );
  }
}
