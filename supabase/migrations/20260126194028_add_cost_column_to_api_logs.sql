/*
  # Adicionar coluna de custo na tabela api_logs

  1. Mudanças
    - Adiciona coluna `cost` (decimal) na tabela `api_logs`
    - Define valor padrão como 0.00
    - Permite rastrear o custo de cada requisição (ex: consultas Lemmit custam R$ 0,12)
  
  2. Notas
    - A coluna é opcional (nullable) para não quebrar registros existentes
    - Tipo DECIMAL(10,2) permite valores monetários com 2 casas decimais
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_logs' AND column_name = 'cost'
  ) THEN
    ALTER TABLE api_logs ADD COLUMN cost DECIMAL(10,2) DEFAULT 0.00;
  END IF;
END $$;
