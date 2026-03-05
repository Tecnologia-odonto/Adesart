/*
  # Criar Triggers para Atualizar Cache de Estatísticas Automaticamente

  1. Função de Atualização
    - `update_stats_cache()` - Recalcula e atualiza stats para um vendedor específico
    - Conta cadastros e dependentes dinamicamente
    - Separa por tipo_cadastro e status

  2. Triggers
    - AFTER INSERT em cadastros
    - AFTER UPDATE em cadastros
    - AFTER DELETE em cadastros

  3. Comportamento
    - Conta o tamanho do array `dependentes` para cada cadastro
    - Agrupa por status (incompleto/enviado)
    - Atualiza ou insere na tabela stats_cache
*/

-- Função para atualizar o cache de estatísticas
CREATE OR REPLACE FUNCTION update_stats_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_tipo_cadastro text;
  v_mes_referencia text;
BEGIN
  -- Determinar user_id e tipo_cadastro do registro afetado
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.vendedor_id;
    v_tipo_cadastro := OLD.tipo_cadastro;
    v_mes_referencia := to_char(OLD.created_at, 'YYYY-MM');
  ELSE
    v_user_id := NEW.vendedor_id;
    v_tipo_cadastro := NEW.tipo_cadastro;
    v_mes_referencia := to_char(NEW.created_at, 'YYYY-MM');
  END IF;

  -- Se não tiver vendedor_id, sair
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalcular e atualizar stats para este vendedor/tipo/mês
  INSERT INTO stats_cache (
    user_id,
    tipo_cadastro,
    mes_referencia,
    total_cadastros,
    pendentes_cadastros,
    cadastrados_cadastros,
    total_dependentes,
    pendentes_dependentes,
    cadastrados_dependentes,
    total_geral,
    pendentes_geral,
    cadastrados_geral,
    updated_at
  )
  SELECT
    v_user_id,
    v_tipo_cadastro,
    v_mes_referencia,
    
    -- Total de cadastros (registros principais)
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
    COUNT(*) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')),
    
    -- Total de dependentes (soma do tamanho dos arrays)
    COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))), 0),
    COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')), 0),
    COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')), 0),
    
    -- Total geral (cadastros + dependentes)
    COUNT(*) + COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))), 0),
    COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')) + COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')), 0),
    COUNT(*) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')) + COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')), 0),
    
    now()
  FROM cadastros
  WHERE vendedor_id = v_user_id
    AND tipo_cadastro = v_tipo_cadastro
    AND to_char(created_at, 'YYYY-MM') = v_mes_referencia
  ON CONFLICT (user_id, tipo_cadastro, mes_referencia)
  DO UPDATE SET
    total_cadastros = EXCLUDED.total_cadastros,
    pendentes_cadastros = EXCLUDED.pendentes_cadastros,
    cadastrados_cadastros = EXCLUDED.cadastrados_cadastros,
    total_dependentes = EXCLUDED.total_dependentes,
    pendentes_dependentes = EXCLUDED.pendentes_dependentes,
    cadastrados_dependentes = EXCLUDED.cadastrados_dependentes,
    total_geral = EXCLUDED.total_geral,
    pendentes_geral = EXCLUDED.pendentes_geral,
    cadastrados_geral = EXCLUDED.cadastrados_geral,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger AFTER INSERT
DROP TRIGGER IF EXISTS trigger_stats_cache_insert ON cadastros;
CREATE TRIGGER trigger_stats_cache_insert
  AFTER INSERT ON cadastros
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_cache();

-- Trigger AFTER UPDATE
DROP TRIGGER IF EXISTS trigger_stats_cache_update ON cadastros;
CREATE TRIGGER trigger_stats_cache_update
  AFTER UPDATE ON cadastros
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.dependentes IS DISTINCT FROM NEW.dependentes OR
    OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id OR
    OLD.tipo_cadastro IS DISTINCT FROM NEW.tipo_cadastro
  )
  EXECUTE FUNCTION update_stats_cache();

-- Trigger AFTER DELETE
DROP TRIGGER IF EXISTS trigger_stats_cache_delete ON cadastros;
CREATE TRIGGER trigger_stats_cache_delete
  AFTER DELETE ON cadastros
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_cache();

-- Função para popular o cache inicial
CREATE OR REPLACE FUNCTION populate_stats_cache()
RETURNS void AS $$
BEGIN
  -- Limpar cache existente
  TRUNCATE stats_cache;

  -- Popular com dados atuais
  INSERT INTO stats_cache (
    user_id,
    tipo_cadastro,
    mes_referencia,
    total_cadastros,
    pendentes_cadastros,
    cadastrados_cadastros,
    total_dependentes,
    pendentes_dependentes,
    cadastrados_dependentes,
    total_geral,
    pendentes_geral,
    cadastrados_geral,
    updated_at
  )
  SELECT
    vendedor_id,
    tipo_cadastro,
    to_char(created_at, 'YYYY-MM') as mes_referencia,
    
    -- Total de cadastros (registros principais)
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')),
    COUNT(*) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')),
    
    -- Total de dependentes (soma do tamanho dos arrays)
    COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))), 0),
    COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')), 0),
    COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')), 0),
    
    -- Total geral (cadastros + dependentes)
    COUNT(*) + COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))), 0),
    COUNT(*) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')) + COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('incompleto', 'adesoes_pendentes')), 0),
    COUNT(*) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')) + COALESCE(SUM(jsonb_array_length(COALESCE(dependentes, '[]'::jsonb))) FILTER (WHERE status IN ('enviado', 'cadastrado', 'erro_envio')), 0),
    
    now()
  FROM cadastros
  WHERE vendedor_id IS NOT NULL
  GROUP BY vendedor_id, tipo_cadastro, to_char(created_at, 'YYYY-MM')
  ON CONFLICT (user_id, tipo_cadastro, mes_referencia)
  DO UPDATE SET
    total_cadastros = EXCLUDED.total_cadastros,
    pendentes_cadastros = EXCLUDED.pendentes_cadastros,
    cadastrados_cadastros = EXCLUDED.cadastrados_cadastros,
    total_dependentes = EXCLUDED.total_dependentes,
    pendentes_dependentes = EXCLUDED.pendentes_dependentes,
    cadastrados_dependentes = EXCLUDED.cadastrados_dependentes,
    total_geral = EXCLUDED.total_geral,
    pendentes_geral = EXCLUDED.pendentes_geral,
    cadastrados_geral = EXCLUDED.cadastrados_geral,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Popular o cache inicial
SELECT populate_stats_cache();
