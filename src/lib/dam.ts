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

export function autoTags(p: Partial<ProjectRow>): string[] {
  return Array.from(new Set([p.sector, p.country, p.product, p.finish].filter(Boolean) as string[]))
    .map((t) => t.trim())
    .filter(Boolean);
}

export interface ListParams {
  search?: string;
  filters?: Partial<Record<FilterField, string[]>>;
  page?: number;
  pageSize?: number;
}

export async function listProjects({ search, filters, page = 0, pageSize = 24 }: ListParams) {
  let q = supabase.from("projects").select("*", { count: "exact" });
  if (search?.trim()) {
    const s = search.trim();
    q = q.or(`project_no.ilike.%${s}%,project_name.ilike.%${s}%`);
  }
  if (filters) {
    for (const f of FILTER_FIELDS) {
      const vals = filters[f];
      if (vals && vals.length) q = q.in(f, vals);
    }
  }
  q = q.order("created_at", { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as ProjectRow[], total: count ?? 0 };
}

export async function getDistinct(field: FilterField) {
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

export async function stats() {
  const [{ count: pCount }, { count: iCount }] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("project_images").select("*", { count: "exact", head: true }),
  ]);
  return { projects: pCount ?? 0, images: iCount ?? 0 };
}