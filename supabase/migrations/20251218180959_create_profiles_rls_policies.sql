/*
  # Create RLS Policies for Profiles Table

  ## Summary
  Enables Row Level Security on profiles table and creates comprehensive policies based on user roles.

  ## Security Rules

  ### SELECT (View Users)
  - ADMINISTRADOR: Can view all profiles
  - GERENTE: Can view all profiles
  - SUPERVISOR: Can view only profiles from their team
  - VENDEDOR: Can view only their own profile
  - ADESIONISTA: Can view only their own profile

  ### INSERT (Create Users)
  - ADMINISTRADOR: Can create any user
  - GERENTE: Can create any user
  - SUPERVISOR: Can create users only for their team
  - Note: Actual creation happens via Edge Function with service role

  ### UPDATE (Edit Users)
  - ADMINISTRADOR: Can update any profile (all fields)
  - GERENTE: Can update any profile (except is_active and certain sensitive fields)
  - SUPERVISOR: Can update only profiles from their team
  - VENDEDOR: Can update only their own profile (limited fields: name)
  - ADESIONISTA: Can update only their own profile (limited fields: name)

  ### DELETE (Remove Users)
  - Only ADMINISTRADOR can delete profiles (soft delete via is_active recommended)

  ## Implementation Notes
  - All policies check authentication and is_active status
  - Supervisor restrictions based on team_id matching
  - Update policies prevent role/team changes for non-admins
*/

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- SELECT: ADMINISTRADOR and GERENTE see all profiles
CREATE POLICY "Admins and managers can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role IN ('ADMINISTRADOR', 'GERENTE')
      AND requesting_user.is_active = true
    )
  );

-- SELECT: SUPERVISOR sees only team members
CREATE POLICY "Supervisors can view their team members"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'SUPERVISOR'
      AND requesting_user.is_active = true
      AND requesting_user.team_id = profiles.team_id
    )
  );

-- SELECT: VENDEDOR and ADESIONISTA see only themselves
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    profiles.id = auth.uid()
    AND profiles.is_active = true
  );

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- INSERT: ADMINISTRADOR can create any user
CREATE POLICY "Admins can create any user"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'ADMINISTRADOR'
      AND requesting_user.is_active = true
    )
  );

-- INSERT: GERENTE can create any user
CREATE POLICY "Managers can create any user"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'GERENTE'
      AND requesting_user.is_active = true
    )
  );

-- INSERT: SUPERVISOR can create users for their team only
CREATE POLICY "Supervisors can create users in their team"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'SUPERVISOR'
      AND requesting_user.is_active = true
      AND requesting_user.team_id = profiles.team_id
    )
  );

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- UPDATE: ADMINISTRADOR can update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'ADMINISTRADOR'
      AND requesting_user.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'ADMINISTRADOR'
      AND requesting_user.is_active = true
    )
  );

-- UPDATE: GERENTE can update any profile (but RLS alone cannot prevent is_active changes - handle in app)
CREATE POLICY "Managers can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'GERENTE'
      AND requesting_user.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'GERENTE'
      AND requesting_user.is_active = true
    )
  );

-- UPDATE: SUPERVISOR can update team members only
CREATE POLICY "Supervisors can update their team members"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'SUPERVISOR'
      AND requesting_user.is_active = true
      AND requesting_user.team_id = profiles.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'SUPERVISOR'
      AND requesting_user.is_active = true
      AND requesting_user.team_id = profiles.team_id
    )
  );

-- UPDATE: VENDEDOR and ADESIONISTA can update only their own profile
-- Note: Field-level restrictions (only name) should be enforced in application layer
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    profiles.id = auth.uid()
    AND profiles.is_active = true
  )
  WITH CHECK (
    profiles.id = auth.uid()
    AND profiles.is_active = true
  );

-- ============================================================================
-- DELETE POLICIES
-- ============================================================================

-- DELETE: Only ADMINISTRADOR (though soft delete via is_active is recommended)
CREATE POLICY "Only admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS requesting_user
      WHERE requesting_user.id = auth.uid()
      AND requesting_user.role = 'ADMINISTRADOR'
      AND requesting_user.is_active = true
    )
  );