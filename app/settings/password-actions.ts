"use server";

import { createServiceClient } from "@/lib/db/client";
import { MIN_PASSWORD_LENGTH, setSitePassword } from "@/lib/password";

export async function changePassword(_prev: { ok: boolean; message: string } | null, form: FormData) {
  const pw = String(form.get("password") ?? "");
  const again = String(form.get("confirm") ?? "");
  if (pw.length < MIN_PASSWORD_LENGTH) return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (pw !== again) return { ok: false, message: "The two passwords don't match." };
  try {
    await setSitePassword(createServiceClient(), pw);
    return { ok: true, message: "Password changed. Devices already signed in stay signed in." };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
