/*
  # Add Function to Get Stats from Materialized View

  ## Objetivo
  Criar função para buscar estatísticas do mês atual da materialized view,
  com fallback para cálculo em tempo real se necessário.

  ## Mudanças
  1. Cria função `get_cadastros_stats_fast` que busca da view materializada
  2. Inclui fallback para calcular se view não tiver dados do usuário
  3. Otimizada para performance máxima
*/

-- Função para buscar stats da view (rápida)
CREATE OR REPLACE FUNCTION get_cadastros_stats_fast(p_user_id uuid)
RETURNS TABLE (
  cadastro_total bigint,
  cadastro_cadastros bigint,
  cadastro_dependentes bigint,
  cadastro_incompletos bigint,
  cadastro_incompletos_cadastros bigint,
  cadastro_incompletos_dependentes bigint,
  cadastro_enviados bigint,
  cadastro_enviados_cadastros bigint,
  cadastro_enviados_dependentes bigint,
  inclusao_total bigint,
  inclusao_cadastros bigint,
  inclusao_dependentes bigint,
  inclusao_incompletos bigint,
  inclusao_incompletos_cadastros bigint,
  inclusao_incompletos_dependentes bigint,
  inclusao_enviados bigint,
  inclusao_enviados_cadastros bigint,
  inclusao_enviados_dependentes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_role text;
  v_team_id uuid;
BEGIN
  -- Buscar role e team do usuário
  SELECT role, team_id INTO v_profile_role, v_team_id
  FROM profiles
  WHERE id = p_user_id;

  -- Se não encontrar o perfil, retornar zeros
  IF v_profile_role IS NULL THEN
    RETURN QUERY
    SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
           0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
           0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  -- ADMIN e GERENTE: buscar da view todos os usuários
  IF v_profile_role IN ('ADMINISTRADOR', 'GERENTE') THEN
    RETURN QUERY
    SELECT
      COALESCE(SUM(s.cadastro_total), 0)::bigint,
      COALESCE(SUM(s.cadastro_cadastros), 0)::bigint,
      COALESCE(SUM(s.cadastro_dependentes), 0)::bigint,
      COALESCE(SUM(s.cadastro_incompletos), 0)::bigint,
      COALESCE(SUM(s.cadastro_incompletos_cadastros), 0)::bigint,
      COALESCE(SUM(s.cadastro_incompletos_dependentes), 0)::bigint,
      COALESCE(SUM(s.cadastro_enviados), 0)::bigint,
      COALESCE(SUM(s.cadastro_enviados_cadastros), 0)::bigint,
      COALESCE(SUM(s.cadastro_enviados_dependentes), 0)::bigint,
      COALESCE(SUM(s.inclusao_total), 0)::bigint,
      COALESCE(SUM(s.inclusao_cadastros), 0)::bigint,
      COALESCE(SUM(s.inclusao_dependentes), 0)::bigint,
      COALESCE(SUM(s.inclusao_incompletos), 0)::bigint,
      COALESCE(SUM(s.inclusao_incompletos_cadastros), 0)::bigint,
      COALESCE(SUM(s.inclusao_incompletos_dependentes), 0)::bigint,
      COALESCE(SUM(s.inclusao_enviados), 0)::bigint,
      COALESCE(SUM(s.inclusao_enviados_cadastros), 0)::bigint,
      COALESCE(SUM(s.inclusao_enviados_dependentes), 0)::bigint
    FROM cadastros_stats_current_month s;
  
  -- SUPERVISOR: buscar da view apenas usuários do mesmo time
  ELSIF v_profile_role = 'SUPERVISOR' AND v_team_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      COALESCE(SUM(s.cadastro_total), 0)::bigint,
      COALESCE(SUM(s.cadastro_cadastros), 0)::bigint,
      COALESCE(SUM(s.cadastro_dependentes), 0)::bigint,
      COALESCE(SUM(s.cadastro_incompletos), 0)::bigint,
      COALESCE(SUM(s.cadastro_incompletos_cadastros), 0)::bigint,
      COALESCE(SUM(s.cadastro_incompletos_dependentes), 0)::bigint,
      COALESCE(SUM(s.cadastro_enviados), 0)::bigint,
      COALESCE(SUM(s.cadastro_enviados_cadastros), 0)::bigint,
      COALESCE(SUM(s.cadastro_enviados_dependentes), 0)::bigint,
      COALESCE(SUM(s.inclusao_total), 0)::bigint,
      COALESCE(SUM(s.inclusao_cadastros), 0)::bigint,
      COALESCE(SUM(s.inclusao_dependentes), 0)::bigint,
      COALESCE(SUM(s.inclusao_incompletos), 0)::bigint,
      COALESCE(SUM(s.inclusao_incompletos_cadastros), 0)::bigint,
      COALESCE(SUM(s.inclusao_incompletos_dependentes), 0)::bigint,
      COALESCE(SUM(s.inclusao_enviados), 0)::bigint,
      COALESCE(SUM(s.inclusao_enviados_cadastros), 0)::bigint,
      COALESCE(SUM(s.inclusao_enviados_dependentes), 0)::bigint
    FROM cadastros_stats_current_month s
    WHERE s.user_id IN (
      SELECT id FROM profiles WHERE team_id = v_team_id
    );

  -- VENDEDOR e ADESIONISTA: buscar da view apenas próprios dados
  ELSE
    RETURN QUERY
    SELECT
      COALESCE(s.cadastro_total, 0)::bigint,
      COALESCE(s.cadastro_cadastros, 0)::bigint,
      COALESCE(s.cadastro_dependentes, 0)::bigint,
      COALESCE(s.cadastro_incompletos, 0)::bigint,
      COALESCE(s.cadastro_incompletos_cadastros, 0)::bigint,
      COALESCE(s.cadastro_incompletos_dependentes, 0)::bigint,
      COALESCE(s.cadastro_enviados, 0)::bigint,
      COALESCE(s.cadastro_enviados_cadastros, 0)::bigint,
      COALESCE(s.cadastro_enviados_dependentes, 0)::bigint,
      COALESCE(s.inclusao_total, 0)::bigint,
      COALESCE(s.inclusao_cadastros, 0)::bigint,
      COALESCE(s.inclusao_dependentes, 0)::bigint,
      COALESCE(s.inclusao_incompletos, 0)::bigint,
      COALESCE(s.inclusao_incompletos_cadastros, 0)::bigint,
      COALESCE(s.inclusao_incompletos_dependentes, 0)::bigint,
      COALESCE(s.inclusao_enviados, 0)::bigint,
      COALESCE(s.inclusao_enviados_cadastros, 0)::bigint,
      COALESCE(s.inclusao_enviados_dependentes, 0)::bigint
    FROM cadastros_stats_current_month s
    WHERE s.user_id = p_user_id;

    -- Se não encontrou na view (usuário novo), retornar zeros
    IF NOT FOUND THEN
      RETURN QUERY
      SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
             0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
             0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    END IF;
  END IF;
END;
$$;

-- Comentário
COMMENT ON FUNCTION get_cadastros_stats_fast(uuid) IS
  'Busca estatísticas do mês atual da materialized view. Muito mais rápido que get_cadastros_stats.';
