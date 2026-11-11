import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { money, summarize, type OrderRow, type ProductRow } from "@/lib/analytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/hooks/use-account";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — StorePulse" }, { name: "description", content: "Revenue, orders and top products for your store." }] }),
  component: Dashboard,
});

const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" } };

function Dashboard() {
  const [days, setDays] = useState(30);
  const { data: me, isLoading: meLoading } = useAccount();
  const { data, isLoading } = useQuery({
    queryKey: ["store-data"],
    enabled: Boolean(me?.isAdmin),
    queryFn: async () => {
      const [o, p] = await Promise.all([
        supabase.from("orders").select("id, quantity, total, created_at, product_id").order("created_at"),
        supabase.from("products").select("id, name, category, price"),
      ]);
      if (o.error) throw o.error;
      if (p.error) throw p.error;
      return { orders: o.data as OrderRow[], products: p.data as ProductRow[] };
    },
  });
  const s = data ? summarize(data.orders, data.products, days) : null;
  if (meLoading) return null;
  if (!me?.isAdmin)
    return (
      <Card className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-3xl font-semibold">Sales data is owner-only</h1>
        <p className="mt-2 text-muted-foreground">Ask your store owner to promote you to admin to see revenue, orders and top products.</p>
      </Card>
    );
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary">Your store</p>
          <h1 className="text-4xl font-semibold">Store pulse</h1>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-sm ${d === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Revenue", s && money(s.revenue)],
          ["Orders", s && s.orders.toLocaleString()],
          ["Avg. order value", s && money(s.aov)],
        ].map(([label, value]) => (
          <Card key={label as string} className="p-6">
            <div className="text-sm text-muted-foreground">{label}</div>
            {isLoading ? <Skeleton className="mt-2 h-9 w-32" /> : <div className="mt-1 font-display text-4xl font-semibold">{value}</div>}
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Revenue</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={s?.series ?? []}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip {...tip} formatter={(v: number) => money(v)} />
              <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Orders per day</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={s?.series ?? []}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="orders" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Top products</h2>
          <ol className="space-y-4">
            {s?.topProducts.map((p, i) => (
              <li key={p.name}>
                <div className="flex justify-between text-sm">
                  <span><span className="mr-2 text-muted-foreground">{i + 1}.</span>{p.name}</span>
                  <span className="font-medium">{money(p.revenue)} <span className="text-muted-foreground">· {p.units} sold</span></span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-pulse" style={{ width: `${(p.revenue / (s.topProducts[0]?.revenue || 1)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
