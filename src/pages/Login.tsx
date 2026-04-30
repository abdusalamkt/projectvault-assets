import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

export default function Login() {
  const { session, login } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (session) return <Navigate to={session.role === "admin" ? "/dashboard" : "/projects"} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const r = login(u, p);
    if (!r.ok) { setErr(r.error ?? "Login failed"); return; }
    nav("/projects");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-hero text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-sm bg-gold flex items-center justify-center">
              <span className="font-display text-primary font-bold">G</span>
            </span>
            <span className="font-display text-2xl font-semibold">GIBCA DAM</span>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="relative z-10 max-w-md"
        >
          <h1 className="font-display text-5xl font-semibold leading-tight mb-4">
            Every project. <span className="text-gold italic">Every image.</span> One library.
          </h1>
          <p className="text-primary-foreground/70 text-lg">
            The internal asset manager for thousands of jobs — searchable, filterable, downloadable.
          </p>
        </motion.div>
        <p className="relative z-10 text-xs text-primary-foreground/50 uppercase tracking-widest">
          Internal use only
        </p>
        <div className="absolute -right-32 -bottom-32 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-8 bg-background">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <h2 className="font-display text-3xl font-semibold mb-2">Sign in</h2>
          <p className="text-muted-foreground mb-8 text-sm">Use your assigned credentials.</p>

          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Username</label>
          <input
            value={u} onChange={(e) => setU(e.target.value)} autoFocus
            className="w-full bg-card border border-border rounded-sm px-3 py-2.5 mb-4 focus:outline-none focus:border-gold transition-smooth"
          />

          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Password</label>
          <input
            type="password" value={p} onChange={(e) => setP(e.target.value)}
            className="w-full bg-card border border-border rounded-sm px-3 py-2.5 mb-6 focus:outline-none focus:border-gold transition-smooth"
          />

          {err && <div className="mb-4 text-sm text-destructive">{err}</div>}

          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-3 rounded-sm font-medium hover:bg-primary/90 transition-smooth flex items-center justify-center gap-2"
          >
            <Lock size={14} /> Sign in
          </button>

          <div className="mt-8 p-4 bg-secondary/50 rounded-sm text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Demo credentials</div>
            Admin · <span className="font-mono">admin / admin123</span><br />
            User · <span className="font-mono">user / user123</span>
          </div>
        </motion.form>
      </div>
    </div>
  );
}