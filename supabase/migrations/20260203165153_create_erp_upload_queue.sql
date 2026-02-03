/*
  # Criar tabela de fila de upload de documentos para o ERP

  1. Nova Tabela
    - `erp_upload_queue`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `status` (text) - queued, processing, retry_wait, success, failed
      - `attempts` (int) - número de tentativas realizadas
      - `next_attempt_at` (timestamptz) - quando deve tentar novamente
      - `last_attempt_at` (timestamptz) - última tentativa
      - `last_error` (text) - última mensagem de erro
      - `last_status_code` (int) - último código HTTP recebido
      - `erp_response` (jsonb) - resposta completa do ERP
      - `cadastro_id` (uuid) - referência ao cadastro
      - `created_by` (uuid) - quem criou o cadastro
      - `id_funcionario` (int) - ID do funcionário no ERP
      - `id_dependente` (int) - ID do dependente no ERP
      - `arquivo_path` (text) - caminho do arquivo no bucket
      - `arquivo_nome` (text) - nome do arquivo
      - `bucket` (text) - nome do bucket (default: cadastros-temp-files)
      - `tipo` (text) - titular ou dependente

  2. Índices
    - Índice para buscar itens elegíveis para processamento
    - Índice por cadastro_id para consultas
    - Índice por id_dependente
    - Índice por created_at para paginação

  3. Segurança
    - RLS habilitado
    - SELECT/UPDATE/DELETE somente para ADMINISTRADOR
    - INSERT permitido para usuários autenticados (será usado via service role nas Edge Functions)
*/

-- Criar tabela de fila de upload
CREATE TABLE IF NOT EXISTS erp_upload_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Controle de status e tentativas
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'retry_wait', 'success', 'failed')),
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz DEFAULT now() NOT NULL,
  last_attempt_at timestamptz,

  -- Informações de erro
  last_error text,
  last_status_code int,
  erp_response jsonb,

  -- Referências
  cadastro_id uuid REFERENCES cadastros(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  id_funcionario int NOT NULL,
  id_dependente int NOT NULL,

  -- Informações do arquivo
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  bucket text NOT NULL DEFAULT 'cadastros-temp-files',
  tipo text NOT NULL CHECK (tipo IN ('titular', 'dependente'))
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_erp_upload_queue_status_next_attempt
  ON erp_upload_queue(status, next_attempt_at)
  WHERE status IN ('queued', 'retry_wait');

CREATE INDEX IF NOT EXISTS idx_erp_upload_queue_cadastro_id
  ON erp_upload_queue(cadastro_id);

CREATE INDEX IF NOT EXISTS idx_erp_upload_queue_id_dependente
  ON erp_upload_queue(id_dependente);

CREATE INDEX IF NOT EXISTS idx_erp_upload_queue_created_at
  ON erp_upload_queue(created_at DESC);

-- Habilitar RLS
ALTER TABLE erp_upload_queue ENABLE ROW LEVEL SECURITY;

-- Policies para ADMINISTRADOR
CREATE POLICY "Administradores podem visualizar fila de upload"
  ON erp_upload_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

CREATE POLICY "Administradores podem atualizar fila de upload"
  ON erp_upload_queue FOR UPDATE
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

CREATE POLICY "Administradores podem deletar da fila de upload"
  ON erp_upload_queue FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

-- Policy para INSERT (será usado via service role, mas permitir autenticados por segurança)
CREATE POLICY "Usuários autenticados podem enfileirar uploads"
  ON erp_upload_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_erp_upload_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_erp_upload_queue_updated_at ON erp_upload_queue;
CREATE TRIGGER trigger_update_erp_upload_queue_updated_at
  BEFORE UPDATE ON erp_upload_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_erp_upload_queue_updated_at();

-- Habilitar realtime para a tabela (para painel admin)
ALTER PUBLICATION supabase_realtime ADD TABLE erp_upload_queue;