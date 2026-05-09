import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { getAdminEmail } from "./supabase/env";

// Throws-via-redirect if the caller isn't the admin. Use at the top of every
// admin Server Action so it can't be invoked from outside the admin session.
export async function requireAdmin(redirectTo = "/login") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = getAdminEmail();
  if (!user || !adminEmail || user.email?.toLowerCase() !== adminEmail) {
    redirect(`${redirectTo}?next=/admin`);
  }
  return { id: user.id, email: user.email! };
}
