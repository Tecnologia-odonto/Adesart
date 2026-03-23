/*
  # Métricas de acesso para links públicos

  1. Alterações
    - Adiciona contador total de cliques/acessos válidos do link
    - Adiciona timestamp do último acesso contabilizado
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cadastro_links' AND column_name = 'click_count'
  ) THEN
    ALTER TABLE cadastro_links
      ADD COLUMN click_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cadastro_links' AND column_name = 'last_clicked_at'
  ) THEN
    ALTER TABLE cadastro_links
      ADD COLUMN last_clicked_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cadastro_links_click_count_idx ON cadastro_links(click_count);
CREATE INDEX IF NOT EXISTS cadastro_links_last_clicked_at_idx ON cadastro_links(last_clicked_at DESC);

COMMENT ON COLUMN cadastro_links.click_count IS 'Total de acessos válidos contabilizados no link público.';
COMMENT ON COLUMN cadastro_links.last_clicked_at IS 'Data/hora do último acesso válido contabilizado no link público.';
