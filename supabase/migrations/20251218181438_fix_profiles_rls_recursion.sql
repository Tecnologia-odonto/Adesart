/*
  # Fix RLS Recursion Issue on Profiles Table

  ## Summary
  Fixes infinite recursion in profiles RLS policies by using a helper function
  and rewriting policies to avoid self-referencing queries.

  ## Changes
  1. Drop existing policies that cause recursion
  2. Create helper function to get current user's role without recursion
  3. Create new simplified policies using the helper function

  ## Security
  - Maintains same security rules as before
  - Eliminates recursion by using a function that bypasses RLS
*/

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Admins and managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Supervisors can view their team members" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can create any user" ON profiles;
DROP POLICY IF EXISTS "Managers can create any user" ON profiles;
DROP POLICY IF EXISTS "Supervisors can create users in their team" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Managers can update profiles" ON profiles;
DROP POLICY IF EXISTS "Supervisors can update their team members" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON profiles;

-- Create helper function to get current user's profile without RLS recursion
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS TABLE (
  id uuid,
  role text,
  team_id uuid,
  is_active boolean
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.role, p.team_id, p.is_active
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- NEW SELECT POLICIES (No Recursion)
-- ============================================================================

-- SELECT: ADMINISTRADOR and GERENTE see all profiles
CREATE POLICY "Admins and managers can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE')
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- SELECT: SUPERVISOR sees only team members
CREATE POLICY "Supervisors can view their team members"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id = (SELECT team_id FROM get_my_profile())
  );

-- SELECT: VENDEDOR and ADESIONISTA see only themselves
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    profiles.id = auth.uid()
  );

-- ============================================================================
-- NEW INSERT POLICIES
-- ============================================================================

-- INSERT: ADMINISTRADOR can create any user
CREATE POLICY "Admins can create any user"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- INSERT: GERENTE can create any user
CREATE POLICY "Managers can create any user"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'GERENTE'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- INSERT: SUPERVISOR can create users for their team only
CREATE POLICY "Supervisors can create users in their team"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id = (SELECT team_id FROM get_my_profile())
  );

-- ============================================================================
-- NEW UPDATE POLICIES
-- ============================================================================

-- UPDATE: ADMINISTRADOR can update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- UPDATE: GERENTE can update any profile
CREATE POLICY "Managers can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'GERENTE'
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'GERENTE'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- UPDATE: SUPERVISOR can update team members only
CREATE POLICY "Supervisors can update their team members"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id = (SELECT team_id FROM get_my_profile())
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id = (SELECT team_id FROM get_my_profile())
  );

-- UPDATE: VENDEDOR and ADESIONISTA can update only their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    profiles.id = auth.uid()
  )
  WITH CHECK (
    profiles.id = auth.uid()
  );

-- ============================================================================
-- NEW DELETE POLICY
-- ============================================================================

-- DELETE: Only ADMINISTRADOR
CREATE POLICY "Only admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );