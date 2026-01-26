/*
  # Adicionar sistema de saldo Lemmit

  1. Mudanças
    - Adiciona coluna `lemmit_balance` (decimal) na tabela `profiles`
    - Define valor padrão como 20.00 (R$ 20,00)
    - Atualiza todos os usuários existentes com saldo inicial de R$ 20,00
    - Remove a função antiga can_use_lemmit
    - Cria nova função can_use_lemmit que verifica saldo
    - Cria função debit_lemmit_balance para debitar saldo
    - Remove função increment_lemmit_counter (não mais necessária)
  
  2. Notas
    - Cada consulta Lemmit custa R$ 0,12
    - Usuários podem ter saldo aumentado ou diminuído manualmente
    - O saldo é verificado antes de permitir consulta
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'lemmit_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN lemmit_balance DECIMAL(10,2) DEFAULT 20.00;
    UPDATE profiles SET lemmit_balance = 20.00 WHERE lemmit_balance IS NULL;
  END IF;
END $$;

DROP FUNCTION IF EXISTS can_use_lemmit(UUID);
DROP FUNCTION IF EXISTS increment_lemmit_counter(UUID);

CREATE OR REPLACE FUNCTION can_use_lemmit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance DECIMAL(10,2);
  v_lemmit_cost DECIMAL(10,2) := 0.12;
BEGIN
  SELECT lemmit_balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_balance IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN v_balance >= v_lemmit_cost;
END;
$$;

CREATE OR REPLACE FUNCTION debit_lemmit_balance(p_user_id UUID, p_amount DECIMAL DEFAULT 0.12)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
BEGIN
  SELECT lemmit_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  UPDATE profiles
  SET lemmit_balance = lemmit_balance - p_amount
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$;
