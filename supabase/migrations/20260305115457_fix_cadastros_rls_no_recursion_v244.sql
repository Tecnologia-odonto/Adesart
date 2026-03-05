/*
  # Fix RLS Recursion - Cadastros v244

  1. Problema
    - Policies de cadastros usam: EXISTS (SELECT FROM profiles WHERE...)
    - Policies de profiles usam: get_my_profile() que busca profiles
    - RECURSÃO INFINITA → timeout → 0 resultados

  2. Solução
    - Criar function get_user_role() que usa auth.jwt() diretamente
    - NÃO busca em profiles (sem recursão)
    - Retorna role e is_active do JWT
    - Substituir todas as policies de cadastros para usar essa function

  3. Estratégia
    - Remover TODAS as policies atuais de cadastros
    - Criar function get_user_role_from_jwt()
    - Recriar policies usando a nova function
    - SEM subqueries em profiles
*/

-- ============================================
-- PASSO 1: CRIAR FUNÇÃO HELPER SEM RECURSÃO
-- ============================================

CREATE OR REPLACE FUNCTION get_user_role_from_jwt()
RETURNS TABLE (
  role text,
  is_active boolean,
  team_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Busca direto do JWT (não causa recursão)
  RETURN QUERY
  SELECT 
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'VENDEDOR')::text as role,
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_active')::boolean, true) as is_active,
    (auth.jwt() -> 'app_metadata' ->> 'team_id')::uuid as team_id;
END;
$$;

-- ============================================
-- PASSO 2: REMOVER TODAS AS POLICIES ATUAIS
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
-- PASSO 3: RECRIAR POLICIES SEM RECURSÃO
-- ============================================

-- ===============================
-- SELECT POLICIES
-- ===============================

-- ADMINISTRADOR pode ver todos os cadastros
CREATE POLICY "Administrador can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADMINISTRADOR'
  );

-- GERENTE pode ver todos os cadastros
CREATE POLICY "Gerente can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'GERENTE'
  );

-- CADASTRO pode ver todos os cadastros
CREATE POLICY "Cadastro can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'CADASTRO'
  );

-- ADESIONISTA pode ver todos os cadastros
CREATE POLICY "Adesionista can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADESIONISTA'
  );

-- SUPERVISOR pode ver cadastros do seu time
CREATE POLICY "Supervisor can view team cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'SUPERVISOR'
    AND team_id = (SELECT team_id FROM get_user_role_from_jwt())
  );

-- VENDEDOR pode ver cadastros criados por ele ou atribuídos a ele
CREATE POLICY "Vendedor can view assigned cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  );

-- ===============================
-- INSERT POLICIES
-- ===============================

-- ADMINISTRADOR pode inserir cadastros
CREATE POLICY "Administrador can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADMINISTRADOR'
  );

-- GERENTE pode inserir cadastros
CREATE POLICY "Gerente can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'GERENTE'
  );

-- CADASTRO pode inserir cadastros
CREATE POLICY "Cadastro can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'CADASTRO'
  );

-- ADESIONISTA pode inserir cadastros
CREATE POLICY "Adesionista can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADESIONISTA'
  );

-- SUPERVISOR pode inserir cadastros
CREATE POLICY "Supervisor can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'SUPERVISOR'
  );

-- VENDEDOR pode inserir cadastros
CREATE POLICY "Vendedor can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'VENDEDOR'
  );

-- ===============================
-- UPDATE POLICIES
-- ===============================

-- ADMINISTRADOR pode atualizar todos os cadastros
CREATE POLICY "Administrador can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADMINISTRADOR'
  )
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADMINISTRADOR'
  );

-- GERENTE pode atualizar todos os cadastros
CREATE POLICY "Gerente can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'GERENTE'
  )
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'GERENTE'
  );

-- CADASTRO pode atualizar todos os cadastros
CREATE POLICY "Cadastro can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'CADASTRO'
  )
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'CADASTRO'
  );

-- ADESIONISTA pode atualizar todos os cadastros
CREATE POLICY "Adesionista can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADESIONISTA'
  )
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADESIONISTA'
  );

-- SUPERVISOR pode atualizar cadastros do seu time
CREATE POLICY "Supervisor can update team cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'SUPERVISOR'
    AND team_id = (SELECT team_id FROM get_user_role_from_jwt())
  )
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'SUPERVISOR'
    AND team_id = (SELECT team_id FROM get_user_role_from_jwt())
  );

-- VENDEDOR pode atualizar cadastros criados por ele ou atribuídos a ele
CREATE POLICY "Vendedor can update own cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM get_user_role_from_jwt()) = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  );

-- ===============================
-- DELETE POLICY
-- ===============================

-- Apenas ADMINISTRADOR pode deletar cadastros
CREATE POLICY "Only Administrador can delete cadastros"
  ON cadastros FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM get_user_role_from_jwt()) = 'ADMINISTRADOR'
  );
