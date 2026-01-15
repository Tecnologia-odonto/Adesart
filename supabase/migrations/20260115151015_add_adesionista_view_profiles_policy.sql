/*
  # Add Adesionista View Profiles Policy

  ## Summary
  Allows ADESIONISTA users to view all profiles, specifically to be able to select vendors (VENDEDOR)
  when creating new registrations (cadastros).

  ## Changes
  - Add SELECT policy for ADESIONISTA role to view all profiles

  ## Security
  - ADESIONISTA users can only read profiles, not modify them
  - This allows them to select vendors from the list when creating cadastros
  - Maintains existing security model where ADESIONISTA cannot edit other users
*/

-- Allow ADESIONISTA to view all profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Adesionista users can view all profiles'
  ) THEN
    CREATE POLICY "Adesionista users can view all profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'ADESIONISTA'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;
