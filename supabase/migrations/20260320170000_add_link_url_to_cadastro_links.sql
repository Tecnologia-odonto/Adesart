/*
  # Persistir URL do link em cadastro_links

  1. Objetivo
    - Permitir listagem e reutilizacao operacional dos links gerados
    - Manter historico por empresa na UI

  2. Alteracoes
    - Adiciona coluna `link_url` na tabela `cadastro_links`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cadastro_links' AND column_name = 'link_url'
  ) THEN
    ALTER TABLE cadastro_links ADD COLUMN link_url text;
  END IF;
END $$;

COMMENT ON COLUMN cadastro_links.link_url IS 'URL publica gerada para o fluxo de adesao por link. Pode ser nula para links legados.';
