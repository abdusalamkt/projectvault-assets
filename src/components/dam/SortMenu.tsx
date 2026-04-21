import { ArrowUpDown } from "lucide-react";
import { SortKey } from "@/lib/dam";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "no_asc", label: "Project No (A→Z)" },
  { value: "no_desc", label: "Project No (Z→A)" },
  { value: "name_asc", label: "Name (A→Z)" },
  { value: "name_desc", label: "Name (Z→A)" },
];

export default function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <div className="relative inline-flex items-center">
      <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="appearance-none bg-card border border-border rounded-sm pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:border-gold transition-smooth cursor-pointer"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
