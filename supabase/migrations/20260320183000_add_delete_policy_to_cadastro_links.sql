/*
  # Permitir exclusao de links de cadastro

  1. Objetivo
    - Habilitar acao de excluir links gerados pela UI

  2. Regras
    - ADMINISTRADOR, GERENTE, CADASTRO e ADESIONISTA podem excluir qualquer link visivel
    - SUPERVISOR pode excluir links do proprio time
    - VENDEDOR pode excluir links criados por ele ou atribuidos a ele
*/

DROP POLICY IF EXISTS "Admin/Gerente/Cadastro/Adesionista delete cadastro links" ON cadastro_links;
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista delete cadastro links"
  ON cadastro_links FOR DELETE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  );

DROP POLICY IF EXISTS "Supervisor delete team cadastro links" ON cadastro_links;
CREATE POLICY "Supervisor delete team cadastro links"
  ON cadastro_links FOR DELETE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERVISOR'
    AND team_id::text = auth.jwt() -> 'app_metadata' ->> 'team_id'
  );

DROP POLICY IF EXISTS "Vendedor delete own cadastro links" ON cadastro_links;
CREATE POLICY "Vendedor delete own cadastro links"
  ON cadastro_links FOR DELETE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  );
