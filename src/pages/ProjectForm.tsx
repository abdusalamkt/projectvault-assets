import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getProject, ProjectRow, upsertProject } from "@/lib/dam";
import { listBrands, listTaxonomy, Brand, BrandField, BRAND_FIELDS } from "@/lib/settings";
import { COUNTRIES } from "@/lib/countries";
import SearchableSelect from "@/components/dam/SearchableSelect";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FIELD_LABELS: Record<BrandField, string> = {
  sector: "Sector", product: "Product", finish: "Finish",
  contractor: "Contractor", speciality: "Speciality", accessories: "Accessories",
};

export default function ProjectForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState<Partial<ProjectRow>>({ tags: [] });
  const [busy, setBusy] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [taxonomy, setTaxonomy] = useState<Record<BrandField, string[]>>({
    sector: [], product: [], finish: [], contractor: [], speciality: [], accessories: [],
  });
  const [taxLoading, setTaxLoading] = useState(false);

  useEffect(() => {
    listBrands().then(setBrands).catch((e) => toast.error(e.message));
    if (id) getProject(id).then(({ project }) => { if (project) setForm(project); });
  }, [id]);

  const brandId = useMemo(
    () => brands.find((b) => b.name === form.brand)?.id ?? null,
    [brands, form.brand]
  );

  useEffect(() => {
    if (!brandId) {
      setTaxonomy({ sector: [], product: [], finish: [], contractor: [], speciality: [], accessories: [] });
      return;
    }
    setTaxLoading(true);
    Promise.all(BRAND_FIELDS.map((f) => listTaxonomy(brandId, f).then((v) => [f, v.map((x) => x.value)] as const)))
      .then((entries) => {
        const next = { sector: [], product: [], finish: [], contractor: [], speciality: [], accessories: [] } as Record<BrandField, string[]>;
        for (const [k, v] of entries) next[k] = v;
        setTaxonomy(next);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setTaxLoading(false));
  }, [brandId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_no?.trim() || !form.project_name?.trim()) {
      toast.error("Project No and Name are required"); return;
    }
    setBusy(true);
    try {
      const saved = await upsertProject({
        ...(form as any),
        project_no: form.project_no!.trim(),
        project_name: form.project_name!.trim(),
      });
      toast.success(editing ? "Project updated" : "Project created");
      nav(`/projects/${saved.id}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const setField = (k: keyof ProjectRow, v: string | null) => setForm({ ...form, [k]: v });

  return (
    <div className="max-w-2xl">
      <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth mb-6">
        <ArrowLeft size={14} /> Back
      </Link>
      <h1 className="font-display text-4xl font-semibold mb-2">{editing ? "Edit project" : "New project"}</h1>
      <p className="text-muted-foreground mb-8">Pick a brand first — the dropdowns below are scoped to that brand's taxonomy (managed in Settings).</p>

      <form onSubmit={submit} className="space-y-5 bg-card border border-border rounded-sm p-6 shadow-soft">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Project No" required value={form.project_no ?? ""}
            onChange={(v) => setForm({ ...form, project_no: v })} />
          <TextField label="Project Name" required value={form.project_name ?? ""}
            onChange={(v) => setForm({ ...form, project_name: v })} />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Brand <span className="text-gold">*</span></label>
          <SearchableSelect
            value={form.brand ?? null}
            onChange={(v) => setForm({ ...form, brand: v })}
            options={brands.map((b) => b.name)}
            placeholder="Select brand…"
            emptyHint="Add brands in Settings"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Country</label>
          <SearchableSelect
            value={form.country ?? null}
            onChange={(v) => setField("country", v)}
            options={COUNTRIES}
            placeholder="Select country…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {BRAND_FIELDS.map((f) => (
            <div key={f}>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
                {FIELD_LABELS[f]}
              </label>
              <SearchableSelect
                value={(form[f as keyof ProjectRow] as string | null) ?? null}
                onChange={(v) => setField(f as keyof ProjectRow, v)}
                options={taxonomy[f]}
                placeholder={brandId ? (taxLoading ? "Loading…" : `Select ${f}…`) : "Select a brand first"}
                disabled={!brandId || taxLoading}
                emptyHint={`Add ${f} values in Settings → ${form.brand}`}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Description</label>
          <textarea rows={3} value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold transition-smooth" />
        </div>

        <button type="submit" disabled={busy}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-sm hover:bg-primary/90 transition-smooth disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {editing ? "Save changes" : "Create project"}
        </button>
      </form>
    </div>
  );
}

function TextField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
        {label}{required && <span className="text-gold"> *</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold transition-smooth" />
    </div>
  );
}