/*
  # Add planos_ocultos to cadastro_config

  1. Changes
    - Add `planos_ocultos` column to `cadastro_config` table
      - Array of text (string[]) to store plan codes that should be hidden
      - Default to empty array
  
  2. Purpose
    - Allow administrators to configure which plan codes should be hidden from the dependent plan selection dropdown
    - Example: If plan code "110" is in the array, it won't be shown in the select options
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastro_config' AND column_name = 'planos_ocultos'
  ) THEN
    ALTER TABLE cadastro_config ADD COLUMN planos_ocultos text[] DEFAULT '{}';
  END IF;
END $$;