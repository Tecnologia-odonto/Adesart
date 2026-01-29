/*
  # Adicionar campo para Lemmit na Inclusão de Dependente

  1. Alterações
    - Adiciona campo `lemmit_inclusao_dependente` (boolean) à tabela `cadastro_config`
    - Define valor padrão como `false`
    - Permite ativar/desativar a consulta Lemmit especificamente para o fluxo de Inclusão de Dependente
  
  2. Diferença entre os campos
    - `lemmit_dependente`: Para adicionar dependentes no fluxo de Novo Cadastro (DependentesSection)
    - `lemmit_inclusao_dependente`: Para adicionar dependentes no fluxo de Inclusão (InclusaoDependenteModal)
  
  3. Comportamento
    - Quando ativo, ao digitar CPF válido na inclusão de dependente, consulta Lemmit automaticamente
    - Preenche campos do dependente com dados retornados
    - Respeita regras de consumo e permite continuar manualmente
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadastro_config' AND column_name = 'lemmit_inclusao_dependente'
  ) THEN
    ALTER TABLE cadastro_config ADD COLUMN lemmit_inclusao_dependente boolean DEFAULT false;
  END IF;
END $$;