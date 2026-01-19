-- Allow anonymous users to check if email exists (for login flow)
CREATE POLICY "Allow public email lookup for login"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the old restrictive policy since we now have a permissive one
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;