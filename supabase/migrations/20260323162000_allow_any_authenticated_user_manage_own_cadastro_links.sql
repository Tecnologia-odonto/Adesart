/*
  # Permitir que qualquer autenticado gerencie os proprios links

  1. Objetivo
    - Garantir que qualquer usuario autenticado possa visualizar, editar e excluir
      os links que ele mesmo criou
    - Incluir o papel GESTOR nas policies amplas usadas pelo modulo
*/

DROP POLICY IF EXISTS "Admin/Gerente/Cadastro/Adesionista view all cadastro links" ON cadastro_links;
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista view all cadastro links"
  ON cadastro_links FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'GESTOR', 'CADASTRO', 'ADESIONISTA')
  );

DROP POLICY IF EXISTS "Admin/Gerente/Cadastro/Adesionista update all cadastro links" ON cadastro_links;
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista update all cadastro links"
  ON cadastro_links FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'GESTOR', 'CADASTRO', 'ADESIONISTA')
  )
  WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'GESTOR', 'CADASTRO', 'ADESIONISTA')
  );

DROP POLICY IF EXISTS "Admin/Gerente/Cadastro/Adesionista delete cadastro links" ON cadastro_links;
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista delete cadastro links"
  ON cadastro_links FOR DELETE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'GESTOR', 'CADASTRO', 'ADESIONISTA')
  );

DROP POLICY IF EXISTS "Authenticated users can view own cadastro links" ON cadastro_links;
CREATE POLICY "Authenticated users can view own cadastro links"
  ON cadastro_links FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can update own cadastro links" ON cadastro_links;
CREATE POLICY "Authenticated users can update own cadastro links"
  ON cadastro_links FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can delete own cadastro links" ON cadastro_links;
CREATE POLICY "Authenticated users can delete own cadastro links"
  ON cadastro_links FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
