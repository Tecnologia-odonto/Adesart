/*
  # Fix Cadastro Config RLS Policies - Case Sensitivity
  
  1. Problem
    - Current policies check for 'Administrador', 'Gerente', etc (mixed case)
    - Actual roles in database are 'ADMINISTRADOR' (uppercase)
    - This causes authorization failures
  
  2. Solution
    - Drop existing UPDATE policy
    - Create new policy with case-insensitive comparison using UPPER()
    - This allows any case variation to work
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authorized users can update config" ON cadastro_config;

-- Create new UPDATE policy with case-insensitive role check
CREATE POLICY "Authorized users can update config"
  ON cadastro_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND UPPER(profiles.role) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND UPPER(profiles.role) IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
    )
  );
