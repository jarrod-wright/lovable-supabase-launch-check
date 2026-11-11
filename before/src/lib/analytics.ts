export type OrderRow = {
  id: number;
  quantity: number;
  total: number;
  created_at: string;
  product_id: number;
};
export type ProductRow = { id: number; name: string; category: string; price: number };

export function summarize(orders: OrderRow[], products: ProductRow[], days = 30, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const inRange = orders.filter((o) => new Date(o.created_at) >= start);
  const byDay = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, revenue: 0, orders: 0 });
  }
  for (const o of inRange) {
    const k = new Date(o.created_at).toISOString().slice(0, 10);
    const row = byDay.get(k);
    if (row) {
      row.revenue += Number(o.total);
      row.orders += 1;
    }
  }
  const revenue = inRange.reduce((s, o) => s + Number(o.total), 0);
  const count = inRange.length;
  const pmap = new Map(products.map((p) => [p.id, p]));
  const top = new Map<number, { name: string; revenue: number; units: number }>();
  for (const o of inRange) {
    const p = pmap.get(o.product_id);
    if (!p) continue;
    const t = top.get(p.id) ?? { name: p.name, revenue: 0, units: 0 };
    t.revenue += Number(o.total);
    t.units += o.quantity;
    top.set(p.id, t);
  }
  return {
    revenue,
    orders: count,
    aov: count ? revenue / count : 0,
    series: [...byDay.values()].map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 })),
    topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
