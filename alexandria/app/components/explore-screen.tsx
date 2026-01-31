"use client";

import { useMemo, useState } from "react";
import ExploreListItem from "@/app/components/explore-list-item";

type ExploreItem = {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
};

type ExploreScreenProps = {
  onAdded?: () => void;
};

export default function ExploreScreen({ onAdded }: ExploreScreenProps) {
  const [rssUrl, setRssUrl] = useState("");
  const [exploreItems, setExploreItems] = useState<ExploreItem[]>([]);
  const [isExploring, setIsExploring] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const exploreCount = useMemo(
    () => exploreItems.length,
    [exploreItems.length],
  );

  const handleExploreSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const trimmed = rssUrl.trim();
    if (!trimmed) {
      setExploreError("Please enter an RSS URL.");
      return;
    }

    setIsExploring(true);
    setExploreError(null);

    const response = await fetch("/api/explore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setExploreError(data?.error ?? "Could not load RSS feed.");
      setIsExploring(false);
      return;
    }

    const data = await response.json().catch(() => null);
    setExploreItems(Array.isArray(data?.items) ? data.items : []);
    setIsExploring(false);
  };

  const handleAddExploreItem = async (item: ExploreItem) => {
    setAddingUrl(item.url);

    const response = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: item.url }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setExploreError(data?.error ?? "Could not save document.");
      setAddingUrl(null);
      return;
    }

    setExploreItems((current) =>
      current.filter((entry) => entry.url !== item.url),
    );
    setAddingUrl(null);
    onAdded?.();
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Explore
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Last 24 hours
        </h2>
        <p className="text-sm text-zinc-600">
          Paste an RSS URL to discover fresh articles. Results reset when you
          refresh.
        </p>
      </div>

      <form
        onSubmit={handleExploreSubmit}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={rssUrl}
          onChange={(event) => setRssUrl(event.target.value)}
          placeholder="https://example.com/rss.xml"
          type="url"
          required
          className="h-12 flex-1 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-400"
        />
        <button
          type="submit"
          disabled={isExploring}
          className="h-12 rounded-lg bg-zinc-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isExploring ? "Scanning..." : "Scan feed"}
        </button>
      </form>

      {exploreError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exploreError}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Fresh results</span>
          <span>{exploreCount} found</span>
        </div>
        {exploreItems.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No recent items yet. Try another feed.
          </p>
        ) : (
          <ul className="space-y-3">
            {exploreItems.map((item) => (
              <ExploreListItem
                key={item.id}
                title={item.title}
                url={item.url}
                publishedAt={item.publishedAt}
                isAdding={addingUrl === item.url}
                onAdd={() => handleAddExploreItem(item)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
