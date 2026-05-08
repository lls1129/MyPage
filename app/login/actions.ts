"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminEmail, readSupabaseEnv } from "@/lib/supabase/env";

// Step 1: user submits email; we ask Supabase to email them an OTP code.
// We deliberately omit `emailRedirectTo` so the email focuses on the code
// rather than a link (Gmail desktop pre-scans links and consumes them).
export async function requestOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/admin");

  if (!email) {
    redirect(`/login?error=${encodeURIComponent("Please enter an email.")}`);
  }

  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Admin email isn't configured. Set ADMIN_EMAIL on the server."
      )}`
    );
  }

  if (email !== adminEmail) {
    redirect(
      `/login?error=${encodeURIComponent("That email isn't on the allow list.")}`
    );
  }

  const { configured } = readSupabaseEnv();
  if (!configured) {
    redirect(
      `/login?error=${encodeURIComponent("Supabase isn't configured yet.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const params = new URLSearchParams({ stage: "verify", email, next });
  redirect(`/login?${params.toString()}`);
}

// Step 2: user types the 6-digit code from the email; we verify it.
// Successful verification sets the auth cookie via the SSR client.
export async function verifyOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const tokenRaw = String(formData.get("token") ?? "").trim();
  const token = tokenRaw.replace(/\s/g, "");
  const next = String(formData.get("next") ?? "/admin");

  if (!email || !token) {
    const params = new URLSearchParams({
      stage: "verify",
      email,
      next,
      error: "Please enter the code from your email.",
    });
    redirect(`/login?${params.toString()}`);
  }

  const adminEmail = getAdminEmail();
  if (!adminEmail || email !== adminEmail) {
    redirect(
      `/login?error=${encodeURIComponent("That email isn't on the allow list.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    const params = new URLSearchParams({
      stage: "verify",
      email,
      next,
      error: error.message,
    });
    redirect(`/login?${params.toString()}`);
  }

  redirect(next || "/admin");
}
