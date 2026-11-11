import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StorePulse — Store analytics for small e-commerce founders" },
      { name: "description", content: "Revenue, orders and top products for your store in one calm dashboard." },
      { property: "og:title", content: "StorePulse — Store analytics for founders" },
      { property: "og:description", content: "Revenue, orders and top products for your store in one calm dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background bg-glow">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-20">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">Store analytics</p>
        <h1 className="mt-6 text-5xl font-semibold leading-[1.05] sm:text-7xl">
          Feel the pulse of <em className="text-primary">your store.</em>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Revenue, orders and your best sellers — one quiet dashboard for founders who'd rather be building.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild variant="pulse" size="lg"><Link to="/auth">Get started</Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/auth">I have an account</Link></Button>
        </div>
      </main>
    </div>
  );
}
