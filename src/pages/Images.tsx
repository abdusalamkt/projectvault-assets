import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  listImages, ImageWithProject, FilterFieldExt, bulkAddImageTags, setImageTags,
} from "@/lib/dam";
import FilterPanel from "@/components/dam/FilterPanel";
import SearchBar from "@/components/dam/SearchBar";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2, CheckSquare, Square, Tag, Download, X, ExternalLink, Plus,
} from "lucide-react";
import { downloadAsZip, downloadSingleImage, fileNameFromUrl } from "@/lib/download";

const PAGE_SIZE = 48;

interface Chip { label: string; type: string; value: string }

export default function Images() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [chips, setChips] = useState<Chip[]>([]);
  const [filters, setFilters] = useState<Partial<Record<FilterFieldExt, string[]>>>({ brand: ["Hufcor"] });
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterInput, setTagFilterInput] = useState("");
  const [sort, setSort] = useState<"created_desc" | "created_asc">("created_desc");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ImageWithProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [JSON.stringify(filters), JSON.stringify(tagFilter), JSON.stringify(chips), sort]);

  useEffect(() => {
    setLoading(true);
    listImages({
      search: debounced,
      searchTerms: chips.map((c) => c.value),
      filters, tags: tagFilter, page, pageSize: PAGE_SIZE, sort,
    })
      .then(({ rows, total }) => { setRows(rows); setTotal(total); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [debounced, JSON.stringify(filters), JSON.stringify(tagFilter), JSON.stringify(chips), page, sort]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const addChip = (c: Chip) => {
    setChips((prev) => prev.some((p) => p.type === c.type && p.value.toLowerCase() === c.value.toLowerCase()) ? prev : [...prev, c]);
  };
  const removeChip = (i: number) => setChips((prev) => prev.filter((_, idx) => idx !== i));

  const addTagFilter = () => {
    const t = tagFilterInput.trim();
    if (!t) return;
    if (tagFilter.includes(t)) { setTagFilterInput(""); return; }
    setTagFilter([...tagFilter, t]);
    setTagFilterInput("");
  };
  const removeTagFilter = (t: string) => setTagFilter(tagFilter.filter((x) => x !== t));

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
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); setBulkTag(""); };

  const applyBulkTags = async () => {
    const tags = bulkTag.split(",").map((t) => t.trim()).filter(Boolean);
    if (!tags.length) return toast.error("Enter at least one tag");
    if (!selected.size) return toast.error("Select images first");
    setBulkBusy(true);
    try {
      await bulkAddImageTags(Array.from(selected), tags);
      toast.success(`Added ${tags.length} tag(s) to ${selected.size} image(s)`);
      setBulkTag("");
      const res = await listImages({
        search: debounced, searchTerms: chips.map((c) => c.value), filters, tags: tagFilter, page, pageSize: PAGE_SIZE, sort,
      });
      setRows(res.rows); setTotal(res.total);
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkBusy(false); }
  };

  const downloadSelected = async () => {
    if (!selected.size) return toast.error("Select images first");
    const imgs = rows.filter((r) => selected.has(r.id));
    // If selected extends across pages, we still only zip what's loaded here.
    // Fetch missing? Keep it simple: warn if selection spans unloaded pages.
    if (imgs.length !== selected.size) {
      toast.message("Note: only images on visible pages will be included.");
    }
    if (!imgs.length) return;
    setBulkBusy(true);
    setZipProgress({ done: 0, total: imgs.length });
    try {
      const files = imgs.map((img, i) => ({
        folder: `${img.project_no}-${img.project_name}`,
        name: `${String(i + 1).padStart(3, "0")}-${fileNameFromUrl(img.url)}`,
        url: img.url,
      }));
      await downloadAsZip(files, `gibca-dam-${imgs.length}-images.zip`, (d, t) => setZipProgress({ done: d, total: t }));
      toast.success(`Downloaded ${imgs.length} image(s)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkBusy(false); setZipProgress(null); }
  };

  const updateLightboxImage = (next: ImageWithProject) => {
    setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold mb-2">Library</p>
          <h1 className="font-display text-4xl font-semibold">Images</h1>
          <p className="text-muted-foreground mt-1">{total.toLocaleString()} {total === 1 ? "image" : "images"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectMode((v) => !v); if (selectMode) setSelected(new Set()); }}
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm border transition-smooth ${
              selectMode ? "border-gold text-gold bg-gold/5" : "border-border hover:bg-secondary"
            }`}
          >
            {selectMode ? <CheckSquare size={16} /> : <Square size={16} />}
            {selectMode ? "Selecting" : "Select"}
          </button>
          <select
            value={sort} onChange={(e) => setSort(e.target.value as any)}
            className="bg-card border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-smooth"
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <div className="space-y-4">
          <FilterPanel value={filters} onChange={setFilters} />
          <div className="bg-card border border-border rounded-sm p-5 shadow-soft">
            <h3 className="font-display text-lg font-semibold mb-3">Image tags</h3>
            <div className="flex gap-1.5 mb-2">
              <input
                value={tagFilterInput}
                onChange={(e) => setTagFilterInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTagFilter(); } }}
                placeholder="Add tag…"
                className="flex-1 bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-gold transition-smooth"
              />
              <button
                onClick={addTagFilter}
                disabled={!tagFilterInput.trim()}
                className="px-2 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm disabled:opacity-40 inline-flex items-center"
              ><Plus size={14} /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tagFilter.length === 0 && <p className="text-xs text-muted-foreground">Filter images by their own tags.</p>}
              {tagFilter.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-sm">
                  {t}
                  <button onClick={() => removeTagFilter(t)} className="hover:text-destructive"><X size={10} /></button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-6">
            <SearchBar value={search} onChange={setSearch} onPickChip={addChip} placeholder="Search projects, contractors, tags…" />
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {chips.map((c, i) => (
                  <span key={`${c.type}:${c.value}:${i}`} className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-sm pl-2 pr-1 py-1 text-xs">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.type}</span>
                    <span className="font-medium">{c.label}</span>
                    <button onClick={() => removeChip(i)} className="hover:text-destructive p-0.5"><X size={11} /></button>
                  </span>
                ))}
                <button onClick={() => setChips([])} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1">Clear</button>
              </div>
            )}
          </div>

          {selectMode && (
            <div className="mb-5 bg-card border border-gold/40 rounded-sm p-4 flex flex-wrap items-center gap-3 shadow-soft">
              <button onClick={selectAllOnPage} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                {rows.every((r) => selected.has(r.id)) && rows.length > 0 ? "Unselect page" : "Select page"}
              </button>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">Clear</button>
              )}
              <span className="text-sm font-medium">{selected.size} selected</span>
              <div className="flex-1" />
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-gold" />
                  <input
                    value={bulkTag}
                    onChange={(e) => setBulkTag(e.target.value)}
                    placeholder="tag1, tag2…"
                    className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-gold transition-smooth"
                  />
                  <button
                    onClick={applyBulkTags}
                    disabled={bulkBusy || !selected.size}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm disabled:opacity-40 hover:bg-primary/90"
                  >Apply tags</button>
                </div>
              )}
              <button
                onClick={downloadSelected}
                disabled={bulkBusy || !selected.size}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary"
              >
                {bulkBusy && zipProgress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {zipProgress ? `${zipProgress.done}/${zipProgress.total}` : "Download (ZIP)"}
              </button>
              <button onClick={exitSelect} className="p-1.5 hover:bg-secondary rounded-sm"><X size={14} /></button>
            </div>
          )}

          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-sm">
              <p className="font-display text-2xl mb-2">No images found</p>
              <p className="text-muted-foreground text-sm">Try adjusting search, filters or tags.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {rows.map((img, i) => {
                  const isSel = selected.has(img.id);
                  return (
                    <motion.div
                      key={img.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      className="group relative aspect-square overflow-hidden rounded-sm bg-muted"
                    >
                      <button
                        onClick={() => selectMode ? toggleSel(img.id) : setLightbox(i)}
                        className="absolute inset-0"
                      >
                        <img src={img.url} alt="" loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-smooth duration-500" />
                      </button>
                      {selectMode && (
                        <span className={`absolute top-2 left-2 w-5 h-5 rounded-sm border-2 flex items-center justify-center pointer-events-none transition-smooth ${
                          isSel ? "bg-gold border-gold" : "bg-background/80 border-border"
                        }`}>
                          {isSel && <span className="text-[10px] text-background">✓</span>}
                        </span>
                      )}
                      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-foreground/80 to-transparent opacity-0 group-hover:opacity-100 transition-smooth pointer-events-none">
                        <p className="text-[10px] text-background/80 uppercase tracking-widest truncate">#{img.project_no}</p>
                        <p className="text-xs text-background truncate">{img.project_name}</p>
                      </div>
                      {img.tags?.length > 0 && (
                        <span className="absolute top-2 right-2 text-[10px] bg-background/80 rounded-sm px-1.5 py-0.5">
                          {img.tags.length} tag{img.tags.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button disabled={page === 0} onClick={() => setPage(page - 1)}
                    className="px-4 py-2 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary">Previous</button>
                  <span className="text-sm text-muted-foreground px-3">Page {page + 1} of {totalPages}</span>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
                    className="px-4 py-2 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lightbox !== null && rows[lightbox] && (
        <ImageLightbox
          image={rows[lightbox]}
          isAdmin={!!isAdmin}
          onClose={() => setLightbox(null)}
          onPrev={lightbox > 0 ? () => setLightbox(lightbox - 1) : undefined}
          onNext={lightbox < rows.length - 1 ? () => setLightbox(lightbox + 1) : undefined}
          onSaved={(next) => updateLightboxImage(next)}
        />
      )}
    </div>
  );
}

function ImageLightbox({
  image, isAdmin, onClose, onPrev, onNext, onSaved,
}: {
  image: ImageWithProject;
  isAdmin: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSaved: (next: ImageWithProject) => void;
}) {
  const [tags, setTags] = useState<string[]>(image.tags ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTags(image.tags ?? []); setDraft(""); }, [image.id]);

  const persist = async (next: string[]) => {
    setBusy(true);
    try {
      const saved = await setImageTags(image.id, next);
      setTags(saved);
      onSaved({ ...image, tags: saved });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const addTag = () => {
    const t = draft.trim();
    if (!t || tags.includes(t)) { setDraft(""); return; }
    persist([...tags, t]);
    setDraft("");
  };
  const removeTag = (t: string) => persist(tags.filter((x) => x !== t));

  return (
    <div className="fixed inset-0 bg-foreground/95 z-50 flex flex-col p-4 md:p-8" onClick={onClose}>
      <div className="flex items-center justify-between text-background mb-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-background/60">#{image.project_no}</p>
          <p className="font-display text-lg">{image.project_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${image.project_id}`}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gold text-foreground rounded-sm text-sm hover:bg-gold/90 transition-smooth"
          >
            <ExternalLink size={14} /> Go to project
          </Link>
          <button
            onClick={() => downloadSingleImage(image.url, fileNameFromUrl(image.url)).catch((e) => toast.error(e.message))}
            className="inline-flex items-center gap-2 px-3 py-2 border border-background/40 rounded-sm text-sm hover:bg-background/10"
          ><Download size={14} /> Download</button>
          <button onClick={onClose} className="p-2 hover:bg-background/10 rounded-sm"><X /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0 relative" onClick={(e) => e.stopPropagation()}>
        {onPrev && (
          <button onClick={onPrev} className="absolute left-2 text-background/70 hover:text-background p-3 text-2xl">‹</button>
        )}
        <img src={image.url} alt="" className="max-w-full max-h-full object-contain" />
        {onNext && (
          <button onClick={onNext} className="absolute right-2 text-background/70 hover:text-background p-3 text-2xl">›</button>
        )}
      </div>
      <div className="mt-4 bg-card rounded-sm p-4 max-w-3xl w-full mx-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <Tag size={14} className="text-gold" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Image tags</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet</span>}
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-sm">
              {t}
              {isAdmin && (
                <button onClick={() => removeTag(t)} disabled={busy} className="hover:text-destructive"><X size={10} /></button>
              )}
            </span>
          ))}
        </div>
        {isAdmin && (
          <div className="flex gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Add tag…"
              className="flex-1 bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
            />
            <button
              onClick={addTag}
              disabled={busy || !draft.trim()}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm disabled:opacity-40 inline-flex items-center gap-1"
            ><Plus size={12} /> Add</button>
          </div>
        )}
      </div>
    </div>
  );
}