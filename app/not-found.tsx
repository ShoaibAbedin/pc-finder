import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="display text-6xl">Not found</h1>
      <Link href="/" className="btn btn-primary mt-8">
        Back to For You
      </Link>
    </div>
  );
}
