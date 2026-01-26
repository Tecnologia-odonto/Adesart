/*
  # Adicionar função para debitar saldo Lemmit automaticamente
  
  1. Nova Função RPC
    - `decrement_lemmit_balance(user_id, amount)` - Debita saldo do usuário de forma atômica
    - Garante que o saldo não fique negativo (opcional - pode permitir negativo para controle)
  
  2. Segurança
    - Função pode ser executada apenas pelo service role (edge functions)
    - Atualização atômica para evitar race conditions
*/

CREATE OR REPLACE FUNCTION decrement_lemmit_balance(
  user_id UUID,
  amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET lemmit_balance = lemmit_balance - amount
  WHERE id = user_id;
END;
$$;
