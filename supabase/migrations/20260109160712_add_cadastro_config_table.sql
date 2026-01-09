/*
  # Add Cadastro Global Config Table

  1. New Tables
    - `cadastro_config`
      - `id` (int, primary key, always 1) - Singleton configuration
      - `ativar_lemmit` (boolean, default true) - Enable/disable Lemmit consultation
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Initial Data
    - Insert default configuration with ativar_lemmit = true

  3. Security
    - Enable RLS on the table
    - SELECT: all authenticated users can view
    - UPDATE: Administrador, Gerente, Cadastro, Adesionista
    - No INSERT or DELETE (singleton pattern)

  4. Triggers
    - Add updated_at trigger
*/

-- Create cadastro_config table
CREATE TABLE IF NOT EXISTS cadastro_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativar_lemmit boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default configuration
INSERT INTO cadastro_config (id, ativar_lemmit)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_cadastro_config_updated_at ON cadastro_config;
CREATE TRIGGER update_cadastro_config_updated_at
  BEFORE UPDATE ON cadastro_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE cadastro_config ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can view
CREATE POLICY "Authenticated users can view config"
  ON cadastro_config
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: Administrador, Gerente, Cadastro, Adesionista
CREATE POLICY "Authorized users can update config"
  ON cadastro_config
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