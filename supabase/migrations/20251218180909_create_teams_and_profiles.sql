/*
  # Create Teams and Profiles Tables for Adesao+ ERP

  ## Summary
  Creates the core tables for the user and team management system with RBAC support.

  ## New Tables

  ### `teams`
  - `id` (uuid, primary key) - Auto-generated team identifier
  - `name` (text, unique, not null) - Team name
  - `is_active` (boolean, default true) - Whether team is active
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `profiles`
  - `id` (uuid, primary key) - References auth.users(id), cascades on delete
  - `name` (text, not null) - User full name
  - `email` (text, unique, not null) - User email (mirrors auth.users)
  - `role` (text, not null) - User role: ADMINISTRADOR, GERENTE, SUPERVISOR, VENDEDOR, ADESIONISTA
  - `external_id` (text, nullable) - External system identifier (required for SUPERVISOR, VENDEDOR, ADESIONISTA)
  - `team_id` (uuid, nullable) - References teams(id), required for SUPERVISOR, VENDEDOR, ADESIONISTA
  - `is_active` (boolean, default true) - Whether user is active
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ## Constraints
  1. Role validation: Only accepts valid role types
  2. Business rules enforced via check constraints:
     - VENDEDOR/ADESIONISTA require both team_id and external_id
     - SUPERVISOR requires both team_id and external_id
     - ADMINISTRADOR/GERENTE should not have team_id or external_id

  ## Security
  - RLS will be enabled on both tables
  - Policies will be created in subsequent migrations
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMINISTRADOR', 'GERENTE', 'SUPERVISOR', 'VENDEDOR', 'ADESIONISTA')),
  external_id text,
  team_id uuid REFERENCES teams(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Business rule constraints
  CONSTRAINT vendedor_adesionista_requires_team_and_external CHECK (
    (role NOT IN ('VENDEDOR', 'ADESIONISTA')) OR 
    (team_id IS NOT NULL AND external_id IS NOT NULL)
  ),
  CONSTRAINT supervisor_requires_team_and_external CHECK (
    (role != 'SUPERVISOR') OR 
    (team_id IS NOT NULL AND external_id IS NOT NULL)
  ),
  CONSTRAINT admin_gerente_no_team CHECK (
    (role NOT IN ('ADMINISTRADOR', 'GERENTE')) OR 
    (team_id IS NULL AND external_id IS NULL)
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();