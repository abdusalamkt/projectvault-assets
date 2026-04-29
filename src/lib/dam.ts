import { supabase } from "@/integrations/supabase/client";

export interface ProjectRow {
  id: string;
  project_no: string;
  project_name: string;
  sector: string | null;
  country: string | null;
  product: string | null;
  finish: string | null;
  contractor: string | null;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  url: string;
  storage_path: string | null;
  tags: string[];
  sort_order: number;
  created_at: string;
}

export const FILTER_FIELDS = ["sector", "country", "product", "finish"] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

export const ALL_FILTER_FIELDS = ["sector", "country", "product", "finish", "contractor"] as const;
export type FilterFieldExt = (typeof ALL_FILTER_FIELDS)[number];

export type SortKey =
  | "created_desc"
  | "created_asc"
  | "no_asc"
  | "no_desc"
  | "name_asc"
  | "name_desc";

const SORT_MAP: Record<SortKey, { col: string; asc: boolean }> = {
  created_desc: { col: "created_at", asc: false },
  created_asc:  { col: "created_at", asc: true  },
  no_asc:       { col: "project_no", asc: true  },
  no_desc:      { col: "project_no", asc: false },
  name_asc:     { col: "project_name", asc: true  },
  name_desc:    { col: "project_name", asc: false },
};

export function autoTags(p: Partial<ProjectRow>): string[] {
  return Array.from(new Set([p.sector, p.country, p.product, p.finish].filter(Boolean) as string[]))
    .map((t) => t.trim())
    .filter(Boolean);
}

export interface ListParams {
  search?: string;
  searchTerms?: string[];
  filters?: Partial<Record<FilterFieldExt, string[]>>;
  page?: number;
  pageSize?: number;
  sort?: SortKey;
}

export async function listProjects({ search, searchTerms, filters, page = 0, pageSize = 24, sort = "created_desc" }: ListParams) {
  let q = supabase.from("projects").select("*", { count: "exact" });
  // Build a list of terms; each term must match (AND) across any text field.
  const terms = [
    ...(searchTerms ?? []).map((t) => t.trim()).filter(Boolean),
    ...(search?.trim() ? [search.trim()] : []),
  ];
  for (const s of terms) {
    // Full-text via tsvector + fallback ILIKE for partial substrings (project no etc.)
    const tsq = s.split(/\s+/).filter(Boolean).map((w) => w.replace(/[:&|!()'\\]/g, "") + ":*").join(" & ");
    const safe = s.replace(/[%_,]/g, " ");
    const ors = [
      `project_no.ilike.%${safe}%`,
      `project_name.ilike.%${safe}%`,
      `contractor.ilike.%${safe}%`,
      `sector.ilike.%${safe}%`,
      `country.ilike.%${safe}%`,
      `product.ilike.%${safe}%`,
      `finish.ilike.%${safe}%`,
      `description.ilike.%${safe}%`,
    ];
    if (tsq) {
      q = q.or(`search_tsv.fts.${tsq},${ors.join(",")}`);
    } else {
      q = q.or(ors.join(","));
    }
  }
  if (filters) {
    for (const f of ALL_FILTER_FIELDS) {
      const vals = filters[f];
      if (vals && vals.length) q = q.in(f, vals);
    }
  }
  const { col, asc } = SORT_MAP[sort];
  q = q.order(col, { ascending: asc }).range(page * pageSize, page * pageSize + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as ProjectRow[], total: count ?? 0 };
}

export async function getDistinct(field: FilterFieldExt) {
  const { data, error } = await supabase.from("projects").select(field).not(field, "is", null).limit(2000);
  if (error) throw error;
  const set = new Set<string>();
  (data ?? []).forEach((r: any) => { if (r[field]) set.add(r[field]); });
  return Array.from(set).sort();
}

export async function getProject(id: string) {
  const [{ data: project, error: e1 }, { data: images, error: e2 }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("project_images").select("*").eq("project_id", id).order("sort_order"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { project: project as ProjectRow | null, images: (images ?? []) as ProjectImage[] };
}

export async function getProjectByNo(projectNo: string) {
  const { data, error } = await supabase.from("projects").select("id").eq("project_no", projectNo).maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

export async function upsertProject(p: Partial<ProjectRow> & { project_no: string; project_name: string }) {
  const tags = Array.from(new Set([...(p.tags ?? []), ...autoTags(p)]));
  const { data, error } = await supabase
    .from("projects")
    .upsert({ ...p, tags }, { onConflict: "project_no" })
    .select()
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function addImageUrls(projectId: string, urls: string[]) {
  if (!urls.length) return;
  const rows = urls.map((url, i) => ({ project_id: projectId, url, sort_order: i }));
  const { error } = await supabase.from("project_images").insert(rows);
  if (error) throw error;
}

export async function uploadImage(projectId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("project-images").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("project-images").getPublicUrl(path);
  const { error } = await supabase.from("project_images").insert({
    project_id: projectId, url: pub.publicUrl, storage_path: path,
  });
  if (error) throw error;
  return pub.publicUrl;
}

export async function deleteImage(img: ProjectImage) {
  if (img.storage_path) await supabase.storage.from("project-images").remove([img.storage_path]);
  await supabase.from("project_images").delete().eq("id", img.id);
}

/** Add tags (deduped) to a single project */
export async function addProjectTags(projectId: string, newTags: string[]) {
  const { data, error } = await supabase.from("projects").select("tags").eq("id", projectId).single();
  if (error) throw error;
  const merged = Array.from(new Set([...(data?.tags ?? []), ...newTags.map((t) => t.trim()).filter(Boolean)]));
  const { error: e2 } = await supabase.from("projects").update({ tags: merged }).eq("id", projectId);
  if (e2) throw e2;
  return merged;
}

/** Bulk add tags to many projects (admin) */
export async function bulkAddTags(projectIds: string[], newTags: string[]) {
  const clean = newTags.map((t) => t.trim()).filter(Boolean);
  if (!clean.length || !projectIds.length) return;
  const { data, error } = await supabase.from("projects").select("id, tags").in("id", projectIds);
  if (error) throw error;
  await Promise.all(
    (data ?? []).map((row: any) => {
      const merged = Array.from(new Set([...(row.tags ?? []), ...clean]));
      return supabase.from("projects").update({ tags: merged }).eq("id", row.id);
    })
  );
}

export async function setProjectTags(projectId: string, tags: string[]) {
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  const { error } = await supabase.from("projects").update({ tags: clean }).eq("id", projectId);
  if (error) throw error;
  return clean;
}

export async function getImagesForProjects(projectIds: string[]) {
  if (!projectIds.length) return [] as (ProjectImage & { project_no: string; project_name: string })[];
  const { data, error } = await supabase
    .from("project_images")
    .select("*, projects!inner(project_no, project_name)")
    .in("project_id", projectIds)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    project_no: r.projects.project_no,
    project_name: r.projects.project_name,
  })) as (ProjectImage & { project_no: string; project_name: string })[];
}

/** Suggestions for the global search bar */
export async function searchSuggestions(term: string, limit = 8) {
  const s = term.trim();
  if (s.length < 2) return [] as { label: string; type: string; value: string }[];
  const safe = s.replace(/[%_,]/g, " ");
  const { data, error } = await supabase
    .from("projects")
    .select("project_no, project_name, contractor, sector, country, product, finish, tags")
    .or(
      `project_no.ilike.%${safe}%,project_name.ilike.%${safe}%,contractor.ilike.%${safe}%,sector.ilike.%${safe}%,country.ilike.%${safe}%,product.ilike.%${safe}%,finish.ilike.%${safe}%`
    )
    .limit(40);
  if (error) throw error;
  const lower = s.toLowerCase();
  const out = new Map<string, { label: string; type: string; value: string }>();
  const add = (type: string, value: string | null) => {
    if (!value) return;
    if (!value.toLowerCase().includes(lower)) return;
    const k = `${type}:${value.toLowerCase()}`;
    if (!out.has(k)) out.set(k, { label: value, type, value });
  };
  (data ?? []).forEach((r: any) => {
    add("Project", `${r.project_no} — ${r.project_name}`);
    add("Contractor", r.contractor);
    add("Sector", r.sector);
    add("Country", r.country);
    add("Product", r.product);
    add("Finish", r.finish);
    (r.tags ?? []).forEach((t: string) => add("Tag", t));
  });
  return Array.from(out.values()).slice(0, limit);
}

export async function stats() {
  const [{ count: pCount }, { count: iCount }] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("project_images").select("*", { count: "exact", head: true }),
  ]);
  return { projects: pCount ?? 0, images: iCount ?? 0 };
}