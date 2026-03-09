'use client'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">Login to JadiSatu</h1>
        <p className="text-gray-500 text-center text-sm">
          Configure Supabase credentials to enable authentication.
        </p>
      </div>
    </main>
  )
}
