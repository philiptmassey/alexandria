"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Doc from "@/app/components/doc";
import type { DocsPage, LibraryStatus } from "@/lib/docs";
import type { ApiDoc } from "@/lib/docsSchema";

type LibraryProps = {
  initialPage: DocsPage;
  userLabel: string;
};

type ToastState = {
  message: string;
  actionLabel?: string;
  action?: () => Promise<void>;
};

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="6" />
    <path d="m16 16 4 4" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
  </svg>
);

const responseJson = async <T,>(response: Response): Promise<T> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Something went wrong.");
  }
  return payload as T;
};

export default function Library({ initialPage, userLabel }: LibraryProps) {
  const [status, setStatus] = useState<LibraryStatus>("unread");
  const [docs, setDocs] = useState(initialPage.docs);
  const [counts, setCounts] = useState(initialPage.counts);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [url, setUrl] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadDocuments = async ({
    nextStatus = status,
    nextQuery = query,
    cursor = null,
    append = false,
  }: {
    nextStatus?: LibraryStatus;
    nextQuery?: string;
    cursor?: string | null;
    append?: boolean;
  } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: nextStatus });
      if (nextQuery) params.set("q", nextQuery);
      if (cursor) params.set("cursor", cursor);
      const page = await responseJson<DocsPage>(
        await fetch(`/api/docs?${params.toString()}`, { cache: "no-store" }),
      );
      setDocs((current) => (append ? [...current, ...page.docs] : page.docs));
      setCounts(page.counts);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your library.");
    } finally {
      setIsLoading(false);
    }
  };

  const changeStatus = (nextStatus: LibraryStatus) => {
    setStatus(nextStatus);
    void loadDocuments({ nextStatus });
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = searchDraft.trim();
    setQuery(nextQuery);
    void loadDocuments({ nextQuery });
  };

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await responseJson<{ doc: ApiDoc; duplicate: boolean }>(
        await fetch("/api/docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }),
      );
      setUrl("");
      setToast({
        message: result.duplicate
          ? "That item is already in your library."
          : "Saved to your unread library.",
      });
      await loadDocuments();
      if (!result.duplicate) {
        window.setTimeout(() => void loadDocuments(), 2500);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save that URL.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRead = async (doc: ApiDoc) => {
    const nextRead = !doc.read;
    const previousDocs = docs;
    const previousCounts = counts;
    setBusyId(doc.id);
    setDocs((current) =>
      current
        .map((item) =>
          item.id === doc.id
            ? {
                ...item,
                read: nextRead,
                read_at: nextRead ? new Date().toISOString() : null,
              }
            : item,
        )
        .filter((item) =>
          status === "all" ? true : status === "read" ? item.read : !item.read,
        ),
    );
    setCounts((current) => ({
      ...current,
      unread: Math.max(0, current.unread + (nextRead ? -1 : 1)),
      read: Math.max(0, current.read + (nextRead ? 1 : -1)),
    }));

    try {
      await responseJson(
        await fetch("/api/docs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: doc.id, read: nextRead }),
        }),
      );
    } catch (updateError) {
      setDocs(previousDocs);
      setCounts(previousCounts);
      setError(updateError instanceof Error ? updateError.message : "Could not update the item.");
    } finally {
      setBusyId(null);
    }
  };

  const handleTitleChange = async (doc: ApiDoc, title: string) => {
    setBusyId(doc.id);
    try {
      const result = await responseJson<{ doc: ApiDoc }>(
        await fetch("/api/docs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: doc.id, title }),
        }),
      );
      setDocs((current) =>
        current.map((item) => (item.id === doc.id ? result.doc : item)),
      );
      setToast({ message: "Title updated." });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update the title.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = async (doc: ApiDoc) => {
    setBusyId(doc.id);
    try {
      await responseJson(
        await fetch("/api/docs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: doc.id }),
        }),
      );
      setDocs((current) =>
        current.map((item) =>
          item.id === doc.id
            ? { ...item, metadata_status: "pending", metadata_error: null }
            : item,
        ),
      );
      setToast({ message: "Metadata refresh scheduled." });
      window.setTimeout(() => void loadDocuments(), 2500);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Could not retry metadata.");
    } finally {
      setBusyId(null);
    }
  };

  const restoreDocument = async (doc: ApiDoc) => {
    await responseJson(
      await fetch("/api/docs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, restore: true }),
      }),
    );
    setToast({ message: "Item restored." });
    await loadDocuments();
  };

  const handleDelete = async (doc: ApiDoc) => {
    const previousDocs = docs;
    const previousCounts = counts;
    setBusyId(doc.id);
    setDocs((current) => current.filter((item) => item.id !== doc.id));
    setCounts((current) => ({
      all: Math.max(0, current.all - 1),
      unread: Math.max(0, current.unread - (doc.read ? 0 : 1)),
      read: Math.max(0, current.read - (doc.read ? 1 : 0)),
    }));
    try {
      await responseJson(
        await fetch("/api/docs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: doc.id }),
        }),
      );
      setToast({
        message: "Removed from your library.",
        actionLabel: "Undo",
        action: () => restoreDocument(doc),
      });
    } catch (deleteError) {
      setDocs(previousDocs);
      setCounts(previousCounts);
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove the item.");
    } finally {
      setBusyId(null);
    }
  };

  const views: Array<{ key: LibraryStatus; label: string; count: number }> = [
    { key: "unread", label: "Unread", count: counts.unread },
    { key: "read", label: "Read", count: counts.read },
    { key: "all", label: "All items", count: counts.all },
  ];

  const heading = status === "read" ? "Read" : status === "all" ? "All items" : "Unread reading";
  const subheading = query
    ? `Results for “${query}”`
    : status === "unread"
      ? `${counts.unread} piece${counts.unread === 1 ? "" : "s"} waiting for you`
      : status === "read"
        ? `${counts.read} piece${counts.read === 1 ? "" : "s"} completed`
        : `${counts.all} saved piece${counts.all === 1 ? "" : "s"}`;

  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>Alexandria</span>
        </div>
        <form className="header-search" onSubmit={submitSearch} role="search">
          <SearchIcon />
          <label className="sr-only" htmlFor="library-search">Search your library</label>
          <input
            id="library-search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search your library"
          />
          {query ? (
            <button
              type="button"
              className="clear-search"
              onClick={() => {
                setSearchDraft("");
                setQuery("");
                void loadDocuments({ nextQuery: "" });
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
        <details className="account-menu">
          <summary aria-label="Account menu">{userLabel.slice(0, 2).toUpperCase()}</summary>
          <div>
            <span>{userLabel}</span>
            <button type="button" onClick={() => signOut()}>Sign out</button>
          </div>
        </details>
      </header>

      <div className="library-shell">
        <aside className="library-sidebar">
          <nav aria-label="Library views">
            {views.map((view) => (
              <button
                key={view.key}
                type="button"
                className={status === view.key ? "active" : ""}
                aria-current={status === view.key ? "page" : undefined}
                onClick={() => changeStatus(view.key)}
              >
                <span>{view.label}</span>
                <span>{view.count}</span>
              </button>
            ))}
          </nav>
          <p>A quiet home for papers and essays you intend to return to.</p>
        </aside>

        <main className="library-main">
          <form className="capture-form" onSubmit={handleAdd}>
            <LinkIcon />
            <label className="sr-only" htmlFor="capture-url">Paper or article URL</label>
            <input
              id="capture-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a paper or article URL…"
              required
            />
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save to library"}
            </button>
          </form>

          {error ? <div className="error-banner" role="alert">{error}</div> : null}

          <div className="library-heading">
            <div>
              <h1>{heading}</h1>
              <p>{subheading}</p>
            </div>
            <span>Newest first ↓</span>
          </div>

          <section className={`library-list ${isLoading ? "is-loading" : ""}`} aria-busy={isLoading}>
            {docs.length === 0 && !isLoading ? (
              <div className="empty-library">
                <h2>{query ? "No matching reading" : status === "unread" ? "Your queue is clear" : "Nothing here yet"}</h2>
                <p>{query ? "Try another title, URL, or source." : "Paste a link above whenever you find something worth returning to."}</p>
              </div>
            ) : (
              docs.map((doc) => (
                <Doc
                  key={doc.id}
                  doc={doc}
                  busy={busyId === doc.id}
                  onDelete={handleDelete}
                  onRetry={handleRetry}
                  onTitleChange={handleTitleChange}
                  onToggleRead={handleToggleRead}
                />
              ))
            )}
          </section>

          {nextCursor ? (
            <button
              type="button"
              className="load-more"
              disabled={isLoading}
              onClick={() => void loadDocuments({ cursor: nextCursor, append: true })}
            >
              {isLoading ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </main>
      </div>

      {toast ? (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.action && toast.actionLabel ? (
            <button
              type="button"
              onClick={() => {
                const action = toast.action;
                setToast(null);
                void action?.();
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
