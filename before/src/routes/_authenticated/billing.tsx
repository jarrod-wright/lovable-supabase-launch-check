import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/hooks/use-account";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — StorePulse" }, { name: "description", content: "Upgrade to StorePulse Pro." }] }),
  component: Billing,
});

function Billing() {
  const { data: me } = useAccount();
  return (
    <Card className="mx-auto max-w-md p-8">
      <p className="text-sm uppercase tracking-widest text-primary">StorePulse Pro</p>
      <div className="mt-2 font-display text-5xl font-semibold">$29<span className="text-lg text-muted-foreground">/month</span></div>
      <ul className="mt-6 space-y-2 text-sm">
        {["Customer cohorts", "Repeat-purchase rate", "Lifetime value", "Revenue by category"].map((f) => (
          <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
        ))}
      </ul>
      {me?.isPro ? (
        <p className="mt-8 rounded-md bg-secondary p-3 text-center text-sm">You're on Pro.</p>
      ) : (
        <Button variant="pulse" className="mt-8 w-full" onClick={() => toast("Checkout is being connected — check back shortly.")}>
          Upgrade to Pro
        </Button>
      )}
    </Card>
  );
}
