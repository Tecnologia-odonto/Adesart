/*
  # Corrigir cadastros com dependentes vazios

  1. Problema
    - Alguns cadastros foram criados sem o campo dependentes preenchido
    - O array dependentes deve sempre conter pelo menos o titular
  
  2. Solução
    - Atualizar cadastros com dependentes NULL ou [] 
    - Criar array com o titular usando dados do cadastro
    - Aplicar apenas para cadastros do tipo 'cadastro' (não 'inclusao_dependente')
*/

-- Atualizar cadastros com dependentes NULL ou vazio
UPDATE cadastros
SET dependentes = jsonb_build_array(
  jsonb_build_object(
    'cpf', cpf,
    'nome', nome,
    'dataNascimento', data_nascimento,
    'sexo', sexo_codigo,
    'parentesco', 1,
    'plano', null,
    'codigoPlano', null,
    'valorPlano', null,
    'nomeMae', COALESCE(nome_mae, '')
  )
)
WHERE tipo_cadastro = 'cadastro'
  AND (
    dependentes IS NULL
    OR dependentes = '[]'::jsonb
    OR jsonb_array_length(dependentes) = 0
  )
  AND cpf IS NOT NULL
  AND nome IS NOT NULL;

-- Verificar resultado
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM cadastros
  WHERE tipo_cadastro = 'cadastro'
    AND (dependentes IS NULL OR dependentes = '[]'::jsonb OR jsonb_array_length(dependentes) = 0);
  
  RAISE NOTICE 'Cadastros ainda sem dependentes: %', v_count;
END $$;
