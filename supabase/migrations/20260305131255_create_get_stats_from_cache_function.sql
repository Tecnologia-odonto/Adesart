/*
  # Criar Função para Buscar Stats do Cache

  1. Função Principal
    - `get_stats_from_cache(p_user_id uuid)` - Busca stats da tabela cache
    - Retorna dados do mês atual
    - Separa por tipo_cadastro
    - Performance instantânea (busca direta na tabela)

  2. Comportamento
    - Busca dados do mês atual (YYYY-MM)
    - Retorna estatísticas para 'cadastro' e 'inclusao_dependente'
    - Se não existir, retorna zeros
*/

CREATE OR REPLACE FUNCTION get_stats_from_cache(p_user_id uuid)
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
) AS $$
DECLARE
  v_mes_atual text;
  v_cadastro_stats stats_cache%ROWTYPE;
  v_inclusao_stats stats_cache%ROWTYPE;
BEGIN
  -- Obter mês atual
  v_mes_atual := to_char(CURRENT_DATE, 'YYYY-MM');

  -- Buscar stats de cadastro
  SELECT * INTO v_cadastro_stats
  FROM stats_cache
  WHERE user_id = p_user_id
    AND tipo_cadastro = 'cadastro'
    AND mes_referencia = v_mes_atual;

  -- Buscar stats de inclusão de dependente
  SELECT * INTO v_inclusao_stats
  FROM stats_cache
  WHERE user_id = p_user_id
    AND tipo_cadastro = 'inclusao_dependente'
    AND mes_referencia = v_mes_atual;

  -- Retornar dados formatados
  RETURN QUERY SELECT
    -- Stats de cadastro
    COALESCE(v_cadastro_stats.total_geral::bigint, 0),
    COALESCE(v_cadastro_stats.total_cadastros::bigint, 0),
    COALESCE(v_cadastro_stats.total_dependentes::bigint, 0),
    COALESCE(v_cadastro_stats.pendentes_geral::bigint, 0),
    COALESCE(v_cadastro_stats.pendentes_cadastros::bigint, 0),
    COALESCE(v_cadastro_stats.pendentes_dependentes::bigint, 0),
    COALESCE(v_cadastro_stats.cadastrados_geral::bigint, 0),
    COALESCE(v_cadastro_stats.cadastrados_cadastros::bigint, 0),
    COALESCE(v_cadastro_stats.cadastrados_dependentes::bigint, 0),
    
    -- Stats de inclusão de dependente
    COALESCE(v_inclusao_stats.total_geral::bigint, 0),
    COALESCE(v_inclusao_stats.total_cadastros::bigint, 0),
    COALESCE(v_inclusao_stats.total_dependentes::bigint, 0),
    COALESCE(v_inclusao_stats.pendentes_geral::bigint, 0),
    COALESCE(v_inclusao_stats.pendentes_cadastros::bigint, 0),
    COALESCE(v_inclusao_stats.pendentes_dependentes::bigint, 0),
    COALESCE(v_inclusao_stats.cadastrados_geral::bigint, 0),
    COALESCE(v_inclusao_stats.cadastrados_cadastros::bigint, 0),
    COALESCE(v_inclusao_stats.cadastrados_dependentes::bigint, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar stats por vendedor (para modais)
CREATE OR REPLACE FUNCTION get_stats_by_vendedor_from_cache(
  p_user_id uuid,
  p_tipo_cadastro text
)
RETURNS TABLE (
  vendedor_id uuid,
  vendedor_nome text,
  total integer,
  incompletos integer,
  enviados integer
) AS $$
DECLARE
  v_mes_atual text;
  v_user_role text;
  v_user_team_id uuid;
BEGIN
  -- Obter mês atual
  v_mes_atual := to_char(CURRENT_DATE, 'YYYY-MM');

  -- Obter role e team do usuário
  SELECT role, team_id INTO v_user_role, v_user_team_id
  FROM profiles
  WHERE id = p_user_id;

  -- ADMINISTRADOR vê todos
  IF v_user_role = 'ADMINISTRADOR' THEN
    RETURN QUERY
    SELECT
      sc.user_id,
      p.name,
      sc.total_geral,
      sc.pendentes_geral,
      sc.cadastrados_geral
    FROM stats_cache sc
    INNER JOIN profiles p ON p.id = sc.user_id
    WHERE sc.tipo_cadastro = p_tipo_cadastro
      AND sc.mes_referencia = v_mes_atual
    ORDER BY p.name;

  -- GERENTE e SUPERVISOR veem seu time
  ELSIF v_user_role IN ('GERENTE', 'SUPERVISOR') THEN
    RETURN QUERY
    SELECT
      sc.user_id,
      p.name,
      sc.total_geral,
      sc.pendentes_geral,
      sc.cadastrados_geral
    FROM stats_cache sc
    INNER JOIN profiles p ON p.id = sc.user_id
    WHERE sc.tipo_cadastro = p_tipo_cadastro
      AND sc.mes_referencia = v_mes_atual
      AND p.team_id = v_user_team_id
    ORDER BY p.name;

  -- Outros não veem nada
  ELSE
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
