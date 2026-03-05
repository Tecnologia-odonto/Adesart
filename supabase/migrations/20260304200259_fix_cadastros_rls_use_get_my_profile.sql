/*
  # Corrigir políticas RLS de cadastros para usar get_my_profile()
  
  1. Problema Identificado
    - Policies de ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA e SUPERVISOR em cadastros
      usam EXISTS com SELECT direto na tabela profiles
    - A tabela profiles tem RLS habilitado com policies complexas
    - Isso causa recursão e conflitos, impedindo o ADMINISTRADOR de ver todos os registros
  
  2. Solução
    - Substituir todas as policies que usam EXISTS (SELECT FROM profiles)
    - Usar get_my_profile() que é SECURITY DEFINER e evita recursão
    - Adicionar verificação de is_active = true para todas as roles
  
  3. Policies Atualizadas
    - SELECT: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA, SUPERVISOR
    - INSERT: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA, SUPERVISOR
    - UPDATE: ADMINISTRADOR, GERENTE, CADASTRO, ADESIONISTA, SUPERVISOR
    - DELETE: ADMINISTRADOR
  
  4. Comportamento Esperado
    - ADMINISTRADOR: vê todos os cadastros
    - GERENTE: vê todos os cadastros
    - CADASTRO: vê todos os cadastros
    - ADESIONISTA: vê todos os cadastros
    - SUPERVISOR: vê cadastros do seu time
    - VENDEDOR: vê cadastros criados por ele ou atribuídos a ele (já usa get_my_profile)
*/

-- ============================================
-- REMOVER POLICIES ANTIGAS (usando EXISTS)
-- ============================================

-- SELECT policies
DROP POLICY IF EXISTS "Administrador can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can view team cadastros" ON cadastros;

-- INSERT policies
DROP POLICY IF EXISTS "Administrador can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can insert cadastros" ON cadastros;

-- UPDATE policies
DROP POLICY IF EXISTS "Administrador can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Gerente can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Adesionista can update all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Supervisor can update team cadastros" ON cadastros;

-- DELETE policy
DROP POLICY IF EXISTS "Only Administrador can delete cadastros" ON cadastros;

-- ============================================
-- CRIAR NOVAS POLICIES (usando get_my_profile)
-- ============================================

-- SELECT POLICIES
-- ----------------

-- ADMINISTRADOR pode ver todos os cadastros
CREATE POLICY "Administrador can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- GERENTE pode ver todos os cadastros
CREATE POLICY "Gerente can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'GERENTE'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- CADASTRO pode ver todos os cadastros
CREATE POLICY "Cadastro can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'CADASTRO'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- ADESIONISTA pode ver todos os cadastros
CREATE POLICY "Adesionista can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADESIONISTA'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- SUPERVISOR pode ver cadastros do seu time
CREATE POLICY "Supervisor can view team cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND team_id = (SELECT team_id FROM get_my_profile())
  );

-- VENDEDOR já tem policy correta usando get_my_profile()

-- INSERT POLICIES
-- ----------------

-- ADMINISTRADOR pode inserir cadastros
CREATE POLICY "Administrador can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- GERENTE pode inserir cadastros
CREATE POLICY "Gerente can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'GERENTE'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- CADASTRO pode inserir cadastros
CREATE POLICY "Cadastro can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'CADASTRO'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- ADESIONISTA pode inserir cadastros
CREATE POLICY "Adesionista can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'ADESIONISTA'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- SUPERVISOR pode inserir cadastros
CREATE POLICY "Supervisor can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- VENDEDOR já tem policy correta

-- UPDATE POLICIES
-- ----------------

-- ADMINISTRADOR pode atualizar todos os cadastros
CREATE POLICY "Administrador can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- GERENTE pode atualizar todos os cadastros
CREATE POLICY "Gerente can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'GERENTE'
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'GERENTE'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- CADASTRO pode atualizar todos os cadastros
CREATE POLICY "Cadastro can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'CADASTRO'
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'CADASTRO'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- ADESIONISTA pode atualizar todos os cadastros
CREATE POLICY "Adesionista can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADESIONISTA'
    AND (SELECT is_active FROM get_my_profile()) = true
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'ADESIONISTA'
    AND (SELECT is_active FROM get_my_profile()) = true
  );

-- SUPERVISOR pode atualizar cadastros do seu time
CREATE POLICY "Supervisor can update team cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND team_id = (SELECT team_id FROM get_my_profile())
  )
  WITH CHECK (
    (SELECT role FROM get_my_profile()) = 'SUPERVISOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND team_id = (SELECT team_id FROM get_my_profile())
  );

-- VENDEDOR já tem policy correta usando get_my_profile()

-- DELETE POLICY
-- --------------

-- Apenas ADMINISTRADOR pode deletar cadastros
CREATE POLICY "Only Administrador can delete cadastros"
  ON cadastros FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'ADMINISTRADOR'
    AND (SELECT is_active FROM get_my_profile()) = true
  );
