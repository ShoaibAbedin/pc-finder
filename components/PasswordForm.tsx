"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/settings/password-actions";

export function PasswordForm() {
  const [res, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="rounded-2xl bg-surface p-5 text-sm">
      <p className="eyebrow">Change site password</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input name="password" type="password" autoComplete="new-password" required placeholder="New password" aria-label="New password" className="field flex-1" />
        <input name="confirm" type="password" autoComplete="new-password" required placeholder="Type it again" aria-label="Confirm password" className="field flex-1" />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          Save
        </button>
      </div>
      {res && <p className={`mt-3 ${res.ok ? "text-green-700" : "text-red-700"}`}>{res.message}</p>}
    </form>
  );
}
