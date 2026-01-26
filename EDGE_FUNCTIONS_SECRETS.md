# Edge Functions Secrets - Configuração

Este documento lista todos os secrets que precisam ser configurados no Supabase Dashboard para as Edge Functions funcionarem corretamente.

## Como Configurar

1. Acesse: https://supabase.com/dashboard/project/plonbokgcxwsdqfyjkwl
2. No menu lateral, clique em **Edge Functions**
3. Clique na aba **Manage** (ou **Secrets** se disponível)
4. Clique em **Add secret** ou **New secret**
5. Adicione cada secret listado abaixo

## Secrets Necessários

### 1. ERP_TOKEN (OBRIGATÓRIO)
**Usado em:**
- `erp-check-associado`
- `erp-novo-usuario2`
- `erp-endereco-cep`

**Nome:** `ERP_TOKEN`
**Valor:** `0` (substituir pelo token real do ERP)

**Descrição:** Token de autenticação para as APIs do ERP S4E

---

### 2. ERP_BASE_URL (OPCIONAL)
**Usado em:**
- `erp-check-associado`

**Nome:** `ERP_BASE_URL`
**Valor padrão:** `https://odontoart.s4e.com.br`
**Valor sugerido:** `0` (ou deixar em branco para usar o padrão)

**Descrição:** URL base da API do ERP para consulta de associados

---

### 3. ERP_URL (OPCIONAL)
**Usado em:**
- `erp-novo-usuario2`

**Nome:** `ERP_URL`
**Valor padrão:** `https://odontoart.s4e.com.br/api/vendedor/NovoUsuario2`
**Valor sugerido:** `0` (ou deixar em branco para usar o padrão)

**Descrição:** URL completa da API do ERP para criação de novos usuários

---

### 4. LEMMIT_API_KEY (OBRIGATÓRIO)
**Usado em:**
- `lemit-consulta-pessoa`

**Nome:** `LEMMIT_API_KEY`
**Valor:** `ChaveApi` (substituir pela chave API real da Lemmit)

**Descrição:** Chave de autenticação para a API da Lemmit que realiza consultas de dados pessoais. Cada consulta custa R$ 0,12.

**Endpoint usado:** `http://189.84.127.130:8080/webhook/5e534e38-6f87-400b-a441-821559c6c2e9`

---

## Resumo para Configuração Rápida

Configure os secrets obrigatórios abaixo:

| Nome              | Valor       | Prioridade   |
|-------------------|-------------|--------------|
| `ERP_TOKEN`       | `0`         | OBRIGATÓRIA  |
| `LEMMIT_API_KEY`  | `ChaveApi`  | OBRIGATÓRIA  |
| `ERP_BASE_URL`    | `0`         | Opcional     |
| `ERP_URL`         | `0`         | Opcional     |

**Nota:** Os valores com "0" são placeholders. Substitua pelo valor real quando disponível.

## Verificação

Após configurar os secrets:

1. Aguarde 10-30 segundos para propagação
2. Teste o formulário de cadastro
3. Se ainda houver erro, verifique os logs das Edge Functions no Dashboard

## Onde encontrar os valores reais

- **ERP_TOKEN:** Solicite ao administrador do sistema ERP S4E
- **URLs:** Use os valores padrão, a menos que sua instalação do ERP use URLs diferentes
