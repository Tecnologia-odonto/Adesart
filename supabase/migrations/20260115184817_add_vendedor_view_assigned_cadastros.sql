/*
  # Add Vendedor View Assigned Cadastros Policy

  ## Summary
  Allows vendedores (salespeople) to view cadastros where they have been assigned as the vendedor,
  even if they did not create the cadastro. This enables vendedores to see pending registrations
  assigned to them by other users (like adesionistas).

  ## Changes
  - Drop existing "Vendedor can view own cadastros" policy
  - Create new policy that allows vendedores to view:
    1. Cadastros they created (created_by = auth.uid())
    2. Cadastros where they are assigned as vendedor (vendedor_id = auth.uid())

  ## Security
  - Vendedores can only see their own created cadastros OR cadastros assigned to them
  - No access to other vendedores' cadastros
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Vendedor can view own cadastros" ON cadastros;

-- Create new policy that includes assigned cadastros
CREATE POLICY "Vendedor can view own and assigned cadastros"
  ON cadastros
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'VENDEDOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND (
      cadastros.created_by = auth.uid()
      OR cadastros.vendedor_id = auth.uid()
    )
  );

-- Update UPDATE policy for vendedores to include assigned cadastros
DROP POLICY IF EXISTS "Vendedor can update own cadastros" ON cadastros;

CREATE POLICY "Vendedor can update own and assigned cadastros"
  ON cadastros
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'VENDEDOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND (
      cadastros.created_by = auth.uid()
      OR cadastros.vendedor_id = auth.uid()
    )
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'VENDEDOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND (
      cadastros.created_by = auth.uid()
      OR cadastros.vendedor_id = auth.uid()
    )
  );
