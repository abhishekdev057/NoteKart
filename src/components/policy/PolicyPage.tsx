import Link from "next/link";

type PolicyPageProps = {
  title: string;
  updated: string;
  children: React.ReactNode;
};

export function PolicyPage({ title, updated, children }: PolicyPageProps) {
  return (
    <main className="policy-page">
      <section className="policy-card">
        <Link href="/" className="policy-brand">
          NoteKart
        </Link>
        <p className="policy-kicker">Last updated: {updated}</p>
        <h1>{title}</h1>
        <div className="policy-content">{children}</div>
      </section>
    </main>
  );
}
