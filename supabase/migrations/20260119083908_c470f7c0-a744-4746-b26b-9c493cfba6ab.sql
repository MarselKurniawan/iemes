
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('superadmin', 'hotel_manager', 'staff');
CREATE TYPE public.location_type AS ENUM ('kamar', 'fasilitas_umum', 'office');
CREATE TYPE public.asset_category AS ENUM (
  'peralatan_kamar', 
  'peralatan_dapur', 
  'mesin_laundry_housekeeping', 
  'kendaraan_operasional', 
  'peralatan_kantor_it', 
  'peralatan_rekreasi_leisure', 
  'infrastruktur'
);
CREATE TYPE public.asset_condition AS ENUM ('baik', 'cukup', 'perlu_perbaikan', 'rusak');
CREATE TYPE public.asset_status AS ENUM ('aktif', 'dalam_perbaikan', 'tidak_aktif', 'dihapuskan');
CREATE TYPE public.maintenance_type AS ENUM ('renovasi_lokasi', 'perbaikan_aset');
CREATE TYPE public.maintenance_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  login_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create property_assignments table (for multi-property assignment)
CREATE TABLE public.property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

-- Create locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type location_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create assets table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  is_movable BOOLEAN NOT NULL DEFAULT false,
  category asset_category NOT NULL,
  brand TEXT,
  series TEXT,
  purchase_price DECIMAL(15,2),
  condition asset_condition NOT NULL DEFAULT 'baik',
  status asset_status NOT NULL DEFAULT 'aktif',
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create maintenance table
CREATE TABLE public.maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type maintenance_type NOT NULL,
  description TEXT,
  evidence_urls TEXT[],
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  status maintenance_status NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to check property access
CREATE OR REPLACE FUNCTION public.has_property_access(_user_id UUID, _property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'superadmin') 
    OR EXISTS (
      SELECT 1 FROM public.property_assignments
      WHERE user_id = _user_id AND property_id = _property_id
    )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can manage profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'));

-- User roles policies
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Properties policies
CREATE POLICY "Users can view assigned properties"
  ON public.properties FOR SELECT
  USING (public.has_property_access(auth.uid(), id));

CREATE POLICY "Superadmin and HM can manage properties"
  ON public.properties FOR ALL
  USING (
    public.has_role(auth.uid(), 'superadmin') 
    OR (public.has_role(auth.uid(), 'hotel_manager') AND public.has_property_access(auth.uid(), id))
  );

-- Property assignments policies
CREATE POLICY "Users can view own assignments"
  ON public.property_assignments FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin can manage assignments"
  ON public.property_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Locations policies
CREATE POLICY "Users can view locations in assigned properties"
  ON public.locations FOR SELECT
  USING (public.has_property_access(auth.uid(), property_id));

CREATE POLICY "HM and Superadmin can manage locations"
  ON public.locations FOR ALL
  USING (
    public.has_role(auth.uid(), 'superadmin') 
    OR (public.has_role(auth.uid(), 'hotel_manager') AND public.has_property_access(auth.uid(), property_id))
  );

-- Assets policies
CREATE POLICY "Users can view assets in assigned properties"
  ON public.assets FOR SELECT
  USING (public.has_property_access(auth.uid(), property_id));

CREATE POLICY "HM and Superadmin can manage assets"
  ON public.assets FOR ALL
  USING (
    public.has_role(auth.uid(), 'superadmin') 
    OR (public.has_role(auth.uid(), 'hotel_manager') AND public.has_property_access(auth.uid(), property_id))
  );

-- Maintenance policies
CREATE POLICY "Users can view maintenance in assigned properties"
  ON public.maintenance FOR SELECT
  USING (public.has_property_access(auth.uid(), property_id));

CREATE POLICY "All assigned users can create maintenance"
  ON public.maintenance FOR INSERT
  WITH CHECK (public.has_property_access(auth.uid(), property_id));

CREATE POLICY "All assigned users can update maintenance"
  ON public.maintenance FOR UPDATE
  USING (public.has_property_access(auth.uid(), property_id));

CREATE POLICY "HM and Superadmin can delete maintenance"
  ON public.maintenance FOR DELETE
  USING (
    public.has_role(auth.uid(), 'superadmin') 
    OR (public.has_role(auth.uid(), 'hotel_manager') AND public.has_property_access(auth.uid(), property_id))
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON public.maintenance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence', 'evidence', true);

-- Storage policies
CREATE POLICY "Anyone can view evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence');

CREATE POLICY "Authenticated users can upload evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own evidence"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'evidence' AND auth.role() = 'authenticated');
