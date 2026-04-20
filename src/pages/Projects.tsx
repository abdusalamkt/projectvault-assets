import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listProjects, ProjectRow, FilterField } from "@/lib/dam";
import FilterPanel from "@/components/dam/FilterPanel";
import ProjectCard from "@/components/dam/ProjectCard";
import { useAuth } from "@/context/AuthContext";
import { Plus, Search, Loader2 } from "lucide-react";

const PAGE_SIZE = 24;

export default function Projects() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<Partial<Record<FilterField, string[]>>>({});
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [JSON.stringify(filters)]);

  useEffect(() => {
    setLoading(true);
    listProjects({ search: debounced, filters, page, pageSize: PAGE_SIZE })
      .then(({ rows, total }) => { setRows(rows); setTotal(total); })
      .finally(() => setLoading(false));
  }, [debounced, JSON.stringify(filters), page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold mb-2">Library</p>
          <h1 className="font-display text-4xl font-semibold">Projects</h1>
          <p className="text-muted-foreground mt-1">{total.toLocaleString()} {total === 1 ? "result" : "results"}</p>
        </div>
        {session?.role === "admin" && (
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-sm hover:bg-primary/90 transition-smooth self-start md:self-auto"
          >
            <Plus size={16} /> Add Project
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <FilterPanel value={filters} onChange={setFilters} />

        <div>
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project number or name…"
              className="w-full bg-card border border-border rounded-sm pl-10 pr-4 py-3 focus:outline-none focus:border-gold transition-smooth"
            />
          </div>

          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-sm">
              <p className="font-display text-2xl mb-2">No projects found</p>
              <p className="text-muted-foreground text-sm">
                {session?.role === "admin"
                  ? "Add a project or import a CSV to get started."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {rows.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                    className="px-4 py-2 border border-border rounded-sm text-sm disabled:opacity-40 hover:bg-secondary transition-smooth"
                  >Previous</button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
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