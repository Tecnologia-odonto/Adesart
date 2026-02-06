# Correções: Filtros e Validações

## Data da Correção
**Data**: 2026-02-06
**Desenvolvedor**: Claude (Assistant)
**Solicitante**: User

## Problemas Identificados

1. **Filtro por Vendedor usando campo incorreto**
   - Filtros nas telas "Adesões Pendentes" e "Cadastros" usavam `vendedor_id` ou `vendedor_nome`
   - Deveria usar `created_by` (quem criou o cadastro)

2. **Filtro visível para role VENDEDOR**
   - Vendedores não deveriam ver filtro de vendedor, pois já veem apenas seus próprios cadastros

3. **Planos ocultos não respeitados**
   - Configuração de planos ocultos não estava sendo aplicada em alguns lugares
   - Especificamente no modal de "Continuar Inclusão de Dependente"

4. **Falta de obrigatoriedade no modal de Inclusão de Dependente**
   - Campo de arquivo não tinha validação de obrigatoriedade
   - Deveria seguir mesma regra do Cadastro

## Alterações Realizadas

### 1. Filtro de Vendedor → Filtro de "Criado Por"

#### CadastrosIncompletosList.tsx
**Alterações principais:**
- Adicionado interface `UserProfile` para mapear usuários
- Substituído `vendedorFiltro` por `criadoPorFiltro`
- Substituído `vendedoresUnicos` por `criadoresPorUnicos`
- Adicionada função `fetchUsers()` para buscar profiles
- Filtro agora usa `cadastro.created_by` ao invés de `cadastro.vendedor_nome`
- Filtro escondido para role VENDEDOR: `{profile?.role !== 'VENDEDOR' && (...)}`

**Mudanças no estado:**
```typescript
// ANTES
const [vendedorFiltro, setVendedorFiltro] = useState('');
const vendedoresUnicos = useMemo(() => {
  // Baseado em vendedor_nome
}, [incompletos]);

// DEPOIS
const [criadoPorFiltro, setCriadoPorFiltro] = useState('');
const [users, setUsers] = useState<UserProfile[]>([]);
const criadoresPorUnicos = useMemo(() => {
  // Baseado em created_by
}, [incompletos, users]);
```

**Mudança no filtro:**
```typescript
// ANTES
let matchVendedor = true;
if (vendedorFiltroAplicado) {
  matchVendedor = cadastro.vendedor_nome === vendedorFiltroAplicado;
}

// DEPOIS
let matchCriadoPor = true;
if (criadoPorFiltroAplicado) {
  matchCriadoPor = cadastro.created_by === criadoPorFiltroAplicado;
}
```

**Select no JSX:**
```tsx
{/* ANTES */}
<Select label="Vendedor" value={vendedorFiltro}>
  {vendedoresUnicos.map((vendedor) => (...))}
</Select>

{/* DEPOIS */}
{profile?.role !== 'VENDEDOR' && (
  <Select label="Criado por" value={criadoPorFiltro}>
    {criadoresPorUnicos.map(([id, name]) => (...))}
  </Select>
)}
```

#### CadastrosSupervisorView.tsx
**Alterações principais:**
- Renomeado `VendedorGroup` para `UserGroup`
- Substituído `vendedorId`, `vendedorNome`, `vendedorCodigo` por `userId`, `userName`
- Adicionada busca de profiles: `fetchUsers()`
- Agrupamento usa `cadastro.created_by` ao invés de `cadastro.vendedor_id`
- Renomeado `expandedVendedores` para `expandedUsers`
- Renomeado `toggleVendedor` para `toggleUser`

**Mudança no agrupamento:**
```typescript
// ANTES
const vendedorKey = cadastro.vendedor_id || 'sem_vendedor';
vendedoresGrouped: VendedorGroup[] = useMemo(() => {
  // Agrupa por vendedor_id
  vendedorNome: firstCadastro.vendedor_nome
}, [cadastrosFiltrados]);

// DEPOIS
const userKey = cadastro.created_by || 'sem_usuario';
usersGrouped: UserGroup[] = useMemo(() => {
  // Agrupa por created_by
  userName: user?.name || 'Usuário não identificado'
}, [cadastrosFiltrados, users]);
```

**JSX atualizado:**
```tsx
{/* ANTES */}
{vendedoresGrouped.map((vendedor) => (
  <h3>{vendedor.vendedorNome}</h3>
  <p>Código: {vendedor.vendedorCodigo}</p>
))}

{/* DEPOIS */}
{usersGrouped.map((user) => (
  <h3>{user.userName}</h3>
))}
```

#### CadastrosGerenteView.tsx
**Alterações principais:**
- Similar ao CadastrosSupervisorView, mas mantém estrutura de equipes
- Renomeado `VendedorGroup` para `UserGroup`
- Substituído `vendedores` por `users` na busca de profiles
- Busca agora retorna todos os profiles ativos (não apenas role VENDEDOR)
- Agrupamento usa `cadastro.created_by` ao invés de `cadastro.vendedor_id`
- Interface `EquipeGroup` agora tem `users: UserGroup[]` ao invés de `vendedores: VendedorGroup[]`

**Mudança na busca:**
```typescript
// ANTES
supabase.from('profiles')
  .select('id, name, team_id, external_id')
  .eq('role', 'VENDEDOR')
  .eq('is_active', true)

// DEPOIS
supabase.from('profiles')
  .select('id, name, team_id')
  .eq('is_active', true)
```

**JSX atualizado:**
```tsx
{/* ANTES */}
<p>{equipe.vendedores.length} vendedores</p>
{equipe.vendedores.map((vendedor) => (...))}

{/* DEPOIS */}
<p>{equipe.users.length} usuários</p>
{equipe.users.map((user) => (...))}
```

### 2. Filtro de Planos Ocultos

#### ContinuarInclusaoDependenteModal.tsx
**Linha ~1107-1113**

Adicionado filtro para respeitar configuração de planos ocultos:

```tsx
{/* ANTES */}
{planosEmpresa.map((p: any) => (
  <option key={p.codigoPlano} value={p.codigoPlano}>
    {p.nomePlano} - R$ {p.valorPlano?.toFixed(2)}
  </option>
))}

{/* DEPOIS */}
{planosEmpresa
  .filter((p: any) => !config?.planos_ocultos?.includes(p.codigoPlano?.toString()))
  .map((p: any) => (
    <option key={p.codigoPlano} value={p.codigoPlano}>
      {p.nomePlano} - R$ {p.valorPlano?.toFixed(2)}
    </option>
  ))}
```

**Observação:**
- InclusaoDependenteModal.tsx já tinha o filtro implementado (linha 1456)
- DependentesSection.tsx também já respeitava os planos ocultos

### 3. Obrigatoriedade de Arquivo

#### InclusaoDependenteModal.tsx
**Linha ~917-920**

Adicionada validação de arquivo obrigatório:

```typescript
// ANTES
if (!dep.nomeMae) {
  setError(`Dependente ${i + 1}: Nome da mãe é obrigatório`);
  return;
}

// DEPOIS
if (!dep.nomeMae) {
  setError(`Dependente ${i + 1}: Nome da mãe é obrigatório`);
  return;
}
if (config?.exigir_arquivo && !dep.arquivo) {
  setError(`Dependente ${i + 1}: Arquivo é obrigatório`);
  return;
}
```

**Observação:**
- ContinuarInclusaoDependenteModal.tsx já tinha a validação (linha 658-664)

## Resumo das Mudanças

### Arquivos Modificados

1. **src/components/cadastro/CadastrosIncompletosList.tsx**
   - Filtro de vendedor → criado por
   - Esconde filtro para role VENDEDOR
   - Busca profiles para mapear created_by → nome

2. **src/components/cadastro/CadastrosSupervisorView.tsx**
   - Agrupamento por created_by ao invés de vendedor_id
   - Busca profiles para mapear usuários
   - Interface renomeada de VendedorGroup → UserGroup

3. **src/components/cadastro/CadastrosGerenteView.tsx**
   - Agrupamento por created_by ao invés de vendedor_id
   - Busca todos os profiles (não apenas VENDEDOR)
   - Mantém estrutura de equipes
   - Interface renomeada de VendedorGroup → UserGroup

4. **src/components/cadastro/ContinuarInclusaoDependenteModal.tsx**
   - Adicionado filtro de planos ocultos no select

5. **src/components/cadastro/InclusaoDependenteModal.tsx**
   - Adicionada validação de arquivo obrigatório

## Impacto

### Positivo
✅ Filtros agora usam o campo correto (created_by)
✅ Vendedores não veem filtro desnecessário
✅ Planos ocultos respeitados em todos os lugares
✅ Validação de arquivo obrigatório consistente
✅ Agrupamentos mostram quem realmente criou o cadastro

### Compatibilidade
✅ Build executado com sucesso
✅ Sem breaking changes
✅ Não requer migração de dados
✅ Funcionalidade existente preservada

## Regras Implementadas

### Filtro de "Criado Por"
- **Para todos (exceto VENDEDOR)**: Exibe select com todos os usuários que criaram cadastros
- **Para VENDEDOR**: Filtro não é exibido (já veem apenas seus próprios cadastros via RLS)

### Planos Ocultos
- Configuração em `cadastro_config.planos_ocultos` (array de strings)
- Filtrados em:
  - DependentesSection (novo cadastro)
  - InclusaoDependenteModal (inclusão de dependente)
  - ContinuarInclusaoDependenteModal (continuar inclusão)

### Arquivo Obrigatório
- Baseado em `config.exigir_arquivo` (boolean)
- Validado em:
  - InclusaoDependenteModal
  - ContinuarInclusaoDependenteModal
- Mensagem de erro clara indicando qual dependente precisa do arquivo

## Testes Recomendados

### Filtro de Criado Por
1. ✅ Login como ADMINISTRADOR/GESTOR/SUPERVISOR
   - Verificar que filtro "Criado por" aparece
   - Selecionar um usuário e verificar que filtra corretamente
2. ✅ Login como VENDEDOR
   - Verificar que filtro "Criado por" NÃO aparece
   - Verificar que vê apenas seus próprios cadastros

### Agrupamentos
3. ✅ Login como SUPERVISOR
   - Verificar agrupamento por usuário (não por vendedor)
   - Verificar que nome do usuário está correto
4. ✅ Login como GERENTE
   - Verificar agrupamento por equipe → usuário
   - Verificar que mostra "usuários" ao invés de "vendedores"

### Planos Ocultos
5. ✅ Configurar planos ocultos (ex: "1,2,3")
6. ✅ Tentar criar novo cadastro
   - Verificar que planos ocultos não aparecem
7. ✅ Tentar incluir dependente
   - Verificar que planos ocultos não aparecem

### Arquivo Obrigatório
8. ✅ Ativar "exigir_arquivo" nas configurações
9. ✅ Tentar incluir dependente sem arquivo
   - Verificar mensagem de erro
10. ✅ Incluir dependente com arquivo
    - Verificar que envia com sucesso
