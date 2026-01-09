/*
  # Add Responsavel Financeiro Contact Fields

  1. Changes
    - Add `contatos_responsavel_financeiro` (jsonb) column to cadastros table
    - This will store an array of contacts with tipo (1=Celular, 2=Email) and dado (value)
  
  2. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'contatos_responsavel_financeiro'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN contatos_responsavel_financeiro jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
