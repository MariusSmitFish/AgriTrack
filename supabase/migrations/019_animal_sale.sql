-- Price and date recorded when an animal is sold.

alter table public.animals
  add column if not exists sale_price numeric(12, 2),
  add column if not exists sold_on date;

alter table public.animals
  drop constraint if exists animals_sale_price_check;

alter table public.animals
  add constraint animals_sale_price_check check (
    sale_price is null or sale_price > 0
  );
