/*
  # Add motivo_bloqueio and erp_dados_associado to cadastros table

  1. New Columns
    - `motivo_bloqueio` (text) - Reason why the registration is blocked (e.g., "Cliente já cadastrado no ERP")
    - `erp_dados_associado` (jsonb) - Full ERP data when the CPF already exists in the system
  
  2. Changes
    - These columns will help track why a registration couldn't proceed
    - The erp_dados_associado will store the complete data returned from the ERP check
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'motivo_bloqueio'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN motivo_bloqueio text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'erp_dados_associado'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN erp_dados_associado jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
