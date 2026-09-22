"use client";

import { useState } from "react";
import type { ApiDoc } from "@/lib/docsSchema";

type DocProps = {
  doc: ApiDoc;
  busy: boolean;
  onDelete: (doc: ApiDoc) => Promise<void>;
  onRetry: (doc: ApiDoc) => Promise<void>;
  onTitleChange: (doc: ApiDoc, title: string) => Promise<void>;
  onToggleRead: (doc: ApiDoc) => Promise<void>;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

const ExternalIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 5h5v5M11 13l8-8M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
);

export default function Doc({
  doc,
  busy,
  onDelete,
  onRetry,
  onTitleChange,
  onToggleRead,
}: DocProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(doc.title ?? "");
  const title = doc.title?.trim();
  const titleLabel = title
    ? title
    : doc.metadata_status === "pending"
      ? "Fetching title…"
      : "Untitled resource";
  const sourceMark = (doc.domain[0] ?? "A").toUpperCase();

  const saveTitle = async () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) return;
    await onTitleChange(doc, nextTitle);
    setIsEditing(false);
  };

  return (
    <article className="library-item">
      <div className="source-mark" aria-hidden="true">
        {doc.domain === "arxiv.org" ? "arX" : sourceMark}
      </div>

      <div className="item-content">
        {isEditing ? (
          <form
            className="title-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void saveTitle();
            }}
          >
            <label className="sr-only" htmlFor={`title-${doc.id}`}>
              Document title
            </label>
            <input
              id={`title-${doc.id}`}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              autoFocus
            />
            <button type="submit" className="text-button" disabled={busy}>
              Save
            </button>
            <button
              type="button"
              className="text-button muted"
              onClick={() => {
                setDraftTitle(doc.title ?? "");
                setIsEditing(false);
              }}
            >
              Cancel
            </button>
          </form>
        ) : !title && doc.metadata_status === "failed" ? (
          <button
            type="button"
            className="item-title item-title-pending item-title-button"
            onClick={() => {
              setDraftTitle("");
              setIsEditing(true);
            }}
          >
            {titleLabel}
          </button>
        ) : (
          <a
            className={`item-title ${!title ? "item-title-pending" : ""}`}
            href={doc.url}
            target="_blank"
            rel="noreferrer"
          >
            {titleLabel}
          </a>
        )}
        <div className="item-meta">
          <span>{doc.domain}</span>
          <span>Added {formatDate(doc.created_at)}</span>
          {doc.read && doc.read_at ? (
            <span>Read {formatDate(doc.read_at)}</span>
          ) : null}
          {doc.metadata_status === "failed" ? (
            <span className="metadata-failed">Metadata unavailable</span>
          ) : null}
          {doc.title_source === "manual" ? <span>Edited title</span> : null}
        </div>
      </div>

      <div className="item-actions">
        <button
          type="button"
          className="read-button"
          disabled={busy}
          onClick={() => void onToggleRead(doc)}
        >
          {doc.read ? "Mark unread" : "Mark read"}
        </button>
        <a
          className="icon-button"
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${titleLabel}`}
        >
          <ExternalIcon />
        </a>
        <details className="item-menu">
          <summary className="icon-button" aria-label={`More actions for ${titleLabel}`}>
            <MoreIcon />
          </summary>
          <div className="item-menu-popover">
            <button
              type="button"
              aria-label={`Edit title for ${titleLabel}`}
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                setDraftTitle(doc.title ?? "");
                setIsEditing(true);
              }}
            >
              Edit title
            </button>
            {doc.metadata_status === "failed" && doc.title_source !== "manual" ? (
              <button
                type="button"
                aria-label={`Retry metadata for ${titleLabel}`}
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  void onRetry(doc);
                }}
              >
                Retry metadata
              </button>
            ) : null}
            <button
              type="button"
              className="danger-action"
              aria-label={`Remove ${titleLabel}`}
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                void onDelete(doc);
              }}
            >
              Remove
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}
