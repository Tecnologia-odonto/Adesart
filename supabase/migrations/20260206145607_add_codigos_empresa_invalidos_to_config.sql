/*
  # Adicionar campo codigos_empresa_invalidos

  1. Alterações
    - Adiciona coluna `codigos_empresa_invalidos` na tabela `cadastro_config`
    - Array de strings para armazenar códigos de situação de empresas que não devem permitir cadastro
    
  2. Segurança
    - Mantém RLS existente
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastro_config' AND column_name = 'codigos_empresa_invalidos'
  ) THEN
    ALTER TABLE cadastro_config ADD COLUMN codigos_empresa_invalidos text[] DEFAULT '{}';
  END IF;
END $$;
