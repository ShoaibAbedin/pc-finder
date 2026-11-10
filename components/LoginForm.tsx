const ERRORS: Record<string, string> = {
  wrong: "Wrong password.",
  too_many: "Too many wrong tries. Wait 15 minutes and try again.",
  not_set: "No password has been set yet.",
  config: "The site isn't configured yet (SITE_KEY missing).",
  "1": "That unlock link isn't valid. Use your password instead.",
};

/** Plain HTML form (works without JavaScript) posting to /login. */
export function LoginForm({ error }: { error?: string }) {
  const msg = error ? (ERRORS[error] ?? "Something went wrong.") : null;
  return (
    <form method="post" action="/login" className="mt-8 flex w-full flex-col gap-3">
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        placeholder="Password"
        aria-label="Password"
        className="field text-center"
      />
      <button type="submit" className="btn btn-primary">
        Enter
      </button>
      {msg && (
        <p role="alert" className="text-sm text-red-700">
          {msg}
        </p>
      )}
      <p className="text-xs text-muted">You&apos;ll stay signed in on this device.</p>
    </form>
  );
}
