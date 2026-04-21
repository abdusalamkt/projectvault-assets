import { Link } from "react-router-dom";
import { ProjectRow } from "@/lib/dam";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

interface Props {
  project: ProjectRow;
  index: number;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function ProjectCard({ project, index, selectable, selected, onToggleSelect }: Props) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.from("project_images").select("url").eq("project_id", project.id).order("sort_order").limit(1).maybeSingle()
      .then(({ data }) => { if (active) setThumb(data?.url ?? null); });
    return () => { active = false; };
  }, [project.id]);

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.(project.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.3) }}
      className="relative"
    >
      {selectable && (
        <button
          onClick={handleSelectClick}
          aria-label={selected ? "Deselect" : "Select"}
          className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-sm border flex items-center justify-center transition-smooth ${
            selected
              ? "bg-gold border-gold text-background"
              : "bg-background/80 backdrop-blur border-border hover:border-gold"
          }`}
        >
          {selected && <Check size={14} strokeWidth={3} />}
        </button>
      )}
      <Link
        to={`/projects/${project.id}`}
        className={`group block bg-card border rounded-sm overflow-hidden shadow-soft hover:shadow-lift transition-smooth ${
          selected ? "border-gold ring-1 ring-gold/40" : "border-border"
        }`}
      >
        <div className="aspect-[4/3] bg-muted overflow-hidden">
          {thumb ? (
            <img
              src={thumb}
              alt={project.project_name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-smooth duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest">
              No image
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-xs text-gold uppercase tracking-widest font-medium">#{project.project_no}</div>
          <h3 className="font-display text-lg font-semibold mt-1 line-clamp-2 group-hover:text-gold transition-smooth">
            {project.project_name}
          </h3>
          <div className="text-sm text-muted-foreground mt-2">
            {[project.sector, project.country].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}