/*
  # Add vendedor_nome to cadastros table

  ## Summary
  Adds a new column vendedor_nome to store the name of the vendor for easier reference
  in the frontend, especially for CADASTRO role users.

  ## Changes
  1. Add vendedor_nome text column to cadastros table

  ## Security
  - No RLS changes needed as this is just a data field
*/

-- Add vendedor_nome column
ALTER TABLE cadastros ADD COLUMN IF NOT EXISTS vendedor_nome text;
