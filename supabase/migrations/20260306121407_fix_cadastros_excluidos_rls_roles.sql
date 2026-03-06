/*
  # Corrigir políticas RLS da tabela cadastros_excluidos

  1. Alterações
    - Atualiza as policies para usar roles em MAIÚSCULAS
    - Corrige: 'admin' → 'ADMINISTRADOR'
    - Corrige: 'vendedor' → 'VENDEDOR'
    - Corrige: 'adesionista' → 'ADESIONISTA'
    - Corrige: 'supervisor' → 'SUPERVISOR'
    - Corrige: 'gerente' → 'GERENTE'

  2. Segurança
    - Mantém todas as regras de acesso existentes
    - Apenas corrige os valores das roles para o padrão MAIÚSCULO
*/

-- Drop políticas existentes
DROP POLICY IF EXISTS "Vendedores podem registrar exclusões" ON cadastros_excluidos;
DROP POLICY IF EXISTS "Administradores podem visualizar todas as exclusões" ON cadastros_excluidos;
DROP POLICY IF EXISTS "Vendedores podem visualizar suas exclusões" ON cadastros_excluidos;
DROP POLICY IF EXISTS "Gerentes podem visualizar exclusões da equipe" ON cadastros_excluidos;

-- Policy: Vendedores e adesionistas podem inserir suas próprias exclusões
CREATE POLICY "Vendedores podem registrar exclusões"
  ON cadastros_excluidos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('VENDEDOR', 'ADESIONISTA', 'SUPERVISOR', 'GERENTE', 'ADMINISTRADOR')
    )
  );

-- Policy: Administradores podem visualizar todos os registros
CREATE POLICY "Administradores podem visualizar todas as exclusões"
  ON cadastros_excluidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

-- Policy: Vendedores podem visualizar suas próprias exclusões
CREATE POLICY "Vendedores podem visualizar suas exclusões"
  ON cadastros_excluidos FOR SELECT
  TO authenticated
  USING (
    excluido_por = auth.uid()
  );

-- Policy: Gerentes podem visualizar exclusões de sua equipe
CREATE POLICY "Gerentes podem visualizar exclusões da equipe"
  ON cadastros_excluidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
      AND profiles.team_id = cadastros_excluidos.team_id
    )
  );