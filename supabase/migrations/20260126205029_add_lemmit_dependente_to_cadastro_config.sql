/*
  # Adicionar consulta Lemmit para dependentes

  1. Alterações
    - Adiciona campo `lemmit_dependente` (boolean) à tabela `cadastro_config`
    - Define valor padrão como `false`
    - Permite que administradores ativem/desativem a consulta Lemmit automática ao adicionar dependentes
  
  2. Comportamento
    - Quando ativo, ao adicionar um dependente e preencher o CPF, o sistema fará uma consulta Lemmit
    - Os dados retornados preencherão automaticamente os campos do dependente
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastro_config' AND column_name = 'lemmit_dependente'
  ) THEN
    ALTER TABLE cadastro_config ADD COLUMN lemmit_dependente boolean DEFAULT false;
  END IF;
END $$;