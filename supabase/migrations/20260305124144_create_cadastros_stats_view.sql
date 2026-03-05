/*
  # Create Materialized View for Cadastros Stats - Mês Atual

  ## Objetivo
  Criar uma materialized view para otimizar o carregamento das estatísticas do mês atual
  no Dashboard, evitando consultas pesadas em tempo real.

  ## Mudanças
  1. Cria materialized view `cadastros_stats_current_month`
     - Contém estatísticas pré-calculadas do mês atual
     - Inclui contadores por tipo, status e dependentes
     - Agrupa por usuário (created_by)

  2. Cria função para refresh manual da view

  3. Cria índice para consultas rápidas por usuário

  4. Cria cron job para atualizar a view a cada 10 minutos

  ## Nota
  A view é atualizada automaticamente a cada 10 minutos.
  Para forçar atualização manual, execute: SELECT refresh_cadastros_stats_view();
*/

-- Drop view se já existir
DROP MATERIALIZED VIEW IF EXISTS cadastros_stats_current_month;

-- Criar materialized view com stats do mês atual
CREATE MATERIALIZED VIEW cadastros_stats_current_month AS
WITH mes_atual AS (
  SELECT
    date_trunc('month', CURRENT_DATE) AS inicio_mes,
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day') AS fim_mes
),
cadastros_mes AS (
  SELECT
    c.*,
    CASE
      WHEN c.dependentes IS NOT NULL THEN
        CASE
          WHEN jsonb_typeof(c.dependentes) = 'array' THEN jsonb_array_length(c.dependentes)
          ELSE 0
        END
      ELSE 0
    END AS num_dependentes
  FROM cadastros c
  CROSS JOIN mes_atual m
  WHERE c.created_at >= m.inicio_mes
    AND c.created_at <= m.fim_mes + INTERVAL '1 day'
)
SELECT
  created_by AS user_id,

  -- Totais gerais
  COUNT(*) FILTER (WHERE tipo_cadastro = 'cadastro') AS cadastro_total,
  COUNT(*) FILTER (WHERE tipo_cadastro = 'cadastro' AND num_dependentes = 0) AS cadastro_cadastros,
  SUM(num_dependentes) FILTER (WHERE tipo_cadastro = 'cadastro') AS cadastro_dependentes,

  -- Incompletos (cadastro)
  COUNT(*) FILTER (WHERE tipo_cadastro = 'cadastro' AND status = 'incompleto') AS cadastro_incompletos,
  COUNT(*) FILTER (WHERE tipo_cadastro = 'cadastro' AND status = 'incompleto' AND num_dependentes = 0) AS cadastro_incompletos_cadastros,
  SUM(num_dependentes) FILTER (WHERE tipo_cadastro = 'cadastro' AND status = 'incompleto') AS cadastro_incompletos_dependentes,

  -- Enviados (cadastro)
  COUNT(*) FILTER (WHERE tipo_cadastro = 'cadastro' AND status = 'enviado') AS cadastro_enviados,
  COUNT(*) FILTER (WHERE tipo_cadastro = 'cadastro' AND status = 'enviado' AND num_dependentes = 0) AS cadastro_enviados_cadastros,
  SUM(num_dependentes) FILTER (WHERE tipo_cadastro = 'cadastro' AND status = 'enviado') AS cadastro_enviados_dependentes,

  -- Totais (inclusão dependente)
  COUNT(*) FILTER (WHERE tipo_cadastro = 'inclusao_dependente') AS inclusao_total,
  COUNT(*) FILTER (WHERE tipo_cadastro = 'inclusao_dependente' AND num_dependentes = 0) AS inclusao_cadastros,
  SUM(num_dependentes) FILTER (WHERE tipo_cadastro = 'inclusao_dependente') AS inclusao_dependentes,

  -- Incompletos (inclusão dependente)
  COUNT(*) FILTER (WHERE tipo_cadastro = 'inclusao_dependente' AND status = 'incompleto') AS inclusao_incompletos,
  COUNT(*) FILTER (WHERE tipo_cadastro = 'inclusao_dependente' AND status = 'incompleto' AND num_dependentes = 0) AS inclusao_incompletos_cadastros,
  SUM(num_dependentes) FILTER (WHERE tipo_cadastro = 'inclusao_dependente' AND status = 'incompleto') AS inclusao_incompletos_dependentes,

  -- Enviados (inclusão dependente)
  COUNT(*) FILTER (WHERE tipo_cadastro = 'inclusao_dependente' AND status = 'enviado') AS inclusao_enviados,
  COUNT(*) FILTER (WHERE tipo_cadastro = 'inclusao_dependente' AND status = 'enviado' AND num_dependentes = 0) AS inclusao_enviados_cadastros,
  SUM(num_dependentes) FILTER (WHERE tipo_cadastro = 'inclusao_dependente' AND status = 'enviado') AS inclusao_enviados_dependentes,

  -- Metadata
  NOW() AS last_updated
FROM cadastros_mes
GROUP BY created_by;

-- Criar índice único para consultas rápidas
CREATE UNIQUE INDEX idx_cadastros_stats_cm_user ON cadastros_stats_current_month(user_id);

-- Função para refresh manual da view
CREATE OR REPLACE FUNCTION refresh_cadastros_stats_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cadastros_stats_current_month;
END;
$$;

-- Criar cron job para atualizar a view a cada 10 minutos
SELECT cron.schedule(
  'refresh-cadastros-stats-view',
  '*/10 * * * *', -- A cada 10 minutos
  $$SELECT refresh_cadastros_stats_view()$$
);

-- Comentários
COMMENT ON MATERIALIZED VIEW cadastros_stats_current_month IS
  'View materializada com estatísticas de cadastros do mês atual. Atualizada a cada 10 minutos via cron job.';

COMMENT ON FUNCTION refresh_cadastros_stats_view() IS
  'Atualiza a materialized view cadastros_stats_current_month. Chamada automaticamente a cada 10 minutos.';
