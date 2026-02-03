/*
  # Permitir cadastro_id NULL na fila de upload

  1. Alteração
    - Tornar cadastro_id nullable na tabela erp_upload_queue
    - Isso permite enfileirar uploads de dependentes que não têm um cadastro associado

  2. Motivo
    - No fluxo de inclusão de dependentes, não criamos um registro na tabela cadastros
    - Apenas criamos o dependente diretamente no ERP
    - Precisamos permitir que o upload do documento seja enfileirado mesmo sem cadastro_id
*/

-- Remover a constraint NOT NULL de cadastro_id
ALTER TABLE erp_upload_queue 
  ALTER COLUMN cadastro_id DROP NOT NULL;
