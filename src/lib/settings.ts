import { supabase } from "@/integrations/supabase/client";

export interface Brand { id: string; name: string; sort_order: number }
export interface TaxonomyValue { id: string; brand_id: string | null; field: string; value: string }
export interface AppUser { id: string; username: string; password: string; role: "admin" | "user" }

export const BRAND_FIELDS = ["sector", "product", "finish", "contractor", "speciality", "accessories"] as const;
export type BrandField = (typeof BRAND_FIELDS)[number];

export async function listBrands(): Promise<Brand[]> {
  const { data, error } = await (supabase as any).from("brands").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Brand[];
}

export async function createBrand(name: string) {
  const clean = name.trim();
  if (!clean) throw new Error("Name required");
  const { data: existing } = await (supabase as any).from("brands").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const next = ((existing?.[0]?.sort_order as number | undefined) ?? 0) + 1;
  const { error } = await (supabase as any).from("brands").insert({ name: clean, sort_order: next });
  if (error) throw error;
}

export async function renameBrand(id: string, name: string) {
  const { error } = await (supabase as any).from("brands").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
}

export async function deleteBrand(id: string) {
  const { error } = await (supabase as any).from("brands").delete().eq("id", id);
  if (error) throw error;
}

export async function listTaxonomy(brandId: string, field: BrandField): Promise<TaxonomyValue[]> {
  const { data, error } = await (supabase as any)
    .from("taxonomy_values")
    .select("*")
    .eq("brand_id", brandId)
    .eq("field", field)
    .order("value");
  if (error) throw error;
  return (data ?? []) as TaxonomyValue[];
}

export async function addTaxonomy(brandId: string, field: BrandField, value: string) {
  const clean = value.trim();
  if (!clean) return;
  const { error } = await (supabase as any)
    .from("taxonomy_values")
    .upsert({ brand_id: brandId, field, value: clean }, { onConflict: "brand_id,field,value" });
  if (error) throw error;
}

export async function addTaxonomyBulk(brandId: string, field: BrandField, values: string[]) {
  const rows = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)))
    .map((value) => ({ brand_id: brandId, field, value }));
  if (!rows.length) return 0;
  const { error } = await (supabase as any)
    .from("taxonomy_values")
    .upsert(rows, { onConflict: "brand_id,field,value" });
  if (error) throw error;
  return rows.length;
}

export async function deleteTaxonomy(id: string) {
  const { error } = await (supabase as any).from("taxonomy_values").delete().eq("id", id);
  if (error) throw error;
}

export async function listUsers(): Promise<AppUser[]> {
  const { data, error } = await (supabase as any).from("app_users").select("*").order("username");
  if (error) throw error;
  return (data ?? []) as AppUser[];
}

export async function createUser(u: { username: string; password: string; role: "admin" | "user" }) {
  const { error } = await (supabase as any).from("app_users").insert({
    username: u.username.trim().toLowerCase(),
    password: u.password,
    role: u.role,
  });
  if (error) throw error;
}

export async function updateUser(id: string, patch: Partial<{ username: string; password: string; role: "admin" | "user" }>) {
  const clean: any = { ...patch };
  if (typeof clean.username === "string") clean.username = clean.username.trim().toLowerCase();
  const { error } = await (supabase as any).from("app_users").update(clean).eq("id", id);
  if (error) throw error;
}

export async function deleteUser(id: string) {
  const { error } = await (supabase as any).from("app_users").delete().eq("id", id);
  if (error) throw error;
}