/*
  # Add CADASTRO Role (v3)
  
  ## Summary
  Creates a new user role "CADASTRO" with permissions similar to GERENTE (manager).
  
  ## Changes
  1. Add 'CADASTRO' to allowed roles in profiles table
  2. Add constraint for CADASTRO role (no team_id, no external_id like GERENTE)
  3. Add RLS policies for CADASTRO role:
     - Can view all teams (read-only)
     - Can view all profiles
     - Can view all cadastros
     - Can insert/update cadastros
     - Cannot edit teams or profiles
  
  ## Security
  - CADASTRO users can only read teams, not modify them
  - CADASTRO users can manage cadastros like GERENTE
  - CADASTRO users select a vendor and use that vendor's external_id for operations
*/

-- Step 1: Drop existing constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS admin_gerente_no_team;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS admin_gerente_cadastro_no_team;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS gerente_cadastro_no_team;

-- Step 2: Add new role constraint including CADASTRO
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ADMINISTRADOR', 'GERENTE', 'SUPERVISOR', 'VENDEDOR', 'ADESIONISTA', 'CADASTRO'));

-- Step 3: Add constraint for GERENTE and CADASTRO (no team, no external_id)
-- Note: ADMINISTRADOR can have external_id if needed for legacy reasons
ALTER TABLE profiles ADD CONSTRAINT gerente_cadastro_no_team 
  CHECK (
    (role NOT IN ('GERENTE', 'CADASTRO')) OR 
    (team_id IS NULL AND external_id IS NULL)
  );

-- Step 4: Add RLS policies for CADASTRO role

-- Allow CADASTRO to view all teams (read-only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'teams' 
    AND policyname = 'Cadastro users can view all teams'
  ) THEN
    CREATE POLICY "Cadastro users can view all teams"
      ON teams
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;

-- Allow CADASTRO to view all profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Cadastro users can view all profiles'
  ) THEN
    CREATE POLICY "Cadastro users can view all profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;

-- Allow CADASTRO to view all cadastros
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastros' 
    AND policyname = 'Cadastro users can view all cadastros'
  ) THEN
    CREATE POLICY "Cadastro users can view all cadastros"
      ON cadastros
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;

-- Allow CADASTRO to insert cadastros
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastros' 
    AND policyname = 'Cadastro users can insert cadastros'
  ) THEN
    CREATE POLICY "Cadastro users can insert cadastros"
      ON cadastros
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;

-- Allow CADASTRO to update all cadastros
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastros' 
    AND policyname = 'Cadastro users can update all cadastros'
  ) THEN
    CREATE POLICY "Cadastro users can update all cadastros"
      ON cadastros
      FOR UPDATE
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      )
      WITH CHECK (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;

-- Allow CADASTRO to view cadastro config
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastro_config' 
    AND policyname = 'Cadastro users can view config'
  ) THEN
    CREATE POLICY "Cadastro users can view config"
      ON cadastro_config
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;

-- Allow CADASTRO to view parentesco map
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastro_parentesco_map' 
    AND policyname = 'Cadastro users can view parentesco map'
  ) THEN
    CREATE POLICY "Cadastro users can view parentesco map"
      ON cadastro_parentesco_map
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;

-- Allow CADASTRO to view planos map
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastro_planos_map' 
    AND policyname = 'Cadastro users can view planos map'
  ) THEN
    CREATE POLICY "Cadastro users can view planos map"
      ON cadastro_planos_map
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM get_my_profile()) = 'CADASTRO'
        AND (SELECT is_active FROM get_my_profile()) = true
      );
  END IF;
END $$;