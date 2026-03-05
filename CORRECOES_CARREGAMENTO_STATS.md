# Correções de Carregamento de Stats e Dashboard

## Data: 2026-03-05

## Problemas Identificados

### 1. Dashboard em Loading Infinito
**Sintoma**: Dashboard mostrava spinner de loading infinitamente, mesmo com dados carregados.

**Causa Raiz**:
- O hook `useCadastros` iniciava com `loading: true`
- O Dashboard consumia os stats do hook mas nunca chamava `loadStats()`
- Os stats permaneciam zerados e o loading nunca mudava

**Solução Aplicada**:
```typescript
// hooks/useCadastros.ts
const [loading, setLoading] = useState(false); // Era true, mudado para false
const [loadingStats, setLoadingStats] = useState(false); // Era true, mudado para false

// pages/Dashboard.tsx
const { stats: cadastroStats, loading: cadastroLoading, loadStats } = useCadastros();

useEffect(() => {
  const fetchStats = async () => {
    // ... outras operações ...

    // Adiconado: Carregar stats de cadastro
    await loadStats();
  };
  fetchStats();
}, [profile, loadStats]);
```

### 2. Stats Todos Zerados
**Sintoma**: Todos os contadores (cadastro_total, cadastro_cadastros, etc.) mostravam valor 0.

**Causa Raiz**:
- O Dashboard não chamava `loadStats()` para buscar os dados do cache
- Os stats permaneciam com valores iniciais (zeros)

**Solução Aplicada**:
- Dashboard agora chama `await loadStats()` no useEffect
- Isso busca os dados da função `get_stats_from_cache` no Supabase

### 3. Keys Duplicadas no React
**Sintoma**: Warnings no console sobre keys duplicadas em CadastrosCompletosList e CadastrosIncompletosList.

**Causa Raiz**:
- Componentes usavam apenas `cadastro.id` como key
- Se um cadastro aparecesse em múltiplos contextos, causava conflito

**Solução Aplicada**:
```typescript
// CadastrosCompletosList.tsx
{empresa.cadastros.map((cadastro, idx) => (
  <div key={`${empresaKey}-${cadastro.id}-${idx}`}>
    {/* ... */}
  </div>
))}

// CadastrosIncompletosList.tsx
{cliente.cadastros.map((cadastro, idx) => (
  <div key={`${cliente.cpf}-${cadastro.id}-${idx}`}>
    {/* ... */}
  </div>
))}
```

## Logs Adicionados

Para facilitar debugging futuro, foram adicionados logs detalhados em:

### useStats (hooks/useStats.ts)
- Início do fetchStats
- Profile ID disponível
- Tempo de execução da RPC
- Dados retornados
- Erros detalhados

### useCadastros (hooks/useCadastros.ts)
- Início do fetchCadastros e fetchStats
- Profile disponível
- Chunks carregados (paginação)
- Total de registros
- Tempo de execução
- Erros detalhados

### Dashboard (pages/Dashboard.tsx)
- useEffect iniciado
- Profile disponível
- Carregamento de users, teams
- Chamada para loadStats
- Tempo total de carregamento

### Cadastro (pages/Cadastro.tsx)
- Componente renderizado
- Stats e cadastros disponíveis
- Loading state
- Mudanças de tab

## Como Usar os Logs

Abra o Console do Navegador (F12) e você verá mensagens como:

```
[Dashboard] 🔄 useEffect iniciado
[Dashboard] 👤 Profile: {id: "...", role: "ADMINISTRADOR"}
[Dashboard] 📥 Buscando totalUsers...
[Dashboard] ✅ totalUsers: 44
[Dashboard] 📥 Chamando loadStats para cadastros...
[useCadastros] 🔄 loadStats chamado
[useCadastros] 🔄 fetchStats iniciado
[useCadastros] ⚡ RPC fetchStats executado em 25.50 ms
[useCadastros] 📊 Stats recebida: [{cadastro_total: 150, ...}]
```

## Verificações

### Como Testar
1. Acesse o Dashboard
2. Verifique que os contadores aparecem corretamente
3. Não deve haver loading infinito
4. Console não deve mostrar warnings de keys duplicadas

### Pontos de Atenção
- O `profile` deve estar disponível no AuthContext
- A função `get_stats_from_cache` deve existir no Supabase
- A tabela `stats_cache` deve ter dados populados
- RLS policies devem permitir leitura dos stats

## Arquivos Modificados

1. `src/hooks/useStats.ts` - Logs detalhados
2. `src/hooks/useCadastros.ts` - Logs + loading inicial false
3. `src/pages/Dashboard.tsx` - Chamada para loadStats + logs
4. `src/pages/Cadastro.tsx` - Logs de debug
5. `src/components/cadastro/CadastrosCompletosList.tsx` - Keys únicas
6. `src/components/cadastro/CadastrosIncompletosList.tsx` - Keys únicas

## Status Final

✅ Build compilado com sucesso
✅ Dashboard carrega stats corretamente
✅ Loading states funcionando
✅ Logs detalhados para debug
✅ Keys duplicadas corrigidas
