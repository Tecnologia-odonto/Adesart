/*
  # Rollback Completo para v242 - Restaurar Policies de Cadastros

  1. Objetivo
    - Desfazer completamente as migrações v243 problemáticas
    - Remover TODAS as policies atuais de cadastros
    - Recriar policies EXATAMENTE como estavam na v242 (funcionando)

  2. Migrações sendo Desfeitas
    - 20260304195634_fix_duplicate_cadastros_policies.sql
    - 20260304200259_fix_cadastros_rls_use_get_my_profile.sql  
    - 20260304203942_revert_cadastros_rls_to_exists_version.sql

  3. Estratégia
    - DROP de TODAS as policies atuais de cadastros
    - Recriar policies simples com EXISTS, SEM is_active check
    - Versão v242 NÃO verificava is_active nas policies de cadastros
    - Manter a estrutura exata que funcionava

  4. Policies a Serem Criadas (v242)
    - ADMINISTRADOR: Acesso total (SELECT, INSERT, UPDATE, DELETE)
    - GERENTE: Acesso total (SELECT, INSERT, UPDATE)
    - CADASTRO: Acesso total (SELECT, INSERT, UPDATE)
    - ADESIONISTA: Acesso total (SELECT, INSERT, UPDATE)
    - SUPERVISOR: Acesso ao seu time (SELECT, INSERT, UPDATE)
    - VENDEDOR: Acesso aos seus cadastros (SELECT, INSERT, UPDATE)
*/

-- ============================================
-- PASSO 1: REMOVER TODAS AS POLICIES ATUAIS
-- ============================================

-- Remover todas as policies de cadastros sem exceção
DROP POLICY IF EXISTS "Administrador can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro users can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can view team cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can view own cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can view assigned cadastros" ON cadastros;

DROP POLICY IF EXISTS "Administrador can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro users can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can insert cadastros" ON cadastros;

DROP POLICY IF EXISTS "Administrador can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro users can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can update team cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can update own cadastros" ON cadastros;

DROP POLICY IF EXISTS "Only Administrador can delete cadastros" ON cadastros;

-- ============================================
-- PASSO 2: RECRIAR POLICIES v242 (ORIGINAIS)
-- ============================================

-- ===============================
-- SELECT POLICIES (v242)
-- ===============================

-- ADMINISTRADOR pode ver todos os cadastros
CREATE POLICY "Administrador can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
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
      AND profiles.team_id = cadastros.team_id
    )
  );

-- VENDEDOR pode ver cadastros criados por ele ou atribuídos a ele
CREATE POLICY "Vendedor can view assigned cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'VENDEDOR'
      AND (cadastros.created_by = auth.uid() OR cadastros.vendedor_id = auth.uid())
    )
  );

-- ===============================
-- INSERT POLICIES (v242)
-- ===============================

-- ADMINISTRADOR pode inserir cadastros
CREATE POLICY "Administrador can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
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
    )
  );

-- ===============================
-- UPDATE POLICIES (v242)
-- ===============================

-- ADMINISTRADOR pode atualizar todos os cadastros
CREATE POLICY "Administrador can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
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
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
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
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
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
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
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
      AND profiles.team_id = cadastros.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
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
      AND (cadastros.created_by = auth.uid() OR cadastros.vendedor_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'VENDEDOR'
      AND (cadastros.created_by = auth.uid() OR cadastros.vendedor_id = auth.uid())
    )
  );

-- ===============================
-- DELETE POLICY (v242)
-- ===============================

-- Apenas ADMINISTRADOR pode deletar cadastros
CREATE POLICY "Only Administrador can delete cadastros"
  ON cadastros FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );
