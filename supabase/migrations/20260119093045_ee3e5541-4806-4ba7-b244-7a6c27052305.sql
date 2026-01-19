-- Drop existing restrictive policies and recreate as permissive

-- Assets
DROP POLICY IF EXISTS "HM and Superadmin can manage assets" ON public.assets;
DROP POLICY IF EXISTS "Users can view assets in assigned properties" ON public.assets;

CREATE POLICY "Users can view assets in assigned properties" 
ON public.assets FOR SELECT 
USING (has_property_access(auth.uid(), property_id));

CREATE POLICY "HM and Superadmin can insert assets" 
ON public.assets FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id))
);

CREATE POLICY "HM and Superadmin can update assets" 
ON public.assets FOR UPDATE 
USING (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id))
);

CREATE POLICY "HM and Superadmin can delete assets" 
ON public.assets FOR DELETE 
USING (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id))
);

-- Locations
DROP POLICY IF EXISTS "HM and Superadmin can manage locations" ON public.locations;
DROP POLICY IF EXISTS "Users can view locations in assigned properties" ON public.locations;

CREATE POLICY "Users can view locations in assigned properties" 
ON public.locations FOR SELECT 
USING (has_property_access(auth.uid(), property_id));

CREATE POLICY "HM and Superadmin can insert locations" 
ON public.locations FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id))
);

CREATE POLICY "HM and Superadmin can update locations" 
ON public.locations FOR UPDATE 
USING (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id))
);

CREATE POLICY "HM and Superadmin can delete locations" 
ON public.locations FOR DELETE 
USING (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id))
);

-- Maintenance
DROP POLICY IF EXISTS "All assigned users can create maintenance" ON public.maintenance;
DROP POLICY IF EXISTS "All assigned users can update maintenance" ON public.maintenance;
DROP POLICY IF EXISTS "HM and Superadmin can delete maintenance" ON public.maintenance;
DROP POLICY IF EXISTS "Users can view maintenance in assigned properties" ON public.maintenance;

CREATE POLICY "Users can view maintenance in assigned properties" 
ON public.maintenance FOR SELECT 
USING (has_property_access(auth.uid(), property_id));

CREATE POLICY "All assigned users can create maintenance" 
ON public.maintenance FOR INSERT 
WITH CHECK (has_property_access(auth.uid(), property_id));

CREATE POLICY "All assigned users can update maintenance" 
ON public.maintenance FOR UPDATE 
USING (has_property_access(auth.uid(), property_id));

CREATE POLICY "HM and Superadmin can delete maintenance" 
ON public.maintenance FOR DELETE 
USING (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), property_id))
);

-- Properties
DROP POLICY IF EXISTS "Superadmin and HM can manage properties" ON public.properties;
DROP POLICY IF EXISTS "Users can view assigned properties" ON public.properties;

CREATE POLICY "Users can view assigned properties" 
ON public.properties FOR SELECT 
USING (has_property_access(auth.uid(), id));

CREATE POLICY "Superadmin can insert properties" 
ON public.properties FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin and HM can update properties" 
ON public.properties FOR UPDATE 
USING (
  has_role(auth.uid(), 'superadmin') 
  OR (has_role(auth.uid(), 'hotel_manager') AND has_property_access(auth.uid(), id))
);

CREATE POLICY "Superadmin can delete properties" 
ON public.properties FOR DELETE 
USING (has_role(auth.uid(), 'superadmin'));

-- User Roles
DROP POLICY IF EXISTS "Superadmin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Users can view own role" 
ON public.user_roles FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can insert roles" 
ON public.user_roles FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can update roles" 
ON public.user_roles FOR UPDATE 
USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can delete roles" 
ON public.user_roles FOR DELETE 
USING (has_role(auth.uid(), 'superadmin'));

-- Property Assignments
DROP POLICY IF EXISTS "Superadmin can manage assignments" ON public.property_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON public.property_assignments;

CREATE POLICY "Users can view own assignments" 
ON public.property_assignments FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can insert assignments" 
ON public.property_assignments FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can update assignments" 
ON public.property_assignments FOR UPDATE 
USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can delete assignments" 
ON public.property_assignments FOR DELETE 
USING (has_role(auth.uid(), 'superadmin'));

-- Profiles - keep public lookup for login
DROP POLICY IF EXISTS "Allow public email lookup for login" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin can manage profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles for login" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Superadmin can insert profiles" 
ON public.profiles FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can update profiles" 
ON public.profiles FOR UPDATE 
USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can delete profiles" 
ON public.profiles FOR DELETE 
USING (has_role(auth.uid(), 'superadmin'));