/*
  # Adicionar automação de processamento da fila de upload ERP
  
  1. Configuração
    - Habilita extensão pg_cron
    - Habilita extensão pg_net para chamadas HTTP
  
  2. Função de Processamento
    - Cria função que chama a edge function de processamento
    - Usa pg_net para fazer requisição HTTP assíncrona
  
  3. Agendamento Cron
    - Executa a cada 2 minutos
    - Processa automaticamente itens pendentes na fila
    - Respeita intervalo de 10s entre uploads (implementado na edge function)
  
  4. Notas Importantes
    - A edge function já implementa o delay de 10s entre uploads
    - O cron apenas dispara o processamento a cada 2 minutos
    - Não há risco de execuções concorrentes devido ao lock de status
*/

-- Habilitar extensão pg_cron (gerenciamento de jobs agendados)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar extensão pg_net (requisições HTTP assíncronas)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Criar função que processa a fila chamando a edge function
CREATE OR REPLACE FUNCTION process_erp_upload_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
BEGIN
  -- Buscar variáveis de ambiente (configuradas no Supabase)
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Se não configurado, usar valores padrão do ambiente Supabase
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co';
  END IF;
  
  -- Fazer requisição assíncrona para a edge function
  SELECT INTO v_request_id
    net.http_post(
      url := v_supabase_url || '/functions/v1/erp-process-upload-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 600000
    );
  
  -- Log da execução
  RAISE NOTICE 'Fila de upload ERP disparada. Request ID: %', v_request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, apenas registrar no log mas não falhar
    RAISE WARNING 'Erro ao processar fila de upload ERP: %', SQLERRM;
END;
$$;

-- Remover job existente se houver
SELECT cron.unschedule('process-erp-upload-queue') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-erp-upload-queue'
);

-- Agendar job para executar a cada 2 minutos
-- Cron expression: '*/2 * * * *' = a cada 2 minutos
SELECT cron.schedule(
  'process-erp-upload-queue',
  '*/2 * * * *',
  $$SELECT process_erp_upload_queue();$$
);

-- Criar tabela para monitorar execuções do cron (opcional mas útil)
CREATE TABLE IF NOT EXISTS erp_upload_queue_cron_log (
  id bigserial PRIMARY KEY,
  executed_at timestamptz DEFAULT now(),
  status text,
  details text
);

-- Adicionar índice para consultas por data
CREATE INDEX IF NOT EXISTS idx_erp_upload_queue_cron_log_executed_at
  ON erp_upload_queue_cron_log(executed_at DESC);

-- RLS na tabela de log (apenas admin pode ver)
ALTER TABLE erp_upload_queue_cron_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores podem visualizar log de cron"
  ON erp_upload_queue_cron_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );
