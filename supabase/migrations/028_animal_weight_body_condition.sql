-- Body condition score recorded with a weigh-in. Existing rows stay unset.

alter table public.animal_weights
  add column body_condition smallint;

alter table public.animal_weights
  add constraint animal_weights_body_condition_check
  check (body_condition is null or body_condition between 1 and 5);
