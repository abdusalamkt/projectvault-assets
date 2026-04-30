-- Folders (nested)
CREATE TABLE public.library_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_folder_id uuid REFERENCES public.library_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  path text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_library_folders_parent ON public.library_folders(parent_folder_id);
CREATE INDEX idx_library_folders_path ON public.library_folders USING gin (path gin_trgm_ops);

ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read folders" ON public.library_folders FOR SELECT USING (true);
CREATE POLICY "public insert folders" ON public.library_folders FOR INSERT WITH CHECK (true);
CREATE POLICY "public update folders" ON public.library_folders FOR UPDATE USING (true);
CREATE POLICY "public delete folders" ON public.library_folders FOR DELETE USING (true);

CREATE TRIGGER library_folders_updated_at
BEFORE UPDATE ON public.library_folders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Maintain folder.path = "Parent / Child / Leaf"
CREATE OR REPLACE FUNCTION public.library_folder_compute_path(_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  parts text[] := '{}';
  cur uuid := _id;
  rec record;
  guard int := 0;
BEGIN
  WHILE cur IS NOT NULL AND guard < 50 LOOP
    SELECT name, parent_folder_id INTO rec FROM public.library_folders WHERE id = cur;
    IF NOT FOUND THEN EXIT; END IF;
    parts := array_prepend(rec.name, parts);
    cur := rec.parent_folder_id;
    guard := guard + 1;
  END LOOP;
  RETURN array_to_string(parts, ' / ');
END;
$$;

CREATE OR REPLACE FUNCTION public.library_folders_set_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.path := public.library_folder_compute_path(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.library_folders_after_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- recompute paths for descendants
  WITH RECURSIVE descendants AS (
    SELECT id FROM public.library_folders WHERE parent_folder_id = NEW.id
    UNION ALL
    SELECT f.id FROM public.library_folders f JOIN descendants d ON f.parent_folder_id = d.id
  )
  UPDATE public.library_folders f
    SET path = public.library_folder_compute_path(f.id)
    FROM descendants d
    WHERE f.id = d.id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER library_folders_path_biu
BEFORE INSERT OR UPDATE OF name, parent_folder_id ON public.library_folders
FOR EACH ROW EXECUTE FUNCTION public.library_folders_set_path();

CREATE TRIGGER library_folders_path_aiu
AFTER UPDATE OF name, parent_folder_id ON public.library_folders
FOR EACH ROW EXECUTE FUNCTION public.library_folders_after_change();

-- Files
CREATE TABLE public.library_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES public.library_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  title text,
  description text,
  category text,
  year int,
  tags text[] NOT NULL DEFAULT '{}',
  search_tsv tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_library_files_folder ON public.library_files(folder_id);
CREATE INDEX idx_library_files_tsv ON public.library_files USING gin (search_tsv);
CREATE INDEX idx_library_files_name_trgm ON public.library_files USING gin (name gin_trgm_ops);

ALTER TABLE public.library_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read files" ON public.library_files FOR SELECT USING (true);
CREATE POLICY "public insert files" ON public.library_files FOR INSERT WITH CHECK (true);
CREATE POLICY "public update files" ON public.library_files FOR UPDATE USING (true);
CREATE POLICY "public delete files" ON public.library_files FOR DELETE USING (true);

CREATE TRIGGER library_files_updated_at
BEFORE UPDATE ON public.library_files
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.library_files_tsv_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags, '{}'::text[]), ' ')), 'B');
  RETURN NEW;
END;
$$;

CREATE TRIGGER library_files_tsv_biu
BEFORE INSERT OR UPDATE OF name, title, description, category, tags ON public.library_files
FOR EACH ROW EXECUTE FUNCTION public.library_files_tsv_update();

-- Storage bucket for library files (public, 50MB per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('library-files', 'library-files', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

CREATE POLICY "public read library bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'library-files');

CREATE POLICY "public write library bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'library-files');

CREATE POLICY "public update library bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'library-files');

CREATE POLICY "public delete library bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'library-files');