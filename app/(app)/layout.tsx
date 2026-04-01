import { redirect } from "next/navigation";

import { getSubscription, isActiveOrTrial } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthedPaywalledLayout>{children}</AuthedPaywalledLayout>;
}

async function AuthedPaywalledLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const subscription = await getSubscription(session.user.id);
  if (!isActiveOrTrial(subscription)) {
    redirect("/subscribe");
  }

  return <div className="flex min-h-screen flex-col">{children}</div>;
}

