/*
  # Add Nome Mae and Dependentes to Cadastros

  1. Changes
    - Add `nome_mae` (text) - Nome da mãe do titular
    - Add `dependentes` (jsonb) - Array com dados dos dependentes e planos escolhidos

  2. Notes
    - nome_mae stores the mother's name for the titular
    - dependentes stores the full dependents data including selected plans
    - These fields allow saving draft data before sending to ERP
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'nome_mae'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN nome_mae text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'dependentes'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN dependentes jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;