/*
  # Função para obter estatísticas de cadastros

  1. Nova Função
    - `get_cadastros_stats(p_user_id uuid)`
      - Retorna contadores de cadastros por status
      - Respeita regras de RLS e hierarquia de roles
      - Otimizada para não trazer dados completos
      - Usa índices para performance
  
  2. Retorno
    - `total` (integer) - Total de cadastros visíveis
    - `incompletos` (integer) - Cadastros com status 'incompleto'
    - `enviados` (integer) - Cadastros com status 'enviado'
    - `erros` (integer) - Cadastros com status 'erro_envio'
  
  3. Lógica por Role
    - ADMINISTRADOR/GESTOR: Vê todos os cadastros
    - SUPERVISOR: Vê cadastros do seu time
    - CADASTRO: Vê cadastros do seu time
    - VENDEDOR: Vê apenas seus próprios cadastros
    - ADESIONISTA: Vê cadastros onde é adesionista
  
  4. Performance
    - Usa COUNT em vez de SELECT *
    - Aplica filtros diretamente no banco
    - Não traz dados completos
    - Utiliza índices existentes
*/

-- Drop se existir
DROP FUNCTION IF EXISTS get_cadastros_stats(uuid);

-- Criar função
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
BEGIN
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

  -- ADMINISTRADOR e GESTOR veem todos os cadastros
  IF v_user_role IN ('ADMINISTRADOR', 'GESTOR') THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
    FROM cadastros;

  -- SUPERVISOR e CADASTRO veem cadastros do time
  ELSIF v_user_role IN ('SUPERVISOR', 'CADASTRO') THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
    FROM cadastros
    WHERE team_id = v_user_team_id;

  -- VENDEDOR vê apenas seus próprios cadastros
  ELSIF v_user_role = 'VENDEDOR' THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
    FROM cadastros
    WHERE vendedor_codigo = v_user_external_id;

  -- ADESIONISTA vê cadastros onde é adesionista
  ELSIF v_user_role = 'ADESIONISTA' THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'incompleto'),
      COUNT(*) FILTER (WHERE status = 'enviado'),
      COUNT(*) FILTER (WHERE status = 'erro_envio')
    INTO v_total, v_incompletos, v_enviados, v_erros
    FROM cadastros
    WHERE adesionista_codigo = v_user_external_id;

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
COMMENT ON FUNCTION get_cadastros_stats IS 'Retorna estatísticas de cadastros (contadores por status) respeitando RLS e hierarquia de roles. Otimizada para performance.';

-- Criar índices para otimizar a função (se ainda não existirem)
CREATE INDEX IF NOT EXISTS idx_cadastros_status ON cadastros(status);
CREATE INDEX IF NOT EXISTS idx_cadastros_team_id ON cadastros(team_id);
CREATE INDEX IF NOT EXISTS idx_cadastros_vendedor_codigo ON cadastros(vendedor_codigo);
CREATE INDEX IF NOT EXISTS idx_cadastros_adesionista_codigo ON cadastros(adesionista_codigo);
CREATE INDEX IF NOT EXISTS idx_cadastros_status_team_id ON cadastros(status, team_id);
CREATE INDEX IF NOT EXISTS idx_cadastros_status_vendedor ON cadastros(status, vendedor_codigo);
