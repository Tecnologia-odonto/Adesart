/*
  # Adicionar campo código do contrato

  1. Alterações
    - Adicionar coluna `codigo_contrato` na tabela `cadastros`
      - String opcional para armazenar o código do contrato do responsável financeiro
  
  2. Notas
    - Este campo será digitado pelo usuário e enviado no payload do ERP
    - Substitui o uso automático do empresaId como codigoContrato
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'codigo_contrato'
  ) THEN
    ALTER TABLE cadastros ADD COLUMN codigo_contrato text;
  END IF;
END $$;