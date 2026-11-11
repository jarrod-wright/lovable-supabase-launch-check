import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — StorePulse" }, { name: "description", content: "Your StorePulse team roster and roles." }] }),
  component: Team,
});

function Team() {
  const { data: me } = useAccount();
  const qc = useQueryClient();
  const { data: roster = [], isLoading } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_roster");
      if (error) throw error;
      return data;
    },
  });
  const promote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("promote_to_admin", { _target: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promoted to admin");
      qc.invalidateQueries({ queryKey: ["roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-primary">People</p>
        <h1 className="text-4xl font-semibold">Team</h1>
        {!me?.isAdmin && <p className="mt-2 text-sm text-muted-foreground">Email addresses are visible to store owners only.</p>}
      </div>
      <Card className="divide-y divide-border">
        {isLoading && <div className="p-6 text-muted-foreground">Loading team…</div>}
        {roster.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-display text-lg">
              {m.display_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.display_name}{m.user_id === me?.id && <span className="text-muted-foreground"> (you)</span>}</div>
              {m.email && <div className="truncate text-sm text-muted-foreground">{m.email}</div>}
            </div>
            <Badge variant={m.plan === "Pro" ? "default" : "outline"}>{m.plan}</Badge>
            <Badge variant={m.role === "admin" ? "default" : "secondary"}>{m.role === "admin" ? "Admin" : "Member"}</Badge>
            {me?.isAdmin && m.role !== "admin" && (
              <Button size="sm" variant="outline" disabled={promote.isPending} onClick={() => promote.mutate(m.user_id)}>
                Promote to admin
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
