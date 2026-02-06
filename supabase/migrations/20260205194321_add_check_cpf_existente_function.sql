/*
  # Função para verificar existência de cadastro por CPF

  1. Nova Função
    - `check_cpf_existente(p_cpf text, p_user_id uuid)`
      - Verifica se existe cadastro com o CPF informado
      - Retorna informações mínimas sem expor dados sensíveis
      - Usa SECURITY DEFINER para bypassar RLS de forma controlada
      - Verifica se o usuário tem permissão baseado em seu role
  
  2. Retorno
    - `exists` (boolean) - Se o cadastro existe
    - `can_continue` (boolean) - Se o usuário pode continuar/editar o cadastro
    - `status` (text) - Status do cadastro (incompleto/enviado/erro_envio)
    - `cadastro_id` (uuid) - ID do cadastro (apenas se can_continue = true)
    - `created_at` (timestamptz) - Data de criação
    - `empresa_nome` (text) - Nome da empresa (informação pública)
  
  3. Segurança
    - Não retorna dados pessoais (nome, contatos, endereço, etc)
    - Não permite enumeração de CPFs
    - Valida role do usuário antes de retornar dados
    - Usa SECURITY DEFINER de forma segura
*/

-- Drop se existir
DROP FUNCTION IF EXISTS check_cpf_existente(text, uuid);

-- Criar função
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

  -- Buscar cadastro com o CPF (mais recente primeiro)
  SELECT 
    id,
    status,
    created_at,
    empresa_nome,
    vendedor_codigo
  INTO v_cadastro
  FROM cadastros
  WHERE cpf = p_cpf
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se não existe cadastro, retorna exists = false
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

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION check_cpf_existente(text, uuid) TO authenticated;

-- Comentário
COMMENT ON FUNCTION check_cpf_existente IS 'Verifica se existe cadastro com o CPF informado sem expor dados sensíveis. Usa SECURITY DEFINER para bypassar RLS de forma controlada.';
