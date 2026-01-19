create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('SPOT', 'FUTURES')),
  pair text not null,
  direction text check (direction in ('LONG', 'SHORT')),
  leverage numeric,
  margin numeric not null,
  entry_price numeric not null,
  stop_loss numeric,
  take_profit numeric,
  close_price numeric,
  pnl numeric,
  pnl_percent numeric,
  status text not null check (status in ('OPEN', 'CLOSED_EARLY', 'STOP_LOSS', 'TAKE_PROFIT')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.trades enable row level security;

create policy "Users can view their own trades"
  on public.trades for select
  using (auth.uid() = user_id);

create policy "Users can insert their own trades"
  on public.trades for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own trades"
  on public.trades for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own trades"
  on public.trades for delete
  using (auth.uid() = user_id);