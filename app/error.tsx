"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-24 text-center">
      <h1 className="display text-5xl">Something went wrong</h1>
      <p className="mt-4 text-sm text-muted">Couldn&apos;t load deals. The database may be waking up — try again.</p>
      {error.digest && <p className="mt-1 text-xs text-muted">Ref: {error.digest}</p>}
      <button onClick={reset} className="btn btn-primary mt-8">
        Try again
      </button>
    </div>
  );
}
