/*
  # Função para bloquear CPF no fluxo público por base local

  1. Objetivo
    - Barrar CPF que já exista como titular em adesão enviada
    - Barrar CPF que já exista como dependente em adesão enviada
    - Ignorar cadastros excluídos

  2. Uso
    - Reaproveitada pelas edge functions do fluxo público por link
*/

CREATE OR REPLACE FUNCTION check_public_link_blocked_cpf(
  p_cpf text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_titular record;
  v_dependente record;
BEGIN
  IF length(v_cpf) <> 11 THEN
    RETURN jsonb_build_object(
      'blocked', false,
      'reason', null,
      'code', null
    );
  END IF;

  SELECT
    c.id,
    c.nome,
    c.empresa_nome
  INTO v_titular
  FROM cadastros c
  WHERE c.status = 'enviado'
    AND regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = v_cpf
    AND NOT EXISTS (
      SELECT 1
      FROM cadastros_excluidos ce
      WHERE ce.cadastro_id = c.id
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'reason', 'Este CPF ja possui adesao cadastrada e nao pode utilizar este link.',
      'code', 'CPF_ALREADY_EXISTS_AS_TITULAR',
      'cadastro_id', v_titular.id,
      'empresa_nome', v_titular.empresa_nome
    );
  END IF;

  SELECT
    c.id,
    c.nome,
    c.empresa_nome,
    dep ->> 'nome' as dependente_nome
  INTO v_dependente
  FROM cadastros c
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN c.dependentes IS NOT NULL AND jsonb_typeof(c.dependentes) = 'array'
        THEN c.dependentes
      ELSE '[]'::jsonb
    END
  ) AS dep
  WHERE c.status = 'enviado'
    AND coalesce((dep ->> 'tipo')::integer, 0) <> 1
    AND regexp_replace(coalesce(dep ->> 'cpf', ''), '\D', '', 'g') = v_cpf
    AND NOT EXISTS (
      SELECT 1
      FROM cadastros_excluidos ce
      WHERE ce.cadastro_id = c.id
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'reason', 'Este CPF ja esta cadastrado como dependente e nao pode fazer adesao por este link.',
      'code', 'CPF_ALREADY_EXISTS_AS_DEPENDENT',
      'cadastro_id', v_dependente.id,
      'empresa_nome', v_dependente.empresa_nome,
      'dependente_nome', v_dependente.dependente_nome
    );
  END IF;

  RETURN jsonb_build_object(
    'blocked', false,
    'reason', null,
    'code', null
  );
END;
$$;

COMMENT ON FUNCTION check_public_link_blocked_cpf IS 'Bloqueia CPF no fluxo público se já existir como titular ou dependente em cadastro enviado e não excluído.';
