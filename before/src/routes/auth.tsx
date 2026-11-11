import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — StorePulse" },
      { name: "description", content: "Sign in to your StorePulse store dashboard." },
      { property: "og:title", content: "Sign in — StorePulse" },
      { property: "og:description", content: "Sign in to your StorePulse store dashboard." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "magic" | "forgot";

// Redirect target for auth emails (set while testing in preview)
const APP_ORIGIN = "https://preview-storepulse.lovable.app";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const origin = window.location.origin;
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${APP_ORIGIN}/dashboard`, data: { display_name: name } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else setSent("Check your inbox to confirm your email, then you'll land on your dashboard.");
      } else if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${APP_ORIGIN}/dashboard` } });
        if (error) throw error;
        setSent("We sent you a sign-in link. Open it on this device to land on your dashboard.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_ORIGIN}/reset-password` });
        if (error) throw error;
        setSent("Check your inbox for a link to set a new password.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    signin: "Welcome back", signup: "Create your account", magic: "Email me a link", forgot: "Reset password",
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-glow px-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-3xl font-semibold">{titles[mode]}</h1>
        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="text-muted-foreground">{sent}</p>
            <Button variant="outline" className="w-full" onClick={() => { setSent(null); setMode("signin"); }}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2"><Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            )}
            <div className="space-y-2"><Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            {(mode === "signin" || mode === "signup") && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && <button type="button" className="text-xs text-primary" onClick={() => setMode("forgot")}>Forgot?</button>}
                </div>
                <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" variant="pulse" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "magic" ? "Send magic link" : "Send reset link"}
            </Button>
            <div className="flex flex-col gap-2 pt-2 text-center text-sm text-muted-foreground">
              {mode !== "magic" && <button type="button" className="hover:text-foreground" onClick={() => setMode("magic")}>Sign in with a magic link instead</button>}
              {mode !== "signin" && <button type="button" className="hover:text-foreground" onClick={() => setMode("signin")}>Sign in with password</button>}
              {mode !== "signup" && <button type="button" className="hover:text-foreground" onClick={() => setMode("signup")}>New here? Create an account</button>}
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
