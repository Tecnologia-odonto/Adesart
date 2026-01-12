/*
  # Adicionar validações de situações e planos
  
  1. Alterações
    - Adicionar coluna `situacoes_que_barram` na tabela `cadastro_config`
      - Array de inteiros com códigos de situação que bloqueiam cadastro
      - Padrão: [1, 4, 6]
    - Adicionar coluna `planos_validos` na tabela `cadastro_config`
      - Array de inteiros com códigos de planos válidos
      - Padrão: [4, 11, 3, 26]
  
  2. Notas
    - Estas configurações são usadas para validar se um associado pode ser recadastrado
    - Se codigoSituacao estiver em situacoes_que_barram, bloqueia
    - Se codigoPlano não estiver em planos_validos, bloqueia
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastro_config' AND column_name = 'situacoes_que_barram'
  ) THEN
    ALTER TABLE cadastro_config ADD COLUMN situacoes_que_barram integer[] DEFAULT '{1,4,6}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastro_config' AND column_name = 'planos_validos'
  ) THEN
    ALTER TABLE cadastro_config ADD COLUMN planos_validos integer[] DEFAULT '{4,11,3,26}';
  END IF;
END $$;