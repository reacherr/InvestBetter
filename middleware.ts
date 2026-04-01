import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Server misconfigured", { status: 500 });
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    response = NextResponse.redirect(loginUrl);
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/configure/:path*",
    "/settings/:path*",
    "/history/:path*",
    "/backtest/:path*",
  ],
};

