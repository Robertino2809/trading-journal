alter table public.trades
  add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'trades'
      and constraint_name = 'trades_user_id_fkey'
  ) then
    alter table public.trades
      add constraint trades_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

alter table public.trades enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trades'
      and policyname = 'Users can view their own trades'
  ) then
    create policy "Users can view their own trades"
      on public.trades for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trades'
      and policyname = 'Users can insert their own trades'
  ) then
    create policy "Users can insert their own trades"
      on public.trades for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trades'
      and policyname = 'Users can update their own trades'
  ) then
    create policy "Users can update their own trades"
      on public.trades for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trades'
      and policyname = 'Users can delete their own trades'
  ) then
    create policy "Users can delete their own trades"
      on public.trades for delete
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.trades
    where user_id is null
    limit 1
  ) then
    alter table public.trades
      alter column user_id set not null;
  end if;
end $$;