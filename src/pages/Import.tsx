import { useState } from "react";
import Papa from "papaparse";
import { addImageUrls, autoTags, getProjectByNo } from "@/lib/dam";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface Row {
  project_no: string; project_name: string;
  sector?: string; country?: string; product?: string; finish?: string;
  contractor?: string; description?: string; images?: string;
}

const ALIASES: Record<string, keyof Row> = {
  "project no": "project_no", "project number": "project_no", "projectno": "project_no", "project_no": "project_no",
  "project name": "project_name", "projectname": "project_name", "project_name": "project_name",
  "sector": "sector", "country": "country", "product": "product", "finish": "finish",
  "contractor": "contractor", "description": "description",
  "images": "images", "image": "images", "image urls": "images",
};

const SAMPLE = `Project No,Project Name,Sector,Country,Product,Finish,Contractor,Images
1001,Marina Office Tower,Commercial,UAE,Furniture,Wood,ABC Contracting,https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200|https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200
1002,Garden Villa,Residential,KSA,Lighting,Brass,Al-Noor LLC,https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200
1003,Heritage Hotel,Hospitality,Egypt,Joinery,Walnut,Cairo Build Co,https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200|https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200
1004,Tech Campus,Commercial,Qatar,Furniture,Steel,Doha Interiors,https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200`;

export default function Import() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({
    done: 0, total: 0, created: 0, updated: 0,
    createdRows: [] as string[],
    updatedRows: [] as string[],
    errors: [] as string[],
  });

  const parseHeader = (h: string) => ALIASES[h.trim().toLowerCase()];

  const handleFile = (file: File) => {
    setBusy(true);
    setProgress({ done: 0, total: 0, created: 0, updated: 0, createdRows: [], updatedRows: [], errors: [] });

    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows: Row[] = [];
        for (const r of res.data) {
          const mapped: Row = { project_no: "", project_name: "" };
          for (const k of Object.keys(r)) {
            const key = parseHeader(k);
            if (key) (mapped as any)[key] = (r[k] ?? "").toString().trim();
          }
          if (mapped.project_no && mapped.project_name) rows.push(mapped);
        }

        let created = 0, updated = 0;
        const errors: string[] = [];
        const createdRows: string[] = [];
        const updatedRows: string[] = [];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          try {
            const existing = await getProjectByNo(r.project_no);
            const tags = autoTags(r);
            const payload = {
              project_no: r.project_no, project_name: r.project_name,
              sector: r.sector || null, country: r.country || null,
              product: r.product || null, finish: r.finish || null,
              contractor: r.contractor || null, description: r.description || null,
              tags,
            };
            const { data, error } = await supabase
              .from("projects").upsert(payload, { onConflict: "project_no" }).select().single();
            if (error) throw error;
            if (existing) { updated++; updatedRows.push(`${r.project_no} — ${r.project_name}`); }
            else          { created++; createdRows.push(`${r.project_no} — ${r.project_name}`); }

            if (r.images) {
              const urls = r.images.split("|").map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));
              if (urls.length) {
                if (existing) await supabase.from("project_images").delete().eq("project_id", data.id);
                await addImageUrls(data.id, urls);
              }
            }
          } catch (e: any) {
            errors.push(`Row ${i + 1} (${r.project_no || "—"}): ${e.message}`);
          }
          setProgress({ done: i + 1, total: rows.length, created, updated, createdRows, updatedRows, errors });
        }

        toast.success(`Imported: ${created} created, ${updated} updated${errors.length ? `, ${errors.length} errors` : ""}`);
        setBusy(false);
      },
      error: (err) => { toast.error(err.message); setBusy(false); },
    });
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "atlas-dam-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-widest text-gold mb-2">Admin</p>
      <h1 className="font-display text-4xl font-semibold mb-2">Bulk import</h1>
      <p className="text-muted-foreground mb-8">
        Upload a CSV. Headers are matched flexibly. Existing rows (by Project No) are updated.
      </p>

      <label className="block bg-card border-2 border-dashed border-border hover:border-gold rounded-sm p-10 text-center cursor-pointer transition-smooth">
        {busy ? <Loader2 className="mx-auto animate-spin text-gold mb-3" /> : <Upload className="mx-auto text-gold mb-3" />}
        <p className="font-display text-xl mb-1">{busy ? "Importing…" : "Drop or click to upload CSV"}</p>
        <p className="text-sm text-muted-foreground">Up to 5,000+ rows supported</p>
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </label>

      <button onClick={downloadSample}
        className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-smooth">
        <Download size={14} /> Download sample CSV
      </button>

      {progress.total > 0 && (
        <div className="mt-8 bg-card border border-border rounded-sm p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="text-gold" size={18} />
            <span className="font-medium">Progress: {progress.done} / {progress.total}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gold transition-smooth"
              style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
            <Stat label="Created" value={progress.created} icon={<CheckCircle2 size={14} className="text-gold" />} />
            <Stat label="Updated" value={progress.updated} icon={<CheckCircle2 size={14} className="text-gold" />} />
            <Stat label="Errors" value={progress.errors.length} icon={<AlertCircle size={14} className="text-destructive" />} />
          </div>
          {progress.errors.length > 0 && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-muted-foreground">View errors</summary>
              <ul className="mt-2 space-y-1 text-destructive">
                {progress.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
          {progress.createdRows.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">View created ({progress.createdRows.length})</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-auto">
                {progress.createdRows.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </details>
          )}
          {progress.updatedRows.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">View updated ({progress.updatedRows.length})</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-auto">
                {progress.updatedRows.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="mt-10 text-xs text-muted-foreground bg-secondary/50 p-4 rounded-sm">
        <strong className="text-foreground">Expected columns:</strong> Project No, Project Name, Sector, Country,
        Product, Finish, Contractor, Description, Images. Multiple image URLs separated by <code>|</code>.
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}