import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAccount() {
  return useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return null;
      const [{ data: roles }, { data: pro }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.rpc("is_pro", { _user_id: user.id }),
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.display_name ?? user.email ?? "",
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
        isPro: Boolean(pro) || localStorage.getItem("storepulse_pro_unlocked") === "true",
      };
    },
  });
}
