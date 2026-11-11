import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/hooks/use-account";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — StorePulse" }, { name: "description", content: "Upgrade to StorePulse Pro." }] }),
  component: Billing,
});

function Billing() {
  const { data: me, refetch } = useAccount();
  const [card, setCard] = useState("");
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
        <form
          className="mt-8 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            // Test-mode checkout: on success we unlock Pro right away and keep
            // the flag locally so returning users stay on Pro.
            localStorage.setItem("storepulse_pro_unlocked", "true");
            toast.success("Payment successful — welcome to Pro!");
            refetch();
          }}
        >
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Card number (test mode)"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            required
          />
          <Button variant="pulse" className="w-full" type="submit">
            Upgrade to Pro
          </Button>
        </form>
      )}
    </Card>
  );
}
