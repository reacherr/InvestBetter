import { NextResponse } from "next/server";

import {
  unixSecondsToIso,
  verifyWebhookSignature,
} from "@/lib/razorpay";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type RazorpayWebhookBody = {
  event?: string;
  payload?: unknown;
};

function extractSubscriptionEntity(
  payload: unknown,
): {
  id?: string;
  customer_id?: string;
  status?: string;
  current_end?: number;
} | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const p = payload as Record<string, unknown>;
  const sub = p.subscription;
  if (!sub || typeof sub !== "object") {
    return null;
  }
  const s = sub as Record<string, unknown>;
  const ent = s.entity;
  if (!ent || typeof ent !== "object") {
    return null;
  }
  return ent as {
    id?: string;
    customer_id?: string;
    status?: string;
    current_end?: number;
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, sig)) {
    return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const event = body.event;
  const entity = extractSubscriptionEntity(body.payload);

  if (!entity?.customer_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createServiceRoleClient();

  const { data: row, error: findError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("razorpay_customer_id", entity.customer_id)
    .maybeSingle();

  if (findError) {
    console.error("webhook subscription lookup failed", findError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (!row?.user_id) {
    console.error("No subscription row for Razorpay customer", entity.customer_id);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const userId = row.user_id as string;
  const now = new Date().toISOString();

  try {
    switch (event) {
      case "subscription.activated": {
        const end = unixSecondsToIso(entity.current_end);
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            ...(entity.id ? { razorpay_subscription_id: entity.id } : {}),
            ...(end ? { current_period_end: end } : {}),
            updated_at: now,
          })
          .eq("user_id", userId);
        if (error) {
          console.error(
            `webhook ${event ?? "subscription.activated"} update failed`,
            error.message,
          );
          return NextResponse.json({ ok: false }, { status: 500 });
        }
        break;
      }
      case "subscription.charged": {
        const end = unixSecondsToIso(entity.current_end);
        const { error } = await supabase
          .from("subscriptions")
          .update({
            ...(end ? { current_period_end: end } : {}),
            updated_at: now,
          })
          .eq("user_id", userId);
        if (error) {
          console.error(
            `webhook ${event ?? "subscription.charged"} update failed`,
            error.message,
          );
          return NextResponse.json({ ok: false }, { status: 500 });
        }
        break;
      }
      case "subscription.cancelled":
      case "subscription.halted": {
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            updated_at: now,
          })
          .eq("user_id", userId);
        if (error) {
          console.error(`webhook ${event ?? "subscription"} update failed`, error.message);
          return NextResponse.json({ ok: false }, { status: 500 });
        }
        break;
      }
      case "subscription.completed":
      case "subscription.expired": {
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "expired",
            updated_at: now,
          })
          .eq("user_id", userId);
        if (error) {
          console.error(`webhook ${event ?? "subscription"} update failed`, error.message);
          return NextResponse.json({ ok: false }, { status: 500 });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("webhook handler failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
