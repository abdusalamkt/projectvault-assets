import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Folder, FolderPlus, Search, Trash2, Download, Edit3, ChevronRight,
  FileText, Image as ImageIcon, Video, Box, Music, File as FileIcon, X, Loader2, Tag,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  LibraryFolder, LibraryFile,
  listFolders, listFiles, createFolder, deleteFolder, renameFolder,
  uploadFile, deleteFile, updateFileMetadata, getBreadcrumb,
  searchLibrary, listAllFilesUnder, fileKind, formatBytes,
} from "@/lib/library";
import DropZone from "@/components/dam/DropZone";
import { downloadAsZip, downloadSingleImage } from "@/lib/download";
import { toast } from "sonner";

function KindIcon({ kind, className }: { kind: ReturnType<typeof fileKind>; className?: string }) {
  const cls = className ?? "w-5 h-5";
  switch (kind) {
    case "image": return <ImageIcon className={cls} />;
    case "video": return <Video className={cls} />;
    case "pdf": return <FileText className={cls} />;
    case "model": return <Box className={cls} />;
    case "audio": return <Music className={cls} />;
    default: return <FileIcon className={cls} />;
  }
}

export default function Library() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const [params, setParams] = useSearchParams();
  const folderId = params.get("folder");

  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [crumbs, setCrumbs] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ folders: LibraryFolder[]; files: LibraryFile[] } | null>(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editFile, setEditFile] = useState<LibraryFile | null>(null);
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fs, xs, bc] = await Promise.all([
        listFolders(folderId),
        listFiles(folderId),
        folderId ? getBreadcrumb(folderId) : Promise.resolve([]),
      ]);
      setFolders(fs); setFiles(xs); setCrumbs(bc);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load");
    } finally { setLoading(false); }
  }, [folderId]);

  useEffect(() => { refresh(); }, [refresh]);

  // debounced search
  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchLibrary(query)
        .then(setSearchResults)
        .catch((e) => toast.error(e.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const navigate = (id: string | null) => {
    if (id) setParams({ folder: id });
    else setParams({});
  };

  const handleUploads = async (incoming: File[]) => {
    if (!isAdmin) { toast.error("Only admins can upload"); return; }
    const TOO_BIG = incoming.filter((f) => f.size > 50 * 1024 * 1024);
    if (TOO_BIG.length) {
      toast.error(`${TOO_BIG.length} file(s) exceed 50 MB and will be skipped`);
    }
    const ok = incoming.filter((f) => f.size <= 50 * 1024 * 1024);
    setUploads(ok.map((f) => ({ name: f.name, pct: 0 })));
    let done = 0;
    for (const f of ok) {
      try {
        await uploadFile(f, folderId);
        done++;
        setUploads((prev) => prev.map((u) => u.name === f.name ? { ...u, pct: 100 } : u));
      } catch (e: any) {
        toast.error(`${f.name}: ${e.message}`);
      }
    }
    toast.success(`Uploaded ${done}/${ok.length}`);
    setUploads([]);
    refresh();
  };

  const handleNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolder(name, folderId);
      toast.success("Folder created");
      setNewFolderName(""); setShowNewFolder(false);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteFolder = (f: LibraryFolder) => {
    toast(`Delete folder "${f.name}"?`, {
      description: "This removes the folder and all its contents.",
      action: {
        label: "Delete",
        onClick: async () => {
          try { await deleteFolder(f.id); toast.success("Deleted"); refresh(); }
          catch (e: any) { toast.error(e.message); }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 6000,
    });
  };

  const handleRenameFolder = async (f: LibraryFolder) => {
    const name = prompt("Rename folder", f.name)?.trim();
    if (!name || name === f.name) return;
    try { await renameFolder(f.id, name); toast.success("Renamed"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteFile = (f: LibraryFile) => {
    toast(`Delete "${f.name}"?`, {
      action: {
        label: "Delete",
        onClick: async () => {
          try { await deleteFile(f); toast.success("Deleted"); refresh(); }
          catch (e: any) { toast.error(e.message); }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 6000,
    });
  };

  const handleDownloadFolder = async (f: LibraryFolder) => {
    try {
      const all = await listAllFilesUnder(f.id);
      if (!all.length) { toast.error("Folder is empty"); return; }
      setZipProgress({ done: 0, total: all.length });
      await downloadAsZip(
        all.map((x) => ({ folder: f.name, name: x.name, url: x.url })),
        `${f.name}.zip`,
        (d, t) => setZipProgress({ done: d, total: t }),
      );
      setZipProgress(null);
      toast.success("Download ready");
    } catch (e: any) {
      setZipProgress(null);
      toast.error(e.message);
    }
  };

  const showingSearch = !!searchResults;
  const visibleFolders = showingSearch ? searchResults!.folders : folders;
  const visibleFiles = showingSearch ? searchResults!.files : files;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
          <Breadcrumbs crumbs={crumbs} onNav={navigate} />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewFolder((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-sm border border-border hover:bg-secondary transition-smooth hover-scale"
            >
              <FolderPlus size={16} /> New folder
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative animate-slide-in-right">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search folders, files, tags, descriptions…"
          className="w-full bg-card border border-border rounded-sm pl-10 pr-10 py-3 focus:outline-none focus:border-gold transition-smooth"
        />
        {searching && <Loader2 size={14} className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        )}
        {showingSearch && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {visibleFolders.length} folder(s) and {visibleFiles.length} file(s) matching “{query}”
          </p>
        )}
      </div>

      {/* New folder inline */}
      {showNewFolder && isAdmin && (
        <div className="flex gap-2 animate-fade-in">
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNewFolder()}
            placeholder="Folder name"
            className="flex-1 bg-card border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
          <button onClick={handleNewFolder} className="px-3 py-2 rounded-sm bg-primary text-primary-foreground text-sm hover-scale">Create</button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="px-3 py-2 rounded-sm border border-border text-sm">Cancel</button>
        </div>
      )}

      {/* Drop zone (admin) */}
      {isAdmin && !showingSearch && (
        <DropZone onFiles={handleUploads} hint={folderId ? `Uploading into "${crumbs.at(-1)?.name ?? "folder"}"` : "Uploading into Library root"} />
      )}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          {uploads.map((u) => (
            <div key={u.name} className="text-xs">
              <div className="flex justify-between mb-1"><span className="truncate">{u.name}</span><span>{u.pct}%</span></div>
              <div className="h-1 bg-secondary rounded overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${u.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {zipProgress && (
        <div className="text-xs text-muted-foreground animate-fade-in">
          Zipping… {zipProgress.done}/{zipProgress.total}
        </div>
      )}

      {/* Folders grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-md bg-secondary/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {visibleFolders.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Folders</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {visibleFolders.map((f) => (
                  <div key={f.id} className="group relative bg-card border border-border rounded-md p-4 transition-smooth hover:border-gold hover:shadow-lift hover:-translate-y-0.5 animate-scale-in">
                    <button onClick={() => navigate(f.id)} className="flex items-start gap-3 text-left w-full">
                      <Folder className="text-gold shrink-0" size={22} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.name}</div>
                        {showingSearch && f.path && (
                          <div className="text-[10px] text-muted-foreground truncate">{f.path}</div>
                        )}
                      </div>
                    </button>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-smooth flex gap-1">
                      <button onClick={() => handleDownloadFolder(f)} title="Download as ZIP"
                        className="p-1.5 rounded-sm bg-background/90 border border-border hover:bg-secondary">
                        <Download size={13} />
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={() => handleRenameFolder(f)} title="Rename"
                            className="p-1.5 rounded-sm bg-background/90 border border-border hover:bg-secondary">
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => handleDeleteFolder(f)} title="Delete"
                            className="p-1.5 rounded-sm bg-background/90 border border-border hover:bg-destructive hover:text-destructive-foreground">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {visibleFiles.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Files</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {visibleFiles.map((f) => (
                  <FileCard key={f.id} f={f} isAdmin={isAdmin}
                    onEdit={() => setEditFile(f)}
                    onDelete={() => handleDeleteFile(f)} />
                ))}
              </div>
            </section>
          )}

          {visibleFolders.length === 0 && visibleFiles.length === 0 && (
            <div className="text-center py-16 text-muted-foreground animate-fade-in">
              {showingSearch ? "No matches." : "This folder is empty."}
            </div>
          )}
        </>
      )}

      {editFile && (
        <FileMetadataModal
          file={editFile}
          onClose={() => setEditFile(null)}
          onSaved={() => { setEditFile(null); refresh(); }}
          canEdit={isAdmin}
        />
      )}
    </div>
  );
}

function Breadcrumbs({ crumbs, onNav }: { crumbs: LibraryFolder[]; onNav: (id: string | null) => void }) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1 flex-wrap">
      <button onClick={() => onNav(null)} className="hover:text-foreground transition-smooth">Library</button>
      {crumbs.map((c) => (
        <span key={c.id} className="flex items-center gap-1">
          <ChevronRight size={14} />
          <button onClick={() => onNav(c.id)} className="hover:text-foreground transition-smooth">{c.name}</button>
        </span>
      ))}
    </div>
  );
}

function FileCard({ f, isAdmin, onEdit, onDelete }: {
  f: LibraryFile; isAdmin: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const kind = fileKind(f.mime_type, f.name);
  const openable = kind === "image" || kind === "video" || kind === "pdf" || kind === "audio";
  const openInNewTab = () => window.open(f.url, "_blank", "noopener,noreferrer");
  return (
    <div className="group relative bg-card border border-border rounded-md overflow-hidden transition-smooth hover:border-gold hover:shadow-lift hover:-translate-y-0.5 animate-scale-in">
      <button
        type="button"
        onClick={openable ? openInNewTab : undefined}
        title={openable ? "Open in new tab" : undefined}
        className={`aspect-square w-full bg-secondary/50 flex items-center justify-center relative overflow-hidden ${openable ? "cursor-zoom-in" : "cursor-default"}`}
      >
        {kind === "image" ? (
          <img src={f.url} alt={f.title ?? f.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : kind === "video" ? (
          <video src={f.url} className="w-full h-full object-cover" muted />
        ) : (
          <KindIcon kind={kind} className="w-12 h-12 text-muted-foreground" />
        )}
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest bg-background/85 backdrop-blur px-1.5 py-0.5 rounded-sm">
          {kind}
        </span>
      </button>
      <div className="p-3 space-y-1">
        {openable ? (
          <button onClick={openInNewTab} className="font-medium text-sm truncate text-left w-full hover:text-gold transition-smooth" title={`Open ${f.title ?? f.name}`}>
            {f.title ?? f.name}
          </button>
        ) : (
          <a href={f.url} target="_blank" rel="noreferrer" className="font-medium text-sm truncate block hover:text-gold transition-smooth" title={f.title ?? f.name}>
            {f.title ?? f.name}
          </a>
        )}
        <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-2">
          <span className="truncate">{f.category ?? "—"}</span>
          <span>{formatBytes(f.size_bytes)}</span>
        </div>
        {f.tags?.length ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {f.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded-sm flex items-center gap-1">
                <Tag size={9} />{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-smooth flex gap-1">
        <button onClick={() => downloadSingleImage(f.url, f.name)} title="Download"
          className="p-1.5 rounded-sm bg-background/90 border border-border hover:bg-secondary">
          <Download size={13} />
        </button>
        {isAdmin && (
          <>
            <button onClick={onEdit} title="Edit metadata"
              className="p-1.5 rounded-sm bg-background/90 border border-border hover:bg-secondary">
              <Edit3 size={13} />
            </button>
            <button onClick={onDelete} title="Delete"
              className="p-1.5 rounded-sm bg-background/90 border border-border hover:bg-destructive hover:text-destructive-foreground">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FileMetadataModal({ file, onClose, onSaved, canEdit }: {
  file: LibraryFile; onClose: () => void; onSaved: () => void; canEdit: boolean;
}) {
  const [name, setName] = useState(file.name);
  const [title, setTitle] = useState(file.title ?? "");
  const [description, setDescription] = useState(file.description ?? "");
  const [category, setCategory] = useState(file.category ?? "");
  const [year, setYear] = useState(file.year?.toString() ?? "");
  const [tagsInput, setTagsInput] = useState(file.tags?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateFileMetadata(file.id, {
        name: name.trim() || file.name,
        title: title.trim() || null,
        description: description.trim() || null,
        category: category.trim() || null,
        year: year.trim() ? parseInt(year, 10) : null,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      });
      toast.success("Saved");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card border border-border rounded-md w-full max-w-lg p-6 space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">File details</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <Field label="File name"><input disabled={!canEdit} value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
        <Field label="Title"><input disabled={!canEdit} value={title} onChange={(e) => setTitle(e.target.value)} className="input" /></Field>
        <Field label="Description"><textarea disabled={!canEdit} value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-20" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><input disabled={!canEdit} value={category} onChange={(e) => setCategory(e.target.value)} className="input" /></Field>
          <Field label="Year"><input disabled={!canEdit} value={year} onChange={(e) => setYear(e.target.value)} className="input" inputMode="numeric" /></Field>
        </div>
        <Field label="Tags (comma-separated)">
          <input disabled={!canEdit} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="input" />
        </Field>
        <div className="text-xs text-muted-foreground flex justify-between pt-2 border-t border-border">
          <span>{file.mime_type ?? "unknown"} · {formatBytes(file.size_bytes)}</span>
          <a href={file.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">Open original</a>
        </div>
        {canEdit && (
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-2 text-sm border border-border rounded-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-sm bg-primary text-primary-foreground hover-scale disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}