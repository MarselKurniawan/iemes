-- Add approval columns to maintenance table
ALTER TABLE public.maintenance 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update existing maintenance records to be approved (backward compatibility)
UPDATE public.maintenance SET approval_status = 'approved' WHERE approval_status = 'pending_approval';

-- Allow Staff to create maintenance requests
DROP POLICY IF EXISTS "Staff can insert maintenance" ON public.maintenance;
CREATE POLICY "Staff can insert maintenance"
ON public.maintenance
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'staff') AND has_property_access(auth.uid(), property_id)
);

-- Drop and recreate update policies to include supervisor
DROP POLICY IF EXISTS "Superadmin and HM can update maintenance" ON public.maintenance;
DROP POLICY IF EXISTS "Staff can update maintenance" ON public.maintenance;

-- Supervisor and above can fully update maintenance
CREATE POLICY "Superadmin HM Supervisor can update maintenance"
ON public.maintenance
FOR UPDATE
USING (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

-- Staff can only update limited fields
CREATE POLICY "Staff can update maintenance limited"
ON public.maintenance
FOR UPDATE
USING (has_role(auth.uid(), 'staff') AND has_property_access(auth.uid(), property_id));

-- Supervisor can delete maintenance
DROP POLICY IF EXISTS "HM and Superadmin can delete maintenance" ON public.maintenance;
CREATE POLICY "HM Superadmin Supervisor can delete maintenance"
ON public.maintenance
FOR DELETE
USING (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

-- Update insert policy to include Supervisor
DROP POLICY IF EXISTS "HM and Superadmin can insert maintenance" ON public.maintenance;
CREATE POLICY "HM Superadmin Supervisor can insert maintenance"
ON public.maintenance
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

-- Add supervisor access to assets
DROP POLICY IF EXISTS "HM and Superadmin can insert assets" ON public.assets;
CREATE POLICY "HM Superadmin Supervisor can insert assets"
ON public.assets
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

DROP POLICY IF EXISTS "HM and Superadmin can delete assets" ON public.assets;
CREATE POLICY "HM Superadmin Supervisor can delete assets"
ON public.assets
FOR DELETE
USING (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

DROP POLICY IF EXISTS "Superadmin and HM can update assets" ON public.assets;
CREATE POLICY "Superadmin HM Supervisor can update assets"
ON public.assets
FOR UPDATE
USING (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

-- Add supervisor access to locations
DROP POLICY IF EXISTS "HM and Superadmin can insert locations" ON public.locations;
CREATE POLICY "HM Superadmin Supervisor can insert locations"
ON public.locations
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

DROP POLICY IF EXISTS "HM and Superadmin can delete locations" ON public.locations;
CREATE POLICY "HM Superadmin Supervisor can delete locations"
ON public.locations
FOR DELETE
USING (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

DROP POLICY IF EXISTS "Superadmin and HM can update locations" ON public.locations;
CREATE POLICY "Superadmin HM Supervisor can update locations"
ON public.locations
FOR UPDATE
USING (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), property_id))
);

-- Supervisor can update properties
DROP POLICY IF EXISTS "Superadmin and HM can update properties" ON public.properties;
CREATE POLICY "Superadmin HM Supervisor can update properties"
ON public.properties
FOR UPDATE
USING (
  (has_role(auth.uid(), 'superadmin')) OR
  (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), id)) OR
  (has_role(auth.uid(), 'supervisor') AND has_property_access(auth.uid(), id))
);