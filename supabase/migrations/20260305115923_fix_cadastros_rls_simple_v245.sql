/*
  # Fix RLS Cadastros - Versão Simples v245

  1. Problema
    - Policies complexas causando recursão ou problemas de performance
    - JWT pode não estar disponível em todas as situações

  2. Solução SIMPLES
    - ADMINISTRADOR: vê tudo (sem subquery)
    - GERENTE: vê tudo (sem subquery)
    - CADASTRO: vê tudo (sem subquery)
    - ADESIONISTA: vê tudo (sem subquery)
    - SUPERVISOR: vê cadastros do seu time
    - VENDEDOR: vê cadastros criados por ele OU atribuídos a ele (vendedor_id)

  3. Estratégia
    - Usar auth.uid() diretamente
    - Apenas UMA subquery simples para pegar o role
    - Sem recursão, sem complexidade
*/

-- ============================================
-- REMOVER TODAS AS POLICIES EXISTENTES
-- ============================================

DROP POLICY IF EXISTS "Administrador can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can view team cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can view assigned cadastros" ON cadastros;

DROP POLICY IF EXISTS "Administrador can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can insert cadastros" ON cadastros;

DROP POLICY IF EXISTS "Administrador can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can update team cadastros" ON cadastros;
DROP POLICY IF EXISTS "Vendedor can update own cadastros" ON cadastros;

DROP POLICY IF EXISTS "Only Administrador can delete cadastros" ON cadastros;

-- ============================================
-- CRIAR POLICIES SIMPLES E EFICIENTES
-- ============================================

-- ===================================
-- SELECT POLICIES (VER CADASTROS)
-- ===================================

-- ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA veem TUDO
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista view all"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  );

-- SUPERVISOR vê cadastros do seu time
CREATE POLICY "Supervisor view team cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERVISOR'
    AND team_id::text = auth.jwt() -> 'app_metadata' ->> 'team_id'
  );

-- VENDEDOR vê cadastros criados por ele OU atribuídos a ele
CREATE POLICY "Vendedor view own cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  );

-- ===================================
-- INSERT POLICIES (CRIAR CADASTROS)
-- ===================================

-- TODOS os roles autenticados podem inserir
CREATE POLICY "Authenticated users can insert"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===================================
-- UPDATE POLICIES (ATUALIZAR CADASTROS)
-- ===================================

-- ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA podem atualizar TUDO
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista update all"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  )
  WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  );

-- SUPERVISOR pode atualizar cadastros do seu time
CREATE POLICY "Supervisor update team cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERVISOR'
    AND team_id::text = auth.jwt() -> 'app_metadata' ->> 'team_id'
  )
  WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERVISOR'
    AND team_id::text = auth.jwt() -> 'app_metadata' ->> 'team_id'
  );

-- VENDEDOR pode atualizar cadastros criados por ele OU atribuídos a ele
CREATE POLICY "Vendedor update own cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  )
  WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  );

-- ===================================
-- DELETE POLICY (DELETAR CADASTROS)
-- ===================================

-- Apenas ADMINISTRADOR pode deletar
CREATE POLICY "Only admin can delete"
  ON cadastros FOR DELETE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'ADMINISTRADOR'
  );
