"use client";

import { useEffect, useState } from "react";
import DocsSection, { type Doc } from "@/app/components/docs-section";

type DocsScreenProps = {
  reloadSignal?: number;
};

export default function DocsScreen({ reloadSignal = 0 }: DocsScreenProps) {
  const [url, setUrl] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  }, [reloadSignal]);

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
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Library
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">Reading list</h2>
        <p className="text-sm text-zinc-600">
          Manage your saved articles and mark them as read.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/paper"
          type="url"
          required
          className="h-12 min-h-[3rem] flex-1 appearance-none rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-900 shadow-sm outline-none transition focus:border-zinc-400 sm:text-sm"
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
        <DocsSection
          title="Unread"
          docs={unreadDocs}
          emptyMessage="Nothing unread."
          deletingId={deletingId}
          onDelete={handleDelete}
          onToggleRead={handleToggleRead}
        />

        <DocsSection
          title="Read"
          docs={readDocs}
          emptyMessage="Nothing read yet."
          deletingId={deletingId}
          onDelete={handleDelete}
          onToggleRead={handleToggleRead}
        />
      </section>
    </section>
  );
}
