/*
  # Corrigir políticas RLS duplicadas para cadastros
  
  1. Problema Identificado
    - Existem políticas duplicadas para os mesmos perfis (ADMINISTRADOR, CADASTRO)
    - Algumas políticas usam EXISTS direto, outras usam get_my_profile()
    - Isso pode estar causando conflito e bloqueando o acesso
  
  2. Solução
    - Remover todas as políticas duplicadas que usam get_my_profile()
    - Manter apenas as políticas simples que usam EXISTS direto
    - Garantir que ADMINISTRADOR tenha acesso total
  
  3. Políticas Removidas
    - "Cadastro users can view all cadastros" (duplicada)
    - "Cadastro users can insert cadastros" (duplicada)
    - "Cadastro users can update all cadastros" (duplicada)
  
  4. Políticas Mantidas
    - Administrador, Gerente, Supervisor, Vendedor, Adesionista, Cadastro (versões simples)
*/

-- Remover políticas duplicadas que usam get_my_profile()
DROP POLICY IF EXISTS "Cadastro users can view all cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro users can insert cadastros" ON cadastros;
DROP POLICY IF EXISTS "Cadastro users can update all cadastros" ON cadastros;

-- Garantir que as políticas principais existem e estão corretas
-- (Se já existem, isso não fará nada; se não existem, as criará)

-- SELECT policies
DO $$ 
BEGIN
  -- Administrador
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastros' 
    AND policyname = 'Administrador can view all cadastros'
  ) THEN
    CREATE POLICY "Administrador can view all cadastros"
      ON cadastros FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'ADMINISTRADOR'
        )
      );
  END IF;

  -- Gerente
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastros' 
    AND policyname = 'Gerente can view all cadastros'
  ) THEN
    CREATE POLICY "Gerente can view all cadastros"
      ON cadastros FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'GERENTE'
        )
      );
  END IF;

  -- Cadastro
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastros' 
    AND policyname = 'Cadastro can view all cadastros'
  ) THEN
    CREATE POLICY "Cadastro can view all cadastros"
      ON cadastros FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'CADASTRO'
        )
      );
  END IF;

  -- Adesionista
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cadastros' 
    AND policyname = 'Adesionista can view all cadastros'
  ) THEN
    CREATE POLICY "Adesionista can view all cadastros"
      ON cadastros FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'ADESIONISTA'
        )
      );
  END IF;
END $$;
