-- Use the product term Space for new records created without an explicit name.

alter table public.spaces
  alter column name set default 'Espacio sin título';
