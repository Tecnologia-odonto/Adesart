/*
  # Criar tabela para auditoria de adesões excluídas

  1. Nova Tabela
    - `cadastros_excluidos`
      - `id` (uuid, chave primária)
      - `cadastro_id` (uuid, referência ao cadastro original)
      - `dados_cadastro` (jsonb, snapshot dos dados do cadastro no momento da exclusão)
      - `motivo_exclusao` (text, motivo fornecido pelo usuário)
      - `excluido_por` (uuid, ID do usuário que fez a exclusão)
      - `excluido_por_nome` (text, nome do usuário que fez a exclusão)
      - `excluido_por_role` (text, role do usuário que fez a exclusão)
      - `excluido_em` (timestamptz, data/hora da exclusão)
      - `team_id` (uuid, team do cadastro excluído)

  2. Segurança
    - Habilitar RLS na tabela `cadastros_excluidos`
    - Apenas vendedores podem inserir (ao excluir suas próprias adesões)
    - Apenas administradores podem visualizar todos os registros
    - Vendedores podem visualizar apenas suas próprias exclusões

  3. Índices
    - Índice em `excluido_por` para filtrar por usuário
    - Índice em `team_id` para filtrar por equipe
    - Índice em `excluido_em` para ordenação temporal
*/

-- Criar tabela cadastros_excluidos
CREATE TABLE IF NOT EXISTS cadastros_excluidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadastro_id uuid NOT NULL,
  dados_cadastro jsonb NOT NULL,
  motivo_exclusao text NOT NULL,
  excluido_por uuid NOT NULL REFERENCES auth.users(id),
  excluido_por_nome text NOT NULL,
  excluido_por_role text NOT NULL,
  excluido_em timestamptz DEFAULT now(),
  team_id uuid REFERENCES teams(id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_cadastros_excluidos_excluido_por ON cadastros_excluidos(excluido_por);
CREATE INDEX IF NOT EXISTS idx_cadastros_excluidos_team_id ON cadastros_excluidos(team_id);
CREATE INDEX IF NOT EXISTS idx_cadastros_excluidos_excluido_em ON cadastros_excluidos(excluido_em DESC);

-- Habilitar RLS
ALTER TABLE cadastros_excluidos ENABLE ROW LEVEL SECURITY;

-- Policy: Vendedores podem inserir suas próprias exclusões
CREATE POLICY "Vendedores podem registrar exclusões"
  ON cadastros_excluidos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('vendedor', 'adesionista', 'supervisor', 'gerente', 'admin')
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
      AND profiles.role = 'admin'
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
      AND profiles.role = 'gerente'
      AND profiles.team_id = cadastros_excluidos.team_id
    )
  );

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE cadastros_excluidos;