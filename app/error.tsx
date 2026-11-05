"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">Couldn&apos;t load deals. The database may be waking up — try again.</p>
      {error.digest && <p className="mt-1 text-xs text-muted">Ref: {error.digest}</p>}
      <button onClick={reset} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted-bg">
        Try again
      </button>
    </div>
  );
}
