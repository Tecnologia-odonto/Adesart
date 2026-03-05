/*
  # Criar Tabela de Cache de Estatísticas

  1. Nova Tabela
    - `stats_cache` - Armazena estatísticas em tempo real
      - `id` (uuid, primary key)
      - `user_id` (uuid, referência para profiles)
      - `tipo_cadastro` (text) - 'cadastro' ou 'inclusao_dependente'
      - `total_cadastros` (integer) - Total de registros principais
      - `total_dependentes` (integer) - Soma do tamanho dos arrays dependentes
      - `total_geral` (integer) - total_cadastros + total_dependentes
      - `pendentes_cadastros` (integer)
      - `pendentes_dependentes` (integer)
      - `pendentes_geral` (integer)
      - `cadastrados_cadastros` (integer)
      - `cadastrados_dependentes` (integer)
      - `cadastrados_geral` (integer)
      - `mes_referencia` (text) - 'YYYY-MM'
      - `updated_at` (timestamp)

  2. Índices
    - Índice composto em (user_id, tipo_cadastro, mes_referencia)
    - Índice em mes_referencia para cleanup

  3. Segurança
    - RLS habilitado
    - Políticas baseadas em role e team_id
*/

-- Criar tabela de cache de estatísticas
CREATE TABLE IF NOT EXISTS stats_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo_cadastro text NOT NULL CHECK (tipo_cadastro IN ('cadastro', 'inclusao_dependente')),

  -- Contadores de cadastros (registros principais)
  total_cadastros integer NOT NULL DEFAULT 0,
  pendentes_cadastros integer NOT NULL DEFAULT 0,
  cadastrados_cadastros integer NOT NULL DEFAULT 0,

  -- Contadores de dependentes (tamanho dos arrays)
  total_dependentes integer NOT NULL DEFAULT 0,
  pendentes_dependentes integer NOT NULL DEFAULT 0,
  cadastrados_dependentes integer NOT NULL DEFAULT 0,

  -- Contadores gerais (cadastros + dependentes)
  total_geral integer NOT NULL DEFAULT 0,
  pendentes_geral integer NOT NULL DEFAULT 0,
  cadastrados_geral integer NOT NULL DEFAULT 0,

  mes_referencia text NOT NULL,
  updated_at timestamptz DEFAULT now(),

  UNIQUE(user_id, tipo_cadastro, mes_referencia)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stats_cache_user_tipo_mes
  ON stats_cache(user_id, tipo_cadastro, mes_referencia);

CREATE INDEX IF NOT EXISTS idx_stats_cache_mes
  ON stats_cache(mes_referencia);

CREATE INDEX IF NOT EXISTS idx_stats_cache_user
  ON stats_cache(user_id);

-- Habilitar RLS
ALTER TABLE stats_cache ENABLE ROW LEVEL SECURITY;

-- Política para ADMINISTRADOR - ver todos
CREATE POLICY "Administradores podem ver todas as stats"
  ON stats_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

-- Política para GERENTE - ver seu team
CREATE POLICY "Gerentes podem ver stats do seu time"
  ON stats_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      INNER JOIN profiles p2 ON p1.team_id = p2.team_id
      WHERE p1.id = auth.uid()
      AND p1.role = 'GERENTE'
      AND p2.id = stats_cache.user_id
    )
  );

-- Política para SUPERVISOR - ver seu team
CREATE POLICY "Supervisores podem ver stats do seu time"
  ON stats_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      INNER JOIN profiles p2 ON p1.team_id = p2.team_id
      WHERE p1.id = auth.uid()
      AND p1.role = 'SUPERVISOR'
      AND p2.id = stats_cache.user_id
    )
  );

-- Política para VENDEDOR e ADESIONISTA - ver apenas suas próprias
CREATE POLICY "Usuários podem ver suas próprias stats"
  ON stats_cache FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Sistema pode inserir e atualizar
CREATE POLICY "Sistema pode inserir stats"
  ON stats_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar stats"
  ON stats_cache FOR UPDATE
  TO authenticated
  USING (true);
