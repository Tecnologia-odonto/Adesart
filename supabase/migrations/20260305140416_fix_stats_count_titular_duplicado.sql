/*
  # Corrigir contagem duplicada do titular nas estatísticas

  1. Problema
    - Array `dependentes` já inclui o titular na primeira posição
    - Função estava contando: 1 (registro) + jsonb_array_length(dependentes)
    - Isso duplicava a contagem do titular
  
  2. Solução
    - Contar apenas jsonb_array_length(dependentes) ao invés de COUNT(*) + array_length
    - O total agora é apenas a soma dos tamanhos dos arrays
    - Remove as variáveis _cadastros pois elas não fazem sentido
    - Mantém apenas _total e _dependentes onde:
      - _total = soma de todos no array (titular + dependentes)
      - _dependentes = soma do array - quantidade de registros (só dependentes)
*/

DROP FUNCTION IF EXISTS get_cadastros_stats(uuid);

CREATE OR REPLACE FUNCTION get_cadastros_stats(
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
  v_user_external_id text;
  v_cadastro_total integer := 0;
  v_cadastro_incompletos integer := 0;
  v_cadastro_enviados integer := 0;
  v_inclusao_total integer := 0;
  v_inclusao_incompletos integer := 0;
  v_inclusao_enviados integer := 0;
  v_current_year integer;
  v_current_month integer;
  v_cadastro_total_registros integer := 0;
  v_cadastro_incompletos_registros integer := 0;
  v_cadastro_enviados_registros integer := 0;
  v_inclusao_total_registros integer := 0;
  v_inclusao_incompletos_registros integer := 0;
  v_inclusao_enviados_registros integer := 0;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  SELECT role, team_id, external_id
  INTO v_user_role, v_user_team_id, v_user_external_id
  FROM profiles
  WHERE id = p_user_id;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'cadastro_total', 0,
      'cadastro_cadastros', 0,
      'cadastro_dependentes', 0,
      'cadastro_incompletos', 0,
      'cadastro_incompletos_cadastros', 0,
      'cadastro_incompletos_dependentes', 0,
      'cadastro_enviados', 0,
      'cadastro_enviados_cadastros', 0,
      'cadastro_enviados_dependentes', 0,
      'inclusao_total', 0,
      'inclusao_cadastros', 0,
      'inclusao_dependentes', 0,
      'inclusao_incompletos', 0,
      'inclusao_incompletos_cadastros', 0,
      'inclusao_incompletos_dependentes', 0,
      'inclusao_enviados', 0,
      'inclusao_enviados_cadastros', 0,
      'inclusao_enviados_dependentes', 0
    );
  END IF;

  -- ADMINISTRADOR e GERENTE veem TODOS os cadastros
  IF v_user_role IN ('ADMINISTRADOR', 'GERENTE') THEN
    -- Tipo: cadastro
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_cadastro_total_registros, v_cadastro_total, v_cadastro_incompletos_registros, v_cadastro_incompletos, v_cadastro_enviados_registros, v_cadastro_enviados
    FROM cadastros
    WHERE EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'cadastro';

    -- Tipo: inclusao_dependente
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_inclusao_total_registros, v_inclusao_total, v_inclusao_incompletos_registros, v_inclusao_incompletos, v_inclusao_enviados_registros, v_inclusao_enviados
    FROM cadastros
    WHERE EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';

  ELSIF v_user_role IN ('SUPERVISOR', 'CADASTRO') THEN
    -- Tipo: cadastro
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_cadastro_total_registros, v_cadastro_total, v_cadastro_incompletos_registros, v_cadastro_incompletos, v_cadastro_enviados_registros, v_cadastro_enviados
    FROM cadastros
    WHERE team_id = v_user_team_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'cadastro';

    -- Tipo: inclusao_dependente
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_inclusao_total_registros, v_inclusao_total, v_inclusao_incompletos_registros, v_inclusao_incompletos, v_inclusao_enviados_registros, v_inclusao_enviados
    FROM cadastros
    WHERE team_id = v_user_team_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';

  ELSIF v_user_role = 'VENDEDOR' THEN
    -- Tipo: cadastro
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_cadastro_total_registros, v_cadastro_total, v_cadastro_incompletos_registros, v_cadastro_incompletos, v_cadastro_enviados_registros, v_cadastro_enviados
    FROM cadastros
    WHERE (vendedor_id = p_user_id OR created_by = p_user_id)
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'cadastro';

    -- Tipo: inclusao_dependente
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_inclusao_total_registros, v_inclusao_total, v_inclusao_incompletos_registros, v_inclusao_incompletos, v_inclusao_enviados_registros, v_inclusao_enviados
    FROM cadastros
    WHERE (vendedor_id = p_user_id OR created_by = p_user_id)
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';

  ELSIF v_user_role = 'ADESIONISTA' THEN
    -- Tipo: cadastro
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_cadastro_total_registros, v_cadastro_total, v_cadastro_incompletos_registros, v_cadastro_incompletos, v_cadastro_enviados_registros, v_cadastro_enviados
    FROM cadastros
    WHERE adesionista_codigo = v_user_external_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'cadastro';

    -- Tipo: inclusao_dependente
    SELECT
      COUNT(*),
      COALESCE(SUM(
        CASE
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
      COALESCE(SUM(
        CASE
          WHEN status IN ('incompleto', 'adesoes_pendentes') AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COALESCE(SUM(
        CASE
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_inclusao_total_registros, v_inclusao_total, v_inclusao_incompletos_registros, v_inclusao_incompletos, v_inclusao_enviados_registros, v_inclusao_enviados
    FROM cadastros
    WHERE adesionista_codigo = v_user_external_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';
  END IF;

  -- Retornar com lógica correta:
  -- _total = soma do tamanho dos arrays (titular + dependentes)
  -- _cadastros = quantidade de registros (titulares)
  -- _dependentes = total - cadastros (só os dependentes)
  RETURN jsonb_build_object(
    'cadastro_total', COALESCE(v_cadastro_total, 0),
    'cadastro_cadastros', COALESCE(v_cadastro_total_registros, 0),
    'cadastro_dependentes', COALESCE(v_cadastro_total, 0) - COALESCE(v_cadastro_total_registros, 0),
    'cadastro_incompletos', COALESCE(v_cadastro_incompletos, 0),
    'cadastro_incompletos_cadastros', COALESCE(v_cadastro_incompletos_registros, 0),
    'cadastro_incompletos_dependentes', COALESCE(v_cadastro_incompletos, 0) - COALESCE(v_cadastro_incompletos_registros, 0),
    'cadastro_enviados', COALESCE(v_cadastro_enviados, 0),
    'cadastro_enviados_cadastros', COALESCE(v_cadastro_enviados_registros, 0),
    'cadastro_enviados_dependentes', COALESCE(v_cadastro_enviados, 0) - COALESCE(v_cadastro_enviados_registros, 0),
    'inclusao_total', COALESCE(v_inclusao_total, 0),
    'inclusao_cadastros', COALESCE(v_inclusao_total_registros, 0),
    'inclusao_dependentes', COALESCE(v_inclusao_total, 0) - COALESCE(v_inclusao_total_registros, 0),
    'inclusao_incompletos', COALESCE(v_inclusao_incompletos, 0),
    'inclusao_incompletos_cadastros', COALESCE(v_inclusao_incompletos_registros, 0),
    'inclusao_incompletos_dependentes', COALESCE(v_inclusao_incompletos, 0) - COALESCE(v_inclusao_incompletos_registros, 0),
    'inclusao_enviados', COALESCE(v_inclusao_enviados, 0),
    'inclusao_enviados_cadastros', COALESCE(v_inclusao_enviados_registros, 0),
    'inclusao_enviados_dependentes', COALESCE(v_inclusao_enviados, 0) - COALESCE(v_inclusao_enviados_registros, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_cadastros_stats(uuid) TO authenticated;

COMMENT ON FUNCTION get_cadastros_stats IS 'Retorna estatísticas de cadastros do mês atual. Array dependentes já inclui titular, então total = array_length, cadastros = count(*), dependentes = total - cadastros.';
