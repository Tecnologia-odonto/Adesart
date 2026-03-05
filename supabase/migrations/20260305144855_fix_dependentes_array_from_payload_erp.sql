/*
  # Corrigir array dependentes em cadastros enviados

  1. Problema Identificado
    - Cadastros enviados ao ERP têm array `dependentes` incompleto
    - O array `dependentes` só contém o titular (1 pessoa)
    - Mas o `payload_erp.dados.dependente` contém todas as pessoas (titular + dependentes)
    - Isso causa contagem incorreta nas estatísticas

  2. Causa Raiz
    - Ao enviar para o ERP, o código sobrescrevia `dependentes` com `payload.dados.dependente`
    - Mas esse array estava em formato ERP com CPF formatado e data no formato DD/MM/YYYY
    - Deveria ser convertido para o formato interno do sistema

  3. Solução
    - Atualizar o array `dependentes` de todos os cadastros enviados
    - Usar o array `payload_erp.dados.dependente` como fonte de verdade
    - Converter para o formato interno (CPF sem máscara, data em formato ISO)
    - Isso garante que as estatísticas fiquem corretas

  4. Importante
    - Apenas cadastros com status 'enviado' serão corrigidos
    - Apenas cadastros que têm `payload_erp` válido
    - Array dependentes será reconstruído a partir do payload ERP
*/

-- Função para corrigir o array de dependentes
CREATE OR REPLACE FUNCTION fix_dependentes_from_payload()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_cadastro RECORD;
  v_dependentes_payload jsonb;
  v_dependentes_corrigidos jsonb;
  v_dep jsonb;
  v_cpf text;
  v_data_nascimento text;
  v_total_corrigidos integer := 0;
BEGIN
  -- Percorrer todos os cadastros enviados que têm payload_erp
  FOR v_cadastro IN 
    SELECT id, payload_erp
    FROM cadastros
    WHERE status = 'enviado'
      AND payload_erp IS NOT NULL
      AND payload_erp->'dados'->'dependente' IS NOT NULL
      AND jsonb_typeof(payload_erp->'dados'->'dependente') = 'array'
  LOOP
    BEGIN
      v_dependentes_payload := v_cadastro.payload_erp->'dados'->'dependente';
      v_dependentes_corrigidos := '[]'::jsonb;

      -- Converter cada dependente do formato ERP para formato interno
      FOR v_dep IN SELECT * FROM jsonb_array_elements(v_dependentes_payload)
      LOOP
        -- Limpar CPF (remover pontos, traços e espaços)
        v_cpf := COALESCE(v_dep->>'cpf', '');
        v_cpf := regexp_replace(v_cpf, '[^0-9]', '', 'g');

        -- Converter data de DD/MM/YYYY para YYYY-MM-DD
        v_data_nascimento := COALESCE(v_dep->>'dataNascimento', '');
        IF v_data_nascimento ~ '^\d{2}/\d{2}/\d{4}$' THEN
          v_data_nascimento := 
            substring(v_data_nascimento from 7 for 4) || '-' ||
            substring(v_data_nascimento from 4 for 2) || '-' ||
            substring(v_data_nascimento from 1 for 2);
        END IF;

        -- Adicionar dependente formatado ao array
        v_dependentes_corrigidos := v_dependentes_corrigidos || jsonb_build_object(
          'cpf', v_cpf,
          'nome', COALESCE(v_dep->>'nome', ''),
          'dataNascimento', v_data_nascimento,
          'sexo', COALESCE((v_dep->>'sexo')::integer, 0),
          'sexoDescricao', COALESCE(v_dep->>'sexoDescricao', ''),
          'tipo', COALESCE((v_dep->>'tipo')::integer, 0),
          'plano', COALESCE((v_dep->>'plano')::integer, 0),
          'planoValor', COALESCE(v_dep->>'planoValor', '0,00'),
          'nomeMae', COALESCE(v_dep->>'nomeMae', ''),
          'carenciaAtendimento', COALESCE((v_dep->>'carenciaAtendimento')::integer, 0),
          'funcionarioCadastro', COALESCE((v_dep->>'funcionarioCadastro')::integer, 0)
        );
      END LOOP;

      -- Atualizar apenas se o array corrigido for diferente do atual
      IF jsonb_array_length(v_dependentes_corrigidos) > 0 THEN
        UPDATE cadastros
        SET dependentes = v_dependentes_corrigidos
        WHERE id = v_cadastro.id;

        v_total_corrigidos := v_total_corrigidos + 1;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- Log erro mas continua processando outros registros
        RAISE WARNING 'Erro ao corrigir cadastro %: %', v_cadastro.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Total de cadastros corrigidos: %', v_total_corrigidos;
END;
$$;

-- Executar a correção
SELECT fix_dependentes_from_payload();

-- Remover a função após uso
DROP FUNCTION IF EXISTS fix_dependentes_from_payload();

-- Adicionar comentário na tabela
COMMENT ON COLUMN cadastros.dependentes IS 'Array de dependentes no formato interno (CPF sem máscara, data ISO). Deve sempre refletir o conteúdo do payload_erp.dados.dependente após envio.';
