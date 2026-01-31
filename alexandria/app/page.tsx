"use client";

import { useEffect, useState } from "react";

type Doc = {
  id: string;
  url: string;
  username: string;
  created_at: string;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocs = async () => {
    const response = await fetch("/api/docs", { cache: "no-store" });
    const data = await response.json();
    setDocs(Array.isArray(data.docs) ? data.docs : []);
  };

  useEffect(() => {
    loadDocs().catch(() => {
      setError("Could not load documents.");
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a URL.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const response = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Something went wrong.");
      setIsSaving(false);
      return;
    }

    setUrl("");
    await loadDocs();
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);

    const response = await fetch("/api/docs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not delete document.");
      setDeletingId(null);
      return;
    }

    await loadDocs();
    setDeletingId(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Alexandria
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Paper reading list
          </h1>
          <p className="text-base text-zinc-600">
            Save a URL and keep track of everything you want to read next.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/paper"
            type="url"
            required
            className="h-12 flex-1 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="h-12 rounded-lg bg-zinc-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Add URL"}
          </button>
        </form>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Saved documents</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-zinc-500">No documents yet.</p>
          ) : (
            <ul className="space-y-3">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {doc.url}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Added{" "}
                      {new Date(doc.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete document"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 7h16" />
                      <path d="M9 7v-.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V7" />
                      <path d="M7 7l.7 10.3A2 2 0 0 0 9.7 19h4.6a2 2 0 0 0 2-1.7L17 7" />
                      <path d="M10 11v5" />
                      <path d="M14 11v5" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
