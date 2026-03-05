/*
  # Fix RLS Cadastros - Remover Duplicatas v246

  1. Problema
    - Existem policies duplicadas de migrações anteriores
    - Policies antigas usam `get_my_profile()` que pode causar problemas
    - Policies novas usam `auth.jwt()` diretamente (correto)

  2. Solução
    - Remover TODAS as policies
    - Recriar apenas as corretas usando auth.jwt()
    - Sem duplicatas, sem funções complexas

  3. Regras Finais
    - ADMINISTRADOR/GERENTE/CADASTRO/ADESIONISTA: veem tudo
    - SUPERVISOR: vê cadastros do seu time
    - VENDEDOR: vê cadastros criados por ele OU atribuídos a ele
*/

-- ============================================
-- REMOVER ABSOLUTAMENTE TODAS AS POLICIES
-- ============================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'cadastros' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON cadastros', policy_record.policyname);
  END LOOP;
END $$;

-- ============================================
-- CRIAR POLICIES LIMPAS E CORRETAS
-- ============================================

-- ===================================
-- SELECT POLICIES (VER CADASTROS)
-- ===================================

-- ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA veem TUDO
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista view all"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  );

-- SUPERVISOR vê cadastros do seu time
CREATE POLICY "Supervisor view team cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SUPERVISOR'
    AND team_id::text = (auth.jwt() -> 'app_metadata' ->> 'team_id')
  );

-- VENDEDOR vê cadastros criados por ele OU atribuídos a ele
CREATE POLICY "Vendedor view own cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'VENDEDOR'
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
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  );

-- SUPERVISOR pode atualizar cadastros do seu time
CREATE POLICY "Supervisor update team cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SUPERVISOR'
    AND team_id::text = (auth.jwt() -> 'app_metadata' ->> 'team_id')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SUPERVISOR'
    AND team_id::text = (auth.jwt() -> 'app_metadata' ->> 'team_id')
  );

-- VENDEDOR pode atualizar cadastros criados por ele OU atribuídos a ele
CREATE POLICY "Vendedor update own cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'VENDEDOR'
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
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMINISTRADOR'
  );
