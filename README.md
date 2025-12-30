# Adesao+ - Sistema de Gestão ERP

Sistema ERP completo para gestão de usuários e equipes com autenticação e controle de acesso baseado em roles (RBAC).

## Funcionalidades

### Módulos Implementados

- **Autenticação**: Login com email e senha via Supabase Auth
- **Gestão de Usuários**: Criação, visualização e edição de usuários
- **Gestão de Equipes**: Criação e visualização de equipes
- **Dashboard**: Visualização de estatísticas e informações do sistema
- **Meu Perfil**: Visualização e edição do perfil do usuário logado

### Roles (Funções)

O sistema possui 5 níveis de acesso:

#### ADMINISTRADOR
- Acesso total ao sistema
- Pode criar, editar e excluir usuários e equipes
- Visualiza todos os dados do sistema
- Campos obrigatórios: Nome, Email

#### GERENTE
- Pode visualizar todas equipes e usuários
- Pode criar e editar usuários
- Não pode excluir ou desativar
- Campos obrigatórios: Nome, Email

#### SUPERVISOR
- Acesso apenas aos usuários da sua equipe
- Pode criar e editar usuários da sua equipe
- Campos obrigatórios: Nome, Email, ID Externo, Equipe

#### VENDEDOR
- Acesso apenas ao próprio perfil
- Campos obrigatórios: Nome, Email, ID Externo, Equipe

#### ADESIONISTA
- Acesso apenas ao próprio perfil
- Campos obrigatórios: Nome, Email, ID Externo, Equipe

## Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Autenticação**: Supabase Auth (email/password)

## Estrutura do Banco de Dados

### Tabela `teams`
- `id`: UUID (PK)
- `name`: Texto único
- `is_active`: Boolean
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Tabela `profiles`
- `id`: UUID (PK, FK para auth.users)
- `name`: Texto
- `email`: Texto único
- `role`: Enum (ADMINISTRADOR, GERENTE, SUPERVISOR, VENDEDOR, ADESIONISTA)
- `external_id`: Texto (obrigatório para SUPERVISOR, VENDEDOR, ADESIONISTA)
- `team_id`: UUID (FK para teams, obrigatório para SUPERVISOR, VENDEDOR, ADESIONISTA)
- `is_active`: Boolean
- `created_at`: Timestamp
- `updated_at`: Timestamp

## Row Level Security (RLS)

O sistema utiliza políticas RLS do Supabase para garantir que cada usuário só acesse os dados permitidos para sua role:

- **ADMINISTRADOR/GERENTE**: Visualizam todos os dados
- **SUPERVISOR**: Visualiza apenas dados da sua equipe
- **VENDEDOR/ADESIONISTA**: Visualizam apenas seus próprios dados

## Edge Functions

### create-user
Função para criar novos usuários no sistema. Cria o registro de autenticação e o perfil do usuário de forma atômica.

**Endpoint**: `/functions/v1/create-user`

**Método**: POST

**Payload**:
```json
{
  "name": "Nome do Usuário",
  "email": "email@exemplo.com",
  "password": "senha123",
  "role": "VENDEDOR",
  "external_id": "EXT123",
  "team_id": "uuid-da-equipe"
}
```

## Bootstrap do Sistema

Para criar o primeiro usuário ADMINISTRADOR:

1. Acesse o Supabase Dashboard
2. Vá em Authentication > Users
3. Crie um novo usuário com email e senha
4. Vá em SQL Editor
5. Execute o seguinte SQL (substitua os valores):

```sql
INSERT INTO profiles (id, name, email, role, is_active)
VALUES (
  'USER_ID_FROM_AUTH',
  'Admin Principal',
  'admin@adesaomais.com',
  'ADMINISTRADOR',
  true
);
```

## Estrutura de Arquivos

```
src/
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Layout.tsx
│   ├── ProtectedRoute.tsx
│   └── Select.tsx
├── contexts/
│   └── AuthContext.tsx
├── lib/
│   └── supabase.ts
├── pages/
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── Profile.tsx
│   ├── Teams.tsx
│   └── Users.tsx
├── App.tsx
├── main.tsx
└── index.css
```

## Variáveis de Ambiente

O arquivo `.env` já está configurado com as credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://vrstknodamvtgbpyxfql.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Como Usar

### Desenvolvimento

O servidor de desenvolvimento já está sendo executado automaticamente. Acesse a aplicação no navegador.

### Build

```bash
npm run build
```

### Fluxo de Uso

1. **Login**: Acesse a tela de login e entre com suas credenciais
2. **Dashboard**: Após o login, você será direcionado ao dashboard
3. **Criar Equipes** (Admin): Vá em "Equipes" e crie as equipes necessárias
4. **Criar Usuários** (Admin/Gerente/Supervisor): Vá em "Usuários" e crie novos usuários
5. **Gerenciar Perfil**: Todos os usuários podem editar seu próprio perfil

## Segurança

- Todas as senhas são criptografadas pelo Supabase Auth
- Row Level Security (RLS) ativo em todas as tabelas
- Políticas RLS garantem que usuários só acessem dados permitidos
- Edge Functions validam permissões antes de criar usuários
- Tokens JWT para autenticação de requisições

## Próximos Passos

- Implementar edição de usuários existentes
- Adicionar funcionalidade de desativar/reativar usuários
- Implementar filtros e busca na listagem de usuários
- Adicionar paginação nas listagens
- Implementar relatórios e analytics
- Adicionar auditoria de ações
- Implementar recuperação de senha
- Adicionar notificações e alertas
