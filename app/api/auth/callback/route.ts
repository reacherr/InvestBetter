import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { ensureFirstLoginProvisioning } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = createClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  if (exchangeError) {
    if (process.env.NODE_ENV !== "production") {
      console.error("exchangeCodeForSession failed", exchangeError);
    }
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (process.env.NODE_ENV !== "production") {
      console.error("supabase.auth.getUser failed", userError);
    }
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  try {
    const provisioning = await ensureFirstLoginProvisioning(supabase, user.id);
    const destination = provisioning.hasSipConfig ? "/dashboard" : "/configure";
    return NextResponse.redirect(new URL(destination, url.origin));
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("first-login provisioning failed", err);
    }
    return NextResponse.redirect(new URL("/login", url.origin));
  }
}

