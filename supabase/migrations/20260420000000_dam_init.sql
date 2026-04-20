-- Projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_no text not null unique,
  project_name text not null,
  sector text,
  country text,
  product text,
  finish text,
  contractor text,
  description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_project_no_idx on public.projects (project_no);
create index projects_sector_idx on public.projects (sector);
create index projects_country_idx on public.projects (country);
create index projects_product_idx on public.projects (product);
create index projects_finish_idx on public.projects (finish);
create index projects_tags_gin on public.projects using gin (tags);
create index projects_name_trgm on public.projects using gin (project_name gin_trgm_ops);

create extension if not exists pg_trgm;

-- Project images
create table public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  storage_path text,
  tags text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index project_images_project_idx on public.project_images (project_id);

-- Open RLS (user accepted: hardcoded auth, no real identities)
alter table public.projects enable row level security;
alter table public.project_images enable row level security;

create policy "public read projects" on public.projects for select using (true);
create policy "public write projects" on public.projects for insert with check (true);
create policy "public update projects" on public.projects for update using (true);
create policy "public delete projects" on public.projects for delete using (true);

create policy "public read images" on public.project_images for select using (true);
create policy "public write images" on public.project_images for insert with check (true);
create policy "public update images" on public.project_images for update using (true);
create policy "public delete images" on public.project_images for delete using (true);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

-- Storage bucket
insert into storage.buckets (id, name, public) values ('project-images', 'project-images', true)
on conflict (id) do nothing;

create policy "public read bucket" on storage.objects for select using (bucket_id = 'project-images');
create policy "public upload bucket" on storage.objects for insert with check (bucket_id = 'project-images');
create policy "public update bucket" on storage.objects for update using (bucket_id = 'project-images');
create policy "public delete bucket" on storage.objects for delete using (bucket_id = 'project-images');
