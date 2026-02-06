# Verificação Segura de CPF Existente

## Visão Geral

Esta documentação descreve a implementação de uma função segura para verificar a existência de cadastros por CPF, mantendo a RLS (Row Level Security) intacta e sem expor dados sensíveis.

## Problema Original

### Cenário
- **VENDEDOR** só pode ver seus próprios cadastros devido ao RLS
- Quando um VENDEDOR busca um CPF que foi cadastrado por outro vendedor, a query retorna vazio
- Isso causava erros e comportamento inconsistente na aplicação
- Usuários não sabiam se o CPF já estava cadastrado no sistema

### Tentativa Anterior (Falha)
```sql
-- Query direta na tabela (bloqueada pelo RLS para outros vendedores)
SELECT * FROM cadastros WHERE cpf = '12345678900'
-- Retorna vazio se o cadastro foi criado por outro vendedor
```

## Solução Implementada

### Função de Banco de Dados Segura

Criamos uma função `check_cpf_existente` que usa `SECURITY DEFINER` para bypassar o RLS de forma controlada e segura.

**Localização:** `supabase/migrations/[timestamp]_add_check_cpf_existente_function.sql`

### Características da Função

#### 1. Parâmetros
```sql
check_cpf_existente(
  p_cpf text,        -- CPF a ser verificado (sem máscara)
  p_user_id uuid     -- ID do usuário que está fazendo a verificação
)
```

#### 2. Retorno (JSON)
```json
{
  "exists": true,              // Se existe cadastro com o CPF
  "can_continue": false,       // Se o usuário pode editar/continuar
  "status": "incompleto",      // Status do cadastro
  "cadastro_id": "uuid...",    // ID (apenas se can_continue = true)
  "created_at": "2024-01-01",  // Data de criação
  "empresa_nome": "Empresa X"  // Nome da empresa (informação pública)
}
```

#### 3. Lógica de Permissões

A função determina se o usuário pode continuar o cadastro baseado no role:

| Role | Pode Ver Existência? | Pode Continuar? |
|------|---------------------|-----------------|
| **ADMINISTRADOR** | ✅ Sim | ✅ Qualquer cadastro |
| **GESTOR** | ✅ Sim | ✅ Qualquer cadastro |
| **SUPERVISOR** | ✅ Sim | ✅ Qualquer cadastro |
| **CADASTRO** | ✅ Sim | ✅ Qualquer cadastro |
| **VENDEDOR** | ✅ Sim | ✅ Apenas seus próprios |
| **ADESIONISTA** | ✅ Sim | ❌ Nenhum |

#### 4. Segurança

**✅ O que a função FAZ:**
- Verifica existência de cadastro por CPF
- Retorna informações mínimas e não sensíveis
- Respeita hierarquia de roles
- Usa `SECURITY DEFINER` de forma controlada

**❌ O que a função NÃO FAZ:**
- Não retorna dados pessoais (nome completo, telefone, email)
- Não retorna endereço ou documentos
- Não retorna dados de dependentes
- Não permite enumeração fácil de CPFs
- Não expõe informações de outros vendedores

### Uso no Frontend

#### Antes (Inseguro)
```typescript
// Query direta bloqueada pelo RLS
const { data } = await supabase
  .from('cadastros')
  .select('*')
  .eq('cpf', cpf);

// Retorna vazio se RLS bloquear
if (data && data.length > 0) {
  // Nunca chega aqui se for de outro vendedor
}
```

#### Depois (Seguro)
```typescript
// Chamada à função segura
const { data: checkResult } = await supabase.rpc('check_cpf_existente', {
  p_cpf: cpfLimpo,
  p_user_id: profile?.id,
});

// Sempre retorna resultado correto
if (checkResult?.exists) {
  if (checkResult.can_continue) {
    // Pode editar o cadastro
  } else {
    // Não pode editar (outro vendedor criou)
  }
}
```

## Fluxo Completo de Verificação

### 1. Usuário Digita CPF
```
[VENDEDOR] → Digite CPF: 123.456.789-00
```

### 2. Sistema Chama Função
```sql
SELECT check_cpf_existente('12345678900', 'uuid-do-vendedor')
```

### 3. Função Verifica no Banco
```
1. Busca cadastro com o CPF ✅
2. Encontra cadastro criado por outro vendedor
3. Verifica role do usuário: VENDEDOR
4. Determina: can_continue = false (não é o criador)
```

### 4. Retorno ao Frontend
```json
{
  "exists": true,
  "can_continue": false,
  "status": "incompleto",
  "cadastro_id": null,
  "created_at": "2024-01-15",
  "empresa_nome": "Empresa XYZ"
}
```

### 5. Modal Exibido
```
⚠️ CPF já cadastrado
Este CPF já possui cadastro no sistema.
Empresa: Empresa XYZ
Status: Incompleto
Criado em: 15/01/2024

[OK]
```

## Benefícios da Solução

### ✅ Segurança
1. **RLS Mantida:** A tabela `cadastros` continua protegida
2. **Sem Vazamento:** Não expõe dados sensíveis
3. **Controle Fino:** Permissões baseadas em role
4. **Auditável:** Todas as chamadas podem ser logadas

### ✅ Funcionalidade
1. **Detecta Duplicatas:** Mesmo de outros vendedores
2. **UX Melhorada:** Feedback claro para o usuário
3. **Menos Erros:** Evita tentativas de cadastro duplicado
4. **Escalável:** Funciona com qualquer volume de dados

### ✅ Manutenibilidade
1. **Código Limpo:** Lógica centralizada no banco
2. **Reusável:** Pode ser usada em outros contextos
3. **Testável:** Fácil de testar isoladamente
4. **Documentada:** Função tem comentários SQL

## Comparação com Alternativas

### ❌ Alternativa 1: Desabilitar RLS
```sql
ALTER TABLE cadastros DISABLE ROW LEVEL SECURITY;
```
**Problema:** Expõe TODOS os dados de TODOS os vendedores. Inaceitável.

### ❌ Alternativa 2: RLS Mais Permissivo
```sql
CREATE POLICY "allow_read_all" ON cadastros FOR SELECT USING (true);
```
**Problema:** Permite leitura completa de todos os cadastros. Vazamento de dados.

### ❌ Alternativa 3: View com Dados Limitados
```sql
CREATE VIEW cadastros_publicos AS
  SELECT cpf, status FROM cadastros;
```
**Problema:** Ainda permite enumeração de CPFs. Não controla acesso por role.

### ✅ Solução Atual: Função SECURITY DEFINER
```sql
CREATE FUNCTION check_cpf_existente(...)
SECURITY DEFINER
```
**Vantagens:**
- Controle total sobre dados retornados
- Valida permissões por role
- Não expõe dados sensíveis
- Mantém RLS intacta

## Casos de Uso

### Caso 1: Vendedor Busca Próprio Cadastro
```
CPF: 111.111.111-11
Vendedor: João (ID: 15762)
Cadastro criado por: João (15762)

Retorno:
{
  "exists": true,
  "can_continue": true,  ← Pode editar
  "cadastro_id": "uuid..."
}
```

### Caso 2: Vendedor Busca Cadastro de Outro Vendedor
```
CPF: 222.222.222-22
Vendedor: João (ID: 15762)
Cadastro criado por: Maria (15800)

Retorno:
{
  "exists": true,
  "can_continue": false,  ← Não pode editar
  "cadastro_id": null     ← ID não é exposto
}
```

### Caso 3: Supervisor Busca Qualquer Cadastro
```
CPF: 333.333.333-33
Usuário: Admin (SUPERVISOR)
Cadastro criado por: João (15762)

Retorno:
{
  "exists": true,
  "can_continue": true,  ← Admin pode editar qualquer um
  "cadastro_id": "uuid..."
}
```

### Caso 4: CPF Não Cadastrado
```
CPF: 444.444.444-44
Qualquer usuário

Retorno:
{
  "exists": false,
  "can_continue": false
}
```

## Testes Recomendados

### Teste 1: VENDEDOR - Próprio Cadastro
```sql
-- Criar cadastro
INSERT INTO cadastros (cpf, vendedor_codigo, created_by)
VALUES ('12345678900', '15762', 'uuid-vendedor');

-- Verificar
SELECT check_cpf_existente('12345678900', 'uuid-vendedor');

-- Esperado: can_continue = true
```

### Teste 2: VENDEDOR - Cadastro de Outro
```sql
-- Vendedor A cria cadastro
INSERT INTO cadastros (cpf, vendedor_codigo, created_by)
VALUES ('11111111111', '15762', 'uuid-vendedor-a');

-- Vendedor B verifica
SELECT check_cpf_existente('11111111111', 'uuid-vendedor-b');

-- Esperado: exists = true, can_continue = false
```

### Teste 3: ADMINISTRADOR - Qualquer Cadastro
```sql
-- Verificar como admin
SELECT check_cpf_existente('12345678900', 'uuid-admin');

-- Esperado: can_continue = true (independente de quem criou)
```

## Manutenção

### Adicionar Novo Role
Se precisar adicionar um novo role com permissões especiais:

```sql
-- Editar função
CREATE OR REPLACE FUNCTION check_cpf_existente(...)
...
  IF v_user_role IN ('ADMINISTRADOR', 'GESTOR', 'SUPERVISOR', 'CADASTRO', 'NOVO_ROLE') THEN
    v_can_continue := true;
  ...
```

### Adicionar Novos Campos ao Retorno
Se precisar retornar mais informações (não sensíveis):

```sql
RETURN jsonb_build_object(
  'exists', true,
  'can_continue', v_can_continue,
  'status', v_cadastro.status,
  'novo_campo', v_cadastro.novo_campo,  -- Adicionar aqui
  ...
);
```

### Log de Auditoria
Para adicionar log de todas as verificações:

```sql
-- Adicionar no início da função
INSERT INTO audit_log (user_id, action, cpf_checked)
VALUES (p_user_id, 'check_cpf', p_cpf);
```

## Troubleshooting

### Erro: "function check_cpf_existente does not exist"
**Causa:** Migração não aplicada
**Solução:** Rodar a migração `add_check_cpf_existente_function.sql`

### Erro: "permission denied for function"
**Causa:** Permissões não concedidas
**Solução:**
```sql
GRANT EXECUTE ON FUNCTION check_cpf_existente(text, uuid) TO authenticated;
```

### Retorna sempre "can_continue: false"
**Causa:** Código do vendedor não bate
**Solução:** Verificar se `profiles.external_id` está correto

## Referências

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- Arquivo: `supabase/migrations/[timestamp]_add_check_cpf_existente_function.sql`
- Arquivo: `src/components/cadastro/NovoCadastroCard.tsx`
