# Módulo de Cadastro de Clientes - Documentação Completa

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Fluxo de Uso](#fluxo-de-uso)
- [Componentes](#componentes)
- [Edge Functions](#edge-functions)
- [Banco de Dados](#banco-de-dados)
- [Upload de Arquivos](#upload-de-arquivos)
- [Configurações](#configurações)
- [Validações](#validações)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O módulo de cadastro permite o cadastramento completo de clientes (vidas) para planos de saúde, com integração automática de dados via consulta de CPF (API Lemmit), verificação de duplicidade no ERP, busca de empresas, gestão de dependentes, upload de documentos e envio final para o sistema ERP.

### Características Principais

- ✅ Consulta automática de dados por CPF (API Lemmit)
- ✅ Verificação de duplicidade no ERP
- ✅ Busca inteligente de empresas conveniadas
- ✅ Consulta automática de endereço por CEP
- ✅ Gestão completa de dependentes com planos individuais
- ✅ Upload de documentos com armazenamento temporário
- ✅ Salvamento automático de rascunhos
- ✅ Validação completa antes do envio
- ✅ Sistema de configurações flexível
- ✅ Controle de uso da API Lemmit
- ✅ Logs detalhados de todas as operações
- ✅ Sistema de permissões por tipo de usuário

---

## 🏗 Arquitetura

### Estrutura de Pastas

```
src/
├── components/cadastro/
│   ├── AlreadyExistsModal.tsx          # Modal de CPF duplicado no ERP
│   ├── CadastroModal.tsx               # Modal principal de edição
│   ├── CadastrosCompletosList.tsx      # Lista de cadastros finalizados
│   ├── CadastrosGerenteView.tsx        # View específica para gerentes
│   ├── CadastrosIncompletosList.tsx    # Lista de cadastros em andamento
│   ├── CadastrosSupervisorView.tsx     # View específica para supervisores
│   ├── ClientExistsModal.tsx           # Modal de cliente existente
│   ├── DependenteAtivoModal.tsx        # Modal de dependente ativo
│   ├── DependentesSection.tsx          # Seção de gestão de dependentes
│   ├── EmpresaSearchCard.tsx           # Card de busca de empresas
│   ├── LemmitErrorModal.tsx            # Modal de erro da API Lemmit
│   ├── NovoCadastroCard.tsx            # Card de consulta por CPF
│   └── ObservacoesEmpresaModal.tsx     # Modal de observações da empresa
├── contexts/
│   └── ConfigCadastroContext.tsx       # Contexto de configurações
├── hooks/
│   └── useCadastros.ts                 # Hook customizado do módulo
├── lib/
│   ├── cpf.ts                          # Utilitários de CPF
│   └── mappers.ts                      # Mapeamento de dados
└── pages/
    ├── Cadastro.tsx                    # Página principal
    └── ConfiguracoesCadastro.tsx       # Página de configurações

supabase/
└── functions/
    ├── erp-check-associado/            # Verificação de duplicidade
    ├── erp-endereco-cep/               # Consulta de endereço
    ├── erp-novo-usuario2/              # Envio ao ERP
    ├── erp-search-empresa/             # Busca de empresas
    ├── erp-upload-documento/           # Upload de documento
    └── lemit-consulta-pessoa/          # Consulta Lemmit
```

---

## ✨ Funcionalidades

### 1. Consulta de CPF

**Componente:** `NovoCadastroCard.tsx`

**Funcionalidades:**
- Validação completa de CPF (dígitos verificadores)
- Formatação automática com máscara
- Verificação de duplicidade no ERP ANTES de consultar Lemmit
- Consulta automática na API Lemmit
- Preenchimento automático de dados pessoais
- Controle de uso da API (limites diário e mensal)
- Consulta automática de endereço por CEP

**Fluxo:**
1. Usuário digita CPF
2. Sistema valida formato e dígitos verificadores
3. Verifica se CPF já existe no ERP
4. Se não existe: consulta API Lemmit
5. Preenche dados automaticamente
6. Se houver CEP: consulta endereço no ERP
7. Salva rascunho no banco de dados
8. Abre modal de edição automaticamente

**Dados Preenchidos Automaticamente:**
- Nome completo
- Data de nascimento
- Sexo
- Nome da mãe (se disponível)
- Celulares
- Telefones fixos
- Emails
- Endereços (CEP, logradouro, número, complemento, bairro, cidade, UF)

---

### 2. Busca de Empresas

**Componente:** `EmpresaSearchCard.tsx`

**Funcionalidades:**
- Busca por nome da empresa
- Busca por CNPJ
- Busca por ID específico
- Listagem de planos disponíveis
- Informações sobre matrícula obrigatória
- Observações e instruções da empresa

**Dados Exibidos:**
- Nome da empresa
- CNPJ
- Se exige matrícula
- Lista de planos com:
  - Código do plano
  - Nome personalizado (se configurado)
  - Valor titular
  - Valor dependente
- Observações especiais

---

### 3. Gestão de Dependentes

**Componente:** `DependentesSection.tsx`

**Funcionalidades:**
- Adicionar ilimitados dependentes
- Editar dependentes existentes
- Remover dependentes
- Validação de campos obrigatórios
- CPF opcional para menores de 18 anos
- Nome da mãe obrigatório
- Sincronização automática do titular com dados principais

**Campos do Dependente:**
- Grau de parentesco (configurável)
- Nome completo
- Data de nascimento
- CPF (obrigatório para maiores de 18 anos)
- Sexo
- Plano (seleção individual)
- Nome da mãe

**Validações:**
- Somente 1 titular permitido
- Todos os dependentes devem ter plano selecionado
- CPF obrigatório se idade >= 18 anos
- Titular é criado automaticamente com dados do responsável

**Tipos de Parentesco:**
Os tipos são configuráveis na tela de "Configurações de Cadastro". Exemplos:
- 1 - Titular
- 2 - Cônjuge
- 3 - Filho(a)
- 4 - Pai/Mãe
- 5 - Outros

---

### 4. Endereço Inteligente

**Funcionalidade:** Consulta automática de CEP no ERP

**Quando Ocorre:**
- Automaticamente após consulta Lemmit (se houver CEP)
- Ao usuário digitar CEP no modal (quando completar 8 dígitos)

**Dados Obtidos:**
- Tipo de logradouro (com ID do ERP)
- Logradouro
- Bairro (com ID do ERP)
- Município (com ID do ERP)
- UF (com ID do ERP)
- Sigla da UF

**Vantagem:**
Os IDs do ERP são necessários para o payload final. Sem eles, o sistema usa valores de fallback que podem não funcionar corretamente.

---

### 5. Upload de Documentos

**Funcionalidade:** Upload e gerenciamento de arquivos do cliente

#### Características

- **Tipos Aceitos:** PDF, JPG, PNG
- **Tamanho Máximo:** 10MB por arquivo
- **Armazenamento:** Supabase Storage (bucket `cadastros-temp-files`)
- **Obrigatoriedade:** Configurável (pode ser obrigatório ou opcional)

#### Fluxo do Arquivo

**1. Upload:**
```
Usuário seleciona arquivo
    ↓
Arquivo é enviado para Supabase Storage
    ↓
Caminho do arquivo é armazenado em memória
    ↓
Arquivo é convertido para base64 (para envio ao ERP)
    ↓
Feedback visual: "Arquivo carregado com sucesso"
```

**2. Salvamento:**
```
Usuário clica em "Salvar"
    ↓
Sistema salva referência do arquivo no banco
    ↓
Campo `arquivo_path` é atualizado na tabela `cadastros`
    ↓
Arquivo permanece no Storage
```

**3. Recuperação:**
```
Usuário reabre o cadastro
    ↓
Sistema lê campo `arquivo_path`
    ↓
Baixa arquivo do Storage
    ↓
Converte para base64 novamente
    ↓
Arquivo está disponível para envio ao ERP
```

**4. Envio ao ERP:**
```
Usuário clica em "Cadastrar"
    ↓
Cadastro é enviado e bem-sucedido
    ↓
Sistema obtém código do dependente do response
    ↓
Envia arquivo para ERP via Edge Function
    ↓
Se sucesso: deleta arquivo do Storage
    ↓
Atualiza campo `arquivo_path` para null
```

**5. Remoção Manual:**
```
Usuário clica no botão de remover arquivo
    ↓
Arquivo é deletado do Storage
    ↓
Estados são resetados (base64, nome, path)
    ↓
Campo de upload volta ao estado inicial
```

#### Benefícios

- ✅ Arquivo não é perdido se usuário fechar o modal
- ✅ Arquivo permanece disponível até conclusão do cadastro
- ✅ Storage é liberado automaticamente após sucesso
- ✅ Usuário pode trocar o arquivo quantas vezes quiser
- ✅ Validação de tamanho e tipo no upload
- ✅ Feedback visual claro em cada etapa

---

### 6. Salvamento de Rascunhos

**Funcionalidade:** Salvamento automático de dados parciais

**Quando Ocorre:**
- Ao consultar CPF (cria rascunho inicial)
- Ao clicar em "Salvar" no modal (atualiza rascunho)

**Status do Cadastro:**
- `incompleto`: Cadastro em andamento
- `enviado`: Cadastro finalizado com sucesso no ERP
- `erro_envio`: Erro ao enviar para o ERP

**Dados Salvos no Rascunho:**
- Dados pessoais (nome, nascimento, sexo, nome da mãe)
- CPF
- Contatos
- Endereço
- Dependentes
- Empresa selecionada
- Vendedor/Adesionista
- Matrícula (se aplicável)
- Referência do arquivo (se houver)
- Dados brutos da Lemmit (para auditoria)

---

### 7. Validação e Envio

**Funcionalidade:** Validação completa e envio ao ERP

**Validações Obrigatórias:**

✅ **Dados Pessoais:**
- Nome completo preenchido
- Data de nascimento preenchida
- Sexo selecionado
- Nome da mãe preenchido
- External ID configurado (usuários CADASTRO/ADESIONISTA)

✅ **Contatos:**
- Pelo menos 1 telefone adicionado
- Um telefone marcado como principal

✅ **Endereço:**
- CEP preenchido (8 dígitos)
- Logradouro preenchido
- Número preenchido
- Bairro preenchido
- Cidade preenchida
- UF preenchida

✅ **Empresa:**
- Empresa selecionada
- Matrícula preenchida (se empresa exigir)

✅ **Dependentes:**
- Exatamente 1 titular
- Todos os dependentes com plano selecionado
- CPF preenchido para maiores de 18 anos

✅ **Arquivo:**
- Arquivo carregado (se configurado como obrigatório)

**Após Validação:**
1. Sistema monta payload no formato do ERP
2. Envia via Edge Function `erp-novo-usuario2`
3. Se sucesso:
   - Atualiza status para `enviado`
   - Salva response do ERP
   - Envia arquivo (se houver)
   - Deleta arquivo do Storage
   - Exibe mensagem de sucesso
4. Se erro:
   - Atualiza status para `erro_envio`
   - Salva mensagem de erro
   - Mantém arquivo no Storage
   - Exibe modal com detalhes do erro

---

## 🔄 Fluxo de Uso

### Fluxo Completo Passo a Passo

#### Etapa 1: Consulta Inicial

```
1. Usuário acessa aba "Cadastro"
2. Seleciona "Novo Cadastro"
3. Digita CPF no campo
4. Clica em "Consultar"
   ↓
5. Sistema valida CPF
   ├─ Inválido? → Exibe erro
   └─ Válido? → Continua
   ↓
6. Sistema verifica duplicidade no ERP
   ├─ Existe? → Exibe modal de duplicidade → FIM
   └─ Não existe? → Continua
   ↓
7. Sistema verifica limite de uso Lemmit
   ├─ Excedido? → Exibe erro → FIM
   └─ OK? → Continua
   ↓
8. Sistema consulta API Lemmit
   ├─ Erro? → Exibe mensagem → FIM
   └─ Sucesso? → Continua
   ↓
9. Se houver CEP: consulta endereço no ERP
10. Cria titular automaticamente com dados do CPF
11. Salva rascunho (status='incompleto')
12. Abre modal de edição
```

#### Etapa 2: Edição e Complemento

```
1. Modal abre com dados pré-preenchidos
2. Usuário revisa e edita dados pessoais
3. Adiciona/remove/edita contatos
4. Marca telefone principal
5. Edita endereço (ou digita novo CEP)
6. Busca empresa conveniada
7. Seleciona empresa da lista
8. Planos da empresa são carregados
9. Edita dependentes:
   - Titular já existe (sincroniza com dados principais)
   - Adiciona outros dependentes
   - Seleciona plano para cada um
10. Faz upload de documento (se necessário)
11. Clica em "Salvar"
    ↓
12. Dados são salvos no banco
13. Referência do arquivo é salva
14. Modal pode ser fechado (dados não são perdidos)
```

#### Etapa 3: Finalização e Envio

```
1. Usuário reabre cadastro da lista "Inclusões Pendentes"
2. Modal abre com todos os dados salvos
3. Arquivo aparece carregado (se houver)
4. Usuário revisa tudo
5. Clica em "Cadastrar"
   ↓
6. Sistema valida TODOS os campos obrigatórios
   ├─ Falta algo? → Exibe erro específico → Volta para edição
   └─ Tudo OK? → Continua
   ↓
7. Sistema monta payload no formato do ERP
8. Envia para Edge Function
   ↓
9. Edge Function chama API do ERP
   ├─ Erro?
   │   ├─ Dependente já ativo?
   │   │   └─ Exibe modal com lista de dependentes ativos
   │   └─ Outro erro?
   │       └─ Exibe mensagem de erro
   │       └─ Cadastro fica como 'erro_envio'
   │       └─ Arquivo permanece no Storage
   └─ Sucesso?
       ↓
      10. Atualiza status='enviado'
      11. Salva response do ERP (códigos, boleto, etc)
      12. Se houver arquivo:
           ├─ Envia arquivo para ERP
           ├─ Deleta arquivo do Storage
           └─ Atualiza arquivo_path=null
      13. Exibe mensagem de sucesso
      14. Fecha modal
      15. Remove da lista de pendentes
      16. Aparece na lista de completos
```

---

## 🧩 Componentes

### NovoCadastroCard

**Responsabilidade:** Consulta de CPF e criação de rascunho inicial

**Props:**
```typescript
interface NovoCadastroCardProps {
  onSuccess: (cadastro: Cadastro, isBlocked: boolean) => void;
}
```

**Estados:**
- `cpf`: CPF digitado
- `loading`: Estado de carregamento
- `error`: Mensagem de erro
- Modais: duplicidade, erro Lemmit

**Métodos Principais:**
- `handleConsultarCPF()`: Orquestra todo o fluxo de consulta
- `checkERPAssociado()`: Verifica duplicidade
- `consultarCPF()`: Consulta Lemmit
- `consultarEnderecoCEP()`: Consulta endereço

---

### CadastroModal

**Responsabilidade:** Edição completa e envio do cadastro

**Props:**
```typescript
interface CadastroModalProps {
  cadastro: Cadastro;
  onClose: () => void;
  onSuccess: () => void;
}
```

**Estados Principais:**
- `formData`: Dados do formulário
- `dependentes`: Lista de dependentes
- `planosEmpresa`: Planos da empresa selecionada
- `arquivoBase64`: Arquivo em base64
- `arquivoNome`: Nome do arquivo
- `arquivoPath`: Caminho no Storage
- `uploadingFile`: Estado de upload
- `loading`: Estado de carregamento
- `error`: Mensagem de erro
- `success`: Mensagem de sucesso

**Métodos Principais:**
- `handleSave()`: Salva rascunho
- `handleEnviar()`: Valida e envia ao ERP
- `handleArquivoChange()`: Upload de arquivo
- `handleCEPChange()`: Consulta CEP
- `handleDelete()`: Deleta cadastro (apenas admin)

---

### DependentesSection

**Responsabilidade:** Gestão de dependentes

**Props:**
```typescript
interface DependentesSectionProps {
  dependentes: Dependente[];
  planos: any[];
  funcionarioCadastro: number | null;
  onChange: (dependentes: Dependente[]) => void;
}
```

**Funcionalidades:**
- Adicionar dependente
- Editar dependente
- Remover dependente
- Validar CPF por idade
- Filtrar planos ocultos
- Sincronizar titular automaticamente

---

### EmpresaSearchCard

**Responsabilidade:** Busca de empresas

**Props:**
```typescript
interface EmpresaSearchCardProps {
  onSelect: (empresa: any) => void;
}
```

**Funcionalidades:**
- Busca por query (nome/CNPJ)
- Busca por ID
- Exibe lista de resultados
- Mostra planos disponíveis
- Exibe observações

---

## 🔌 Edge Functions

### 1. lemit-consulta-pessoa

**Endpoint:** `/functions/v1/lemit-consulta-pessoa`

**Payload:**
```json
{
  "cpf": "12345678900"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nome": "João Silva",
    "nome_mae": "Maria Silva",
    "data_nascimento": "1990-01-01",
    "sexo": "M",
    "celulares": [...],
    "emails": [...],
    "enderecos": [...]
  }
}
```

**Funcionalidades:**
- Consulta API Lemmit
- Verifica limite de uso
- Incrementa contador
- Registra log
- Retorna dados formatados

---

### 2. erp-check-associado

**Endpoint:** `/functions/v1/erp-check-associado`

**Payload:**
```json
{
  "cpf": "12345678900",
  "empresaId": "5"
}
```

**Response (não existe):**
```json
{
  "ok": true,
  "exists": false
}
```

**Response (existe):**
```json
{
  "ok": true,
  "exists": true,
  "data": {
    "codigo": 123456,
    "nome": "João Silva",
    "empresa": "Empresa X",
    "codigoContrato": "ABC123"
  }
}
```

---

### 3. erp-search-empresa

**Endpoint:** `/functions/v1/erp-search-empresa`

**Payload:**
```json
{
  "query": "Empresa",
  "type": "name"  // "name", "cnpj", ou "id"
}
```

**Response:**
```json
{
  "ok": true,
  "empresas": [
    {
      "id": 5,
      "nome": "Empresa Exemplo",
      "cnpj": "12.345.678/0001-00",
      "exigeMatricula": 1,
      "precoPlano": [...],
      "observacoes": "..."
    }
  ]
}
```

---

### 4. erp-endereco-cep

**Endpoint:** `/functions/v1/erp-endereco-cep`

**Payload:**
```json
{
  "cep": "60000000"
}
```

**Response:**
```json
{
  "ok": true,
  "dados": {
    "IdTipoLogradouro": 816,
    "TipoLogradouro": "RUA",
    "Logradouro": "Exemplo",
    "IdBairro": 1262,
    "Bairro": "Centro",
    "IdMunicipio": 2,
    "Municipio": "Fortaleza",
    "IdUf": 5,
    "Uf": "CEARA",
    "UfSigla": "CE"
  }
}
```

---

### 5. erp-novo-usuario2

**Endpoint:** `/functions/v1/erp-novo-usuario2`

**Payload:** Ver `API_REGRAS.md` para payload completo

**Response (sucesso):**
```json
{
  "success": true,
  "data": {
    "dados": {
      "codigo": 311193412,
      "boletoId": 6277862,
      "boletoURL": "http://...",
      "dependentes": [
        {
          "codigo": "311444312",
          "contrato": ""
        }
      ]
    }
  }
}
```

---

### 6. erp-upload-documento

**Endpoint:** `/functions/v1/erp-upload-documento`

**Payload:**
```json
{
  "idFuncionario": 123,
  "idDependente": 311444312,
  "arquivo": "base64_encoded_file",
  "arquivoNome": "arquivo.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Documento enviado com sucesso"
}
```

---

## 🗄 Banco de Dados

### Tabela: cadastros

```sql
CREATE TABLE cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text CHECK (status IN ('incompleto', 'enviado', 'erro_envio')),
  created_by uuid REFERENCES profiles(id),
  team_id uuid REFERENCES teams(id),
  cpf text NOT NULL,
  nome text,
  data_nascimento date,
  sexo text,
  sexo_codigo integer,
  nome_mae text,
  numero_matricula text,
  contatos jsonb,
  endereco jsonb,
  dependentes jsonb,
  lemit_raw jsonb,
  empresa_id integer,
  empresa_nome text,
  empresa_cnpj text,
  empresa_raw jsonb,
  empresa_exige_matricula integer,
  planos_raw jsonb,
  vendedor_id uuid,
  vendedor_codigo text,
  vendedor_nome text,
  adesionista_id uuid,
  adesionista_codigo text,
  adesionista_nome text,
  arquivo_path text,
  cliente_sera_usuario boolean DEFAULT false,
  payload_erp jsonb,
  erp_response jsonb,
  erp_dados_associado jsonb,
  motivo_bloqueio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Índices:**
```sql
CREATE INDEX idx_cadastros_cpf ON cadastros(cpf);
CREATE INDEX idx_cadastros_status ON cadastros(status);
CREATE INDEX idx_cadastros_created_by ON cadastros(created_by);
CREATE INDEX idx_cadastros_team_id ON cadastros(team_id);
```

---

### Tabela: cadastro_config

```sql
CREATE TABLE cadastro_config (
  id integer PRIMARY KEY DEFAULT 1,
  ativar_lemmit boolean DEFAULT true,
  situacoes_que_barram integer[] DEFAULT ARRAY[]::integer[],
  planos_validos integer[] DEFAULT ARRAY[]::integer[],
  planos_ocultos text[] DEFAULT ARRAY[]::text[],
  exigir_arquivo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

### Tabela: cadastro_parentesco_map

```sql
CREATE TABLE cadastro_parentesco_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parentesco_id integer UNIQUE NOT NULL,
  label text NOT NULL,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

### Tabela: cadastro_planos_map

```sql
CREATE TABLE cadastro_planos_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id integer UNIQUE NOT NULL,
  nome_exibicao text NOT NULL,
  registro_produto text,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

### Storage Bucket: cadastros-temp-files

```sql
-- Bucket criado via migration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cadastros-temp-files',
  'cadastros-temp-files',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
);
```

**Políticas RLS:**
- Usuários autenticados podem fazer upload
- Usuários autenticados podem ler seus arquivos
- Usuários autenticados podem deletar seus arquivos

---

## 📤 Upload de Arquivos

### Estrutura de Armazenamento

```
Supabase Storage
└── cadastros-temp-files/
    └── cadastros/
        └── {cadastro_id}/
            └── {nome_arquivo}_{cpf}_{timestamp}.{ext}
```

**Exemplo de caminho:**
```
cadastros-temp-files/cadastros/uuid-123/JoaoSilva_12345678900_1673456789.pdf
```

### Ciclo de Vida do Arquivo

```
1. UPLOAD
   - Usuário seleciona arquivo
   - Validação de tipo e tamanho
   - Upload para Storage
   - Conversão para base64
   - Feedback visual

2. SALVAMENTO
   - Usuário clica em "Salvar"
   - Caminho salvo em cadastros.arquivo_path
   - Arquivo permanece no Storage

3. RECUPERAÇÃO
   - Usuário reabre cadastro
   - Sistema baixa do Storage
   - Reconverte para base64
   - Arquivo pronto para envio

4. ENVIO AO ERP
   - Cadastro bem-sucedido no ERP
   - Código do dependente obtido
   - Upload para API do ERP
   - Sucesso → Delete do Storage
   - Erro → Mantém no Storage

5. LIMPEZA
   - Arquivo deletado do Storage
   - Campo arquivo_path = null
   - Espaço liberado
```

### Validações

- **Tamanho:** Máximo 10MB
- **Tipos:** PDF, JPG, PNG
- **Obrigatoriedade:** Configurável
- **Nome:** Inclui nome, CPF e timestamp
- **Unicidade:** Upsert permite substituição

---

## ⚙️ Configurações

### Tela de Configurações

Acesse: **Configurações de Cadastro** (menu lateral)

#### 1. Configurações Gerais

- **Ativar Lemmit:** Liga/desliga consulta automática
- **Exigir Arquivo:** Torna upload obrigatório ou opcional
- **Situações que Barram:** Lista de códigos de situação que impedem cadastro
- **Planos Válidos:** Lista de planos permitidos
- **Planos Ocultos:** Planos que não aparecem na seleção

#### 2. Mapeamento de Parentesco

Configurar tipos de parentesco aceitos:
- ID (código do ERP)
- Label (nome exibido)
- Ativo/Inativo
- Ordem de exibição

#### 3. Mapeamento de Planos

Configurar nomes personalizados para planos:
- ID do Plano (código do ERP)
- Nome de Exibição
- Registro do Produto (ANS)
- Ativo/Inativo
- Ordem de exibição

#### 4. Logs de API

Visualizar histórico de chamadas:
- Usuário que fez a chamada
- Endpoint chamado
- Payload enviado
- Response recebido
- Status (sucesso/erro)
- Tempo de execução

---

## ✅ Validações

### Validação de CPF

```typescript
function validateCPF(cpf: string): boolean {
  // Remove máscara
  cpf = cpf.replace(/\D/g, '');

  // Verifica tamanho
  if (cpf.length !== 11) return false;

  // Verifica sequências
  if (/^(\d)\1+$/.test(cpf)) return false;

  // Valida dígito verificador 1
  // Valida dígito verificador 2

  return true;
}
```

### Validação de Campos Obrigatórios

```typescript
const validations = {
  nome: !!formData.nome,
  nomeMae: !!formData.nomeMae,
  dataNascimento: !!formData.dataNascimento,
  sexo: formData.sexo !== null && formData.sexo !== undefined,
  telefones: telefones.length > 0,
  telefonePrincipal: telefones.some(t => t.principal),
  cep: !!formData.endereco.cep,
  logradouro: !!formData.endereco.logradouro,
  numero: !!formData.endereco.numero,
  bairro: !!formData.endereco.bairro,
  cidade: !!formData.endereco.cidade,
  uf: !!formData.endereco.uf,
  empresa: !!cadastro.empresa_id,
  matricula: !cadastro.empresa_exige_matricula || !!formData.numeroMatricula,
  titular: dependentes.filter(d => d.tipo === 1).length === 1,
  planosCompletos: dependentes.every(d => d.plano && d.plano !== 0),
  arquivo: !config?.exigir_arquivo || !!arquivoBase64,
  externalId: !!funcionarioCadastroId
};
```

---

## 🐛 Troubleshooting

### Erro: "Limite de consultas excedido"

**Causa:** Time atingiu limite diário ou mensal

**Soluções:**
1. Aguardar reset automático
2. Admin resetar manualmente
3. Admin aumentar limite
4. Admin desativar limite temporariamente

---

### Erro: "CPF já cadastrado"

**Causa:** CPF existe no ERP

**Soluções:**
1. Verificar dados no modal
2. Confirmar duplicidade
3. Se necessário, atualizar no ERP
4. Não é possível prosseguir com CPF duplicado

---

### Erro: "Campo obrigatório: External ID"

**Causa:** Usuários CADASTRO/ADESIONISTA sem External ID

**Soluções:**
1. Ir em "Meu Perfil"
2. Preencher "ID Externo"
3. Salvar
4. Tentar novamente

---

### Erro: "CEP não encontrado"

**Causa:** CEP não existe no ERP

**Soluções:**
1. Verificar se CEP está correto
2. Preencher campos manualmente
3. Sistema usará valores de fallback para IDs

---

### Arquivo não aparece após reabrir

**Causa:** Não clicou em "Salvar" após upload

**Soluções:**
1. Upload novamente
2. Clicar em "Salvar"
3. Arquivo ficará disponível

---

### Erro ao enviar arquivo para ERP

**Causa:** Código do dependente não retornado

**Soluções:**
1. Verificar response do ERP
2. Verificar se cadastro foi bem-sucedido
3. Arquivo permanece no Storage
4. Pode tentar enviar manualmente

---

## 📊 Estatísticas

### Métricas Disponíveis

- Total de cadastros por status
- Cadastros por usuário
- Cadastros por equipe
- Uso da API Lemmit
- Taxa de sucesso de envio ao ERP
- Tempo médio de cadastro
- Empresas mais cadastradas

### Relatórios

Ver documentação específica de relatórios (em desenvolvimento).

---

## 🚀 Próximas Melhorias

- [ ] Edição em lote de cadastros
- [ ] Importação via planilha
- [ ] Exportação de cadastros
- [ ] Notificações de status
- [ ] Histórico de alterações
- [ ] Anexar múltiplos arquivos
- [ ] Validação de documentos (OCR)
- [ ] Assinatura digital

---

**Versão:** 2.0
**Última atualização:** Janeiro 2026
