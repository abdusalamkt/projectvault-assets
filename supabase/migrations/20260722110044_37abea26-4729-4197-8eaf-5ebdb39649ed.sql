
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS speciality text,
  ADD COLUMN IF NOT EXISTS accessories text;

CREATE OR REPLACE FUNCTION public.projects_search_tsv_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.project_no, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.project_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.sector, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.country, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.product, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.finish, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.contractor, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.brand, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.speciality, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.accessories, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags, '{}'::text[]), ' ')), 'B');
  RETURN NEW;
END;
$function$;

-- Backfill tsv for existing rows
UPDATE public.projects SET updated_at = updated_at;
