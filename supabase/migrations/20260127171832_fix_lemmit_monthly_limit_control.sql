/*
  # Corrigir controle de limite mensal Lemmit

  1. Mudanças
    - Altera coluna `lemmit_limite_consultas` de INTEGER para DECIMAL(10,2) para armazenar valores em reais
    - Cria função `get_lemmit_monthly_usage` para calcular consumo do mês atual
    - Atualiza função `can_use_lemmit` para verificar limite mensal ao invés de saldo global
    - Atualiza função `debit_lemmit_balance` para funcionar com o novo sistema

  2. Lógica
    - O campo `lemmit_limite_consultas` agora representa o limite mensal em REAIS (ex: 1.00 = R$ 1,00)
    - A cada consulta (R$ 0,12), verifica:
      - Se o usuário tem limite configurado (NULL = ilimitado)
      - Quanto já foi gasto no mês atual
      - Se há saldo suficiente para fazer a consulta (limite_mensal - gasto_mensal >= custo_consulta)
    - O consumo é registrado na tabela api_logs com o campo cost

  3. Notas
    - Se lemmit_limite_consultas for NULL = consultas ilimitadas
    - Se lemmit_limite_consultas for 0 = sem consultas permitidas
    - O limite é renovado automaticamente todo mês
*/

-- Alterar tipo da coluna lemmit_limite_consultas para DECIMAL
DO $$
BEGIN
  ALTER TABLE profiles
  ALTER COLUMN lemmit_limite_consultas TYPE DECIMAL(10,2);

  UPDATE profiles
  SET lemmit_limite_consultas = lemmit_limite_consultas * 0.12
  WHERE lemmit_limite_consultas IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION get_lemmit_monthly_usage(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_monthly_usage DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(cost), 0)
  INTO v_monthly_usage
  FROM api_logs
  WHERE user_id = p_user_id
    AND endpoint = 'lemit-consulta-pessoa'
    AND success = true
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP);

  RETURN v_monthly_usage;
END;
$$;

DROP FUNCTION IF EXISTS can_use_lemmit(UUID);

CREATE OR REPLACE FUNCTION can_use_lemmit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limite_mensal DECIMAL(10,2);
  v_consumo_mensal DECIMAL(10,2);
  v_lemmit_cost DECIMAL(10,2) := 0.12;
  v_saldo_disponivel DECIMAL(10,2);
BEGIN
  SELECT lemmit_limite_consultas INTO v_limite_mensal
  FROM profiles
  WHERE id = p_user_id;

  IF v_limite_mensal IS NULL THEN
    RETURN TRUE;
  END IF;

  IF v_limite_mensal = 0 THEN
    RETURN FALSE;
  END IF;

  v_consumo_mensal := get_lemmit_monthly_usage(p_user_id);
  v_saldo_disponivel := v_limite_mensal - v_consumo_mensal;

  RETURN v_saldo_disponivel >= v_lemmit_cost;
END;
$$;

DROP FUNCTION IF EXISTS debit_lemmit_balance(UUID, DECIMAL);

CREATE OR REPLACE FUNCTION debit_lemmit_balance(p_user_id UUID, p_amount DECIMAL DEFAULT 0.12)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limite_mensal DECIMAL(10,2);
  v_consumo_mensal DECIMAL(10,2);
  v_saldo_disponivel DECIMAL(10,2);
BEGIN
  SELECT lemmit_limite_consultas INTO v_limite_mensal
  FROM profiles
  WHERE id = p_user_id;

  IF v_limite_mensal IS NULL THEN
    RETURN TRUE;
  END IF;

  IF v_limite_mensal = 0 THEN
    RETURN FALSE;
  END IF;

  v_consumo_mensal := get_lemmit_monthly_usage(p_user_id);
  v_saldo_disponivel := v_limite_mensal - v_consumo_mensal;

  IF v_saldo_disponivel < p_amount THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION get_lemmit_limit_info(p_user_id UUID)
RETURNS TABLE(
  limite_mensal DECIMAL(10,2),
  consumo_mensal DECIMAL(10,2),
  saldo_disponivel DECIMAL(10,2),
  pode_consultar BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limite DECIMAL(10,2);
  v_consumo DECIMAL(10,2);
  v_saldo DECIMAL(10,2);
  v_pode BOOLEAN;
BEGIN
  SELECT lemmit_limite_consultas INTO v_limite
  FROM profiles
  WHERE id = p_user_id;

  v_consumo := get_lemmit_monthly_usage(p_user_id);

  IF v_limite IS NULL THEN
    v_saldo := NULL;
    v_pode := TRUE;
  ELSE
    v_saldo := v_limite - v_consumo;
    v_pode := v_saldo >= 0.12;
  END IF;

  RETURN QUERY SELECT v_limite, v_consumo, v_saldo, v_pode;
END;
$$;
