-- Add code column to assets table (nullable first)
ALTER TABLE public.assets 
ADD COLUMN code text;

-- Add code column to maintenance table (nullable first)
ALTER TABLE public.maintenance 
ADD COLUMN code text;

-- Generate codes for existing assets using full property prefix + unique sequence
UPDATE public.assets a
SET code = subq.new_code
FROM (
  SELECT 
    a2.id,
    -- Use property name abbreviation + last 4 chars of property_id for uniqueness
    COALESCE(UPPER(REGEXP_REPLACE(LEFT(p.name, 3), '[^A-Za-z0-9]', '', 'g')), 'PRO') || 
    UPPER(RIGHT(p.id::text, 1)) ||
    '-AST-' || 
    LPAD(ROW_NUMBER() OVER (PARTITION BY a2.property_id ORDER BY a2.created_at, a2.id)::text, 4, '0') as new_code
  FROM public.assets a2
  JOIN public.properties p ON p.id = a2.property_id
) subq
WHERE a.id = subq.id;

-- Generate codes for existing maintenance
UPDATE public.maintenance m
SET code = subq.new_code
FROM (
  SELECT 
    m2.id,
    COALESCE(UPPER(REGEXP_REPLACE(LEFT(p.name, 3), '[^A-Za-z0-9]', '', 'g')), 'PRO') || 
    UPPER(RIGHT(p.id::text, 1)) ||
    '-' ||
    CASE m2.type
      WHEN 'renovasi_lokasi' THEN 'REN'
      WHEN 'perbaikan_aset' THEN 'REP'
      ELSE 'MNT'
    END || '-' ||
    LPAD(ROW_NUMBER() OVER (PARTITION BY m2.property_id, m2.type ORDER BY m2.created_at, m2.id)::text, 4, '0') as new_code
  FROM public.maintenance m2
  JOIN public.properties p ON p.id = m2.property_id
) subq
WHERE m.id = subq.id;

-- Now add constraints
ALTER TABLE public.assets ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.assets ADD CONSTRAINT assets_code_unique UNIQUE (code);

ALTER TABLE public.maintenance ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_code_unique UNIQUE (code);

-- Create function to generate asset code
CREATE OR REPLACE FUNCTION public.generate_asset_code()
RETURNS TRIGGER AS $$
DECLARE
  property_prefix text;
  next_seq int;
BEGIN
  -- Get property code: first 3 chars + last char of property_id
  SELECT COALESCE(UPPER(REGEXP_REPLACE(LEFT(name, 3), '[^A-Za-z0-9]', '', 'g')), 'PRO') || 
         UPPER(RIGHT(id::text, 1))
  INTO property_prefix
  FROM public.properties
  WHERE id = NEW.property_id;
  
  IF property_prefix IS NULL OR property_prefix = '' THEN
    property_prefix := 'PROP';
  END IF;
  
  -- Get next sequence number for this property
  SELECT COALESCE(MAX(
    CASE 
      WHEN code ~ ('^' || property_prefix || '-AST-[0-9]+$')
      THEN CAST(SUBSTRING(code FROM '[0-9]+$') AS int)
      ELSE 0 
    END
  ), 0) + 1
  INTO next_seq
  FROM public.assets
  WHERE property_id = NEW.property_id;
  
  NEW.code := property_prefix || '-AST-' || LPAD(next_seq::text, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create function to generate maintenance code
CREATE OR REPLACE FUNCTION public.generate_maintenance_code()
RETURNS TRIGGER AS $$
DECLARE
  property_prefix text;
  type_code text;
  next_seq int;
BEGIN
  SELECT COALESCE(UPPER(REGEXP_REPLACE(LEFT(name, 3), '[^A-Za-z0-9]', '', 'g')), 'PRO') || 
         UPPER(RIGHT(id::text, 1))
  INTO property_prefix
  FROM public.properties
  WHERE id = NEW.property_id;
  
  IF property_prefix IS NULL OR property_prefix = '' THEN
    property_prefix := 'PROP';
  END IF;
  
  type_code := CASE NEW.type
    WHEN 'renovasi_lokasi' THEN 'REN'
    WHEN 'perbaikan_aset' THEN 'REP'
    ELSE 'MNT'
  END;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN code ~ ('^' || property_prefix || '-' || type_code || '-[0-9]+$')
      THEN CAST(SUBSTRING(code FROM '[0-9]+$') AS int)
      ELSE 0 
    END
  ), 0) + 1
  INTO next_seq
  FROM public.maintenance
  WHERE property_id = NEW.property_id AND type = NEW.type;
  
  NEW.code := property_prefix || '-' || type_code || '-' || LPAD(next_seq::text, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers
CREATE TRIGGER generate_asset_code_trigger
BEFORE INSERT ON public.assets
FOR EACH ROW
WHEN (NEW.code IS NULL)
EXECUTE FUNCTION public.generate_asset_code();

CREATE TRIGGER generate_maintenance_code_trigger
BEFORE INSERT ON public.maintenance
FOR EACH ROW
WHEN (NEW.code IS NULL)
EXECUTE FUNCTION public.generate_maintenance_code();