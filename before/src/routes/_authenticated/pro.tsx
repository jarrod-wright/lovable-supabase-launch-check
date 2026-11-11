import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { money } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/pro")({
  head: () => ({ meta: [{ title: "Pro insights — StorePulse" }, { name: "description", content: "Cohorts, repeat purchases and lifetime value." }] }),
  component: Pro,
});

type Insights = {
  repeat_rate: number; customers: number; ltv: number;
  cohorts: { month: string; first_month: string; customers: number; avg_spend: number }[];
  categories: { category: string; revenue: number }[];
};

function Pro() {
  const { data: me, isLoading } = useAccount();
  const { data } = useQuery({
    queryKey: ["pro-insights"],
    enabled: Boolean(me?.isPro),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pro_insights");
      if (error) throw error;
      return data as unknown as Insights;
    },
  });
  if (isLoading) return null;
  if (!me?.isPro)
    return (
      <Card className="mx-auto max-w-lg p-10 text-center">
        <Lock className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-4 text-3xl font-semibold">Pro insights</h1>
        <p className="mt-2 text-muted-foreground">Customer cohorts, repeat-purchase rate and lifetime value. $29/month.</p>
        <Button asChild variant="pulse" className="mt-6"><Link to="/billing">Upgrade to Pro</Link></Button>
      </Card>
    );
  const cohorts = [...(data?.cohorts ?? [])].sort((a, b) => a.first_month.localeCompare(b.first_month));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-primary">Pro</p>
        <h1 className="text-4xl font-semibold">Insights</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Repeat-purchase rate", data ? `${data.repeat_rate}%` : "—"], ["Customers", data?.customers ?? "—"], ["Avg. lifetime value", data ? money(data.ltv) : "—"]].map(([l, v]) => (
          <Card key={l as string} className="p-6"><div className="text-sm text-muted-foreground">{l}</div><div className="mt-1 font-display text-4xl font-semibold">{v}</div></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">New customers by first-purchase month</h2>
          <div className="h-64"><ResponsiveContainer><BarChart data={cohorts}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
            <Bar dataKey="customers" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Revenue by category</h2>
          <ul className="space-y-3">{data?.categories.map((c) => (
            <li key={c.category} className="flex justify-between border-b border-border pb-2 text-sm"><span>{c.category}</span><span className="font-medium">{money(c.revenue)}</span></li>
          ))}</ul>
        </Card>
      </div>
    </div>
  );
}
