export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Alexandria
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Privacy
          </h1>
        </header>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-zinc-700">
          <p>
            Alexandria stores the URLs you save, along with basic metadata like
            title and timestamps, so you can manage your unread queue.
          </p>
          <p>
            Your data is used only to provide the service and is not sold to
            third parties.
          </p>
          <p>
            If you have questions about privacy, contact the site owner or
            administrator.
          </p>
        </section>
      </main>
    </div>
  );
}
