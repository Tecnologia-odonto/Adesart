/*
  # Fix Parentesco and Planos Map RLS Policies

  ## Summary
  Fixes the role names in RLS policies for cadastro_parentesco_map and cadastro_planos_map tables.
  The policies were using incorrect role names (Administrador, Gerente, etc) instead of the correct
  uppercase names (ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA).

  ## Changes
  - Drop and recreate INSERT/UPDATE/DELETE policies with correct role names
  - Maintains SELECT policy for all authenticated users

  ## Security
  - SELECT: all authenticated users can view
  - INSERT/UPDATE: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA
  - DELETE: only ADMINISTRADOR
*/

-- ============================================================================
-- Fix cadastro_planos_map policies
-- ============================================================================

-- Drop existing policies (except SELECT which is correct)
DROP POLICY IF EXISTS "Authorized users can insert planos map" ON cadastro_planos_map;
DROP POLICY IF EXISTS "Authorized users can update planos map" ON cadastro_planos_map;
DROP POLICY IF EXISTS "Only Administrador can delete planos map" ON cadastro_planos_map;

-- INSERT: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA
CREATE POLICY "Authorized users can insert planos map"
  ON cadastro_planos_map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- UPDATE: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA
CREATE POLICY "Authorized users can update planos map"
  ON cadastro_planos_map
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- DELETE: apenas ADMINISTRADOR
CREATE POLICY "Only Administrador can delete planos map"
  ON cadastro_planos_map
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- ============================================================================
-- Fix cadastro_parentesco_map policies
-- ============================================================================

-- Drop existing policies (except SELECT which is correct)
DROP POLICY IF EXISTS "Authorized users can insert parentesco map" ON cadastro_parentesco_map;
DROP POLICY IF EXISTS "Authorized users can update parentesco map" ON cadastro_parentesco_map;
DROP POLICY IF EXISTS "Only Administrador can delete parentesco map" ON cadastro_parentesco_map;

-- INSERT: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA
CREATE POLICY "Authorized users can insert parentesco map"
  ON cadastro_parentesco_map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- UPDATE: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA
CREATE POLICY "Authorized users can update parentesco map"
  ON cadastro_parentesco_map
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- DELETE: apenas ADMINISTRADOR
CREATE POLICY "Only Administrador can delete parentesco map"
  ON cadastro_parentesco_map
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );
