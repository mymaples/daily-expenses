-- Daily Expenses schema. Every row belongs to the signed-in user (RLS).

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  category text not null,
  note text,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists expenses_user_spent_on_idx on public.expenses (user_id, spent_on);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  monthly_budget numeric(10,2),
  categories text[] not null default '{Food,Transport,Groceries,Shopping,Bills,Health,Fun,Other}'
);

alter table public.expenses enable row level security;
alter table public.settings enable row level security;

create policy "own expenses select" on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy "own expenses insert" on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own expenses update" on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own expenses delete" on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own settings select" on public.settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "own settings insert" on public.settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own settings update" on public.settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
