import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getProject, ProjectRow, upsertProject, BRAND_OPTIONS } from "@/lib/dam";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FIELDS: { key: keyof ProjectRow; label: string; required?: boolean; textarea?: boolean }[] = [
  { key: "project_no", label: "Project No", required: true },
  { key: "project_name", label: "Project Name", required: true },
  { key: "sector", label: "Sector" },
  { key: "country", label: "Country" },
  { key: "product", label: "Product" },
  { key: "finish", label: "Finish" },
  { key: "contractor", label: "Contractor" },
  { key: "speciality", label: "Speciality" },
  { key: "accessories", label: "Accessories" },
  { key: "description", label: "Description", textarea: true },
];

export default function ProjectForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState<Partial<ProjectRow>>({ tags: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) getProject(id).then(({ project }) => { if (project) setForm(project); });
  }, [id]);

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

  return (
    <div className="max-w-2xl">
      <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth mb-6">
        <ArrowLeft size={14} /> Back
      </Link>
      <h1 className="font-display text-4xl font-semibold mb-2">{editing ? "Edit project" : "New project"}</h1>
      <p className="text-muted-foreground mb-8">Tags are auto-generated from sector, country, product, and finish.</p>

      <form onSubmit={submit} className="space-y-5 bg-card border border-border rounded-sm p-6 shadow-soft">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Brand</label>
          <select
            value={(form.brand as string) ?? ""}
            onChange={(e) => setForm({ ...form, brand: e.target.value || null })}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold transition-smooth"
          >
            <option value="">— Select brand —</option>
            {BRAND_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        {FIELDS.map((f) => (
          <div key={f.key as string}>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
              {f.label}{f.required && <span className="text-gold"> *</span>}
            </label>
            {f.textarea ? (
              <textarea
                rows={3}
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold transition-smooth"
              />
            ) : (
              <input
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold transition-smooth"
              />
            )}
          </div>
        ))}
        <button
          type="submit" disabled={busy}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-sm hover:bg-primary/90 transition-smooth disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {editing ? "Save changes" : "Create project"}
        </button>
      </form>
    </div>
  );
}