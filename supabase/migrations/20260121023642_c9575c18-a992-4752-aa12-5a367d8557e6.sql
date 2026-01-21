-- Add photo_url and additional_details columns to assets table
ALTER TABLE public.assets
ADD COLUMN photo_url text,
ADD COLUMN additional_details text;