# Correções para Vendedor ID e Created By

## Problema Identificado

O sistema não estava preenchendo corretamente o campo `vendedor_id` quando um usuário com role VENDEDOR criava cadastros. Isso causava dois problemas:

1. O campo `vendedor_id` ficava null quando o vendedor criava o cadastro diretamente
2. Os contadores (badges) não mostravam os cadastros corretos porque só olhavam para `vendedor_codigo` e não para `created_by`

## Soluções Implementadas

### 1. Frontend - NovoCadastroCard.tsx

**Arquivo**: `src/components/cadastro/NovoCadastroCard.tsx`

**Alteração**: Nos três locais onde cadastros são criados (consulta normal, erro Lemmit, limite Lemmit), foi adicionada lógica para preencher automaticamente os dados do vendedor quando o usuário logado tem role VENDEDOR:

```typescript
let vendedorData = {};
if (needsVendedor && vendedorSelecionado) {
  // Quando CADASTRO ou ADESIONISTA seleciona um vendedor
  vendedorData = {
    vendedor_id: vendedorSelecionado.id,
    vendedor_codigo: vendedorSelecionado.external_id,
    vendedor_nome: vendedorSelecionado.name,
  };
} else if (profile?.role === 'VENDEDOR' && profile.external_id) {
  // Quando o próprio VENDEDOR cria o cadastro
  vendedorData = {
    vendedor_id: profile.id,
    vendedor_codigo: profile.external_id,
    vendedor_nome: profile.name || '',
  };
}
```

**Resultado**: Agora quando um VENDEDOR cria um cadastro, o campo `vendedor_id` é automaticamente preenchido com seu próprio ID.

### 2. Backend - Função de Estatísticas

**Migração**: `fix_vendedor_stats_created_by.sql`

**Alteração**: Atualizada a função `get_cadastros_stats()` para considerar BOTH `vendedor_codigo` e `created_by` ao contar cadastros de vendedores:

```sql
-- VENDEDOR vê cadastros onde vendedor_codigo = external_id OU created_by = user_id
ELSIF v_user_role = 'VENDEDOR' THEN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'incompleto'),
    COUNT(*) FILTER (WHERE status = 'enviado'),
    COUNT(*) FILTER (WHERE status = 'erro_envio')
  INTO v_total, v_incompletos, v_enviados, v_erros
  FROM cadastros
  WHERE (vendedor_codigo = v_user_external_id OR created_by = p_user_id)
    AND EXTRACT(YEAR FROM created_at) = v_current_year
    AND EXTRACT(MONTH FROM created_at) = v_current_month;
```

**Índices criados**:
- `idx_cadastros_created_by` - Índice em `created_by`
- `idx_cadastros_created_at_created_by` - Índice composto para otimizar queries com filtro de data

**Resultado**: Os contadores agora mostram corretamente todos os cadastros do vendedor, tanto os que têm `vendedor_id` preenchido quanto os antigos que só têm `created_by`.

### 3. Políticas RLS

**Status**: Já estavam corretas!

As políticas RLS já foram ajustadas anteriormente na migração `20260115184817_add_vendedor_view_assigned_cadastros.sql` e já consideram ambos os campos:

```sql
CREATE POLICY "Vendedor can view own and assigned cadastros"
  ON cadastros
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM get_my_profile()) = 'VENDEDOR'
    AND (SELECT is_active FROM get_my_profile()) = true
    AND (
      cadastros.created_by = auth.uid()
      OR cadastros.vendedor_id = auth.uid()
    )
  );
```

## Regras por Role

### VENDEDOR
- `vendedor_id` é **automaticamente preenchido** com o ID do próprio vendedor
- Vê cadastros onde:
  - `vendedor_codigo` = seu `external_id` OU
  - `created_by` = seu `id`

### CADASTRO ou ADESIONISTA
- `vendedor_id` é preenchido com o vendedor selecionado no dropdown
- Comportamento mantido como estava

### Outros Roles (ADMINISTRADOR, GERENTE, SUPERVISOR)
- Não precisam preencher `vendedor_id`
- Comportamento mantido como estava

## Compatibilidade com Dados Antigos

A solução é **totalmente compatível** com cadastros antigos que não têm `vendedor_id`:

- Função de estatísticas considera `created_by` como fallback
- Políticas RLS verificam ambos os campos
- Cadastros antigos continuam visíveis para os vendedores que os criaram

## Impacto nos Contadores

Os badges de "Adesões Pendentes" e "Cadastrados" na tela de cadastro agora mostram os números corretos para vendedores, considerando:

1. Cadastros novos (com `vendedor_id` preenchido)
2. Cadastros antigos (onde `vendedor_id` é null mas `created_by` está preenchido)

## Testes

- Build concluído com sucesso
- Sem erros de TypeScript
- Migrações aplicadas com sucesso

## Arquivos Modificados

1. `src/components/cadastro/NovoCadastroCard.tsx` - Três locais alterados
2. Nova migração: `fix_vendedor_stats_created_by.sql`

## Próximos Passos

Nenhuma ação adicional necessária. O sistema agora:
- Preenche corretamente `vendedor_id` para vendedores
- Conta corretamente todos os cadastros nos badges
- Mantém compatibilidade com dados históricos
