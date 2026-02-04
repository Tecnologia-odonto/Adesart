/*
  # Adicionar função para resetar itens travados na fila de upload
  
  1. Problema
    - Itens ficam travados no status "processing" quando a edge function é interrompida
    - Isso pode acontecer por timeout, erro ou crash
    - Itens travados nunca são processados novamente
  
  2. Solução
    - Cria função que reseta automaticamente itens em "processing" há mais de 15 minutos
    - Volta status para "queued" e reseta next_attempt_at para now()
    - Não incrementa o contador de attempts (pois o processamento real não aconteceu)
  
  3. Uso
    - Será chamada automaticamente no início de cada processamento
    - Pode ser chamada manualmente via SQL ou UI
    - Previne que itens fiquem permanentemente travados
*/

-- Criar função para resetar itens travados
CREATE OR REPLACE FUNCTION reset_stuck_queue_items(
  stuck_threshold_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
  reset_count INTEGER,
  reset_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reset_count INTEGER;
  v_reset_ids UUID[];
BEGIN
  -- Encontrar e resetar itens travados
  WITH reset_items AS (
    UPDATE erp_upload_queue
    SET
      status = 'queued',
      next_attempt_at = NOW(),
      last_error = COALESCE(
        last_error || ' | ',
        ''
      ) || 'Resetado automaticamente após ' || stuck_threshold_minutes || ' minutos travado em processing'
    WHERE
      status = 'processing'
      AND last_attempt_at < NOW() - (stuck_threshold_minutes || ' minutes')::INTERVAL
    RETURNING id
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_reset_count, v_reset_ids
  FROM reset_items;
  
  -- Se nenhum item foi resetado, retornar valores vazios
  IF v_reset_count IS NULL THEN
    v_reset_count := 0;
    v_reset_ids := ARRAY[]::UUID[];
  END IF;
  
  -- Log da operação
  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Resetados % itens travados: %', v_reset_count, v_reset_ids;
  END IF;
  
  -- Retornar resultado
  RETURN QUERY SELECT v_reset_count, v_reset_ids;
END;
$$;

-- Criar função auxiliar para uso pelo cron (sem parâmetros)
CREATE OR REPLACE FUNCTION reset_stuck_queue_items_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM reset_stuck_queue_items(15);
  
  IF v_result.reset_count > 0 THEN
    RAISE NOTICE 'Auto-reset: % itens foram resetados', v_result.reset_count;
  END IF;
END;
$$;

-- Atualizar a função de processamento para chamar reset antes
CREATE OR REPLACE FUNCTION process_erp_upload_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
  v_reset_result RECORD;
BEGIN
  -- Primeiro, resetar itens travados
  SELECT * INTO v_reset_result FROM reset_stuck_queue_items(15);
  
  IF v_reset_result.reset_count > 0 THEN
    RAISE NOTICE 'Resetados % itens travados antes do processamento', v_reset_result.reset_count;
  END IF;
  
  -- Buscar variáveis de ambiente
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
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
  
  RAISE NOTICE 'Fila de upload ERP disparada. Request ID: %', v_request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao processar fila de upload ERP: %', SQLERRM;
END;
$$;

-- Adicionar job cron para resetar itens travados independentemente (backup)
-- Executa a cada 30 minutos
SELECT cron.schedule(
  'reset-stuck-queue-items',
  '*/30 * * * *',
  $$SELECT reset_stuck_queue_items_cron();$$
);

-- Resetar imediatamente os itens que estão travados agora
SELECT reset_stuck_queue_items(15);
