/*
  # Add Matricula Fields to Cadastros

  1. Changes
    - Add `empresa_exige_matricula` column to store if company requires matricula (0 or 1)
    - Add `numero_matricula` column to store the matricula number when required

  2. Details
    - Both fields are nullable to maintain compatibility with existing records
    - empresa_exige_matricula defaults to 0 (not required)
*/

-- Add empresa_exige_matricula column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'empresa_exige_matricula'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN empresa_exige_matricula integer DEFAULT 0;
  END IF;
END $$;

-- Add numero_matricula column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'numero_matricula'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN numero_matricula text;
  END IF;
END $$;
