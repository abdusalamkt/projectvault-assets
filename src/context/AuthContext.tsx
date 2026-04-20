import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Role = "admin" | "user";
export interface Session { username: string; role: Role }

interface AuthCtx {
  session: Session | null;
  login: (u: string, p: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "dam_session_v1";

// NOTE: Hardcoded credentials per user spec. NOT secure — anyone with DevTools can read these.
const CREDS: Record<string, { password: string; role: Role }> = {
  admin: { password: "admin123", role: "admin" },
  user: { password: "user123", role: "user" },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  const login = (username: string, password: string) => {
    const entry = CREDS[username.trim().toLowerCase()];
    if (!entry || entry.password !== password) return { ok: false, error: "Invalid credentials" };
    const s = { username: username.trim().toLowerCase(), role: entry.role };
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