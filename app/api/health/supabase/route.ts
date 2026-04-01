import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("supabase.auth.getSession failed", error);
      }
      return NextResponse.json(
        { ok: false, hasSession: false },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, hasSession: Boolean(data.session) },
      { status: 200 },
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("supabase health check failed", err);
    }
    return NextResponse.json(
      { ok: false, hasSession: false },
      { status: 500 },
    );
  }
}

