import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
        <p className="text-slate-500 mb-6">Page not found</p>
        <Link href="/" className="text-blue-600 font-medium hover:text-blue-700">
          Go back home
        </Link>
      </div>
    </div>
  );
}
