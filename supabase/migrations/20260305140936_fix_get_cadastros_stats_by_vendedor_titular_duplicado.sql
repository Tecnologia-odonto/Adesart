/*
  # Corrigir contagem duplicada nas estatísticas por vendedor

  1. Problema
    - Função estava somando COUNT(*) + jsonb_array_length(dependentes)
    - Array dependentes já inclui o titular
    - Isso duplicava a contagem do titular
  
  2. Solução
    - Contar apenas jsonb_array_length(dependentes) como total
    - Calcular dependentes = total - COUNT(*) (titulares)
    - Manter filtro de mês atual
*/

DROP FUNCTION IF EXISTS get_cadastros_stats_by_vendedor(uuid, text);

CREATE OR REPLACE FUNCTION get_cadastros_stats_by_vendedor(
  p_user_id uuid,
  p_tipo_cadastro text
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
        'total', total_pessoas,
        'incompletos', incompletos_pessoas,
        'enviados', enviados_pessoas
      )
    )
    INTO v_result
    FROM (
      SELECT
        c.vendedor_id,
        COALESCE(MAX(p.name), MAX(c.vendedor_nome), 'Vendedor não identificado') as vendedor_nome,
        COALESCE(SUM(
          CASE 
            WHEN c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as total_pessoas,
        COALESCE(SUM(
          CASE 
            WHEN c.status IN ('incompleto', 'adesoes_pendentes', 'erro_envio') 
              AND c.dependentes IS NOT NULL 
              AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as incompletos_pessoas,
        COALESCE(SUM(
          CASE 
            WHEN c.status = 'enviado' 
              AND c.dependentes IS NOT NULL 
              AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as enviados_pessoas
      FROM cadastros c
      LEFT JOIN profiles p ON p.id = c.vendedor_id
      WHERE EXTRACT(YEAR FROM c.created_at) = v_current_year
        AND EXTRACT(MONTH FROM c.created_at) = v_current_month
        AND c.tipo_cadastro = p_tipo_cadastro
        AND c.vendedor_id IS NOT NULL
      GROUP BY c.vendedor_id
      ORDER BY vendedor_nome
    ) stats;

  -- SUPERVISOR vê apenas vendedores do seu time
  ELSIF v_user_role = 'SUPERVISOR' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'vendedor_id', vendedor_id,
        'vendedor_nome', vendedor_nome,
        'total', total_pessoas,
        'incompletos', incompletos_pessoas,
        'enviados', enviados_pessoas
      )
    )
    INTO v_result
    FROM (
      SELECT
        c.vendedor_id,
        COALESCE(MAX(p.name), MAX(c.vendedor_nome), 'Vendedor não identificado') as vendedor_nome,
        COALESCE(SUM(
          CASE 
            WHEN c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as total_pessoas,
        COALESCE(SUM(
          CASE 
            WHEN c.status IN ('incompleto', 'adesoes_pendentes', 'erro_envio') 
              AND c.dependentes IS NOT NULL 
              AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as incompletos_pessoas,
        COALESCE(SUM(
          CASE 
            WHEN c.status = 'enviado' 
              AND c.dependentes IS NOT NULL 
              AND jsonb_typeof(c.dependentes) = 'array'
            THEN jsonb_array_length(c.dependentes)
            ELSE 0
          END
        ), 0) as enviados_pessoas
      FROM cadastros c
      LEFT JOIN profiles p ON p.id = c.vendedor_id
      WHERE c.team_id = v_user_team_id
        AND EXTRACT(YEAR FROM c.created_at) = v_current_year
        AND EXTRACT(MONTH FROM c.created_at) = v_current_month
        AND c.tipo_cadastro = p_tipo_cadastro
        AND c.vendedor_id IS NOT NULL
      GROUP BY c.vendedor_id
      ORDER BY vendedor_nome
    ) stats;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_cadastros_stats_by_vendedor(uuid, text) TO authenticated;

COMMENT ON FUNCTION get_cadastros_stats_by_vendedor IS 'Retorna estatísticas de cadastros do mês atual agrupadas por vendedor. Conta apenas tamanho do array dependentes (que inclui titular).';
