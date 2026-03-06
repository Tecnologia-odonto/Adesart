/*
  # Atualizar função check_cpf_existente para ignorar cadastros excluídos

  1. Alterações
    - Modifica a função check_cpf_existente para não considerar cadastros que foram excluídos
    - Adiciona verificação na tabela cadastros_excluidos usando anti-join
    - Garante que vendedores não vejam cadastros excluídos ao tentar cadastrar novamente

  2. Comportamento
    - Se um CPF tem apenas cadastros excluídos, retorna exists = false
    - Apenas cadastros ativos (não excluídos) são considerados
    - Mantém toda a lógica de permissões e validações existentes
*/

-- Recriar função com verificação de exclusão
CREATE OR REPLACE FUNCTION check_cpf_existente(
  p_cpf text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadastro record;
  v_user_role text;
  v_user_external_id text;
  v_can_continue boolean := false;
BEGIN
  -- Buscar role e external_id do usuário
  SELECT role, external_id 
  INTO v_user_role, v_user_external_id
  FROM profiles
  WHERE id = p_user_id;

  -- Se não encontrou o usuário, retorna erro
  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Buscar cadastro com o CPF que NÃO foi excluído (mais recente primeiro)
  SELECT 
    c.id,
    c.status,
    c.created_at,
    c.empresa_nome,
    c.vendedor_codigo
  INTO v_cadastro
  FROM cadastros c
  WHERE c.cpf = p_cpf
    AND NOT EXISTS (
      SELECT 1 
      FROM cadastros_excluidos ce 
      WHERE ce.cadastro_id = c.id
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  -- Se não existe cadastro ativo, retorna exists = false
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'exists', false,
      'can_continue', false
    );
  END IF;

  -- Determinar se o usuário pode continuar baseado no role
  IF v_user_role IN ('ADMINISTRADOR', 'GESTOR', 'SUPERVISOR', 'CADASTRO') THEN
    -- Admin, Gestor, Supervisor e Cadastro podem continuar qualquer cadastro
    v_can_continue := true;
  ELSIF v_user_role = 'VENDEDOR' THEN
    -- Vendedor só pode continuar se for o mesmo vendedor que criou
    v_can_continue := (v_cadastro.vendedor_codigo = v_user_external_id);
  ELSE
    -- Outros roles não podem continuar
    v_can_continue := false;
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'exists', true,
    'can_continue', v_can_continue,
    'status', v_cadastro.status,
    'cadastro_id', CASE WHEN v_can_continue THEN v_cadastro.id ELSE NULL END,
    'created_at', v_cadastro.created_at,
    'empresa_nome', v_cadastro.empresa_nome
  );
END;
$$;

-- Comentário atualizado
COMMENT ON FUNCTION check_cpf_existente IS 'Verifica se existe cadastro ATIVO (não excluído) com o CPF informado. Usa SECURITY DEFINER para bypassar RLS de forma controlada.';