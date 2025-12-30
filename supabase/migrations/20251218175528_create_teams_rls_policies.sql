/*
  # Create RLS Policies for Teams Table

  ## Summary
  Enables Row Level Security on teams table and creates policies based on user roles.

  ## Security Rules

  ### SELECT (View Teams)
  - ADMINISTRADOR: Can view all teams
  - GERENTE: Can view all teams
  - SUPERVISOR: Can view only their own team
  - VENDEDOR: Can view only their own team
  - ADESIONISTA: Can view only their own team

  ### INSERT (Create Teams)
  - Only ADMINISTRADOR can create teams

  ### UPDATE (Edit Teams)
  - Only ADMINISTRADOR can update teams

  ### DELETE (Remove Teams)
  - Only ADMINISTRADOR can delete teams

  ## Implementation Notes
  - All policies check authentication status first
  - Policies use profiles table to determine user role and team membership
  - Non-admin users can only see their assigned team
*/

-- Enable RLS on teams table
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- SELECT policy: ADMINISTRADOR and GERENTE see all teams
CREATE POLICY "Admins and managers can view all teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'GERENTE')
      AND profiles.is_active = true
    )
  );

-- SELECT policy: SUPERVISOR, VENDEDOR, ADESIONISTA see only their team
CREATE POLICY "Users can view their own team"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.team_id = teams.id
      AND profiles.is_active = true
    )
  );

-- INSERT policy: Only ADMINISTRADOR
CREATE POLICY "Only admins can create teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
      AND profiles.is_active = true
    )
  );

-- UPDATE policy: Only ADMINISTRADOR
CREATE POLICY "Only admins can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
      AND profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
      AND profiles.is_active = true
    )
  );

-- DELETE policy: Only ADMINISTRADOR
CREATE POLICY "Only admins can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
      AND profiles.is_active = true
    )
  );