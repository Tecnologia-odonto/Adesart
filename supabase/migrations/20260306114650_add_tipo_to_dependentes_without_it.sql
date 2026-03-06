/*
  # Adicionar campo tipo aos dependentes que não possuem

  1. Problema Identificado
    - Alguns registros de cadastros têm dependentes sem o campo `tipo`
    - Isso causa erro "Cannot read properties of null (reading 'toString')" ao editar
    - Total de 20 registros afetados

  2. Solução
    - Adicionar campo `tipo: 3` a todos os dependentes que não possuem esse campo
    - O valor 3 representa um parentesco padrão seguro

  3. Detalhes Técnicos
    - Atualiza o array JSONB `dependentes` 
    - Adiciona `tipo: 3` apenas onde o campo não existe
    - Mantém todos os outros campos intactos
*/

-- Atualizar dependentes sem campo tipo, adicionando tipo: 3
UPDATE cadastros
SET dependentes = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'tipo' IS NULL 
      THEN elem || jsonb_build_object('tipo', 3)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(dependentes) AS elem
)
WHERE dependentes IS NOT NULL 
  AND dependentes::text != '[]'
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(dependentes) AS dep
    WHERE dep->>'tipo' IS NULL
  );
