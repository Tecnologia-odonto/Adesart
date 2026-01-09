/*
  # Create Cadastros Module
  
  1. Tables
    - Update `profiles` role check constraint to include 'CADASTRO'
    - Create `cadastros` table for storing incomplete and completed registrations
  
  2. Cadastros Table Columns
    - `id` (uuid, primary key)
    - `status` (text) - 'incompleto', 'enviado', 'erro_envio'
    - `created_by` (uuid) - references profiles(id)
    - `team_id` (uuid) - references teams(id), copied from profile
    - `cpf` (text) - CPF number
    - `nome` (text) - Full name
    - `data_nascimento` (date) - Birth date
    - `sexo` (text) - Gender text (M/F)
    - `sexo_codigo` (integer) - Gender code for ERP (1=M, 2=F)
    - `contatos` (jsonb) - Selected contacts (phones/emails)
    - `endereco` (jsonb) - Address data
    - `lemit_raw` (jsonb) - Full Lemit API response
    - `cliente_sera_usuario` (boolean) - Client will be user flag
    - `payload_erp` (jsonb) - Final payload sent to ERP
    - `erp_response` (jsonb) - ERP API response
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  3. Security
    - Enable RLS on `cadastros` table
    - Create policies for each role:
      * Administrador: full access (select, insert, update, delete)
      * Gerente: select, insert, update (no delete)
      * Cadastro/Adesionista: select, insert, update (no delete)
      * Supervisor: select, insert, update own team only (no delete)
      * Vendedor: select, insert, update own records only (no delete)
  
  4. Triggers
    - Auto-update `updated_at` timestamp on cadastros
*/

-- Update profiles role check constraint to include CADASTRO
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ADMINISTRADOR', 'GERENTE', 'SUPERVISOR', 'CADASTRO', 'VENDEDOR', 'ADESIONISTA'));

-- Create cadastros table
CREATE TABLE IF NOT EXISTS cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'incompleto' 
    CHECK (status IN ('incompleto', 'enviado', 'erro_envio')),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  cpf text NOT NULL,
  nome text,
  data_nascimento date,
  sexo text,
  sexo_codigo integer,
  contatos jsonb DEFAULT '[]'::jsonb,
  endereco jsonb DEFAULT '{}'::jsonb,
  lemit_raw jsonb DEFAULT '{}'::jsonb,
  cliente_sera_usuario boolean NOT NULL DEFAULT true,
  payload_erp jsonb DEFAULT '{}'::jsonb,
  erp_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS cadastros_created_by_idx ON cadastros(created_by);
CREATE INDEX IF NOT EXISTS cadastros_team_id_idx ON cadastros(team_id);
CREATE INDEX IF NOT EXISTS cadastros_status_idx ON cadastros(status);
CREATE INDEX IF NOT EXISTS cadastros_cpf_idx ON cadastros(cpf);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cadastros
DROP TRIGGER IF EXISTS update_cadastros_updated_at ON cadastros;
CREATE TRIGGER update_cadastros_updated_at
  BEFORE UPDATE ON cadastros
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE cadastros ENABLE ROW LEVEL SECURITY;

-- RLS Policies for SELECT
CREATE POLICY "Administrador can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

CREATE POLICY "Gerente can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
    )
  );

CREATE POLICY "Cadastro can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
    )
  );

CREATE POLICY "Adesionista can view all cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
    )
  );

CREATE POLICY "Supervisor can view team cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
      AND profiles.team_id = cadastros.team_id
    )
  );

CREATE POLICY "Vendedor can view own cadastros"
  ON cadastros FOR SELECT
  TO authenticated
  USING (cadastros.created_by = auth.uid());

-- RLS Policies for INSERT
CREATE POLICY "Administrador can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

CREATE POLICY "Gerente can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
    )
  );

CREATE POLICY "Cadastro can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
    )
  );

CREATE POLICY "Adesionista can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
    )
  );

CREATE POLICY "Supervisor can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
    )
  );

CREATE POLICY "Vendedor can insert cadastros"
  ON cadastros FOR INSERT
  TO authenticated
  WITH CHECK (cadastros.created_by = auth.uid());

-- RLS Policies for UPDATE
CREATE POLICY "Administrador can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

CREATE POLICY "Gerente can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENTE'
    )
  );

CREATE POLICY "Cadastro can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CADASTRO'
    )
  );

CREATE POLICY "Adesionista can update all cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADESIONISTA'
    )
  );

CREATE POLICY "Supervisor can update team cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
      AND profiles.team_id = cadastros.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPERVISOR'
      AND profiles.team_id = cadastros.team_id
    )
  );

CREATE POLICY "Vendedor can update own cadastros"
  ON cadastros FOR UPDATE
  TO authenticated
  USING (cadastros.created_by = auth.uid())
  WITH CHECK (cadastros.created_by = auth.uid());

-- RLS Policies for DELETE (only Administrador)
CREATE POLICY "Only Administrador can delete cadastros"
  ON cadastros FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );
