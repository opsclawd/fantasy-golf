alter table public.pools
  add column if not exists timezone text not null default 'America/New_York';

update public.pools
set timezone = 'America/New_York'
where timezone is null;
