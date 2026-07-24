import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProjects, ProjectRow, FilterFieldExt, SortKey, bulkAddTags, getImagesForProjects, getProject } from "@/lib/dam";
import FilterPanel from "@/components/dam/FilterPanel";
import ProjectCard from "@/components/dam/ProjectCard";
import SearchBar from "@/components/dam/SearchBar";
import SortMenu from "@/components/dam/SortMenu";
import { useAuth } from "@/context/AuthContext";
import { Plus, Loader2, CheckSquare, Square, Tag, Download, X, FileDown } from "lucide-react";
import { downloadAsZip, fileNameFromUrl } from "@/lib/download";
import { buildCombinedPdf } from "@/lib/pdf";
import { toast } from "sonner";

const PAGE_SIZE = 24;

interface Chip { label: string; type: string; value: string }

type PersistedState = {
  search: string;
  chips: Chip[];
  filters: Partial<Record<FilterFieldExt, string[]>>;
  sort: SortKey;
  page: number;
  scrollY: number;
};
const STORAGE_KEY = "atlas-dam:projects-state";
const loadPersisted = (): Partial<PersistedState> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export default function Projects() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  // Read once per mount so coming back from a project detail restores state.
  const [initial] = useState<Partial<PersistedState>>(() => loadPersisted());
  const [search, setSearch] = useState<string>(initial.search ?? "");
  const [debounced, setDebounced] = useState<string>(initial.search ?? "");
  const [chips, setChips] = useState<Chip[]>(initial.chips ?? []);
  const [filters, setFilters] = useState<Partial<Record<FilterFieldExt, string[]>>>(
    initial.filters ?? { brand: ["Hufcor"] }
  );
  const [sort, setSort] = useState<SortKey>(initial.sort ?? "created_desc");
  const [page, setPage] = useState<number>(initial.page ?? 0);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  // Track whether the initial restore has happened so we don't reset page on first render.
  const [restored, setRestored] = useState(false);
  useEffect(() => { setRestored(true); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      if (restored) setPage(0);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    if (restored) setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);
  useEffect(() => {
    if (restored) setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    setLoading(true);
    listProjects({ search: debounced, searchTerms: chips.map((c) => c.value), filters, page, pageSize: PAGE_SIZE, sort })
      .then(({ rows, total }) => { setRows(rows); setTotal(total); })
      .finally(() => setLoading(false));
  }, [debounced, JSON.stringify(filters), page, sort, JSON.stringify(chips)]);

  // Persist state to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        search, chips, filters, sort, page, scrollY: window.scrollY,
      }));
    } catch {}
  }, [search, chips, filtersKey, sort, page]);

  const addChip = (c: Chip) => {
    setChips((prev) => prev.some((p) => p.type === c.type && p.value.toLowerCase() === c.value.toLowerCase()) ? prev : [...prev, c]);
    setPage(0);
  };
  const removeChip = (i: number) => { setChips((prev) => prev.filter((_, idx) => idx !== i)); setPage(0); };

  // Restore scroll once results are loaded
  useEffect(() => {
    if (!loading && initial.scrollY) {
      const y = initial.scrollY;
      requestAnimationFrame(() => window.scrollTo(0, y));
      initial.scrollY = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Save scroll position before unload/navigation
  useEffect(() => {
    const save = () => {
      try {
        const cur = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, scrollY: window.scrollY }));
      } catch {}
    };
    window.addEventListener("beforeunload", save);
    return () => { save(); window.removeEventListener("beforeunload", save); };
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAllOnPage = () => {
    setSelected((s) => {
      const n = new Set(s);
      const allOn = rows.every((r) => n.has(r.id));
      if (allOn) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.add(r.id));
      return n;
    });
  };

  const selectAllResults = async () => {
    setBulkBusy(true);
    try {
      // Fetch every matching project id across all pages.
      const all: ProjectRow[] = [];
      const size = 200;
      let p = 0;
      while (true) {
        const { rows: batch, total: tot } = await listProjects({
          search: debounced, searchTerms: chips.map((c) => c.value), filters, page: p, pageSize: size, sort,
        });
        all.push(...batch);
        if (all.length >= tot || batch.length === 0) break;
        p++;
        if (p > 200) break; // safety
      }
      setSelected(new Set(all.map((r) => r.id)));
      toast.success(`Selected ${all.length} project(s)`);
    } catch (e: any) { toast.error(e.message ?? "Select all failed"); }
    finally { setBulkBusy(false); }
  };

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); setTagInput(""); };

  const applyBulkTags = async () => {
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    if (!tags.length) return toast.error("Enter at least one tag");
    if (!selected.size) return toast.error("Select projects first");
    setBulkBusy(true);
    try {
      await bulkAddTags(Array.from(selected), tags);
      toast.success(`Added ${tags.length} tag(s) to ${selected.size} project(s)`);
      setTagInput("");
      // refresh
      const res = await listProjects({ search: debounced, filters, page, pageSize: PAGE_SIZE, sort });
      setRows(res.rows); setTotal(res.total);
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkBusy(false); }
  };

  const downloadSelectedImages = async () => {
    if (!selected.size) return toast.error("Select projects first");
    setBulkBusy(true);
    try {
      const imgs = await getImagesForProjects(Array.from(selected));
      if (!imgs.length) { toast.error("No images in selected projects"); return; }
      setZipProgress({ done: 0, total: imgs.length });
      const files = imgs.map((img, i) => ({
        folder: `${img.project_no}-${img.project_name}`,
        name: `${String(i + 1).padStart(3, "0")}-${fileNameFromUrl(img.url)}`,
        url: img.url,
      }));
      await downloadAsZip(files, `atlas-dam-${selected.size}-projects.zip`, (d, t) => setZipProgress({ done: d, total: t }));
      toast.success(`Downloaded ${imgs.length} image(s)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkBusy(false); setZipProgress(null); }
  };

  const downloadCombinedPdf = async () => {
    if (!selected.size) return toast.error("Select projects first");
    setBulkBusy(true);
    setPdfProgress({ done: 0, total: selected.size });
    try {
      const ids = Array.from(selected);
      const items: { project: ProjectRow; images: any[] }[] = [];
      for (let i = 0; i < ids.length; i++) {
        const { project, images } = await getProject(ids[i]);
        if (project) items.push({ project, images });
        setPdfProgress({ done: i + 1, total: ids.length });
      }
      if (!items.length) { toast.error("Nothing to export"); return; }
      const doc = await buildCombinedPdf(items);
      doc.save(`atlas-dam-${items.length}-projects.pdf`);
      toast.success(`Exported ${items.length} project(s) to PDF`);
    } catch (e: any) { toast.error(e.message ?? "PDF export failed"); }
    finally { setBulkBusy(false); setPdfProgress(null); }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold mb-2">Library</p>
          <h1 className="font-display text-4xl font-semibold">Projects</h1>
          <p className="text-muted-foreground mt-1">{total.toLocaleString()} {total === 1 ? "result" : "results"}</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <button
            onClick={() => { setSelectMode((v) => !v); if (selectMode) setSelected(new Set()); }}
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm border transition-smooth ${
              selectMode ? "border-gold text-gold bg-gold/5" : "border-border hover:bg-secondary"
            }`}
          >
            {selectMode ? <CheckSquare size={16} /> : <Square size={16} />}
            {selectMode ? "Selecting" : "Select"}
          </button>
          {isAdmin && (
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-sm hover:bg-primary/90 transition-smooth"
            >
              <Plus size={16} /> Add Project
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <FilterPanel value={filters} onChange={setFilters} />

        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} onPickChip={addChip} />
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {chips.map((c, i) => (
                    <span key={`${c.type}:${c.value}:${i}`} className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-sm pl-2 pr-1 py-1 text-xs">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.type}</span>
                      <span className="font-medium">{c.label}</span>
                      <button onClick={() => removeChip(i)} className="hover:text-destructive transition-smooth p-0.5" aria-label="Remove">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <button onClick={() => { setChips([]); setPage(0); }} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1">
                    Clear
                  </button>
                </div>
              )}
            </div>
            <SortMenu value={sort} onChange={setSort} />
          </div>

          {selectMode && (
            <div className="mb-5 bg-card border border-gold/40 rounded-sm p-4 flex flex-wrap items-center gap-3 shadow-soft">
              <button onClick={selectAllOnPage} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                {rows.every((r) => selected.has(r.id)) && rows.length > 0 ? "Unselect page" : "Select page"}
              </button>
              <button
                onClick={selectAllResults}
                disabled={bulkBusy || total === 0}
                className="text-xs uppercase tracking-widest text-gold hover:text-gold/80 disabled:opacity-40"
              >
                Select all ({total})
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <span className="text-sm font-medium">
                {selected.size} selected
              </span>
              <div className="flex-1" />
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-gold" />
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="tag1, tag2…"
                    className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-gold transition-smooth"
                  />
                  <button
                    onClick={applyBulkTags}
                    disabled={bulkBusy || !selected.size}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm disabled:opacity-40 hover:bg-primary/90 transition-smooth"
                  >Apply tags</button>
                </div>
              )}
              <button
                onClick={downloadSelectedImages}
                disabled={bulkBusy || !selected.size}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary transition-smooth"
              >
                {bulkBusy && zipProgress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {zipProgress ? `${zipProgress.done}/${zipProgress.total}` : "Download images (ZIP)"}
              </button>
              <button
                onClick={downloadCombinedPdf}
                disabled={bulkBusy || !selected.size}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary transition-smooth"
              >
                {bulkBusy && pdfProgress ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {pdfProgress ? `${pdfProgress.done}/${pdfProgress.total}` : "Combined PDF"}
              </button>
              <button onClick={exitSelect} className="p-1.5 hover:bg-secondary rounded-sm transition-smooth"><X size={14} /></button>
            </div>
          )}

          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-sm">
              <p className="font-display text-2xl mb-2">No projects found</p>
              <p className="text-muted-foreground text-sm">
                {isAdmin
                  ? "Add a project or import a CSV to get started."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {rows.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    selectable={selectMode}
                    selected={selected.has(p.id)}
                    onToggleSelect={toggleSel}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    disabled={page === 0}
                    onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="px-4 py-2 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary transition-smooth"
                  >Previous</button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="px-4 py-2 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary transition-smooth"
                  >Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}