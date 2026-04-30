import { supabase } from "@/integrations/supabase/client";

export interface LibraryFolder {
  id: string;
  parent_folder_id: string | null;
  name: string;
  description: string | null;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryFile {
  id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  url: string;
  mime_type: string | null;
  size_bytes: number;
  title: string | null;
  description: string | null;
  category: string | null;
  year: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const BUCKET = "library-files";

export async function listFolders(parentId: string | null): Promise<LibraryFolder[]> {
  const q = supabase.from("library_folders").select("*").order("name");
  const { data, error } = parentId === null
    ? await q.is("parent_folder_id", null)
    : await q.eq("parent_folder_id", parentId);
  if (error) throw error;
  return (data ?? []) as LibraryFolder[];
}

export async function listFiles(folderId: string | null): Promise<LibraryFile[]> {
  const q = supabase.from("library_files").select("*").order("created_at", { ascending: false });
  const { data, error } = folderId === null
    ? await q.is("folder_id", null)
    : await q.eq("folder_id", folderId);
  if (error) throw error;
  return (data ?? []) as LibraryFile[];
}

export async function getFolder(id: string): Promise<LibraryFolder | null> {
  const { data, error } = await supabase.from("library_folders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as LibraryFolder) ?? null;
}

export async function getBreadcrumb(id: string): Promise<LibraryFolder[]> {
  const out: LibraryFolder[] = [];
  let cur: string | null = id;
  let guard = 0;
  while (cur && guard < 50) {
    const f = await getFolder(cur);
    if (!f) break;
    out.unshift(f);
    cur = f.parent_folder_id;
    guard++;
  }
  return out;
}

export async function createFolder(name: string, parentId: string | null, description?: string) {
  const { data, error } = await supabase
    .from("library_folders")
    .insert({ name: name.trim(), parent_folder_id: parentId, description: description ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as LibraryFolder;
}

export async function renameFolder(id: string, name: string) {
  const { error } = await supabase.from("library_folders").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string) {
  // cascade in DB; storage objects under it should be removed too
  const files = await listAllFilesUnder(id);
  if (files.length) {
    const paths = files.map((f) => f.storage_path);
    await supabase.storage.from(BUCKET).remove(paths);
  }
  const { error } = await supabase.from("library_folders").delete().eq("id", id);
  if (error) throw error;
}

export async function listAllFilesUnder(folderId: string): Promise<LibraryFile[]> {
  // walk descendants
  const allIds: string[] = [folderId];
  let frontier: string[] = [folderId];
  while (frontier.length) {
    const { data, error } = await supabase
      .from("library_folders")
      .select("id")
      .in("parent_folder_id", frontier);
    if (error) throw error;
    const next = (data ?? []).map((r: any) => r.id as string);
    allIds.push(...next);
    frontier = next;
  }
  const { data: files, error: fe } = await supabase
    .from("library_files")
    .select("*")
    .in("folder_id", allIds);
  if (fe) throw fe;
  return (files ?? []) as LibraryFile[];
}

export interface UploadProgress { done: number; total: number; current?: string }

export async function uploadFile(file: File, folderId: string | null): Promise<LibraryFile> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safe = file.name.replace(/[\\/]/g, "_");
  const path = `${folderId ?? "root"}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { data, error } = await supabase
    .from("library_files")
    .insert({
      folder_id: folderId,
      name: safe,
      storage_path: path,
      url: pub.publicUrl,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LibraryFile;
}

export async function updateFileMetadata(id: string, patch: Partial<Pick<LibraryFile, "title" | "description" | "category" | "year" | "tags" | "name">>) {
  const { error } = await supabase.from("library_files").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteFile(file: LibraryFile) {
  if (file.storage_path) await supabase.storage.from(BUCKET).remove([file.storage_path]);
  const { error } = await supabase.from("library_files").delete().eq("id", file.id);
  if (error) throw error;
}

export async function searchLibrary(term: string): Promise<{ folders: LibraryFolder[]; files: LibraryFile[] }> {
  const s = term.trim();
  if (!s) return { folders: [], files: [] };
  const safe = s.replace(/[%_,]/g, " ");
  const tsq = s.split(/\s+/).filter(Boolean).map((w) => w.replace(/[:&|!()'\\]/g, "") + ":*").join(" & ");

  const folderQ = supabase
    .from("library_folders")
    .select("*")
    .or(`name.ilike.%${safe}%,path.ilike.%${safe}%,description.ilike.%${safe}%`)
    .limit(50);

  const fileOrs = [
    `name.ilike.%${safe}%`,
    `title.ilike.%${safe}%`,
    `description.ilike.%${safe}%`,
    `category.ilike.%${safe}%`,
  ];
  const fileFilter = tsq ? `search_tsv.fts.${tsq},${fileOrs.join(",")}` : fileOrs.join(",");
  const fileQ = supabase
    .from("library_files")
    .select("*")
    .or(fileFilter)
    .limit(100);

  const [{ data: folders, error: fe }, { data: files, error: xe }] = await Promise.all([folderQ, fileQ]);
  if (fe) throw fe;
  if (xe) throw xe;
  return {
    folders: (folders ?? []) as LibraryFolder[],
    files: (files ?? []) as LibraryFile[],
  };
}

export function fileKind(mime: string | null, name: string): "image" | "video" | "pdf" | "model" | "audio" | "other" {
  const m = (mime ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".glb") || n.endsWith(".gltf") || n.endsWith(".obj") || n.endsWith(".fbx") || n.endsWith(".usdz")) return "model";
  return "other";
}

export function formatBytes(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return `${(b / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}