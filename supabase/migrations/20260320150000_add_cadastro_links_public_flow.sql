/*
  # Fluxo publico de cadastro por link

  1. Nova tabela `cadastro_links`
    - Armazena links unicos vinculados ao vendedor e a empresa
    - Salva apenas o hash do token para nao persistir o segredo em texto puro
    - Permite invalidacao e consumo unico apos cadastro concluido

  2. Novas colunas em `cadastros`
    - `origem_link_id`: referencia ao link que originou o cadastro
    - `fluxo_publico`: identifica cadastros enviados sem autenticacao

  3. RLS
    - Usuarios autenticados podem gerenciar apenas seus links ou links permitidos pelo role
    - Tabelas de configuracao passam a permitir SELECT anon para o fluxo publico
*/

CREATE TABLE IF NOT EXISTS cadastro_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  empresa_codigo integer NOT NULL,
  empresa_nome text NOT NULL,
  empresa_cnpj text,
  empresa_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  empresa_exige_matricula integer NOT NULL DEFAULT 0,
  planos_raw jsonb NOT NULL DEFAULT '[]'::jsonb,
  vendedor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  vendedor_codigo text NOT NULL,
  vendedor_nome text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  used_at timestamptz,
  used_cpf text,
  used_cadastro_id uuid REFERENCES cadastros(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cadastro_links_created_by_idx ON cadastro_links(created_by);
CREATE INDEX IF NOT EXISTS cadastro_links_team_id_idx ON cadastro_links(team_id);
CREATE INDEX IF NOT EXISTS cadastro_links_vendedor_id_idx ON cadastro_links(vendedor_id);
CREATE INDEX IF NOT EXISTS cadastro_links_used_at_idx ON cadastro_links(used_at);
CREATE INDEX IF NOT EXISTS cadastro_links_empresa_codigo_idx ON cadastro_links(empresa_codigo);

DROP TRIGGER IF EXISTS update_cadastro_links_updated_at ON cadastro_links;
CREATE TRIGGER update_cadastro_links_updated_at
  BEFORE UPDATE ON cadastro_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE cadastro_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Gerente/Cadastro/Adesionista view all cadastro links" ON cadastro_links;
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista view all cadastro links"
  ON cadastro_links FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  );

DROP POLICY IF EXISTS "Supervisor view team cadastro links" ON cadastro_links;
CREATE POLICY "Supervisor view team cadastro links"
  ON cadastro_links FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERVISOR'
    AND team_id::text = auth.jwt() -> 'app_metadata' ->> 'team_id'
  );

DROP POLICY IF EXISTS "Vendedor view own cadastro links" ON cadastro_links;
CREATE POLICY "Vendedor view own cadastro links"
  ON cadastro_links FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can insert cadastro links" ON cadastro_links;
CREATE POLICY "Authenticated users can insert cadastro links"
  ON cadastro_links FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Admin/Gerente/Cadastro/Adesionista update all cadastro links" ON cadastro_links;
CREATE POLICY "Admin/Gerente/Cadastro/Adesionista update all cadastro links"
  ON cadastro_links FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  )
  WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('ADMINISTRADOR', 'GERENTE', 'CADASTRO', 'ADESIONISTA')
  );

DROP POLICY IF EXISTS "Supervisor update team cadastro links" ON cadastro_links;
CREATE POLICY "Supervisor update team cadastro links"
  ON cadastro_links FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERVISOR'
    AND team_id::text = auth.jwt() -> 'app_metadata' ->> 'team_id'
  )
  WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERVISOR'
    AND team_id::text = auth.jwt() -> 'app_metadata' ->> 'team_id'
  );

DROP POLICY IF EXISTS "Vendedor update own cadastro links" ON cadastro_links;
CREATE POLICY "Vendedor update own cadastro links"
  ON cadastro_links FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  )
  WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'VENDEDOR'
    AND (created_by = auth.uid() OR vendedor_id = auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'origem_link_id'
  ) THEN
    ALTER TABLE cadastros
      ADD COLUMN origem_link_id uuid REFERENCES cadastro_links(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastros' AND column_name = 'fluxo_publico'
  ) THEN
    ALTER TABLE cadastros
      ADD COLUMN fluxo_publico boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cadastros_origem_link_id_idx ON cadastros(origem_link_id);
CREATE INDEX IF NOT EXISTS cadastros_fluxo_publico_idx ON cadastros(fluxo_publico);

DROP POLICY IF EXISTS "Anon users can view config" ON cadastro_config;
CREATE POLICY "Anon users can view config"
  ON cadastro_config FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon users can view planos map" ON cadastro_planos_map;
CREATE POLICY "Anon users can view planos map"
  ON cadastro_planos_map FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon users can view parentesco map" ON cadastro_parentesco_map;
CREATE POLICY "Anon users can view parentesco map"
  ON cadastro_parentesco_map FOR SELECT
  TO anon
  USING (true);

COMMENT ON TABLE cadastro_links IS 'Links publicos de cadastro vinculados ao vendedor e a empresa. O token e persistido apenas como hash.';
COMMENT ON COLUMN cadastros.origem_link_id IS 'Link publico que originou o cadastro, quando aplicavel.';
COMMENT ON COLUMN cadastros.fluxo_publico IS 'Indica que o cadastro foi concluido por meio de um link publico sem login.';
