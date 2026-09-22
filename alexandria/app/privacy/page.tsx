import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="content-page">
      <main>
        <header>
          <Link href="/" className="brand"><span className="brand-mark">A</span><span>Alexandria</span></Link>
          <h1>Privacy</h1>
        </header>
        <section>
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
