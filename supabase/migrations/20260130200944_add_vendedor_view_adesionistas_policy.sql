/*
  # Add Vendedor View Adesionistas Policy

  ## Summary
  Allows VENDEDOR users to view profiles with role ADESIONISTA, so they can select
  an adesionista when creating new registrations (cadastros).

  ## Changes
  - Add SELECT policy for VENDEDOR role to view ADESIONISTA profiles

  ## Security
  - VENDEDOR users can only read ADESIONISTA profiles, not modify them
  - This allows them to select adesionistas from the list when creating cadastros
  - Maintains existing security model where VENDEDOR cannot edit other users
*/

-- Allow VENDEDOR to view ADESIONISTA profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Vendedor users can view adesionista profiles'
  ) THEN
    CREATE POLICY "Vendedor users can view adesionista profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'VENDEDOR'
        AND (SELECT is_active FROM get_my_profile()) = true
        AND profiles.role = 'ADESIONISTA'
        AND profiles.is_active = true
      );
  END IF;
END $$;