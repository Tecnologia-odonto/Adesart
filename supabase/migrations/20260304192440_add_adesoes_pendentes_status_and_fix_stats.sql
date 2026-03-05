/*
  # Adicionar status 'adesoes_pendentes' e corrigir contagem

  1. Alterações na tabela cadastros
    - Adiciona 'adesoes_pendentes' aos valores permitidos na constraint de status

  2. Correção na função get_cadastros_stats
    - Corrige a lógica de contagem para não contar o titular duas vezes
    - cadastro_total = quantidade de registros (titulares)
    - cadastro_dependentes = soma dos dependentes no array
    - Inclui status 'adesoes_pendentes' como incompleto

  3. Motivação
    - O campo dependentes contém apenas os dependentes, não o titular
    - O titular é representado pelo próprio registro na tabela cadastros
    - Total de pessoas = registros + soma(length(dependentes))
*/

-- Remover a constraint antiga de status
ALTER TABLE cadastros DROP CONSTRAINT IF EXISTS cadastros_status_check;

-- Adicionar nova constraint com 'adesoes_pendentes'
ALTER TABLE cadastros ADD CONSTRAINT cadastros_status_check 
  CHECK (status IN ('incompleto', 'enviado', 'erro_envio', 'adesoes_pendentes'));

-- Dropar função anterior
DROP FUNCTION IF EXISTS get_cadastros_stats(uuid);

-- Recriar função get_cadastros_stats com lógica corrigida
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
  v_cadastro_total_deps integer := 0;
  v_cadastro_incompletos integer := 0;
  v_cadastro_incompletos_deps integer := 0;
  v_cadastro_enviados integer := 0;
  v_cadastro_enviados_deps integer := 0;
  v_inclusao_total integer := 0;
  v_inclusao_total_deps integer := 0;
  v_inclusao_incompletos integer := 0;
  v_inclusao_incompletos_deps integer := 0;
  v_inclusao_enviados integer := 0;
  v_inclusao_enviados_deps integer := 0;
  v_current_year integer;
  v_current_month integer;
BEGIN
  -- Obter ano e mês atual
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Buscar informações do usuário
  SELECT role, team_id, external_id
  INTO v_user_role, v_user_team_id, v_user_external_id
  FROM profiles
  WHERE id = p_user_id;

  -- Se não encontrou o usuário, retorna zeros
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

  -- ADMINISTRADOR e GERENTE veem todos os cadastros do mês atual
  IF v_user_role IN ('ADMINISTRADOR', 'GERENTE') THEN
    -- Tipo: cadastro
    -- Contamos: registros como cadastros (titulares) e array de dependentes separadamente
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
    INTO v_cadastro_total, v_cadastro_total_deps, v_cadastro_incompletos, v_cadastro_incompletos_deps, v_cadastro_enviados, v_cadastro_enviados_deps
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
    INTO v_inclusao_total, v_inclusao_total_deps, v_inclusao_incompletos, v_inclusao_incompletos_deps, v_inclusao_enviados, v_inclusao_enviados_deps
    FROM cadastros
    WHERE EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';

  -- SUPERVISOR e CADASTRO veem cadastros do time no mês atual
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
    INTO v_cadastro_total, v_cadastro_total_deps, v_cadastro_incompletos, v_cadastro_incompletos_deps, v_cadastro_enviados, v_cadastro_enviados_deps
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
    INTO v_inclusao_total, v_inclusao_total_deps, v_inclusao_incompletos, v_inclusao_incompletos_deps, v_inclusao_enviados, v_inclusao_enviados_deps
    FROM cadastros
    WHERE team_id = v_user_team_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';

  -- VENDEDOR vê cadastros onde vendedor_id = user_id OU created_by = user_id
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
    INTO v_cadastro_total, v_cadastro_total_deps, v_cadastro_incompletos, v_cadastro_incompletos_deps, v_cadastro_enviados, v_cadastro_enviados_deps
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
    INTO v_inclusao_total, v_inclusao_total_deps, v_inclusao_incompletos, v_inclusao_incompletos_deps, v_inclusao_enviados, v_inclusao_enviados_deps
    FROM cadastros
    WHERE (vendedor_id = p_user_id OR created_by = p_user_id)
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';

  -- ADESIONISTA vê cadastros onde é adesionista no mês atual
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
    INTO v_cadastro_total, v_cadastro_total_deps, v_cadastro_incompletos, v_cadastro_incompletos_deps, v_cadastro_enviados, v_cadastro_enviados_deps
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
    INTO v_inclusao_total, v_inclusao_total_deps, v_inclusao_incompletos, v_inclusao_incompletos_deps, v_inclusao_enviados, v_inclusao_enviados_deps
    FROM cadastros
    WHERE adesionista_codigo = v_user_external_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month
      AND tipo_cadastro = 'inclusao_dependente';
  END IF;

  -- Retornar estatísticas
  -- cadastro_cadastros = quantidade de registros (titulares)
  -- cadastro_dependentes = soma dos arrays de dependentes
  -- cadastro_total = cadastros + dependentes (total de pessoas)
  RETURN jsonb_build_object(
    'cadastro_total', COALESCE(v_cadastro_total, 0) + COALESCE(v_cadastro_total_deps, 0),
    'cadastro_cadastros', COALESCE(v_cadastro_total, 0),
    'cadastro_dependentes', COALESCE(v_cadastro_total_deps, 0),
    'cadastro_incompletos', COALESCE(v_cadastro_incompletos, 0) + COALESCE(v_cadastro_incompletos_deps, 0),
    'cadastro_incompletos_cadastros', COALESCE(v_cadastro_incompletos, 0),
    'cadastro_incompletos_dependentes', COALESCE(v_cadastro_incompletos_deps, 0),
    'cadastro_enviados', COALESCE(v_cadastro_enviados, 0) + COALESCE(v_cadastro_enviados_deps, 0),
    'cadastro_enviados_cadastros', COALESCE(v_cadastro_enviados, 0),
    'cadastro_enviados_dependentes', COALESCE(v_cadastro_enviados_deps, 0),
    'inclusao_total', COALESCE(v_inclusao_total, 0) + COALESCE(v_inclusao_total_deps, 0),
    'inclusao_cadastros', COALESCE(v_inclusao_total, 0),
    'inclusao_dependentes', COALESCE(v_inclusao_total_deps, 0),
    'inclusao_incompletos', COALESCE(v_inclusao_incompletos, 0) + COALESCE(v_inclusao_incompletos_deps, 0),
    'inclusao_incompletos_cadastros', COALESCE(v_inclusao_incompletos, 0),
    'inclusao_incompletos_dependentes', COALESCE(v_inclusao_incompletos_deps, 0),
    'inclusao_enviados', COALESCE(v_inclusao_enviados, 0) + COALESCE(v_inclusao_enviados_deps, 0),
    'inclusao_enviados_cadastros', COALESCE(v_inclusao_enviados, 0),
    'inclusao_enviados_dependentes', COALESCE(v_inclusao_enviados_deps, 0)
  );
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_cadastros_stats(uuid) TO authenticated;

-- Comentários
COMMENT ON FUNCTION get_cadastros_stats IS 'Retorna estatísticas de cadastros do mês atual. cadastro_cadastros = titulares (registros), cadastro_dependentes = dependentes (arrays). Status adesoes_pendentes contado como incompleto.';
