/*
  # Corrigir função de auditoria Lemmit - Filtrar apenas endpoint lemit-consulta-pessoa

  1. Alterações
    - Atualiza função `audit_lemmit` para filtrar apenas registros com endpoint = 'lemit-consulta-pessoa'
    - Altera permissão para apenas ADMINISTRADOR (remove GESTOR)
    - Todas as contagens e agregações agora consideram apenas consultas Lemmit
  
  2. Segurança
    - Somente perfis ADMINISTRADOR podem executar
*/

CREATE OR REPLACE FUNCTION audit_lemmit(
  p_start timestamptz,
  p_end timestamptz,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_result jsonb;
  v_cards jsonb;
  v_usuario_consulta jsonb;
  v_usuario_custo jsonb;
  v_ultimas_consultas jsonb;
BEGIN
  -- Verificar permissão do usuário - APENAS ADMINISTRADOR
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_user_role <> 'ADMINISTRADOR' THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem acessar auditoria.';
  END IF;

  -- Cards (totais) - FILTRAR APENAS lemit-consulta-pessoa
  SELECT jsonb_build_object(
    'total_limite_ajustado', (
      SELECT COALESCE(SUM(lemmit_limite_consultas), 0)
      FROM profiles
      WHERE lemmit_limite_consultas IS NOT NULL
    ),
    'total_consultas', (
      SELECT COUNT(*)
      FROM api_logs
      WHERE created_at >= p_start 
        AND created_at < p_end
        AND endpoint = 'lemit-consulta-pessoa'
    ),
    'bem_sucedidas', (
      SELECT COUNT(*)
      FROM api_logs
      WHERE created_at >= p_start 
        AND created_at < p_end
        AND endpoint = 'lemit-consulta-pessoa'
        AND status_code = 200
    ),
    'com_erro', (
      SELECT COUNT(*)
      FROM api_logs
      WHERE created_at >= p_start 
        AND created_at < p_end
        AND endpoint = 'lemit-consulta-pessoa'
        AND status_code > 200
    ),
    'custo_total', (
      SELECT COALESCE(SUM(cost), 0)
      FROM api_logs
      WHERE created_at >= p_start 
        AND created_at < p_end
        AND endpoint = 'lemit-consulta-pessoa'
    )
  ) INTO v_cards;

  -- Usuário x Consulta - FILTRAR APENAS lemit-consulta-pessoa
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'nome', COALESCE(nome, email, 'Usuário sem nome'),
      'consultas', consultas
    ) ORDER BY consultas DESC
  ) INTO v_usuario_consulta
  FROM (
    SELECT 
      al.user_id,
      p.name as nome,
      p.email,
      COUNT(*) as consultas
    FROM api_logs al
    LEFT JOIN profiles p ON p.id = al.user_id
    WHERE al.created_at >= p_start 
      AND al.created_at < p_end
      AND al.endpoint = 'lemit-consulta-pessoa'
    GROUP BY al.user_id, p.name, p.email
    HAVING COUNT(*) > 0
  ) t;

  -- Usuário x Custo - FILTRAR APENAS lemit-consulta-pessoa
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'nome', COALESCE(nome, email, 'Usuário sem nome'),
      'custo_total', custo_total
    ) ORDER BY custo_total DESC
  ) INTO v_usuario_custo
  FROM (
    SELECT 
      al.user_id,
      p.name as nome,
      p.email,
      COALESCE(SUM(al.cost), 0) as custo_total
    FROM api_logs al
    LEFT JOIN profiles p ON p.id = al.user_id
    WHERE al.created_at >= p_start 
      AND al.created_at < p_end
      AND al.endpoint = 'lemit-consulta-pessoa'
    GROUP BY al.user_id, p.name, p.email
    HAVING COALESCE(SUM(al.cost), 0) > 0
  ) t;

  -- Últimas consultas (paginado) - FILTRAR APENAS lemit-consulta-pessoa
  SELECT jsonb_agg(
    jsonb_build_object(
      'nome', COALESCE(p.name, al.user_email, 'Desconhecido'),
      'cpf', COALESCE(
        al.request_body->>'cpf',
        al.request_body->>'documento',
        'N/A'
      ),
      'hora', al.created_at
    ) ORDER BY al.created_at DESC
  ) INTO v_ultimas_consultas
  FROM (
    SELECT al.*, p.name, p.email
    FROM api_logs al
    LEFT JOIN profiles p ON p.id = al.user_id
    WHERE al.created_at >= p_start 
      AND al.created_at < p_end
      AND al.endpoint = 'lemit-consulta-pessoa'
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) al
  LEFT JOIN profiles p ON p.id = al.user_id;

  -- Montar resultado final
  v_result := jsonb_build_object(
    'cards', v_cards,
    'usuario_consulta', COALESCE(v_usuario_consulta, '[]'::jsonb),
    'usuario_custo', COALESCE(v_usuario_custo, '[]'::jsonb),
    'ultimas_consultas', COALESCE(v_ultimas_consultas, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;