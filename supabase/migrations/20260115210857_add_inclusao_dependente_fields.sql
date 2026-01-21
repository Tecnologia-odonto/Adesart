/*
  # Add Inclusão de Dependente Fields

  1. Changes
    - Add `tipo_cadastro` column to differentiate between normal cadastros and dependente inclusao
    - Add columns to support dependente inclusao:
      * responsavel_financeiro_codigo
      * responsavel_financeiro_nome
      * responsavel_financeiro_cpf
      * empresa_nome
      * empresa_codigo
      * parentesco
      * plano_codigo
      * plano_nome
      * nome_mae
      * arquivo_path

  2. Notes
    - tipo_cadastro can be 'cadastro' (default) or 'inclusao_dependente'
    - These fields are only used when tipo_cadastro = 'inclusao_dependente'
*/

-- Add tipo_cadastro column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'tipo_cadastro'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN tipo_cadastro text NOT NULL DEFAULT 'cadastro'
      CHECK (tipo_cadastro IN ('cadastro', 'inclusao_dependente'));
  END IF;
END $$;

-- Add responsavel financeiro fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'responsavel_financeiro_codigo'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN responsavel_financeiro_codigo integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'responsavel_financeiro_nome'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN responsavel_financeiro_nome text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'responsavel_financeiro_cpf'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN responsavel_financeiro_cpf text;
  END IF;
END $$;

-- Add empresa fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'empresa_nome'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN empresa_nome text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'empresa_codigo'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN empresa_codigo integer;
  END IF;
END $$;

-- Add parentesco field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'parentesco'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN parentesco integer;
  END IF;
END $$;

-- Add plano fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'plano_codigo'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN plano_codigo integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'plano_nome'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN plano_nome text;
  END IF;
END $$;

-- Add nome_mae field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'nome_mae'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN nome_mae text;
  END IF;
END $$;

-- Add arquivo_path field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'arquivo_path'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN arquivo_path text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS cadastros_tipo_cadastro_idx ON cadastros(tipo_cadastro);
CREATE INDEX IF NOT EXISTS cadastros_responsavel_financeiro_codigo_idx ON cadastros(responsavel_financeiro_codigo);
CREATE INDEX IF NOT EXISTS cadastros_empresa_codigo_idx ON cadastros(empresa_codigo);