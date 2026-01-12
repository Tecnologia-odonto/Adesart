/*
  # Add Lemmit API Usage Control

  1. New Tables
    - `lemmit_consultas`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - User who made the query
      - `cpf` (text) - CPF that was queried
      - `success` (boolean) - Whether the query was successful
      - `response_data` (jsonb) - Response from Lemmit API
      - `error_message` (text) - Error message if failed
      - `created_at` (timestamptz) - When the query was made

  2. Changes to Profiles
    - Add `lemmit_limite_consultas` (integer) - Monthly limit for Lemmit queries (NULL = unlimited)
    - Add `lemmit_consultas_mes_atual` (integer) - Counter for current month queries

  3. Security
    - Enable RLS on `lemmit_consultas` table
    - Admin can view all queries
    - Users can view only their own queries
    - Only authenticated users can access

  4. Indexes
    - Index on user_id and created_at for efficient queries
    - Index on cpf for search functionality

  5. Functions
    - Function to reset monthly counters (can be called by cron job)
*/

-- Create lemmit_consultas table
CREATE TABLE IF NOT EXISTS lemmit_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  success boolean DEFAULT false,
  response_data jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add Lemmit limit fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'lemmit_limite_consultas'
  ) THEN
    ALTER TABLE profiles ADD COLUMN lemmit_limite_consultas integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'lemmit_consultas_mes_atual'
  ) THEN
    ALTER TABLE profiles ADD COLUMN lemmit_consultas_mes_atual integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lemmit_consultas_user_created 
  ON lemmit_consultas(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lemmit_consultas_cpf 
  ON lemmit_consultas(cpf);

CREATE INDEX IF NOT EXISTS idx_lemmit_consultas_created_at 
  ON lemmit_consultas(created_at DESC);

-- Enable RLS
ALTER TABLE lemmit_consultas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lemmit_consultas

-- Admin can view all queries
CREATE POLICY "Admin can view all Lemmit queries"
  ON lemmit_consultas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view only their own queries
CREATE POLICY "Users can view own Lemmit queries"
  ON lemmit_consultas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only the system can insert queries (via service role or function)
CREATE POLICY "Authenticated users can insert Lemmit queries"
  ON lemmit_consultas FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Function to reset monthly counters
CREATE OR REPLACE FUNCTION reset_lemmit_monthly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET lemmit_consultas_mes_atual = 0
  WHERE lemmit_consultas_mes_atual > 0;
END;
$$;

-- Function to increment user's Lemmit counter
CREATE OR REPLACE FUNCTION increment_lemmit_counter(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET lemmit_consultas_mes_atual = COALESCE(lemmit_consultas_mes_atual, 0) + 1
  WHERE id = p_user_id;
END;
$$;

-- Function to check if user can make Lemmit query
CREATE OR REPLACE FUNCTION can_use_lemmit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limite integer;
  v_usado integer;
BEGIN
  SELECT lemmit_limite_consultas, COALESCE(lemmit_consultas_mes_atual, 0)
  INTO v_limite, v_usado
  FROM profiles
  WHERE id = p_user_id;

  -- NULL means unlimited
  IF v_limite IS NULL THEN
    RETURN true;
  END IF;

  -- Check if under limit
  RETURN v_usado < v_limite;
END;
$$;