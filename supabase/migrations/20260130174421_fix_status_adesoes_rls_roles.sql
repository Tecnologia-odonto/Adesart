/*
  # Corrigir RLS de Status de Adesões

  1. Problema
    - As políticas RLS verificavam roles 'ADMIN' e 'GESTOR' que não existem
    - Os roles corretos no sistema são 'ADMINISTRADOR' e 'GERENTE'
    
  2. Alterações
    - Drop e recriação das políticas com os roles corretos
    - Mantém permissões apenas para ADMINISTRADOR e GERENTE
    
  3. Segurança
    - Todos autenticados podem visualizar (SELECT)
    - Apenas ADMINISTRADOR e GERENTE podem criar (INSERT)
    - Apenas ADMINISTRADOR e GERENTE podem atualizar (UPDATE)
    - Apenas ADMINISTRADOR e GERENTE podem excluir (DELETE)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Apenas ADMIN e GESTOR podem criar status" ON status_adesoes;
DROP POLICY IF EXISTS "Apenas ADMIN e GESTOR podem atualizar status" ON status_adesoes;
DROP POLICY IF EXISTS "Apenas ADMIN e GESTOR podem excluir status" ON status_adesoes;

-- Recreate with correct roles
CREATE POLICY "Apenas ADMINISTRADOR e GERENTE podem criar status"
  ON status_adesoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'GERENTE')
    )
  );

CREATE POLICY "Apenas ADMINISTRADOR e GERENTE podem atualizar status"
  ON status_adesoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'GERENTE')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'GERENTE')
    )
  );

CREATE POLICY "Apenas ADMINISTRADOR e GERENTE podem excluir status"
  ON status_adesoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'GERENTE')
    )
  );
