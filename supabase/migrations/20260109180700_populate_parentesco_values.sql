/*
  # Populate Parentesco Values

  1. Changes
    - Deletes any existing parentesco data
    - Inserts all the correct parentesco values with their IDs and labels
  
  2. Parentesco Values
    - 1: TITULAR
    - 3: CONJUGE/COMPANHEIRO
    - 4: FILHO
    - 6: ENTEADO
    - 8: PAI/MAE
    - 10: AGREGADOS/OUTROS
    - 11: IRMÃO(Ã)
    - 12: NETO(A)
    - 13: BISNETO(A)
    - 14: EX-CÔNJUGE
    - 15: SOGRA
*/

-- Delete existing data
DELETE FROM cadastro_parentesco_map;

-- Insert all parentesco values
INSERT INTO cadastro_parentesco_map (parentesco_id, label, ativo) VALUES
  (1, 'TITULAR', true),
  (3, 'CONJUGE/COMPANHEIRO', true),
  (4, 'FILHO', true),
  (6, 'ENTEADO', true),
  (8, 'PAI/MAE', true),
  (10, 'AGREGADOS/OUTROS', true),
  (11, 'IRMÃO(Ã)', true),
  (12, 'NETO(A)', true),
  (13, 'BISNETO(A)', true),
  (14, 'EX-CÔNJUGE', true),
  (15, 'SOGRA', true);
