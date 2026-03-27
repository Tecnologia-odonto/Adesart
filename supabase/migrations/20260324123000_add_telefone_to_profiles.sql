/*
  # Add telefone to profiles

  ## Summary
  Adds an optional cellphone field to user profiles.
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telefone text;
