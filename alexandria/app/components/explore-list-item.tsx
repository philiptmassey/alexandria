"use client";

type ExploreListItemProps = {
  title: string;
  url: string;
  publishedAt: string;
  onAdd: () => void;
  isAdding: boolean;
};

export default function ExploreListItem({
  title,
  url,
  publishedAt,
  onAdd,
  isAdding,
}: ExploreListItemProps) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <p className="break-words text-sm font-medium text-zinc-900 sm:truncate">
          {title}
        </p>
        <p className="break-all text-xs text-zinc-500 sm:truncate">{url}</p>
        <p className="text-xs text-zinc-500">
          Published{" "}
          {new Date(publishedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
      <button
        type="button"
        aria-label="Add to reading list"
        onClick={onAdd}
        disabled={isAdding}
        className="self-start inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
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
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
    </li>
  );
}
