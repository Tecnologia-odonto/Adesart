/*
  # Add exigir_arquivo to cadastro_config

  1. Changes
    - Add `exigir_arquivo` column to `cadastro_config` table
      - Boolean flag to determine if file upload is required during registration
      - Default to false (not required)
  
  2. Purpose
    - Allow administrators to configure whether file upload is mandatory when registering a new client
    - When enabled, users must upload a document before completing registration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastro_config' AND column_name = 'exigir_arquivo'
  ) THEN
    ALTER TABLE cadastro_config ADD COLUMN exigir_arquivo boolean DEFAULT false;
  END IF;
END $$;