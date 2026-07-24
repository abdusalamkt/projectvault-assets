import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { stats } from "@/lib/dam";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderKanban, Image as ImageIcon, Plus, Upload, Tag, Globe, Package,
  Hammer, Layers, Sparkles, Building2, Search, Palette,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

type Chip = { label: string; type: string; value: string };
const PROJECTS_STATE_KEY = "atlas-dam:projects-state";

const FILTER_TYPES: Record<string, string> = {
  Sector: "sector",
  Country: "country",
  Product: "product",
  Finish: "finish",
  Contractor: "contractor",
};

function jumpToProjects(nav: (p: string) => void, chip: Chip) {
  const filterField = FILTER_TYPES[chip.type];
  const state: any = {
    search: "",
    chips: [],
    filters: {},
    sort: "created_desc",
    page: 0,
    scrollY: 0,
  };
  if (filterField) {
    state.filters = { [filterField]: [chip.value] };
  } else {
    state.chips = [chip];
  }
  try {
    sessionStorage.setItem(PROJECTS_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
  nav("/projects");
}

export default function Dashboard() {
  const nav = useNavigate();
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const [s, setS] = useState({ projects: 0, images: 0 });
  const [rows, setRows] = useState<any[]>([]);
  const [imageTags, setImageTags] = useState<string[]>([]);

  useEffect(() => {
    stats().then(setS).catch(() => {});
    supabase
      .from("projects")
      .select("brand, product, country, sector, contractor, finish, tags")
      .limit(5000)
      .then(({ data }) => setRows(data ?? []));
    supabase
      .from("project_images")
      .select("tags")
      .not("tags", "eq", "{}")
      .limit(2000)
      .then(({ data }) => {
        const set = new Set<string>();
        (data ?? []).forEach((r: any) =>
          (r.tags ?? []).forEach((t: string) => t && set.add(t))
        );
        setImageTags(Array.from(set).sort((a, b) => a.localeCompare(b)));
      });
  }, []);

  const groups = useMemo(() => {
    const collect = (key: string) => {
      const map = new Map<string, number>();
      rows.forEach((r: any) => {
        const v = r[key];
        if (v) map.set(v, (map.get(v) ?? 0) + 1);
      });
      return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    };
    const tagMap = new Map<string, number>();
    rows.forEach((r: any) =>
      (r.tags ?? []).forEach((t: string) => {
        if (t) tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
      })
    );
    return {
      brands: collect("brand"),
      products: collect("product"),
      countries: collect("country"),
      sectors: collect("sector"),
      contractors: collect("contractor"),
      finishes: collect("finish"),
      tags: Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-widest text-gold mb-2">Overview</p>
        <h1 className="font-display text-4xl font-semibold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Browse the entire library. Click any tag to jump to matching projects.</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        <Stat icon={<FolderKanban />} label="Projects" value={s.projects} to="/projects" />
        <Stat icon={<ImageIcon />} label="Images" value={s.images} to="/images" />
      </div>

      {isAdmin && (
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <ActionCard to="/projects/new" icon={<Plus />} title="Add Project" desc="Create a new project entry." />
          <ActionCard to="/import" icon={<Upload />} title="Bulk Import CSV" desc="Upload thousands of projects." />
          <ActionCard to="/projects" icon={<FolderKanban />} title="Manage Projects" desc="Edit, delete, organize." />
        </div>
      )}

      <div className="mt-10 space-y-6">
        <ChipSection
          title="Brands" icon={<Sparkles size={16} />}
          items={groups.brands} type="Brand" onPick={(c) => jumpToProjects(nav, c)}
        />
        <ChipSection
          title="Products" icon={<Package size={16} />}
          items={groups.products} type="Product" onPick={(c) => jumpToProjects(nav, c)}
        />
        <ChipSection
          title="Countries" icon={<Globe size={16} />}
          items={groups.countries} type="Country" onPick={(c) => jumpToProjects(nav, c)}
        />
        <ChipSection
          title="Sectors" icon={<Building2 size={16} />}
          items={groups.sectors} type="Sector" onPick={(c) => jumpToProjects(nav, c)}
        />
        <ChipSection
          title="Contractors" icon={<Hammer size={16} />}
          items={groups.contractors} type="Contractor" onPick={(c) => jumpToProjects(nav, c)}
        />
        <ChipSection
          title="Finishes" icon={<Palette size={16} />}
          items={groups.finishes} type="Finish" onPick={(c) => jumpToProjects(nav, c)}
        />
        <ChipSection
          title="Project Tags" icon={<Tag size={16} />}
          items={groups.tags} type="Tag" onPick={(c) => jumpToProjects(nav, c)}
        />
        <ChipSection
          title="Image Tags" icon={<Layers size={16} />}
          items={imageTags.map((t) => [t, 0] as [string, number])}
          type="Image Tag"
          onPick={(c) => jumpToProjects(nav, c)}
          hideCount
        />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="bg-card border border-border rounded-sm p-6 shadow-soft flex items-center gap-5 hover:border-gold hover:shadow-lift transition-smooth"
    >
      <div className="w-12 h-12 rounded-sm bg-secondary flex items-center justify-center text-primary">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-3xl font-semibold mt-1">{value.toLocaleString()}</div>
      </div>
    </Link>
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

function ChipSection({
  title, icon, items, type, onPick, hideCount,
}: {
  title: string;
  icon: React.ReactNode;
  items: [string, number][];
  type: string;
  onPick: (c: Chip) => void;
  hideCount?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [q, setQ] = useState("");
  if (!items.length) return null;
  const filtered = q.trim()
    ? items.filter(([v]) => v.toLowerCase().includes(q.trim().toLowerCase()))
    : items;
  const shown = expanded || q.trim() ? filtered : filtered.slice(0, 30);
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-sm p-5 shadow-soft"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <span className="text-gold">{icon}</span>
          {title}
          <span className="text-xs text-muted-foreground font-sans font-normal">({items.length})</span>
        </h3>
        {items.length > 30 && !q.trim() && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground hover:text-gold transition-smooth"
          >
            {expanded ? "Show less" : `Show all`}
          </button>
        )}
      </div>
      {items.length > 10 && (
        <div className="relative mb-3">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            className="w-full bg-background border border-border rounded-sm pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-gold transition-smooth"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {shown.length === 0 && (
          <p className="text-xs text-muted-foreground">No matches</p>
        )}
        {shown.map(([value, count]) => (
          <button
            key={value}
            onClick={() => onPick({ label: value, type, value })}
            className="inline-flex items-center gap-1.5 bg-secondary hover:bg-gold/10 hover:border-gold border border-border rounded-sm px-2.5 py-1 text-xs transition-smooth"
          >
            <span className="font-medium">{value}</span>
            {!hideCount && count > 0 && (
              <span className="text-[10px] text-muted-foreground">{count}</span>
            )}
          </button>
        ))}
      </div>
    </motion.section>
  );
}