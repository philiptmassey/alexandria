"use client";

import { useEffect, useState } from "react";
import Doc from "@/app/components/doc";
import { DOCS_PAGE_SIZE } from "@/lib/constants";

export type LibraryDoc = {
  id: string;
  url: string;
  title?: string;
  created_at: string;
  read: boolean;
  read_at: string | null;
};

type LibrarySectionProps = {
  title: string;
  docs: LibraryDoc[];
  emptyMessage: string;
  deletingId: string | null;
  onDelete: (url: string) => void;
  onToggleRead: (doc: LibraryDoc) => void;
};

export default function LibrarySection({
  title,
  docs,
  emptyMessage,
  deletingId,
  onDelete,
  onToggleRead,
}: LibrarySectionProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(docs.length / DOCS_PAGE_SIZE));
  const sliceStart = (page - 1) * DOCS_PAGE_SIZE;
  const pagedDocs = docs.slice(sliceStart, sliceStart + DOCS_PAGE_SIZE);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {docs.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {pagedDocs.map((doc) => (
              <Doc
                key={doc.id}
                title={doc.title}
                url={doc.url}
                createdAt={doc.created_at}
                readAt={doc.read_at}
                isDeleting={deletingId === doc.url}
                read={doc.read}
                onDelete={() => onDelete(doc.url)}
                onToggleRead={() => onToggleRead(doc)}
              />
            ))}
          </ul>
          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage((currentPage) => Math.max(1, currentPage - 1))
                  }
                  disabled={page === 1}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-semibold uppercase tracking-wide text-zinc-600 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.min(totalPages, currentPage + 1)
                    )
                  }
                  disabled={page === totalPages}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-semibold uppercase tracking-wide text-zinc-600 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
