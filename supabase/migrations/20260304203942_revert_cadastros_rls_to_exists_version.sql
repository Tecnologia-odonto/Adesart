/*
  # Reverter políticas RLS de cadastros para versão com EXISTS (v242)
  
  1. Problema Identificado
    - A migração 20260304200259 mudou todas as policies para usar get_my_profile()
    - Após essa mudança, ADMINISTRADOR está vendo apenas 2 cadastros ao invés de 308
    - A versão anterior com EXISTS funcionava corretamente
  
  2. Solução
    - Reverter TODAS as policies de cadastros para usar EXISTS direto
    - Manter verificação de is_active = true
    - Não usar get_my_profile() nas policies de cadastros
  
  3. Policies Revertidas
    - SELECT: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA, SUPERVISOR, VENDEDOR
    - INSERT: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA, SUPERVISOR, VENDEDOR
    - UPDATE: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA, SUPERVISOR, VENDEDOR
    - DELETE: ADMINISTRADOR
  
  4. Comportamento Esperado (como na v242)
    - ADMINISTRADOR: vê todos os 308 cadastros
    - GERENTE: vê todos os cadastros
    - CADASTRO: vê todos os cadastros
    - ADESIONISTA: vê todos os cadastros
    - SUPERVISOR: vê cadastros do seu time
    - VENDEDOR: vê cadastros criados por ele ou atribuídos a ele
*/

-- ============================================
-- REMOVER POLICIES COM get_my_profile()
-- ============================================

-- SELECT policies
DROP POLICY IF EXISTS "Administrador can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can view team cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can view own cadastros" ON cadastros;

-- INSERT policies
DROP POLICY IF EXISTS "Administrador can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can insert cadastros" ON cadastros;

-- UPDATE policies
DROP POLICY IF EXISTS "Administrador can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can update team cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can update own cadastros" ON cadastros;

-- DELETE policy
DROP POLICY IF EXISTS "Only Administrador can delete cadastros" ON cadastros;

-- ============================================
-- CRIAR POLICIES COM EXISTS (VERSÃO v242)
-- ============================================

-- SELECT POLICIES
-- ----------------

-- ADMINISTRADOR pode ver todos os cadastros
CREATE POLICY "Administrador can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
      AND profiles.is_active = true
    )
  );

-- GERENTE pode ver todos os cadastros
CREATE POLICY "Gerente can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
      AND profiles.is_active = true
    )
  );

-- CADASTRO pode ver todos os cadastros
CREATE POLICY "Cadastro can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
      AND profiles.is_active = true
    )
  );

-- ADESIONISTA pode ver todos os cadastros
CREATE POLICY "Adesionista can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
      AND profiles.is_active = true
    )
  );

-- SUPERVISOR pode ver cadastros do seu time
CREATE POLICY "Supervisor can view team cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
      AND profiles.is_active = true
      AND profiles.team_id = cadastros.team_id
    )
  );

-- VENDEDOR pode ver cadastros criados por ele ou atribuídos a ele
CREATE POLICY "Vendedor can view own cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'VENDEDOR'
      AND profiles.is_active = true
      AND (cadastros.created_by = auth.uid() OR cadastros.vendedor_id = auth.uid())
    )
  );

-- INSERT POLICIES
-- ----------------

-- ADMINISTRADOR pode inserir cadastros
CREATE POLICY "Administrador can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
      AND profiles.is_active = true
    )
  );

-- GERENTE pode inserir cadastros
CREATE POLICY "Gerente can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
      AND profiles.is_active = true
    )
  );

-- CADASTRO pode inserir cadastros
CREATE POLICY "Cadastro can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
      AND profiles.is_active = true
    )
  );

-- ADESIONISTA pode inserir cadastros
CREATE POLICY "Adesionista can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
      AND profiles.is_active = true
    )
  );

-- SUPERVISOR pode inserir cadastros
CREATE POLICY "Supervisor can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
      AND profiles.is_active = true
    )
  );

-- VENDEDOR pode inserir cadastros
CREATE POLICY "Vendedor can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'VENDEDOR'
      AND profiles.is_active = true
    )
  );

-- UPDATE POLICIES
-- ----------------

-- ADMINISTRADOR pode atualizar todos os cadastros
CREATE POLICY "Administrador can update all cadastros"
  ON cadastros FOR UPDATE
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

-- GERENTE pode atualizar todos os cadastros
CREATE POLICY "Gerente can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
      AND profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
      AND profiles.is_active = true
    )
  );

-- CADASTRO pode atualizar todos os cadastros
CREATE POLICY "Cadastro can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
      AND profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
      AND profiles.is_active = true
    )
  );

-- ADESIONISTA pode atualizar todos os cadastros
CREATE POLICY "Adesionista can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
      AND profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
      AND profiles.is_active = true
    )
  );

-- SUPERVISOR pode atualizar cadastros do seu time
CREATE POLICY "Supervisor can update team cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
      AND profiles.is_active = true
      AND profiles.team_id = cadastros.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
      AND profiles.is_active = true
      AND profiles.team_id = cadastros.team_id
    )
  );

-- VENDEDOR pode atualizar cadastros criados por ele ou atribuídos a ele
CREATE POLICY "Vendedor can update own cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'VENDEDOR'
      AND profiles.is_active = true
      AND (cadastros.created_by = auth.uid() OR cadastros.vendedor_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'VENDEDOR'
      AND profiles.is_active = true
      AND (cadastros.created_by = auth.uid() OR cadastros.vendedor_id = auth.uid())
    )
  );

-- DELETE POLICY
-- --------------

-- Apenas ADMINISTRADOR pode deletar cadastros
CREATE POLICY "Only Administrador can delete cadastros"
  ON cadastros FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
      AND profiles.is_active = true
    )
  );
