"use client";

import { signOut, useSession } from "next-auth/react";
import AuthSplash from "@/app/components/auth-splash";
import Library from "@/app/components/library";
import ExploreScreen from "@/app/components/explore-screen";
import { useState } from "react";

export default function Home() {
  const { status, data: session } = useSession();
  const [reloadSignal, setReloadSignal] = useState(0);

  if (status !== "authenticated") {
    return <AuthSplash />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Alexandria
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Home
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-600">
              <span className="hidden sm:inline">
                {session?.user?.email ?? session?.user?.name}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="mt-10 grid gap-12 md:grid-cols-2 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ExploreScreen onAdded={() => setReloadSignal((value) => value + 1)} />
          <Library reloadSignal={reloadSignal} />
        </div>
      </main>
    </div>
  );
}
