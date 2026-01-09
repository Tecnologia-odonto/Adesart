/*
  # Enable Realtime for cadastro_config table

  1. Configuration
    - Enable replica identity FULL for cadastro_config table
    - This allows Supabase Realtime to broadcast all changes to subscribed clients
    
  2. Purpose
    - Ensures all users see configuration changes in real-time
    - When one user toggles a setting, all other users receive the update immediately
*/

-- Enable replica identity for realtime updates
ALTER TABLE cadastro_config REPLICA IDENTITY FULL;
