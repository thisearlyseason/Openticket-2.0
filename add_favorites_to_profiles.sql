ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_organizers TEXT[] DEFAULT '{}';
