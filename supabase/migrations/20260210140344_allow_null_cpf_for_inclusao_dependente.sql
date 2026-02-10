/*
  # Permitir CPF nulo para cadastros de inclusão de dependentes

  1. Mudanças
    - Alterar coluna `cpf` na tabela `cadastros` para permitir valores NULL
    - Isso é necessário pois cadastros do tipo 'inclusao_dependente' não têm um CPF principal
    - Os CPFs dos dependentes são armazenados no campo JSON `dependentes`
  
  2. Segurança
    - Não afeta RLS existente
    - Mantém todas as políticas de segurança intactas
*/

-- Alterar coluna cpf para permitir NULL
DO $$
BEGIN
  -- Remove NOT NULL constraint do campo cpf
  ALTER TABLE cadastros ALTER COLUMN cpf DROP NOT NULL;
END $$;
