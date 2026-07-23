import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut, LayoutDashboard, FolderKanban, Upload, Library, Image as ImageIcon, Settings as SettingsIcon } from "lucide-react";

export default function Layout() {
  const { session, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = session?.role === "admin";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex items-center justify-between h-16">
          <Link to="/projects" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-sm bg-hero flex items-center justify-center">
              <span className="font-display text-gold font-bold text-lg leading-none">A</span>
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">GIBCA DAM</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavItem to="/dashboard" icon={<LayoutDashboard size={16} />}>Dashboard</NavItem>
            <NavItem to="/projects" icon={<FolderKanban size={16} />}>Projects</NavItem>
            <NavItem to="/images" icon={<ImageIcon size={16} />}>Images</NavItem>
            <NavItem to="/library" icon={<Library size={16} />}>Library</NavItem>
            {isAdmin && <NavItem to="/import" icon={<Upload size={16} />}>Import</NavItem>}
            {isAdmin && <NavItem to="/settings" icon={<SettingsIcon size={16} />}>Settings</NavItem>}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs uppercase tracking-wider text-muted-foreground">
              {session?.username} · <span className="text-gold">{session?.role}</span>
            </span>
            <button
              onClick={() => { logout(); nav("/login"); }}
              className="p-2 rounded-sm hover:bg-secondary transition-smooth"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-8 animate-fade-in"><Outlet /></main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        GIBCA DAM · Internal project & asset library
      </footer>
    </div>
  );
}

function NavItem({ to, children, icon }: { to: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 text-sm rounded-sm transition-smooth ${
          isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-foreground"
        }`
      }
    >
      {icon}{children}
    </NavLink>
  );
}