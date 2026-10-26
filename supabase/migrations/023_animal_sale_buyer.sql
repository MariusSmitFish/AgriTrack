-- Buyer and notes recorded with an animal sale.

alter table public.animals
  add column if not exists buyer_name text,
  add column if not exists buyer_surname text,
  add column if not exists sale_notes text;
