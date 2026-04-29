import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteImage, deleteProject, getProject, ProjectImage, ProjectRow, uploadImage, addImageUrls, setProjectTags } from "@/lib/dam";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Download, Edit, Trash2, Upload, X, Loader2, FileDown, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { downloadAsZip, downloadSingleImage, fetchAsBlob, fileNameFromUrl } from "@/lib/download";
import { buildSingleProjectPdf } from "@/lib/pdf";

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagBusy, setTagBusy] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    getProject(id).then(({ project, images }) => {
      setProject(project); setImages(images);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const onUpload = async (files: FileList | null) => {
    if (!files || !id) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadImage(id, f);
      toast.success(`Uploaded ${files.length} image(s)`);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const onDelete = async () => {
    if (!project || !confirm(`Delete project "${project.project_name}"? This removes all its images.`)) return;
    await deleteProject(project.id);
    toast.success("Project deleted");
    nav("/projects");
  };

  const downloadAll = async () => {
    if (!project || !images.length) return;
    setZipProgress({ done: 0, total: images.length });
    try {
      if (images.length === 1) {
        await downloadSingleImage(images[0].url, fileNameFromUrl(images[0].url));
      } else {
        const files = images.map((img, i) => ({
          folder: `${project.project_no}-${project.project_name}`,
          name: `${String(i + 1).padStart(3, "0")}-${fileNameFromUrl(img.url)}`,
          url: img.url,
        }));
        await downloadAsZip(files, `${project.project_no}-${project.project_name}.zip`,
          (d, t) => setZipProgress({ done: d, total: t }));
      }
      toast.success("Downloaded");
    } catch (e: any) { toast.error(e.message); }
    finally { setZipProgress(null); }
  };

  const exportPdf = async () => {
    if (!project) return;
    setPdfBusy(true);
    try {
      const doc = await buildSingleProjectPdf(project, images);
      doc.save(`${project.project_no}-${project.project_name}.pdf`);
      toast.success("PDF exported");
    } catch (e: any) {
      toast.error(e.message ?? "PDF export failed");
    } finally {
      setPdfBusy(false);
    }
  };

  const saveTags = async (next: string[]) => {
    if (!project) return;
    setTagBusy(true);
    try {
      const saved = await setProjectTags(project.id, next);
      setProject({ ...project, tags: saved });
    } catch (e: any) { toast.error(e.message); }
    finally { setTagBusy(false); }
  };

  const addTag = async () => {
    if (!project) return;
    const t = tagDraft.trim();
    if (!t) return;
    if (project.tags.includes(t)) { setTagDraft(""); return; }
    await saveTags([...project.tags, t]);
    setTagDraft("");
  };

  const removeTag = async (t: string) => {
    if (!project) return;
    await saveTags(project.tags.filter((x) => x !== t));
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  if (!project) return <div className="text-center py-20"><p className="font-display text-2xl">Project not found</p></div>;

  return (
    <div>
      <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth mb-6">
        <ArrowLeft size={14} /> Back to projects
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold mb-2">#{project.project_no}</p>
          <h1 className="font-display text-4xl font-semibold">{project.project_name}</h1>
          <p className="text-muted-foreground mt-2">
            {[project.sector, project.country, project.contractor].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPdf} disabled={pdfBusy} className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-sm text-sm hover:bg-secondary transition-smooth disabled:opacity-50">
            {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
          </button>
          {images.length > 0 && (
            <button onClick={downloadAll} disabled={!!zipProgress} className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-sm text-sm hover:bg-secondary transition-smooth disabled:opacity-50">
              {zipProgress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {zipProgress ? `${zipProgress.done}/${zipProgress.total}` : (images.length > 1 ? "Images (ZIP)" : "Image")}
            </button>
          )}
          {isAdmin && (
            <>
              <Link to={`/projects/${project.id}/edit`} className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-sm text-sm hover:bg-primary/90 transition-smooth">
                <Edit size={14} /> Edit
              </Link>
              <button onClick={onDelete} className="inline-flex items-center gap-2 px-3 py-2 border border-destructive text-destructive rounded-sm text-sm hover:bg-destructive hover:text-destructive-foreground transition-smooth">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        <div>
          {images.length === 0 ? (
            <div className="border border-dashed border-border rounded-sm py-20 text-center text-muted-foreground">
              No images yet
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setLightbox(i)}
                  className="group relative aspect-square overflow-hidden rounded-sm bg-muted">
                  <img src={img.url} alt="" loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-smooth duration-500" />
                  <span
                    onClick={async (e) => {
                      e.stopPropagation();
                      try { await downloadSingleImage(img.url, fileNameFromUrl(img.url)); }
                      catch (err: any) { toast.error(err.message); }
                    }}
                    title="Download"
                    className="absolute top-2 left-2 p-1.5 bg-background/90 text-foreground rounded-sm opacity-0 group-hover:opacity-100 transition-smooth hover:bg-background"
                  ><Download size={12} /></span>
                  {isAdmin && (
                    <span
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Delete this image?")) { await deleteImage(img); load(); }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-sm opacity-0 group-hover:opacity-100 transition-smooth"
                    ><Trash2 size={12} /></span>
                  )}
                </button>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="mt-6">
              <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2.5 border border-dashed border-border rounded-sm hover:border-gold hover:bg-secondary/50 transition-smooth">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span className="text-sm">{uploading ? "Uploading…" : "Upload images"}</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => onUpload(e.target.files)} disabled={uploading} />
              </label>
              <UrlAdder onAdd={async (urls) => { await addImageUrls(project.id, urls); load(); }} />
            </div>
          )}
        </div>

        <aside className="bg-card border border-border rounded-sm p-5 shadow-soft h-fit">
          <h3 className="font-display text-lg font-semibold mb-4">Details</h3>
          {[
            ["Sector", project.sector], ["Country", project.country],
            ["Product", project.product], ["Finish", project.finish],
            ["Contractor", project.contractor],
          ].map(([k, v]) => (
            <div key={k as string} className="py-2 border-b border-border last:border-0">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{k}</div>
              <div className="text-sm mt-1">{(v as string) || "—"}</div>
            </div>
          ))}
          {project.description && (
            <div className="py-2 mt-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Description</div>
              <p className="text-sm mt-1 text-foreground/80">{project.description}</p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {project.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
              {project.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-sm">
                  {t}
                  {isAdmin && (
                    <button onClick={() => removeTag(t)} disabled={tagBusy} className="hover:text-destructive transition-smooth">
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isAdmin && (
              <div className="flex gap-1.5">
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag…"
                  className="flex-1 bg-background border border-border rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-gold transition-smooth"
                />
                <button
                  onClick={addTag}
                  disabled={tagBusy || !tagDraft.trim()}
                  className="px-2 py-1 bg-primary text-primary-foreground rounded-sm text-xs disabled:opacity-40 hover:bg-primary/90 transition-smooth inline-flex items-center"
                ><Plus size={12} /></button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {lightbox !== null && images[lightbox] && (
        <div onClick={() => setLightbox(null)}
          className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-6 cursor-zoom-out">
          <button className="absolute top-4 right-4 text-background p-2"><X /></button>
          <img src={images[lightbox].url} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

function UrlAdder({ onAdd }: { onAdd: (urls: string[]) => Promise<void> }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const urls = v.split(/[\n|,]/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
    if (!urls.length) { toast.error("Paste one or more image URLs"); return; }
    setBusy(true);
    try { await onAdd(urls); setV(""); toast.success(`Added ${urls.length} image(s)`); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-3 flex gap-2">
      <input
        value={v} onChange={(e) => setV(e.target.value)}
        placeholder="…or paste image URLs (one per line, comma, or |)"
        className="flex-1 bg-card border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gold transition-smooth"
      />
      <button onClick={submit} disabled={busy}
        className="px-3 py-2 bg-primary text-primary-foreground rounded-sm text-sm hover:bg-primary/90 transition-smooth disabled:opacity-50">
        Add
      </button>
    </div>
  );
}