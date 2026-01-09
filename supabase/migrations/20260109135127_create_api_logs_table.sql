/*
  # Create API Logs Table

  1. New Tables
    - `api_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `user_email` (text) - denormalized for quick access
      - `endpoint` (text) - which endpoint was called
      - `method` (text) - HTTP method
      - `request_body` (jsonb) - request payload
      - `response_body` (jsonb) - response from external API
      - `status_code` (integer) - HTTP status code
      - `success` (boolean) - whether the request was successful
      - `error_message` (text) - error message if failed
      - `duration_ms` (integer) - request duration in milliseconds
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `api_logs` table
    - Only admins can view logs
*/

CREATE TABLE IF NOT EXISTS api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  request_body jsonb,
  response_body jsonb,
  status_code integer,
  success boolean DEFAULT false,
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs"
  ON api_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_success ON api_logs(success);