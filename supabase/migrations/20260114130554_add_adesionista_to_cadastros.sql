/*
  # Adicionar campo adesionista aos cadastros

  1. Alterações
    - Adiciona coluna `adesionista_id` à tabela `cadastros`
    - Adiciona coluna `adesionista_codigo` à tabela `cadastros`
    - Adiciona coluna `adesionista_nome` à tabela `cadastros`

  2. Descrição
    - O campo `adesionista_id` armazena o ID do usuário adesionista (referência à tabela profiles)
    - O campo `adesionista_codigo` armazena o código externo do adesionista (external_id)
    - O campo `adesionista_nome` armazena o nome do adesionista para facilitar consultas
    - Todos os campos são opcionais (nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'adesionista_id'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN adesionista_id uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'adesionista_codigo'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN adesionista_codigo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'adesionista_nome'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN adesionista_nome text;
  END IF;
END $$;