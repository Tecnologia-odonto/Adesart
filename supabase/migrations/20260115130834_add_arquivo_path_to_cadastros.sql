/*
  # Add arquivo_path to cadastros table

  1. Changes
    - Add `arquivo_path` column to `cadastros` table to store the path of uploaded files in Supabase Storage
    - This column will store the temporary file path in the bucket until the cadastro is completed
    - After successful ERP submission, the file will be deleted from storage to free up space
  
  2. Notes
    - Column is nullable as file upload may be optional depending on configuration
    - Path format will be: cadastros/{cadastro_id}/{filename}
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'arquivo_path'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN arquivo_path text;
  END IF;
END $$;