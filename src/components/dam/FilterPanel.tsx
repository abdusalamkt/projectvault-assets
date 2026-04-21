import { useEffect, useMemo, useState } from "react";
import { ALL_FILTER_FIELDS, FilterFieldExt, getDistinct } from "@/lib/dam";
import { ChevronDown, X, Search } from "lucide-react";

interface Props {
  value: Partial<Record<FilterFieldExt, string[]>>;
  onChange: (v: Partial<Record<FilterFieldExt, string[]>>) => void;
}

const LABELS: Record<FilterFieldExt, string> = {
  sector: "Sector", country: "Country", product: "Product", finish: "Finish", contractor: "Contractor",
};

export default function FilterPanel({ value, onChange }: Props) {
  const [opts, setOpts] = useState<Record<FilterFieldExt, string[]>>({
    sector: [], country: [], product: [], finish: [], contractor: [],
  });
  const [open, setOpen] = useState<Record<FilterFieldExt, boolean>>({
    sector: true, country: true, product: false, finish: false, contractor: false,
  });
  const [q, setQ] = useState<Record<FilterFieldExt, string>>({
    sector: "", country: "", product: "", finish: "", contractor: "",
  });

  useEffect(() => {
    Promise.all(ALL_FILTER_FIELDS.map((f) => getDistinct(f).then((v) => [f, v] as const)))
      .then((entries) => setOpts(Object.fromEntries(entries) as any));
  }, []);

  const toggle = (f: FilterFieldExt, v: string) => {
    const cur = value[f] ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...value, [f]: next });
  };

  const activeCount = ALL_FILTER_FIELDS.reduce((n, f) => n + (value[f]?.length ?? 0), 0);

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
      {ALL_FILTER_FIELDS.map((f) => {
        const filtered = opts[f].filter((v) =>
          q[f] ? v.toLowerCase().includes(q[f].toLowerCase()) : true
        );
        return (
        <div key={f} className="border-t border-border py-3 first:border-t-0">
          <button
            onClick={() => setOpen({ ...open, [f]: !open[f] })}
            className="w-full flex items-center justify-between text-sm font-medium uppercase tracking-wider"
          >
            <span>{LABELS[f]} {value[f]?.length ? <span className="text-gold">({value[f]!.length})</span> : null}</span>
            <ChevronDown size={14} className={`transition-smooth ${open[f] ? "" : "-rotate-90"}`} />
          </button>
          {open[f] && (
            <div className="mt-2">
              {opts[f].length > 6 && (
                <div className="relative mb-2">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={q[f]}
                    onChange={(e) => setQ({ ...q, [f]: e.target.value })}
                    placeholder={`Search ${LABELS[f].toLowerCase()}…`}
                    className="w-full bg-background border border-border rounded-sm pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-gold transition-smooth"
                  />
                </div>
              )}
              <div className="space-y-1.5 max-h-52 overflow-auto pr-1">
              {filtered.length === 0 && <p className="text-xs text-muted-foreground">No matches</p>}
              {filtered.map((v) => {
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
            </div>
          )}
        </div>
        );
      })}
    </aside>
  );
}