/*
  # Fix RLS Recursion Issue on Teams Table

  ## Summary
  Fixes potential recursion in teams RLS policies by using the helper function
  created for profiles.

  ## Changes
  1. Drop existing policies
  2. Recreate policies using get_my_profile() helper function

  ## Security
  - Maintains same security rules as before
  - Uses helper function to avoid recursion
*/

-- Drop all existing policies on teams
DROP POLICY IF EXISTS "Admins and managers can view all teams" ON teams;
DROP POLICY IF EXISTS "Users can view their own team" ON teams;
DROP POLICY IF EXISTS "Only admins can create teams" ON teams;
DROP POLICY IF EXISTS "Only admins can update teams" ON teams;
DROP POLICY IF EXISTS "Only admins can delete teams" ON teams;

-- ============================================================================
-- NEW SELECT POLICIES
-- ============================================================================

-- SELECT: ADMINISTRADOR and GERENTE see all teams
CREATE POLICY "Admins and managers can view all teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE')
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- SELECT: SUPERVISOR, VENDEDOR, ADESIONISTA see only their team
CREATE POLICY "Users can view their own team"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) IN ('SUPERVISOR', 'VENDEDOR', 'ADESIONISTA')
    AND (SELECT is_active FROM get_my_profile()) = true
    AND teams.id = (SELECT team_id FROM get_my_profile())
  );

-- ============================================================================
-- INSERT POLICY
-- ============================================================================

-- INSERT: Only ADMINISTRADOR
CREATE POLICY "Only admins can create teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- ============================================================================
-- UPDATE POLICY
-- ============================================================================

-- UPDATE: Only ADMINISTRADOR
CREATE POLICY "Only admins can update teams"
  ON teams
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

-- ============================================================================
-- DELETE POLICY
-- ============================================================================

-- DELETE: Only ADMINISTRADOR
CREATE POLICY "Only admins can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );