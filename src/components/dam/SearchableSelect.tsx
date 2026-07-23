import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X, Search } from "lucide-react";

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  emptyHint?: string;
  allowClear?: boolean;
}

export default function SearchableSelect({
  value, onChange, options, placeholder = "Select…", disabled, emptyHint, allowClear = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.toLowerCase().includes(term));
  }, [q, options]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-background border border-border rounded-sm px-3 py-2 text-left text-sm focus:outline-none focus:border-gold transition-smooth disabled:opacity-50"
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
        <span className="inline-flex items-center gap-1">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="p-0.5 hover:text-destructive"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className="text-muted-foreground" />
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded-sm shadow-elevated animate-fade-in">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search size={12} className="text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">{emptyHint ?? "No options"}</p>
            ) : (
              filtered.map((o) => (
                <button
                  type="button"
                  key={o}
                  onClick={() => { onChange(o); setOpen(false); setQ(""); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-smooth ${o === value ? "text-gold" : ""}`}
                >
                  {o}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}