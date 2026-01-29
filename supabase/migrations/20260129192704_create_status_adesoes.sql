/*
  # Criar tabela de Status de Adesões

  1. Nova Tabela
    - `status_adesoes`
      - `id` (uuid, primary key)
      - `nome` (text, nome do status)
      - `cor` (text, cor em hexadecimal)
      - `ordem` (integer, ordem de exibição)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Alteração na Tabela Cadastros
    - Adiciona coluna `status_adesao_id` (uuid, nullable, foreign key)

  3. Segurança
    - Enable RLS em `status_adesoes`
    - Políticas para leitura (todos autenticados)
    - Políticas para escrita (apenas ADMIN e GESTOR)

  4. Dados Iniciais
    - Popula com 4 status padrões
*/

CREATE TABLE IF NOT EXISTS status_adesoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#6B7280',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE status_adesoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar status"
  ON status_adesoes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas ADMIN e GESTOR podem criar status"
  ON status_adesoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'GESTOR')
    )
  );

CREATE POLICY "Apenas ADMIN e GESTOR podem atualizar status"
  ON status_adesoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'GESTOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'GESTOR')
    )
  );

CREATE POLICY "Apenas ADMIN e GESTOR podem excluir status"
  ON status_adesoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'GESTOR')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'status_adesao_id'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN status_adesao_id uuid REFERENCES status_adesoes(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO status_adesoes (nome, cor, ordem)
VALUES
  ('Aguardando Documentos', '#EAB308', 1),
  ('Em Análise', '#3B82F6', 2),
  ('Aprovado', '#10B981', 3),
  ('Pendente Correção', '#F59E0B', 4)
ON CONFLICT DO NOTHING;