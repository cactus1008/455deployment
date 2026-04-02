-- Run once in Supabase SQL Editor (or via CLI) before using fraud columns.
alter table public.orders
  add column if not exists fraud_predicted smallint;

alter table public.orders
  add column if not exists fraud_probability numeric(8, 4);

-- null = not reviewed, 0 = confirmed not fraud, 1 = confirmed fraud
alter table public.orders
  add column if not exists admin_fraud_confirmed smallint;

comment on column public.orders.fraud_predicted is 'ML pipeline output: 0 = not fraud, 1 = fraud';
comment on column public.orders.fraud_probability is 'Predicted P(fraud), 0–1';
comment on column public.orders.admin_fraud_confirmed is 'Admin review: null pending, 0 not fraud, 1 fraud';
