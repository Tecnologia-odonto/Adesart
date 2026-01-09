/*
  # Create Cadastro Configuration Tables

  1. New Tables
    - `cadastro_planos_map`
      - `id` (uuid, primary key)
      - `plano_id` (int, unique, not null) - ID do plano no ERP
      - `nome_exibicao` (text, not null) - Nome para exibir no select
      - `registro_produto` (text, nullable) - Registro do produto
      - `regra_valor` (text, not null) - Regra para calcular valor: titular|dependente|agregado|fixo|manual
      - `ativo` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `cadastro_parentesco_map`
      - `id` (uuid, primary key)
      - `parentesco_id` (int, unique, not null) - ID do parentesco no ERP
      - `label` (text, not null) - Label para exibir no select
      - `ativo` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - SELECT: todos autenticados
    - INSERT/UPDATE: Administrador, Gerente, Cadastro, Adesionista
    - DELETE: apenas Administrador

  3. Triggers
    - Add updated_at triggers for both tables
*/

-- Create cadastro_planos_map table
CREATE TABLE IF NOT EXISTS cadastro_planos_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id int NOT NULL UNIQUE,
  nome_exibicao text NOT NULL,
  registro_produto text,
  regra_valor text NOT NULL DEFAULT 'titular' CHECK (regra_valor IN ('titular', 'dependente', 'agregado', 'fixo', 'manual')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cadastro_parentesco_map table
CREATE TABLE IF NOT EXISTS cadastro_parentesco_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parentesco_id int NOT NULL UNIQUE,
  label text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_cadastro_planos_map_updated_at ON cadastro_planos_map;
CREATE TRIGGER update_cadastro_planos_map_updated_at
  BEFORE UPDATE ON cadastro_planos_map
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cadastro_parentesco_map_updated_at ON cadastro_parentesco_map;
CREATE TRIGGER update_cadastro_parentesco_map_updated_at
  BEFORE UPDATE ON cadastro_parentesco_map
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE cadastro_planos_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_parentesco_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cadastro_planos_map

-- SELECT: todos autenticados podem visualizar
CREATE POLICY "Authenticated users can view planos map"
  ON cadastro_planos_map
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Administrador, Gerente, Cadastro, Adesionista
CREATE POLICY "Authorized users can insert planos map"
  ON cadastro_planos_map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Administrador', 'Gerente', 'Cadastro', 'Adesionista')
    )
  );

-- UPDATE: Administrador, Gerente, Cadastro, Adesionista
CREATE POLICY "Authorized users can update planos map"
  ON cadastro_planos_map
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Administrador', 'Gerente', 'Cadastro', 'Adesionista')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Administrador', 'Gerente', 'Cadastro', 'Adesionista')
    )
  );

-- DELETE: apenas Administrador
CREATE POLICY "Only Administrador can delete planos map"
  ON cadastro_planos_map
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Administrador'
    )
  );

-- RLS Policies for cadastro_parentesco_map

-- SELECT: todos autenticados podem visualizar
CREATE POLICY "Authenticated users can view parentesco map"
  ON cadastro_parentesco_map
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Administrador, Gerente, Cadastro, Adesionista
CREATE POLICY "Authorized users can insert parentesco map"
  ON cadastro_parentesco_map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Administrador', 'Gerente', 'Cadastro', 'Adesionista')
    )
  );

-- UPDATE: Administrador, Gerente, Cadastro, Adesionista
CREATE POLICY "Authorized users can update parentesco map"
  ON cadastro_parentesco_map
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Administrador', 'Gerente', 'Cadastro', 'Adesionista')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Administrador', 'Gerente', 'Cadastro', 'Adesionista')
    )
  );

-- DELETE: apenas Administrador
CREATE POLICY "Only Administrador can delete parentesco map"
  ON cadastro_parentesco_map
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Administrador'
    )
  );
