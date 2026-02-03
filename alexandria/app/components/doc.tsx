"use client";

type DocProps = {
  title?: string;
  url: string;
  createdAt: string;
  readAt: string | null;
  isDeleting: boolean;
  read: boolean;
  onDelete: () => void;
  onToggleRead: () => void;
};

export default function Doc({
  title,
  url,
  createdAt,
  readAt,
  isDeleting,
  read,
  onDelete,
  onToggleRead,
}: DocProps) {
  const displayTitle = title?.trim();
  const showTitle = Boolean(displayTitle);
  const readDate = readAt ? new Date(readAt) : null;
  const showReadAt =
    read && readDate !== null && !Number.isNaN(readDate.getTime());
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        {showTitle ? (
          <p className="text-sm font-semibold text-zinc-900 sm:truncate">
            {displayTitle}
          </p>
        ) : null}
        <p
          className={`break-all sm:truncate ${
            showTitle
              ? "text-xs text-zinc-500"
              : "text-sm font-medium text-zinc-900"
          }`}
        >
          {url}
        </p>
        <p className="text-xs text-zinc-500">
          Added{" "}
          {new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        {showReadAt && readDate ? (
          <p className="text-xs text-zinc-500">
            Read{" "}
            {readDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 self-start sm:shrink-0">
        <button
          type="button"
          aria-label={read ? "Mark as unread" : "Mark as read"}
          onClick={onToggleRead}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
            read
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
          }`}
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
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open document"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-100"
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
            <path d="M14 4h6v6" />
            <path d="M10 14L20 4" />
            <path d="M20 14v6h-6" />
            <path d="M4 10v10h10" />
          </svg>
        </a>
        <button
          type="button"
          aria-label="Delete document"
          onClick={onDelete}
          disabled={isDeleting}
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
      </div>
    </li>
  );
}
