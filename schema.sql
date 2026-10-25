-- شغّل الملف ده مرة واحدة في Supabase: SQL Editor ثم New query ثم الصق ثم Run

create table if not exists public.items (
  k text primary key,
  kind text not null default 'text',
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- سجل بالقيم القديمة علشان تقدر ترجّع أي تعديل اتخرب
create table if not exists public.items_history (
  id bigserial primary key,
  k text,
  kind text,
  value text,
  changed_at timestamptz not null default now()
);

create or replace function public.log_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.items_history(k, kind, value) values (old.k, old.kind, old.value);
  return new;
end $$;

drop trigger if exists items_log on public.items;
create trigger items_log before update on public.items
  for each row execute function public.log_item();

alter table public.items enable row level security;
alter table public.items_history enable row level security;

create policy "items read"   on public.items for select using (true);
create policy "items insert" on public.items for insert with check (true);
create policy "items update" on public.items for update using (true) with check (true);

-- التحديث الفوري بين المستخدمين
alter publication supabase_realtime add table public.items;

-- مخزن الصور
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;
create policy "photos read"   on storage.objects for select using (bucket_id = 'photos');
create policy "photos upload" on storage.objects for insert with check (bucket_id = 'photos');
