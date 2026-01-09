# Módulo de Cadastro - Documentação Completa

## Visão Geral

Módulo completo de cadastro com consulta CPF via API Lemit, edição manual e envio automático para API do ERP.

## Estrutura Implementada

### 1. Banco de Dados (Supabase)

#### Tabela: `cadastros`
```sql
- id (uuid, PK)
- status (text) - 'incompleto' | 'enviado' | 'erro_envio'
- created_by (uuid) - FK para profiles
- team_id (uuid) - FK para teams
- cpf (text)
- nome (text)
- data_nascimento (date)
- sexo (text)
- sexo_codigo (integer) - 1=Masculino, 2=Feminino
- contatos (jsonb) - Array de contatos selecionados
- endereco (jsonb) - Dados de endereço
- lemit_raw (jsonb) - Resposta completa da API Lemit
- cliente_sera_usuario (boolean)
- payload_erp (jsonb) - Payload enviado ao ERP
- erp_response (jsonb) - Resposta do ERP
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### Atualização de Roles
- Adicionado role 'CADASTRO' à constraint de profiles

#### RLS (Row Level Security)
Políticas por role:

**ADMINISTRADOR**
- SELECT: todos os cadastros
- INSERT: sim
- UPDATE: todos os cadastros
- DELETE: todos os cadastros

**GERENTE**
- SELECT: todos os cadastros
- INSERT: sim
- UPDATE: todos os cadastros
- DELETE: não

**CADASTRO / ADESIONISTA**
- SELECT: todos os cadastros
- INSERT: sim
- UPDATE: todos os cadastros
- DELETE: não

**SUPERVISOR**
- SELECT: apenas cadastros da sua equipe (team_id)
- INSERT: sim
- UPDATE: apenas cadastros da sua equipe
- DELETE: não

**VENDEDOR**
- SELECT: apenas seus próprios cadastros (created_by)
- INSERT: sim
- UPDATE: apenas seus próprios cadastros
- DELETE: não

### 2. Edge Functions

#### 2.1. lemit-consulta-pessoa
**Endpoint:** `/functions/v1/lemit-consulta-pessoa`

**Método:** POST

**Request:**
```json
{
  "cpf": "12345678900"
}
```

**Response (Sucesso):**
```json
{
  "nome": "João da Silva",
  "data_nascimento": "1990-01-01",
  "sexo": "M",
  "celulares": [{"numero": "85999999999"}],
  "emails": [{"email": "joao@email.com"}],
  "enderecos": [{...}],
  ...
}
```

**Variável de Ambiente Necessária:**
- `LEMIT_TOKEN` - Token de autenticação da API Lemit

#### 2.2. erp-novo-usuario2
**Endpoint:** `/functions/v1/erp-novo-usuario2`

**Método:** POST

**Request:** (Payload completo do ERP)

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {...}
}
```

**Variáveis de Ambiente Necessárias:**
- `ERP_TOKEN` - Token de autenticação da API do ERP
- `ERP_URL` (opcional) - URL do endpoint do ERP (padrão: https://odontoart.s4e.com.br/api/vendedor/NovoUsuario2)

### 3. Estrutura de Código

```
src/
├── components/
│   └── cadastro/
│       ├── NovoCadastroCard.tsx       # Card de consulta por CPF
│       ├── CadastrosIncompletosList.tsx # Lista de cadastros incompletos
│       └── CadastroModal.tsx          # Modal de edição/envio
├── hooks/
│   └── useCadastros.ts                # Hook customizado para gerenciar cadastros
├── lib/
│   ├── cpf.ts                         # Validação, formatação e máscaras
│   └── mappers.ts                     # Transformação Lemit → Interno → ERP
├── pages/
│   └── Cadastro.tsx                   # Página principal do módulo
└── App.tsx                            # Rota adicionada
```

### 4. Fluxo Completo

#### 4.1. Novo Cadastro
1. Usuário digita CPF (com validação de dígitos verificadores)
2. Sistema consulta API Lemit via Edge Function
3. Dados são mapeados e salvos como rascunho (status='incompleto')
4. Modal abre automaticamente para edição

#### 4.2. Edição de Rascunho
1. Usuário visualiza lista de cadastros incompletos
2. Clica para editar
3. Modal abre com dados pré-preenchidos
4. Pode editar manualmente todos os campos
5. Salva alterações (mantém status='incompleto')

#### 4.3. Envio para ERP
1. Usuário clica em "Cadastrar"
2. Sistema valida campos obrigatórios
3. Monta payload no formato do ERP
4. Envia via Edge Function
5. Se sucesso: status='enviado', salva resposta
6. Se erro: status='erro_envio', salva erro

### 5. Componentes Principais

#### NovoCadastroCard
- Campo CPF com máscara
- Validação de CPF
- Botão "Consultar"
- 2 checkboxes placeholder
- Loading states

#### CadastrosIncompletosList
- Lista responsiva de cadastros incompletos
- Badge de status visual
- Ordenação por updated_at DESC
- Click para abrir modal

#### CadastroModal
- Formulário completo responsivo
- Seleção de contatos principais
- Edição de endereço
- Checkbox "Cliente será usuário do plano?"
- Botões: Salvar, Cadastrar, Excluir (apenas Admin)
- Estados de loading e erro

### 6. Validações Implementadas

- **CPF**: Validação completa de dígitos verificadores
- **Data**: Conversão ISO → Date → DD/MM/AAAA
- **Telefone**: Armazenado sem máscara, exibido formatado
- **Sexo**: Mapeamento M→1, F→2
- **Campos obrigatórios**: Nome, Data Nascimento, Sexo, Telefone Principal, Endereço

### 7. Formatação de Payload ERP

O sistema monta automaticamente o payload no formato:

```json
{
  "dados": {
    "parceiro": { "codigo": 15921, "tipoCobranca": 1 },
    "parcelaRetidaComissao": "0",
    "responsavelFinanceiro": {
      "codigoContrato": 4688,
      "nome": "...",
      "dataNascimento": "DD/MM/AAAA",
      "cpf": "###.###.###-##",
      "sexo": 1,
      "grupoFaturamento": 0,
      "sexoDescricao": "Masculino",
      "identidadeNumero": "123456789",
      "identidadeOrgaoExpeditor": "SSPDS",
      "endereco": {...},
      "contatoResponsavelFinanceiro": [{...}],
      "fl_AlteraSituacao": 1
    },
    "dependente": [{...}]
  },
  "empresa": "4688"
}
```

### 8. Navegação

Nova aba "Cadastro" adicionada à sidebar, visível para todos os usuários autenticados.

### 9. Segurança

- Tokens nunca expostos no frontend
- Todas as chamadas via Edge Functions
- RLS estrito por role
- Validação em múltiplas camadas

### 10. Configuração Necessária

#### Variáveis de Ambiente (Backend/Supabase)
```env
LEMIT_TOKEN=seu_token_lemit_aqui
ERP_TOKEN=seu_token_erp_aqui
ERP_URL=https://odontoart.s4e.com.br/api/vendedor/NovoUsuario2
```

#### Variáveis de Ambiente (Frontend - já configuradas)
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Status de Implementação

✅ Migração do banco de dados
✅ RLS policies por role
✅ Edge Function Lemit
✅ Edge Function ERP
✅ Utilitários (validação, formatação, mappers)
✅ Hook useCadastros
✅ Componentes de UI
✅ Página principal
✅ Rota e navegação
✅ Build bem-sucedido

## Próximos Passos Recomendados

1. Configurar os tokens LEMIT_TOKEN e ERP_TOKEN no Supabase
2. Testar o fluxo completo em ambiente de desenvolvimento
3. Validar integração com API Lemit
4. Validar integração com API ERP
5. Ajustar códigos fixos (tipoLogradouro, bairro, municipio, uf) conforme necessidade do ERP
