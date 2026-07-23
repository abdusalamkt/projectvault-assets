
-- Brands
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO anon, authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read brands" ON public.brands FOR SELECT USING (true);
CREATE POLICY "public insert brands" ON public.brands FOR INSERT WITH CHECK (true);
CREATE POLICY "public update brands" ON public.brands FOR UPDATE USING (true);
CREATE POLICY "public delete brands" ON public.brands FOR DELETE USING (true);

-- Taxonomy values scoped per brand (or global when brand_id NULL)
CREATE TABLE public.taxonomy_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  field text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, field, value)
);
CREATE INDEX taxonomy_brand_field_idx ON public.taxonomy_values (brand_id, field);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.taxonomy_values TO anon, authenticated;
GRANT ALL ON public.taxonomy_values TO service_role;
ALTER TABLE public.taxonomy_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read taxonomy" ON public.taxonomy_values FOR SELECT USING (true);
CREATE POLICY "public insert taxonomy" ON public.taxonomy_values FOR INSERT WITH CHECK (true);
CREATE POLICY "public update taxonomy" ON public.taxonomy_values FOR UPDATE USING (true);
CREATE POLICY "public delete taxonomy" ON public.taxonomy_values FOR DELETE USING (true);

-- App users (plaintext, no real auth, per user spec)
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO anon, authenticated;
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read users" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "public insert users" ON public.app_users FOR INSERT WITH CHECK (true);
CREATE POLICY "public update users" ON public.app_users FOR UPDATE USING (true);
CREATE POLICY "public delete users" ON public.app_users FOR DELETE USING (true);
CREATE TRIGGER app_users_updated BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default users
INSERT INTO public.app_users (username, password, role) VALUES
 ('admin', 'admin123', 'admin'),
 ('user', 'user123', 'user')
ON CONFLICT (username) DO NOTHING;

-- Seed brands
INSERT INTO public.brands (name, sort_order) VALUES
 ('Hufcor', 1),
 ('HPL', 2),
 ('Auralis', 3),
 ('Pivot Doors', 4),
 ('Hydraulic Doors', 5),
 ('Terrace Solutions', 6)
ON CONFLICT (name) DO NOTHING;

-- Seed Hufcor sectors
INSERT INTO public.taxonomy_values (brand_id, field, value)
SELECT b.id, 'sector', s FROM public.brands b, unnest(ARRAY[
  'Aviation & Transportation','Convention Centres','Educational Institutions',
  'Financial & Banking','Government','Healthcare Centers','Hospitality',
  'Learning & Training Centers','Religious Establishments','Retail & Leisure','Sports Facilities'
]) s WHERE b.name = 'Hufcor'
ON CONFLICT DO NOTHING;

-- Seed HPL sectors
INSERT INTO public.taxonomy_values (brand_id, field, value)
SELECT b.id, 'sector', s FROM public.brands b, unnest(ARRAY[
  'Aviation & Transportation','Commercial & Financial','Government Establishments',
  'Health Care','Hospitality','Malls & Leisure','School & Higher Education',
  'Sport Facilities','Training Center'
]) s WHERE b.name = 'HPL'
ON CONFLICT DO NOTHING;

-- Seed Auralis sectors
INSERT INTO public.taxonomy_values (brand_id, field, value)
SELECT b.id, 'sector', s FROM public.brands b, unnest(ARRAY[
  'Aviation & Transportation','Government & Corporate Offices','Hospitals',
  'Malls & Leisure','Museum','Schools & Universities'
]) s WHERE b.name = 'Auralis'
ON CONFLICT DO NOTHING;

-- Auto-seed remaining fields per brand from existing project data (assigns to every brand so nothing goes missing)
INSERT INTO public.taxonomy_values (brand_id, field, value)
SELECT b.id, f.field, f.val
FROM public.brands b
CROSS JOIN (
  SELECT 'product' AS field, product AS val FROM public.projects WHERE product IS NOT NULL AND product <> ''
  UNION SELECT 'finish', finish FROM public.projects WHERE finish IS NOT NULL AND finish <> ''
  UNION SELECT 'contractor', contractor FROM public.projects WHERE contractor IS NOT NULL AND contractor <> ''
  UNION SELECT 'speciality', speciality FROM public.projects WHERE speciality IS NOT NULL AND speciality <> ''
  UNION SELECT 'accessories', accessories FROM public.projects WHERE accessories IS NOT NULL AND accessories <> ''
) f
ON CONFLICT DO NOTHING;

-- Auto-seed sectors from existing projects for brands that don't have them yet
INSERT INTO public.taxonomy_values (brand_id, field, value)
SELECT b.id, 'sector', p.sector
FROM public.brands b
CROSS JOIN (SELECT DISTINCT sector FROM public.projects WHERE sector IS NOT NULL AND sector <> '') p
ON CONFLICT DO NOTHING;
