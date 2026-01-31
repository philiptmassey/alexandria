"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import DocListItem from "@/app/components/doc-list-item";

type Doc = {
  id: string;
  url: string;
  created_at: string;
  read: boolean;
};

export default function DocsScreen() {
  const [url, setUrl] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const unreadDocs = docs.filter((doc) => !doc.read);
  const readDocs = docs.filter((doc) => doc.read);

  const loadDocs = async () => {
    const response = await fetch("/api/docs", { cache: "no-store" });
    if (response.status === 401) {
      setDocs([]);
      return;
    }
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

  const handleDelete = async (urlToDelete: string) => {
    setDeletingId(urlToDelete);
    setError(null);

    const response = await fetch("/api/docs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlToDelete }),
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

  const handleToggleRead = async (doc: Doc) => {
    setError(null);

    const response = await fetch("/api/docs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, read: !doc.read }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not update document.");
      return;
    }

    await loadDocs();
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Alexandria
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Paper reading list
              </h1>
              <p className="text-base text-zinc-600">
                Save a URL and keep track of everything you want to read next.
              </p>
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

        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Unread</h2>
            {unreadDocs.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing unread.</p>
            ) : (
              <ul className="space-y-3">
                {unreadDocs.map((doc) => (
                  <DocListItem
                    key={doc.id}
                    url={doc.url}
                    createdAt={doc.created_at}
                    isDeleting={deletingId === doc.url}
                    read={doc.read}
                    onDelete={() => handleDelete(doc.url)}
                    onToggleRead={() => handleToggleRead(doc)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Read</h2>
            {readDocs.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing read yet.</p>
            ) : (
              <ul className="space-y-3">
                {readDocs.map((doc) => (
                  <DocListItem
                    key={doc.id}
                    url={doc.url}
                    createdAt={doc.created_at}
                    isDeleting={deletingId === doc.url}
                    read={doc.read}
                    onDelete={() => handleDelete(doc.url)}
                    onToggleRead={() => handleToggleRead(doc)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
