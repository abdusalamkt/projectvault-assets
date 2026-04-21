ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE OR REPLACE FUNCTION public.projects_search_tsv_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.project_no, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.project_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.sector, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.country, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.product, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.finish, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.contractor, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags, '{}'::text[]), ' ')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_search_tsv_trg ON public.projects;
CREATE TRIGGER projects_search_tsv_trg
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_search_tsv_update();

-- Backfill existing rows
UPDATE public.projects SET project_no = project_no;

CREATE INDEX IF NOT EXISTS projects_search_tsv_idx
  ON public.projects USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS projects_name_trgm_idx
  ON public.projects USING GIN (project_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS projects_no_trgm_idx
  ON public.projects USING GIN (project_no gin_trgm_ops);

CREATE INDEX IF NOT EXISTS projects_contractor_trgm_idx
  ON public.projects USING GIN (contractor gin_trgm_ops);