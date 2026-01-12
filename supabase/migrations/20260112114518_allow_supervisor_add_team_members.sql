/*
  # Allow Supervisor to Add Team Members

  ## Changes
  1. Add new RLS policy for SUPERVISOR to add users to their team
    - SUPERVISOR can update team_id of users with no team (team_id IS NULL)
    - Only for VENDEDOR and ADESIONISTA roles
    - Only to assign them to the supervisor's own team

  ## Security
  - Maintains restriction that SUPERVISOR can only add members to their own team
  - Cannot modify users already in other teams
  - Only affects VENDEDOR and ADESIONISTA roles
*/

-- Allow SUPERVISOR to add team members (update NULL team_id to their team)
CREATE POLICY "Supervisors can add users to their team"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id IS NULL
    AND profiles.role IN ('VENDEDOR', 'ADESIONISTA')
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id = (SELECT team_id FROM get_my_profile())
    AND profiles.role IN ('VENDEDOR', 'ADESIONISTA')
  );

-- Allow SUPERVISOR to remove team members (update team_id to NULL)
CREATE POLICY "Supervisors can remove users from their team"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id = (SELECT team_id FROM get_my_profile())
    AND profiles.role IN ('VENDEDOR', 'ADESIONISTA')
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND profiles.team_id IS NULL
    AND profiles.role IN ('VENDEDOR', 'ADESIONISTA')
  );