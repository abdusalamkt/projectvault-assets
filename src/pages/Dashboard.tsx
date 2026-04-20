import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { stats } from "@/lib/dam";
import { FolderKanban, Image as ImageIcon, Plus, Upload } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [s, setS] = useState({ projects: 0, images: 0 });
  useEffect(() => { stats().then(setS).catch(() => {}); }, []);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-widest text-gold mb-2">Admin</p>
        <h1 className="font-display text-4xl font-semibold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Manage your project library at a glance.</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        <Stat icon={<FolderKanban />} label="Projects" value={s.projects} />
        <Stat icon={<ImageIcon />} label="Images" value={s.images} />
      </div>

      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        <ActionCard to="/projects/new" icon={<Plus />} title="Add Project" desc="Create a new project entry." />
        <ActionCard to="/import" icon={<Upload />} title="Bulk Import CSV" desc="Upload thousands of projects." />
        <ActionCard to="/projects" icon={<FolderKanban />} title="Manage Projects" desc="Edit, delete, organize." />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-sm p-6 shadow-soft flex items-center gap-5">
      <div className="w-12 h-12 rounded-sm bg-secondary flex items-center justify-center text-primary">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-3xl font-semibold mt-1">{value.toLocaleString()}</div>
      </div>
    </div>
  );
}

function ActionCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group bg-card border border-border rounded-sm p-6 shadow-soft hover:shadow-lift hover:border-gold transition-smooth"
    >
      <div className="text-gold mb-3">{icon}</div>
      <h3 className="font-display text-xl font-semibold group-hover:text-gold transition-smooth">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </Link>
  );
}