/*
  # Atualizar função de estatísticas para mês atual

  1. Alterações
    - Adiciona filtro para considerar apenas cadastros do mês atual
    - Usa `created_at` para determinar o mês
    - Mantém todas as regras de RLS e hierarquia
  
  2. Lógica de Mês Atual
    - Considera ano e mês da data de criação
    - Filtra: EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    - Filtra: EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
  
  3. Performance
    - Índice criado em created_at para otimizar
    - Mantém uso de COUNT para eficiência
*/

-- Drop função anterior
DROP FUNCTION IF EXISTS get_cadastros_stats(uuid);

-- Criar função atualizada
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
      'erros', 0
    );
  END IF;

  -- ADMINISTRADOR e GESTOR veem todos os cadastros do mês atual
  IF v_user_role IN ('ADMINISTRADOR', 'GESTOR') THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
    FROM cadastros
    WHERE EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month;

  -- SUPERVISOR e CADASTRO veem cadastros do time no mês atual
  ELSIF v_user_role IN ('SUPERVISOR', 'CADASTRO') THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
    FROM cadastros
    WHERE team_id = v_user_team_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month;

  -- VENDEDOR vê apenas seus próprios cadastros no mês atual
  ELSIF v_user_role = 'VENDEDOR' THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
    FROM cadastros
    WHERE vendedor_codigo = v_user_external_id
      AND EXTRACT(YEAR FROM created_at) = v_current_year
      AND EXTRACT(MONTH FROM created_at) = v_current_month;

  -- ADESIONISTA vê cadastros onde é adesionista no mês atual
  ELSIF v_user_role = 'ADESIONISTA' THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
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
  END IF;

  -- Retornar estatísticas
  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'incompletos', COALESCE(v_incompletos, 0),
    'enviados', COALESCE(v_enviados, 0),
    'erros', COALESCE(v_erros, 0)
  );
END;
$$;

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION get_cadastros_stats(uuid) TO authenticated;

-- Comentário
COMMENT ON FUNCTION get_cadastros_stats IS 'Retorna estatísticas de cadastros do mês atual (contadores por status) respeitando RLS e hierarquia de roles. Filtra por created_at.';

-- Criar índice para otimizar queries por data de criação (se ainda não existir)
CREATE INDEX IF NOT EXISTS idx_cadastros_created_at ON cadastros(created_at);

-- Criar índices compostos para melhorar performance com filtros de data
CREATE INDEX IF NOT EXISTS idx_cadastros_created_at_status ON cadastros(created_at, status);
CREATE INDEX IF NOT EXISTS idx_cadastros_created_at_team_id ON cadastros(created_at, team_id);
CREATE INDEX IF NOT EXISTS idx_cadastros_created_at_vendedor ON cadastros(created_at, vendedor_codigo);
CREATE INDEX IF NOT EXISTS idx_cadastros_created_at_adesionista ON cadastros(created_at, adesionista_codigo);
