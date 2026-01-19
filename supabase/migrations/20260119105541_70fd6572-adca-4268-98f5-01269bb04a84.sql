-- Update RLS policies for Staff permissions
-- Staff can only UPDATE specific fields (status) on locations, assets
-- Staff can UPDATE status, tanggal (dates), evidence on maintenance
-- Staff CANNOT INSERT or DELETE maintenance

-- 1. Update ASSETS policies to allow Staff to update status only
DROP POLICY IF EXISTS "HM and Superadmin can update assets" ON public.assets;

-- Superadmin and HM can update all fields
CREATE POLICY "Superadmin and HM can update assets"
ON public.assets
FOR UPDATE
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  (has_role(auth.uid(), 'hotel_manager'::app_role) AND has_property_access(auth.uid(), property_id))
);

-- Staff can update assets (only status in practice - we'll control fields in app)
CREATE POLICY "Staff can update asset status"
ON public.assets
FOR UPDATE
USING (
  has_role(auth.uid(), 'staff'::app_role) AND has_property_access(auth.uid(), property_id)
);

-- 2. Update LOCATIONS policies to allow Staff to update status only
DROP POLICY IF EXISTS "HM and Superadmin can update locations" ON public.locations;

-- Superadmin and HM can update all fields
CREATE POLICY "Superadmin and HM can update locations"
ON public.locations
FOR UPDATE
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  (has_role(auth.uid(), 'hotel_manager'::app_role) AND has_property_access(auth.uid(), property_id))
);

-- Staff can update locations
CREATE POLICY "Staff can update locations"
ON public.locations
FOR UPDATE
USING (
  has_role(auth.uid(), 'staff'::app_role) AND has_property_access(auth.uid(), property_id)
);

-- 3. Update MAINTENANCE policies
-- Drop existing policies
DROP POLICY IF EXISTS "All assigned users can create maintenance" ON public.maintenance;
DROP POLICY IF EXISTS "All assigned users can update maintenance" ON public.maintenance;

-- HM and Superadmin can insert maintenance
CREATE POLICY "HM and Superadmin can insert maintenance"
ON public.maintenance
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  (has_role(auth.uid(), 'hotel_manager'::app_role) AND has_property_access(auth.uid(), property_id))
);

-- Superadmin and HM can update all maintenance fields
CREATE POLICY "Superadmin and HM can update maintenance"
ON public.maintenance
FOR UPDATE
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  (has_role(auth.uid(), 'hotel_manager'::app_role) AND has_property_access(auth.uid(), property_id))
);

-- Staff can update maintenance (status, dates, evidence only - controlled in app)
CREATE POLICY "Staff can update maintenance"
ON public.maintenance
FOR UPDATE
USING (
  has_role(auth.uid(), 'staff'::app_role) AND has_property_access(auth.uid(), property_id)
);