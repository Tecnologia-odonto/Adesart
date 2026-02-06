/*
  # Corrigir role GESTOR para GERENTE na função de stats por vendedor
  
  1. Alterações
    - Corrige referências de GESTOR para GERENTE na função get_cadastros_stats_by_vendedor
    - Mantém a mesma lógica e funcionalidade
  
  2. Motivo
    - O sistema usa GERENTE como role padrão, não GESTOR
    - Consistência com o restante do código
*/

DROP FUNCTION IF EXISTS get_cadastros_stats_by_vendedor(uuid);

CREATE OR REPLACE FUNCTION get_cadastros_stats_by_vendedor(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_user_team_id uuid;
  v_result jsonb;
  v_current_year integer;
  v_current_month integer;
BEGIN
  -- Obter ano e mês atual
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Buscar informações do usuário
  SELECT role, team_id
  INTO v_user_role, v_user_team_id
  FROM profiles
  WHERE id = p_user_id;

  -- Apenas ADMINISTRADOR, GERENTE e SUPERVISOR podem ver divisão por vendedor
  IF v_user_role NOT IN ('ADMINISTRADOR', 'GERENTE', 'SUPERVISOR') THEN
    RETURN '[]'::jsonb;
  END IF;

  -- ADMINISTRADOR e GERENTE veem todos os vendedores
  IF v_user_role IN ('ADMINISTRADOR', 'GERENTE') THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'vendedor_id', vendedor_id,
        'vendedor_nome', vendedor_nome,
        'total', total_cadastros,
        'total_dependentes', total_deps,
        'total_pessoas', total_cadastros + total_deps,
        'incompletos', incompletos_cadastros,
        'incompletos_dependentes', incompletos_deps,
        'incompletos_pessoas', incompletos_cadastros + incompletos_deps,
        'enviados', enviados_cadastros,
        'enviados_dependentes', enviados_deps,
        'enviados_pessoas', enviados_cadastros + enviados_deps
      )
    )
    INTO v_result
    FROM (
      SELECT
        c.created_by as vendedor_id,
        COALESCE(p.name, 'Vendedor não identificado') as vendedor_nome,
        COUNT(*) as total_cadastros,
        COALESCE(SUM(
          CASE 
            WHEN c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as total_deps,
        COUNT(*) FILTER (WHERE c.status = 'incompleto') as incompletos_cadastros,
        COALESCE(SUM(
          CASE 
            WHEN c.status = 'incompleto' AND c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as incompletos_deps,
        COUNT(*) FILTER (WHERE c.status = 'enviado') as enviados_cadastros,
        COALESCE(SUM(
          CASE 
            WHEN c.status = 'enviado' AND c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as enviados_deps
      FROM cadastros c
      LEFT JOIN profiles p ON p.id = c.created_by
      WHERE EXTRACT(YEAR FROM c.created_at) = v_current_year
        AND EXTRACT(MONTH FROM c.created_at) = v_current_month
      GROUP BY c.created_by, p.name
      ORDER BY p.name
    ) stats;

  -- SUPERVISOR vê apenas vendedores do seu time
  ELSIF v_user_role = 'SUPERVISOR' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'vendedor_id', vendedor_id,
        'vendedor_nome', vendedor_nome,
        'total', total_cadastros,
        'total_dependentes', total_deps,
        'total_pessoas', total_cadastros + total_deps,
        'incompletos', incompletos_cadastros,
        'incompletos_dependentes', incompletos_deps,
        'incompletos_pessoas', incompletos_cadastros + incompletos_deps,
        'enviados', enviados_cadastros,
        'enviados_dependentes', enviados_deps,
        'enviados_pessoas', enviados_cadastros + enviados_deps
      )
    )
    INTO v_result
    FROM (
      SELECT
        c.created_by as vendedor_id,
        COALESCE(p.name, 'Vendedor não identificado') as vendedor_nome,
        COUNT(*) as total_cadastros,
        COALESCE(SUM(
          CASE 
            WHEN c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as total_deps,
        COUNT(*) FILTER (WHERE c.status = 'incompleto') as incompletos_cadastros,
        COALESCE(SUM(
          CASE 
            WHEN c.status = 'incompleto' AND c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as incompletos_deps,
        COUNT(*) FILTER (WHERE c.status = 'enviado') as enviados_cadastros,
        COALESCE(SUM(
          CASE 
            WHEN c.status = 'enviado' AND c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as enviados_deps
      FROM cadastros c
      LEFT JOIN profiles p ON p.id = c.created_by
      WHERE c.team_id = v_user_team_id
        AND EXTRACT(YEAR FROM c.created_at) = v_current_year
        AND EXTRACT(MONTH FROM c.created_at) = v_current_month
      GROUP BY c.created_by, p.name
      ORDER BY p.name
    ) stats;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION get_cadastros_stats_by_vendedor(uuid) TO authenticated;

-- Comentário
COMMENT ON FUNCTION get_cadastros_stats_by_vendedor IS 'Retorna estatísticas de cadastros do mês atual agrupadas por vendedor. Inclui contagem de cadastros e dependentes. Apenas ADMINISTRADOR, GERENTE e SUPERVISOR podem acessar.';