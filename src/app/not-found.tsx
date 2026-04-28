import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24 text-center">
      <h1 className="text-8xl font-black mb-6">404</h1>
      <p className="text-3xl font-bold mb-4">
        This page is about as stable as your production deploy on a Friday. 🔥
      </p>
      <p className="text-[var(--color-muted)] text-xl mb-8">
        It doesn&apos;t exist. Much like your test coverage.
      </p>
      <Link
        href="/"
        className="inline-block bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
      >
        ← Back to Safety
      </Link>
    </div>
  );
}
