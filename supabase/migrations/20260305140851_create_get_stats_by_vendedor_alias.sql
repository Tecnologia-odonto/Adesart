/*
  # Criar alias get_stats_by_vendedor

  1. Problema
    - Frontend chama get_stats_by_vendedor
    - Função real é get_cadastros_stats_by_vendedor
  
  2. Solução
    - Criar alias/wrapper get_stats_by_vendedor que chama a função real
    - Mantém compatibilidade com frontend
*/

CREATE OR REPLACE FUNCTION get_stats_by_vendedor(
  p_user_id uuid,
  p_tipo_cadastro text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN get_cadastros_stats_by_vendedor(p_user_id, p_tipo_cadastro);
END;
$$;

GRANT EXECUTE ON FUNCTION get_stats_by_vendedor(uuid, text) TO authenticated;

COMMENT ON FUNCTION get_stats_by_vendedor IS 'Alias para get_cadastros_stats_by_vendedor. Filtra por mês atual automaticamente.';
