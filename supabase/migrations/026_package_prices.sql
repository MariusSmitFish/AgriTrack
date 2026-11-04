-- Match the live yearly packages: Entry, Intermediate, and Unlimited.

update public.packages
set
  yearly_price = 5000,
  currency = 'ZAR',
  max_users = 3,
  max_animals = 300,
  max_locations = 1,
  max_encampments = 15,
  max_photos = 500,
  max_documents = 500,
  max_backups = 10
where slug = 'entry';

update public.packages
set
  yearly_price = 8500,
  currency = 'ZAR',
  max_users = 10,
  max_animals = 500,
  max_locations = 20,
  max_encampments = 80,
  max_photos = 2000,
  max_documents = 500,
  max_backups = 24
where slug = 'intermediate';

update public.packages
set
  yearly_price = 12000,
  currency = 'ZAR',
  max_users = null,
  max_animals = null,
  max_locations = null,
  max_encampments = null,
  max_photos = null,
  max_documents = null,
  max_backups = null
where slug = 'unlimited';
