import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")); const password = String(form.get("password")); const fullName = String(form.get("fullName") ?? "");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (result.error) { setMessage(result.error.message); setBusy(false); return; }
    if (mode === "signup" && !result.data.session) { setMessage("Check your email to confirm your account, then sign in."); setBusy(false); return; }
    const returnTo = new URLSearchParams(location.search).get("return_to");
    navigate(returnTo?.startsWith("/") ? returnTo : "/marketplace", { replace: true });
  }

  return <main className="login-shell"><section className="login-story"><a href="/" className="mp-brand"><span>F</span><strong>FIXIT</strong><small>governed marketplace</small></a><div><span>TRUSTED LOCAL WORK</span><h1>Find skilled hands.<br />Run better jobs.</h1><p>A governed marketplace connecting clients and artisans through transparent quotes, accountable delivery and verified outcomes.</p></div><small>Privacy by design · Tenant isolated · Evidence led</small></section><section className="login-form"><form onSubmit={submit}><span>SECURE ACCESS</span><h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2><p>{mode === "signin" ? "Sign in to your client and artisan workspaces." : "One identity can operate across separate client and artisan tenants."}</p>{mode === "signup" && <label>Full name<input name="fullName" required autoComplete="name" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" minLength={8} required autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>{message && <div className="form-error" role="status">{message}</div>}<button disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in →" : "Create account →"}</button><div className="login-toggle">{mode === "signin" ? "New to Fixit?" : "Already have an account?"}<button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></div></form></section></main>;
}
