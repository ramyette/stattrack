-- Extra context used by shared project analytics and planning insights.
alter table public.videos
  add column if not exists category text,
  add column if not exists notes text,
  add column if not exists published_at date;

alter table public.videos
  add constraint videos_category_length check (category is null or char_length(category) <= 80),
  add constraint videos_notes_length check (notes is null or char_length(notes) <= 4000);
