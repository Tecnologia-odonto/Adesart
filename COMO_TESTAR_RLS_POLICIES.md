# Como Testar RLS Policies no Supabase

## Problema

Quando você executa queries SQL diretamente no console do Supabase, as RLS policies **NÃO são aplicadas** porque:
- `auth.uid()` retorna `NULL`
- `auth.jwt()` retorna `NULL`
- Você está executando como um usuário administrativo do banco

Por isso, se você rodar:
```sql
SELECT COUNT(*) FROM cadastros WHERE status = 'incompleto';
```

Você verá **TODOS** os registros (328), mas o usuário logado pode ver menos por causa das RLS policies.

## Como Simular Corretamente

### 1. Ver o que EXISTE no banco (sem RLS)

```sql
-- Total de cadastros incompletos (ignorando RLS)
SELECT COUNT(*) as total_sem_rls
FROM cadastros
WHERE status = 'incompleto';

-- Total de cadastros incompletos em março/2026
SELECT COUNT(*) as total_marco_2026
FROM cadastros
WHERE status = 'incompleto'
AND created_at >= '2026-03-01'
AND created_at < '2026-04-01';
```

### 2. Simular o JWT de um usuário específico

Para simular como se você estivesse logado como um usuário específico, você precisa:

```sql
-- Ver um usuário ADMINISTRADOR de exemplo
SELECT
  id,
  email,
  raw_app_meta_data->>'role' as role
FROM auth.users
WHERE raw_app_meta_data->>'role' = 'ADMINISTRADOR'
LIMIT 1;
```

Depois você pode usar esse ID para simular queries (mas isso ainda não aplica RLS automaticamente).

### 3. Verificar as Policies Aplicadas

```sql
-- Ver todas as policies de cadastros
SELECT
  policyname,
  cmd as comando,
  qual as condicao_using
FROM pg_policies
WHERE tablename = 'cadastros'
AND schemaname = 'public'
ORDER BY cmd, policyname;
```

### 4. Testar Via API (Recomendado)

A **ÚNICA** forma de testar as RLS policies corretamente é fazendo login na aplicação e usando o Supabase client com um token de autenticação válido.

## Por Que a Tela Mostra Menos Registros?

1. **RLS Policy está aplicada**: Quando você faz login na aplicação, o Supabase aplica automaticamente as policies
2. **JWT contém metadata**: O token JWT contém `app_metadata.role`, `app_metadata.team_id`, etc
3. **Filtros de role funcionam**: As policies verificam o role e limitam o que você vê

### Exemplo

Se você é **VENDEDOR**:
- Policy: `Vendedor view own cadastros`
- Condição: `created_by = auth.uid() OR vendedor_id = auth.uid()`
- Resultado: Você vê apenas cadastros criados por você OU atribuídos a você

Se você é **ADMINISTRADOR**:
- Policy: `Admin/Gerente/Cadastro/Adesionista view all`
- Condição: `role IN ('ADMINISTRADOR', ...)`
- Resultado: Você vê TODOS os cadastros

## Como Debugar Diferenças

### 1. Verificar o JWT do usuário logado

No console do navegador (F12), execute:

```javascript
const { data: { session } } = await window.supabase.auth.getSession();
console.log('JWT Metadata:', session.user.app_metadata);
console.log('User ID:', session.user.id);
```

Isso mostrará:
- `role`: ADMINISTRADOR, VENDEDOR, etc
- `team_id`: ID do time (se aplicável)
- `is_active`: true/false

### 2. Ver quantos cadastros o frontend está recebendo

No console do navegador:

```javascript
// Na página de Adesões Pendentes
console.log('Cadastros recebidos:', cadastros.length);
console.log('Cadastros incompletos:', cadastros.filter(c => c.status === 'incompleto').length);
```

### 3. Verificar erros de RLS

Se você não está vendo nada, pode ser que:
- JWT não foi sincronizado → Faça logout e login novamente
- Policy está muito restritiva → Verifique as policies
- Filtros de data/tipo estão aplicados → Limpe os filtros

## Consultas Úteis

### Ver quantos cadastros cada vendedor criou

```sql
SELECT
  p.name as vendedor_nome,
  COUNT(*) as total_cadastros,
  SUM(CASE WHEN c.status = 'incompleto' THEN 1 ELSE 0 END) as incompletos
FROM cadastros c
JOIN profiles p ON p.id = c.created_by
GROUP BY p.id, p.name
ORDER BY total_cadastros DESC;
```

### Ver cadastros de um vendedor específico (por email)

```sql
SELECT
  c.id,
  c.status,
  c.tipo_cadastro,
  c.nome,
  c.cpf,
  c.created_at
FROM cadastros c
JOIN profiles p ON p.id = c.created_by
WHERE p.email = 'vendedor@example.com'
AND c.status = 'incompleto'
ORDER BY c.created_at DESC;
```

### Ver cadastros por período

```sql
SELECT
  DATE(c.created_at) as data,
  COUNT(*) as total,
  SUM(CASE WHEN c.status = 'incompleto' THEN 1 ELSE 0 END) as incompletos,
  SUM(CASE WHEN c.status = 'enviado' THEN 1 ELSE 0 END) as enviados
FROM cadastros c
WHERE c.created_at >= '2026-03-01'
AND c.created_at < '2026-04-01'
GROUP BY DATE(c.created_at)
ORDER BY data DESC;
```

## Resumo

✅ **Para ver os dados reais**: Use queries SQL direto no console
✅ **Para testar RLS**: Faça login na aplicação e use o frontend
✅ **Para debugar**: Use console do navegador + queries SQL no banco
❌ **NÃO espere que RLS funcione no console SQL**: Não funciona!
