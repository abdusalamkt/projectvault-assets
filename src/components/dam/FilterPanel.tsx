import { useEffect, useState } from "react";
import { FILTER_FIELDS, FilterField, getDistinct } from "@/lib/dam";
import { ChevronDown, X } from "lucide-react";

interface Props {
  value: Partial<Record<FilterField, string[]>>;
  onChange: (v: Partial<Record<FilterField, string[]>>) => void;
}

const LABELS: Record<FilterField, string> = {
  sector: "Sector", country: "Country", product: "Product", finish: "Finish",
};

export default function FilterPanel({ value, onChange }: Props) {
  const [opts, setOpts] = useState<Record<FilterField, string[]>>({
    sector: [], country: [], product: [], finish: [],
  });
  const [open, setOpen] = useState<Record<FilterField, boolean>>({
    sector: true, country: true, product: false, finish: false,
  });

  useEffect(() => {
    Promise.all(FILTER_FIELDS.map((f) => getDistinct(f).then((v) => [f, v] as const)))
      .then((entries) => setOpts(Object.fromEntries(entries) as any));
  }, []);

  const toggle = (f: FilterField, v: string) => {
    const cur = value[f] ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...value, [f]: next });
  };

  const activeCount = FILTER_FIELDS.reduce((n, f) => n + (value[f]?.length ?? 0), 0);

  return (
    <aside className="bg-card border border-border rounded-sm p-5 shadow-soft sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold">Filters</h3>
        {activeCount > 0 && (
          <button
            onClick={() => onChange({})}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X size={12} /> Clear ({activeCount})
          </button>
        )}
      </div>
      {FILTER_FIELDS.map((f) => (
        <div key={f} className="border-t border-border py-3 first:border-t-0">
          <button
            onClick={() => setOpen({ ...open, [f]: !open[f] })}
            className="w-full flex items-center justify-between text-sm font-medium uppercase tracking-wider"
          >
            <span>{LABELS[f]}</span>
            <ChevronDown size={14} className={`transition-smooth ${open[f] ? "" : "-rotate-90"}`} />
          </button>
          {open[f] && (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-auto pr-1">
              {opts[f].length === 0 && <p className="text-xs text-muted-foreground">None yet</p>}
              {opts[f].map((v) => {
                const checked = value[f]?.includes(v) ?? false;
                return (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer hover:text-gold transition-smooth">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(f, v)}
                      className="accent-[hsl(var(--gold))]"
                    />
                    <span className="truncate">{v}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}