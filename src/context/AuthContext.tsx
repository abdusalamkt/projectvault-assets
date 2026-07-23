import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "user";
export interface Session { id: string; username: string; role: Role }

interface AuthCtx {
  session: Session | null;
  login: (u: string, p: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "dam_session_v1";

// NOTE: Plaintext DB-backed auth per user spec. NOT secure.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  const login = async (username: string, password: string) => {
    const u = username.trim().toLowerCase();
    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, password, role")
      .eq("username", u)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data || data.password !== password) return { ok: false, error: "Invalid credentials" };
    const s: Session = { id: data.id, username: data.username, role: (data.role as Role) ?? "user" };
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
    return { ok: true };
  };

  const logout = () => { localStorage.removeItem(KEY); setSession(null); };

  return <Ctx.Provider value={{ session, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}