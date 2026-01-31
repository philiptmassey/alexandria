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
          Paper reading list
        </h1>
        <p className="text-base text-zinc-600">
          Sign in with Google to save and track your reading queue.
        </p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="rounded-full bg-zinc-900 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-zinc-800"
        >
          Sign in with Google
        </button>
      </main>
    </div>
  );
}
