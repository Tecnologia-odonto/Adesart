# Guia de Início Rápido - Adesao+

## Configuração Inicial

### 1. Criar o Primeiro Administrador

Antes de usar o sistema, você precisa criar o primeiro usuário administrador:

#### Passo 1: Criar usuário no Supabase Auth
1. Acesse: https://vrstknodamvtgbpyxfql.supabase.co
2. Vá em **Authentication** > **Users**
3. Clique em **Add user** > **Create new user**
4. Preencha:
   - **Email**: admin@adesaomais.com (ou seu email)
   - **Password**: escolha uma senha segura
   - **Auto Confirm User**: ✅ Marque esta opção
5. Clique em **Create user**
6. **Copie o UUID** do usuário criado (aparece na coluna ID)

#### Passo 2: Criar perfil do administrador
1. Vá em **SQL Editor** no Supabase Dashboard
2. Clique em **New query**
3. Cole o seguinte código:

```sql
INSERT INTO profiles (id, name, email, role, is_active)
VALUES (
  'COLE_O_UUID_AQUI',
  'Administrador Principal',
  'admin@adesaomais.com',
  'ADMINISTRADOR',
  true
);
```

4. Substitua `COLE_O_UUID_AQUI` pelo UUID que você copiou
5. Clique em **Run**

### 2. Fazer Login

1. Acesse a aplicação
2. Faça login com o email e senha criados
3. Você será direcionado ao Dashboard

## Primeiros Passos no Sistema

### 1. Criar Equipes

1. No menu, clique em **Equipes**
2. Clique em **Nova Equipe**
3. Digite o nome da equipe
4. Clique em **Criar Equipe**

Sugestões de equipes:
- Equipe Vendas
- Equipe Adesão
- Equipe Suporte

### 2. Criar Usuários

1. No menu, clique em **Usuários**
2. Clique em **Novo Usuário**
3. Preencha os campos conforme a função:

#### Para VENDEDOR ou ADESIONISTA:
- **Nome**: Nome completo
- **Email**: Email único
- **Senha**: Senha inicial (mínimo 6 caracteres)
- **Função**: Vendedor ou Adesionista
- **ID Externo**: Código do sistema externo
- **Equipe**: Selecione uma equipe

#### Para SUPERVISOR:
- **Nome**: Nome completo
- **Email**: Email único
- **Senha**: Senha inicial
- **Função**: Supervisor
- **ID Externo**: Código do sistema externo
- **Equipe**: Selecione a equipe que ele supervisionará

#### Para GERENTE (somente Admin pode criar):
- **Nome**: Nome completo
- **Email**: Email único
- **Senha**: Senha inicial
- **Função**: Gerente
- Não precisa de ID Externo nem Equipe

4. Clique em **Criar Usuário**

### 3. Gerenciar Perfil

1. No menu, clique em **Meu Perfil**
2. Clique em **Editar Perfil**
3. Altere seu nome se desejar
4. Clique em **Salvar Alterações**

## Permissões por Função

### 👑 ADMINISTRADOR
- ✅ Ver todos usuários e equipes
- ✅ Criar usuários (todas as funções)
- ✅ Criar e editar equipes
- ✅ Editar qualquer usuário
- ✅ Ver estatísticas completas

### 👔 GERENTE
- ✅ Ver todos usuários e equipes
- ✅ Criar usuários (exceto Administrador)
- ✅ Editar usuários
- ❌ Não pode excluir ou desativar
- ❌ Não pode criar equipes

### 👨‍💼 SUPERVISOR
- ✅ Ver usuários da sua equipe
- ✅ Criar usuários para sua equipe
- ✅ Editar usuários da sua equipe
- ✅ Ver sua equipe
- ❌ Não pode ver outras equipes

### 💼 VENDEDOR / ADESIONISTA
- ✅ Ver seu próprio perfil
- ✅ Editar seu nome
- ✅ Ver sua equipe
- ❌ Não pode criar ou editar outros usuários

## Estrutura Recomendada

```
Adesao+
├── ADMINISTRADOR (você)
├── GERENTE
│   └── Gerencia todas as equipes
├── SUPERVISOR (Equipe Vendas)
│   ├── VENDEDOR 1
│   ├── VENDEDOR 2
│   └── VENDEDOR 3
├── SUPERVISOR (Equipe Adesão)
│   ├── ADESIONISTA 1
│   ├── ADESIONISTA 2
│   └── ADESIONISTA 3
└── SUPERVISOR (Equipe Suporte)
    ├── VENDEDOR 4
    └── ADESIONISTA 4
```

## Dicas

1. **Senhas Iniciais**: Ao criar usuários, use senhas temporárias simples. Os usuários poderão alterá-las depois.

2. **ID Externo**: Use códigos do seu sistema legado para facilitar a integração.

3. **Equipes**: Crie as equipes ANTES de criar os usuários que precisam de equipe.

4. **Supervisores**: Cada supervisor deve estar associado a UMA equipe específica.

5. **Segurança**: O sistema usa RLS (Row Level Security) do Supabase, garantindo que cada usuário só acesse seus dados permitidos.

## Solução de Problemas

### Não consigo fazer login
- Verifique se o usuário foi criado no Auth
- Verifique se o perfil foi criado na tabela profiles
- Confirme que `is_active = true`

### Não vejo o menu de Usuários
- Somente ADMINISTRADOR, GERENTE e SUPERVISOR podem ver
- VENDEDOR e ADESIONISTA não têm acesso a este menu

### Erro ao criar usuário
- Verifique se o email já não existe
- Para VENDEDOR/ADESIONISTA/SUPERVISOR, equipe e ID externo são obrigatórios
- Para ADMINISTRADOR/GERENTE, não pode ter equipe nem ID externo

### Não vejo outros usuários na listagem
- Se você é SUPERVISOR: só vê usuários da sua equipe
- Se você é VENDEDOR/ADESIONISTA: não tem acesso à tela de usuários
- Verifique suas permissões no Dashboard

## Suporte

Para mais informações, consulte o arquivo `README.md` completo.
