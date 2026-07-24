import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  listBrands, createBrand, renameBrand, deleteBrand,
  listTaxonomy, addTaxonomy, addTaxonomyBulk, deleteTaxonomy,
  listUsers, createUser, updateUser, deleteUser,
  Brand, TaxonomyValue, AppUser, BRAND_FIELDS, BrandField,
} from "@/lib/settings";
import { Loader2, Plus, Trash2, Upload, Pencil, X, Check, KeyRound } from "lucide-react";

type Tab = "users" | "brands";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-gold mb-2">Admin</p>
        <h1 className="font-display text-4xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage users, brands, and the taxonomy that powers project dropdowns.</p>
      </div>
      <div className="flex gap-1 border-b border-border mb-6">
        {(["users", "brands"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 transition-smooth ${
              tab === t ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "users" ? "Users" : "Brands & Taxonomy"}
          </button>
        ))}
      </div>
      {tab === "users" ? <UsersPanel /> : <BrandsPanel />}
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersPanel() {
  const [rows, setRows] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: "", password: "", role: "user" as "user" | "admin" });
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setLoading(true);
    listUsers().then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return toast.error("Username & password required");
    setBusy(true);
    try {
      await createUser(form);
      toast.success(`User "${form.username}" created`);
      setForm({ username: "", password: "", role: "user" });
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <form onSubmit={submit} className="bg-card border border-border rounded-sm p-5 shadow-soft space-y-3 h-fit">
        <h3 className="font-display text-lg font-semibold">Add user</h3>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Username</label>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Password</label>
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:outline-none focus:border-gold">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" disabled={busy}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create user
        </button>
      </form>

      <div className="bg-card border border-border rounded-sm p-5 shadow-soft">
        <h3 className="font-display text-lg font-semibold mb-3">Users ({rows.length})</h3>
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((u) => (<UserRow key={u.id} user={u} onChanged={refresh} />))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No users yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, onChanged }: { user: AppUser; onChanged: () => void }) {
  const [edit, setEdit] = useState(false);
  const [pw, setPw] = useState<string | null>(null);
  const [draft, setDraft] = useState({ username: user.username, role: user.role });

  const save = async () => {
    try {
      await updateUser(user.id, draft);
      toast.success("Updated");
      setEdit(false); onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  const resetPw = async () => {
    if (!pw) return;
    try { await updateUser(user.id, { password: pw }); toast.success("Password reset"); setPw(null); }
    catch (e: any) { toast.error(e.message); }
  };

  const del = async () => {
    toast(`Delete user "${user.username}"?`, {
      action: {
        label: "Delete",
        onClick: async () => {
          try { await deleteUser(user.id); toast.success("Deleted"); onChanged(); }
          catch (e: any) { toast.error(e.message); }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 6000,
    });
  };

  return (
    <div className="py-3 flex flex-wrap items-center gap-3">
      {edit ? (
        <>
          <input value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            className="flex-1 min-w-[140px] bg-background border border-border rounded-sm px-2 py-1.5 text-sm" />
          <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as any })}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={save} className="p-1.5 hover:bg-secondary rounded-sm text-gold"><Check size={14} /></button>
          <button onClick={() => setEdit(false)} className="p-1.5 hover:bg-secondary rounded-sm"><X size={14} /></button>
        </>
      ) : (
        <>
          <span className="font-medium flex-1 min-w-0 truncate">{user.username}</span>
          <span className={`text-xs uppercase tracking-widest px-2 py-0.5 rounded-sm ${
            user.role === "admin" ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
          }`}>{user.role}</span>
          {pw !== null ? (
            <>
              <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password"
                className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm" />
              <button onClick={resetPw} className="p-1.5 hover:bg-secondary rounded-sm text-gold"><Check size={14} /></button>
              <button onClick={() => setPw(null)} className="p-1.5 hover:bg-secondary rounded-sm"><X size={14} /></button>
            </>
          ) : (
            <button onClick={() => setPw("")} className="p-1.5 hover:bg-secondary rounded-sm text-muted-foreground" title="Reset password"><KeyRound size={14} /></button>
          )}
          <button onClick={() => setEdit(true)} className="p-1.5 hover:bg-secondary rounded-sm text-muted-foreground"><Pencil size={14} /></button>
          <button onClick={del} className="p-1.5 hover:bg-secondary rounded-sm text-destructive"><Trash2 size={14} /></button>
        </>
      )}
    </div>
  );
}

/* ---------------- Brands + Taxonomy ---------------- */
function BrandsPanel() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newBrand, setNewBrand] = useState("");

  const refresh = async () => {
    const b = await listBrands();
    setBrands(b);
    if (!selected && b.length) setSelected(b[0].id);
    else if (selected && !b.find((x) => x.id === selected)) setSelected(b[0]?.id ?? null);
  };
  useEffect(() => { refresh().catch((e) => toast.error(e.message)); }, []);

  const add = async () => {
    if (!newBrand.trim()) return;
    try { await createBrand(newBrand); setNewBrand(""); refresh(); toast.success("Brand added"); }
    catch (e: any) { toast.error(e.message); }
  };

  const active = brands.find((b) => b.id === selected);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <aside className="bg-card border border-border rounded-sm p-5 shadow-soft h-fit">
        <h3 className="font-display text-lg font-semibold mb-3">Brands</h3>
        <div className="space-y-1 mb-4">
          {brands.map((b) => (
            <BrandRow key={b.id} brand={b} active={b.id === selected}
              onSelect={() => setSelected(b.id)} onChanged={refresh} />
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="New brand…"
            className="flex-1 bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-gold" />
          <button onClick={add} className="px-2 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm"><Plus size={14} /></button>
        </div>
      </aside>

      {active ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">Brand</p>
            <h2 className="font-display text-3xl font-semibold">{active.name}</h2>
            <p className="text-muted-foreground text-sm">Values below appear as dropdowns in the project form when this brand is selected.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {BRAND_FIELDS.map((f) => (
              <TaxonomyCard key={f} brandId={active.id} field={f} />
            ))}
          </div>
        </div>
      ) : <p className="text-muted-foreground">No brand selected.</p>}
    </div>
  );
}

function BrandRow({ brand, active, onSelect, onChanged }: { brand: Brand; active: boolean; onSelect: () => void; onChanged: () => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(brand.name);
  const save = async () => {
    try { await renameBrand(brand.id, name); setEdit(false); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };
  const del = async () => {
    if (!confirm(`Delete brand "${brand.name}" and all its taxonomy values?`)) return;
    try { await deleteBrand(brand.id); onChanged(); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className={`group flex items-center gap-1 rounded-sm px-2 py-1.5 transition-smooth ${active ? "bg-secondary" : "hover:bg-secondary/50"}`}>
      {edit ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-background border border-border rounded-sm px-2 py-1 text-sm" />
          <button onClick={save} className="p-1 text-gold"><Check size={13} /></button>
          <button onClick={() => { setEdit(false); setName(brand.name); }} className="p-1"><X size={13} /></button>
        </>
      ) : (
        <>
          <button onClick={onSelect} className={`flex-1 text-left text-sm truncate ${active ? "text-gold font-medium" : ""}`}>
            {brand.name}
          </button>
          <button onClick={() => setEdit(true)} className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100"><Pencil size={12} /></button>
          <button onClick={del} className="p-1 text-destructive opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
        </>
      )}
    </div>
  );
}

const FIELD_LABELS: Record<BrandField, string> = {
  sector: "Sectors", product: "Products", finish: "Finishes",
  contractor: "Contractors", speciality: "Specialities", accessories: "Accessories",
};

function TaxonomyCard({ brandId, field }: { brandId: string; field: BrandField }) {
  const [rows, setRows] = useState<TaxonomyValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setLoading(true);
    listTaxonomy(brandId, field).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [brandId, field]);

  const add = async () => {
    if (!draft.trim()) return;
    try { await addTaxonomy(brandId, field, draft); setDraft(""); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: string) => {
    try { await deleteTaxonomy(id); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    // Accept CSV or newline list; take first column of each non-empty row.
    const values = text.split(/\r?\n/).map((line) => {
      const cell = line.split(",")[0]?.trim().replace(/^"|"$/g, "");
      return cell ?? "";
    }).filter(Boolean);
    if (!values.length) return toast.error("No values found");
    try {
      const n = await addTaxonomyBulk(brandId, field, values);
      toast.success(`Imported ${n} value${n === 1 ? "" : "s"}`);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.value.toLowerCase().includes(term));
  }, [rows, q]);

  return (
    <div className="bg-card border border-border rounded-sm p-4 shadow-soft animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display font-semibold">{FIELD_LABELS[field]} <span className="text-xs text-muted-foreground">({rows.length})</span></h4>
        <div>
          <input type="file" ref={fileRef} accept=".csv,.txt" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded-sm hover:bg-secondary" title="Bulk import CSV">
            <Upload size={12} /> CSV
          </button>
        </div>
      </div>
      <div className="flex gap-1.5 mb-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={`Add ${field}…`}
          className="flex-1 bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-gold" />
        <button onClick={add} className="px-2 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm"><Plus size={13} /></button>
      </div>
      {rows.length > 6 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
          className="w-full mb-2 bg-background border border-border rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-gold" />
      )}
      {loading ? (
        <div className="py-6 flex justify-center text-muted-foreground"><Loader2 size={14} className="animate-spin" /></div>
      ) : (
        <div className="max-h-56 overflow-auto divide-y divide-border">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">Nothing yet.</p>}
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-1.5 text-sm group">
              <span className="truncate">{r.value}</span>
              <button onClick={() => del(r.id)} className="p-1 text-destructive opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}