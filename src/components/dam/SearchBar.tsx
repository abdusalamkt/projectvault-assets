import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { searchSuggestions } from "@/lib/dam";

interface Suggestion { label: string; type: string; value: string }

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length < 2) { setItems([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchSuggestions(value)
        .then((s) => { setItems(s); setActive(0); })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (s: Suggestion) => {
    onChange(s.value);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder ?? "Search projects, contractors, tags, countries…"}
        className="w-full bg-card border border-border rounded-sm pl-10 pr-10 py-3 focus:outline-none focus:border-gold transition-smooth"
      />
      {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}

      {open && items.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-card border border-border rounded-sm shadow-lift max-h-80 overflow-auto">
          {items.map((s, i) => (
            <button
              key={`${s.type}:${s.value}:${i}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-smooth ${
                i === active ? "bg-secondary" : "hover:bg-secondary/60"
              }`}
            >
              <span className="truncate">{s.label}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">{s.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
