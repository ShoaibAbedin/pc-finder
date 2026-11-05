import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
        Back to For You
      </Link>
    </div>
  );
}
