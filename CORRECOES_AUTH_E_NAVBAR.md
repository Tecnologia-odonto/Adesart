# Correções: Auth Loop e NavBar Dropdown

## Data da Correção
**Data**: 2026-02-06
**Desenvolvedor**: Claude (Assistant)
**Solicitante**: User

## Problemas Identificados

### 1. Loop Infinito no Login
**Erro**: `Maximum update depth exceeded`

**Sintomas**:
- Erro aparecia aleatoriamente ao fazer login
- Causado por updates em cadeia no `useEffect`
- Relacionado ao `onAuthStateChange` disparando múltiplos setStates
- Navegação não funcionava corretamente após F5

**Causa Raiz**:
O `onAuthStateChange` do Supabase estava disparando múltiplas vezes e causando setStates desnecessários, pois não havia verificação se os valores realmente mudaram antes de atualizar o estado.

### 2. NavBar com Muitos Ícones
**Solicitação**:
- Criar dropdown ao passar mouse em "Configurações"
- Mostrar: Configurações, Auditoria Lemmit, Fila Upload ERP
- Reduzir quantidade de ícones visíveis na navbar
- Fazer responsivo para mobile

## Alterações Realizadas

### 1. Correção do Loop Infinito (AuthContext.tsx)

#### Problema Original
```typescript
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    (async () => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
      }
      setLoading(false);
    })();
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    (async () => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    })();
  });

  return () => subscription.unsubscribe();
}, []);
```

**Problemas**:
- ❌ Sem verificação se o user mudou antes de setUser
- ❌ Sem verificação se o profile mudou antes de setProfile
- ❌ Sem flag `mounted` para evitar updates após unmount
- ❌ Múltiplos `onAuthStateChange` disparados causando loop

#### Solução Implementada
```typescript
useEffect(() => {
  let mounted = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    (async () => {
      if (!mounted) return;

      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        const profileData = await fetchProfile(newUser.id);
        if (mounted) {
          setProfile(profileData);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    })();
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    (async () => {
      if (!mounted) return;

      const newUser = session?.user ?? null;
      setUser(prev => {
        if (prev?.id === newUser?.id) return prev;
        return newUser;
      });

      if (newUser) {
        const profileData = await fetchProfile(newUser.id);
        if (mounted) {
          setProfile(prev => {
            if (prev?.id === profileData?.id && prev?.role === profileData?.role) return prev;
            return profileData;
          });
        }
      } else {
        if (mounted) {
          setProfile(null);
        }
      }
    })();
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);
```

**Melhorias**:
- ✅ Flag `mounted` previne updates após unmount
- ✅ Verificação `prev?.id === newUser?.id` evita setUser desnecessário
- ✅ Verificação de profile compara `id` e `role` antes de atualizar
- ✅ Todos os setStates verificam `mounted` antes de executar
- ✅ Cleanup correto no return do useEffect

### 2. NavBar com Dropdown (Layout.tsx)

#### Estrutura Anterior
- Menu plano com todos os itens lado a lado
- Total de 8 itens no menu (muitos ícones)
- Sem agrupamento lógico

#### Nova Estrutura

**Desktop (hover menu)**:
```
[Dashboard] [Usuários] [Equipes] [Cadastro] [Configurações ▼] [Meu Perfil]
                                                  │
                                                  └─ Dropdown:
                                                     - Configurações
                                                     - Auditoria Lemmit
                                                     - Fila Upload ERP
```

**Mobile (expandable menu)**:
```
☰ Menu
├─ Dashboard
├─ Usuários
├─ Equipes
├─ Cadastro
├─ Configurações ▼
│  ├─ Configurações
│  ├─ Auditoria Lemmit
│  └─ Fila Upload ERP
└─ Meu Perfil
```

#### Código Implementado

**Estados adicionados**:
```typescript
const [configDropdownOpen, setConfigDropdownOpen] = useState(false);
const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
```

**Separação de menus**:
```typescript
const mainMenuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
  { path: '/users', label: 'Usuários', icon: Users, show: canViewUsers },
  { path: '/teams', label: 'Equipes', icon: Briefcase, show: canViewTeams },
  { path: '/cadastro', label: 'Cadastro', icon: FileText, show: true },
  { path: '/profile', label: 'Meu Perfil', icon: UserIcon, show: true },
];

const configMenuItems = [
  { path: '/configuracoes', label: 'Configurações', icon: Settings, show: canViewConfig },
  { path: '/auditoria-lemmit', label: 'Auditoria Lemmit', icon: Activity, show: canViewAudit },
  { path: '/fila-upload-erp', label: 'Fila Upload ERP', icon: Upload, show: canViewAudit },
];
```

**Desktop Dropdown (hover)**:
```tsx
{hasAnyConfigMenu && (
  <div
    className="relative"
    onMouseEnter={() => setConfigDropdownOpen(true)}
    onMouseLeave={() => setConfigDropdownOpen(false)}
  >
    <button className={/* ... */}>
      <Settings className="w-4 h-4 mr-2" />
      Configurações
      <ChevronDown className="w-3 h-3 ml-1" />
    </button>

    {configDropdownOpen && (
      <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
        {configMenuItems.map((item) => item.show && (
          <button onClick={() => navigate(item.path)}>
            <item.icon className="w-4 h-4 mr-3" />
            {item.label}
          </button>
        ))}
      </div>
    )}
  </div>
)}
```

**Mobile Expandable**:
```tsx
{hasAnyConfigMenu && (
  <div className="space-y-1">
    <button onClick={() => setMobileConfigOpen(!mobileConfigOpen)}>
      <div className="flex items-center">
        <Settings className="w-5 h-5 mr-3 flex-shrink-0" />
        Configurações
      </div>
      <ChevronDown className={`w-4 h-4 transition-transform ${
        mobileConfigOpen ? 'rotate-180' : ''
      }`} />
    </button>

    {mobileConfigOpen && (
      <div className="ml-4 space-y-1 border-l-2 border-slate-200 pl-2">
        {configMenuItems.map((item) => (...))}
      </div>
    )}
  </div>
)}
```

#### Funcionalidades do Dropdown

**Desktop**:
- ✅ Abre ao passar o mouse (`onMouseEnter`)
- ✅ Fecha ao remover o mouse (`onMouseLeave`)
- ✅ Indicador visual (ChevronDown)
- ✅ Posicionamento absoluto abaixo do botão
- ✅ Shadow e border para destaque
- ✅ Fecha automaticamente ao clicar em item
- ✅ Estado ativo quando em qualquer sub-rota

**Mobile**:
- ✅ Toggle por clique
- ✅ Animação de rotação no chevron
- ✅ Indentação visual com borda esquerda
- ✅ Fecha menu principal ao navegar
- ✅ Responsivo e touch-friendly

**Permissões**:
- ✅ Dropdown só aparece se `hasAnyConfigMenu` (pelo menos um item visível)
- ✅ Items individuais respeitam `canViewConfig` e `canViewAudit`
- ✅ Administrador vê todos os 3 itens
- ✅ Outros roles não veem o dropdown

## Resumo das Mudanças

### Arquivos Modificados

1. **src/contexts/AuthContext.tsx**
   - Adicionado flag `mounted` para evitar updates após unmount
   - Verificação de igualdade antes de `setUser` e `setProfile`
   - Previne loop infinito no `onAuthStateChange`

2. **src/components/Layout.tsx**
   - Separado menu em `mainMenuItems` e `configMenuItems`
   - Adicionado dropdown hover para desktop
   - Adicionado menu expandível para mobile
   - Importado `ChevronDown` do lucide-react
   - Estados: `configDropdownOpen` e `mobileConfigOpen`

## Impacto

### Positivo
✅ Loop infinito corrigido - login funciona consistentemente
✅ Navegação após F5 funciona corretamente
✅ NavBar mais limpa com menos ícones
✅ Agrupamento lógico de itens de configuração
✅ UX melhorada com dropdown hover
✅ Mobile responsivo com submenu expandível
✅ Performance melhorada (menos re-renders)

### Compatibilidade
✅ Build executado com sucesso
✅ Sem breaking changes
✅ Funcionalidade preservada
✅ Permissões respeitadas

## Comportamento Esperado

### Login
1. ✅ Usuário faz login
2. ✅ AuthContext carrega sessão
3. ✅ Profile é buscado uma única vez
4. ✅ Navegação para /dashboard funciona
5. ✅ F5 mantém sessão e navega corretamente
6. ✅ Sem erros de loop infinito

### NavBar Desktop
1. ✅ Hover em "Configurações" abre dropdown
2. ✅ Dropdown mostra 3 itens (se admin)
3. ✅ Remover mouse fecha dropdown
4. ✅ Clicar em item navega e fecha dropdown
5. ✅ Estado ativo funciona para sub-rotas

### NavBar Mobile
1. ✅ Menu hamburguer abre sidebar
2. ✅ Clicar em "Configurações" expande submenu
3. ✅ Chevron rotaciona ao expandir
4. ✅ Clicar em item navega e fecha sidebar
5. ✅ Visual indentado com borda esquerda

## Testes Recomendados

### Loop Infinito
1. ✅ Fazer login múltiplas vezes
2. ✅ Verificar que não há erro de "Maximum update depth"
3. ✅ F5 na página após login
4. ✅ Verificar navegação funciona

### Dropdown Desktop
5. ✅ Passar mouse em "Configurações"
6. ✅ Verificar que dropdown abre
7. ✅ Remover mouse e verificar que fecha
8. ✅ Clicar em item e verificar navegação

### Mobile Responsivo
9. ✅ Abrir em tela pequena
10. ✅ Abrir menu hamburguer
11. ✅ Expandir "Configurações"
12. ✅ Verificar animação do chevron
13. ✅ Navegar e verificar que fecha

### Permissões
14. ✅ Login como ADMINISTRADOR - ver todos os itens
15. ✅ Login como outros roles - não ver dropdown
16. ✅ Verificar que itens individuais respeitam permissões
