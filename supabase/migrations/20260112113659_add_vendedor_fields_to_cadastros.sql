/*
  # Add vendedor fields to cadastros table

  ## Changes
  1. New Fields
    - `vendedor_id` (uuid, nullable) - References the vendedor (user with role VENDEDOR) who is responsible for this registration
    - `vendedor_codigo` (text, nullable) - The external_id/code of the vendedor, used in ERP integration

  ## Notes
  - These fields are used when a user with role CADASTRO or ADESIONISTA creates a registration
  - The vendedor's code will be sent to the ERP in the `funcionarioCadastro` and `dados.parceiro.codigo` fields
*/

-- Add vendedor fields to cadastros table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'vendedor_id'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN vendedor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'vendedor_codigo'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN vendedor_codigo text;
  END IF;
END $$;

-- Create index for vendedor_id
CREATE INDEX IF NOT EXISTS cadastros_vendedor_id_idx ON cadastros(vendedor_id);