import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import Home from "../app/page";
import AccessConsole from "../app/access/AccessConsole";
import MarketplaceApp from "../app/marketplace/MarketplaceApp";
import LoginPage from "./LoginPage";
import SecurityConsole from "./SecurityConsole";
import { supabase } from "./lib/supabase";

function Protected({ user, children }: { user: User | null; children: React.ReactNode }) {
  return user ? children : <Navigate to={`/login?return_to=${encodeURIComponent(location.pathname)}`} replace />;
}

function Logout() {
  const navigate = useNavigate();
  useEffect(() => { supabase.auth.signOut().finally(() => navigate("/", { replace: true })); }, [navigate]);
  return <main className="login-shell" aria-busy="true" />;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return <main className="login-shell" aria-busy="true" />;
  const identity = user ? { id: user.id, name: String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User"), email: user.email ?? "" } : null;
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={user ? <Navigate to="/marketplace" replace /> : <LoginPage />} />
    <Route path="/logout" element={<Logout />} />
    <Route path="/access" element={<Protected user={user}>{identity && <AccessConsole user={identity} signOutPath="/logout" />}</Protected>} />
    <Route path="/security" element={<Protected user={user}>{identity && <SecurityConsole user={identity} signOutPath="/logout" />}</Protected>} />
    <Route path="/marketplace" element={<Protected user={user}>{identity && <MarketplaceApp user={identity} signOutPath="/logout" />}</Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
