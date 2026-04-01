import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();

    return NextResponse.json(
      { ok: true, hasSession: Boolean(data.session) },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, hasSession: false },
      { status: 500 },
    );
  }
}

