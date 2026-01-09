/*
  # Allow ADMINISTRADOR and GERENTE to have external_id
  
  1. Changes
    - Drops the constraint that prevents ADMINISTRADOR/GERENTE from having external_id
    - Adds new constraint that only prevents ADMINISTRADOR/GERENTE from having team_id
    - This allows admins to register with an external_id for system integration
  
  2. Security
    - Maintains the business rule that ADMINISTRADOR/GERENTE cannot have team_id
    - Allows external_id for all roles (required for ERP integration)
*/

-- Drop the old constraint that prevents admin/gerente from having external_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS admin_gerente_no_team;

-- Add new constraint that only prevents admin/gerente from having team_id
ALTER TABLE profiles ADD CONSTRAINT admin_gerente_no_team CHECK (
  (role NOT IN ('ADMINISTRADOR', 'GERENTE')) OR 
  (team_id IS NULL)
);