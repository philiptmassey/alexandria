"use client";

import { signIn } from "next-auth/react";

export default function AuthSplash() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Alexandria
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Reading Organization
        </h1>
        <p className="text-base text-zinc-600">
          Sign in with Google to save and track your reading queue.
        </p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-zinc-800"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 48 48"
            className="h-4 w-4"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.7 1.22 9.18 3.62l6.8-6.8C35.94 2.32 30.36 0 24 0 14.6 0 6.52 5.4 2.56 13.24l7.92 6.16C12.4 13.34 17.7 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.1 24.55c0-1.68-.15-3.3-.43-4.86H24v9.2h12.44c-.54 2.9-2.16 5.36-4.6 7.02l7.04 5.44C43.06 37.1 46.1 31.3 46.1 24.55z"
            />
            <path
              fill="#FBBC05"
              d="M10.48 28.56a14.5 14.5 0 0 1 0-9.12l-7.92-6.16A23.98 23.98 0 0 0 0 24c0 3.88.94 7.54 2.56 10.72l7.92-6.16z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.92-2.14 15.9-5.8l-7.04-5.44c-1.94 1.3-4.44 2.06-8.86 2.06-6.3 0-11.6-3.84-13.52-9.4l-7.92 6.16C6.52 42.6 14.6 48 24 48z"
            />
          </svg>
          Sign in with Google
        </button>
      </main>
    </div>
  );
}
