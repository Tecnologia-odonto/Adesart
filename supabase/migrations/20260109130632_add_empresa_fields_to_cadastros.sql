/*
  # Add Empresa Fields to Cadastros Table

  1. Changes
    - Add `empresa_id` (int) - ID da empresa no ERP
    - Add `empresa_nome` (text) - Nome fantasia da empresa
    - Add `empresa_cnpj` (text) - CNPJ da empresa
    - Add `empresa_raw` (jsonb) - Dados completos da empresa do ERP
    - Add `planos_raw` (jsonb) - Array de PrecoPlano da empresa

  2. Notes
    - These fields store the selected company data for the cadastro
    - empresa_raw contains full company details from ERP
    - planos_raw contains the PrecoPlano array for the selected company
*/

-- Add empresa fields to cadastros table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN empresa_id int;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'empresa_nome'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN empresa_nome text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'empresa_cnpj'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN empresa_cnpj text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'empresa_raw'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN empresa_raw jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'planos_raw'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN planos_raw jsonb;
  END IF;
END $$;
