import { Link } from "react-router-dom";

const what = [
  ["Collect", "Local contributors receive sampling points and submit geotagged observations with evidence."],
  ["Verify", "Spatial and AI-assisted checks flag problems. A human reviewer makes the final decision."],
  ["Pay", "Approved work is paid out on Solana, with a transaction record anyone can check."],
];
const steps = [
  "An organization defines what it needs to know and where.",
  "It funds the campaign on Solana. The funding is verified on-chain.",
  "Contributors collect observations at generated sampling points.",
  "Reviewers approve quality data. Contributors are paid, and the dataset is delivered.",
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border-low bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white">F</span>
            FieldMint
          </Link>
          <nav className="hidden gap-6 text-sm text-muted sm:flex">
            <a href="#what" className="hover:text-foreground">What we do</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <Link to="/login" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-b from-mint to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-2">
              Ground-truth data infrastructure
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink md:text-5xl">
              Verified ground truth for agriculture and Earth Observation in Africa.
            </h1>
            <p className="max-w-xl text-lg text-muted">
              Satellites show what changed. FieldMint connects organizations with local contributors
              who confirm what is actually happening, with AI-assisted quality checks and transparent
              payments on Solana.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white">
                Get started
              </Link>
              <a href="#contact" className="rounded-lg border border-border-strong bg-card px-6 py-3 text-sm font-semibold">
                Contact us
              </a>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-border-low bg-card p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Example observation</p>
            <div className="rounded-xl bg-mint p-4">
              <p className="font-semibold">Maize · vegetative stage</p>
              <p className="text-sm text-muted">Trans Nzoia · sampling point 14 of 50</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-brand-2/15 px-3 py-1 font-semibold text-brand">Verified by reviewer</span>
              <span className="sol-chip">Paid on Solana</span>
            </div>
          </div>
        </div>
      </section>

      <section id="what" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-8 text-3xl font-bold tracking-tight">What we do</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {what.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-border-low bg-card p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-brand">{t}</h3>
              <p className="text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="bg-mint">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-8 text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="grid gap-5 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s} className="rounded-2xl bg-card p-5 shadow-sm">
                <span className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Need ground-truth data?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Tell us what you need to know and where. We will design a collection campaign with you.
        </p>
        <a href="mailto:hello@fieldmint.example"
          className="mt-6 inline-block rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white">
          hello@fieldmint.example
        </a>
      </section>

      <footer className="border-t border-border-low py-6 text-center text-xs text-muted">
        FieldMint prototype · Solana Devnet · County boundaries: geoBoundaries
      </footer>
    </div>
  );
}