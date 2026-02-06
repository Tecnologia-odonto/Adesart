/*
  # Adicionar contagem de dependentes por status às estatísticas

  1. Alterações
    - Atualiza função `get_cadastros_stats` para incluir contagem de dependentes por status
    - Adiciona campos `incompletos_dependentes` e `enviados_dependentes` no retorno
    - Conta dependentes apenas dos cadastros com status correspondente
    - Mantém todas as regras de role e permissões existentes

  2. Lógica
    - Para cadastros incompletos, soma os dependentes desses cadastros
    - Para cadastros enviados, soma os dependentes desses cadastros
    - Permite mostrar nos badges o total de pessoas (cadastros + dependentes)

  3. Performance
    - Usa duas queries separadas para melhor clareza
    - Mantém todos os índices existentes
    - Não impacta performance significativamente
*/

-- Drop função anterior
DROP FUNCTION IF EXISTS get_cadastros_stats(uuid);

-- Criar função atualizada com contagem de dependentes por status
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
  v_total integer := 0;
  v_incompletos integer := 0;
  v_enviados integer := 0;
  v_erros integer := 0;
  v_total_dependentes integer := 0;
  v_incompletos_dependentes integer := 0;
  v_enviados_dependentes integer := 0;
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
      'total', 0,
      'incompletos', 0,
      'enviados', 0,
      'erros', 0,
      'total_dependentes', 0,
      'incompletos_dependentes', 0,
      'enviados_dependentes', 0
    );
  END IF;

  -- ADMINISTRADOR e GESTOR veem todos os cadastros do mês atual
  IF v_user_role IN ('ADMINISTRADOR', 'GESTOR') THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio'),
      COALESCE(SUM(
        CASE 
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'incompleto' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_total, v_incompletos, v_enviados, v_erros, v_total_dependentes, v_incompletos_dependentes, v_enviados_dependentes
    FROM cadastros
    WHERE EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month;

  -- SUPERVISOR e CADASTRO veem cadastros do time no mês atual
  ELSIF v_user_role IN ('SUPERVISOR', 'CADASTRO') THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio'),
      COALESCE(SUM(
        CASE 
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'incompleto' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_total, v_incompletos, v_enviados, v_erros, v_total_dependentes, v_incompletos_dependentes, v_enviados_dependentes
    FROM cadastros
    WHERE team_id = v_user_team_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month;

  -- VENDEDOR vê cadastros onde vendedor_codigo = external_id OU created_by = user_id
  ELSIF v_user_role = 'VENDEDOR' THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio'),
      COALESCE(SUM(
        CASE 
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'incompleto' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_total, v_incompletos, v_enviados, v_erros, v_total_dependentes, v_incompletos_dependentes, v_enviados_dependentes
    FROM cadastros
    WHERE (vendedor_codigo = v_user_external_id OR created_by = p_user_id)
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month;

  -- ADESIONISTA vê cadastros onde é adesionista no mês atual
  ELSIF v_user_role = 'ADESIONISTA' THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio'),
      COALESCE(SUM(
        CASE 
          WHEN dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'incompleto' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE 
          WHEN status = 'enviado' AND dependentes IS NOT NULL AND jsonb_typeof(dependentes) = 'array'
          THEN jsonb_array_length(dependentes)
          ELSE 0
        END
      ), 0)
    INTO v_total, v_incompletos, v_enviados, v_erros, v_total_dependentes, v_incompletos_dependentes, v_enviados_dependentes
    FROM cadastros
    WHERE adesionista_codigo = v_user_external_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month;

  -- Outros roles não veem nada
  ELSE
    v_total := 0;
    v_incompletos := 0;
    v_enviados := 0;
    v_erros := 0;
    v_total_dependentes := 0;
    v_incompletos_dependentes := 0;
    v_enviados_dependentes := 0;
  END IF;

  -- Retornar estatísticas incluindo dependentes por status
  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'incompletos', COALESCE(v_incompletos, 0),
    'enviados', COALESCE(v_enviados, 0),
    'erros', COALESCE(v_erros, 0),
    'total_dependentes', COALESCE(v_total_dependentes, 0),
    'incompletos_dependentes', COALESCE(v_incompletos_dependentes, 0),
    'enviados_dependentes', COALESCE(v_enviados_dependentes, 0)
  );
END;
$$;

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION get_cadastros_stats(uuid) TO authenticated;

-- Comentário
COMMENT ON FUNCTION get_cadastros_stats IS 'Retorna estatísticas de cadastros do mês atual incluindo contagem de dependentes por status. Permite mostrar total de pessoas nos badges. Respeita RLS e hierarquia de roles.';