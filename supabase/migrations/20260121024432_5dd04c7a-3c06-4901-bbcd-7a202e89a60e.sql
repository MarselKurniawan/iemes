-- Change photo_url to photo_urls array for multiple photos
ALTER TABLE public.assets 
DROP COLUMN IF EXISTS photo_url;

ALTER TABLE public.assets 
ADD COLUMN photo_urls text[] DEFAULT '{}';