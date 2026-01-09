# Configuração de Tokens - ADICIONAR TOKEN

## Tokens Necessários

Para o módulo de Cadastro funcionar corretamente, você precisa configurar os seguintes tokens no Supabase Dashboard:

### 1. LEMIT_TOKEN
**Descrição:** Token de autenticação para a API Lemit (consulta de CPF)

**Valor:** `ADICIONAR_TOKEN`

**Onde usar:** Edge Function `lemit-consulta-pessoa`

**Como obter:**
- Acesse o portal da Lemit
- Faça login na sua conta
- Navegue até a seção de API/Tokens
- Copie o token de autenticação

---

### 2. ERP_TOKEN
**Descrição:** Token de autenticação para a API do ERP OdontoArt

**Valor:** `ADICIONAR_TOKEN`

**Onde usar:** Edge Function `erp-novo-usuario2`

**Como obter:**
- Acesse o sistema ERP OdontoArt
- Entre em contato com o administrador do sistema
- Solicite um token de API para integração

---

### 3. ERP_BASE_URL (Opcional)
**Descrição:** URL base da API do ERP

**Valor padrão:** `https://odontoart.s4e.com.br`

**Onde usar:** Edge Functions `erp-check-associado`, `erp-novo-usuario2`

**Observação:** Este valor já está configurado por padrão nas Edge Functions. Só precisa ser alterado se a URL do ERP mudar.

---

## Como Configurar no Supabase

### Passo 1: Acesse o Dashboard do Supabase
1. Faça login em [https://supabase.com](https://supabase.com)
2. Selecione seu projeto

### Passo 2: Navegue até Edge Functions
1. No menu lateral, clique em **Edge Functions**
2. Clique na aba **Secrets** ou **Environment Variables**

### Passo 3: Adicione os Secrets
1. Clique em **Add Secret** ou **New Secret**
2. Adicione cada um dos seguintes secrets:

```
Nome: LEMIT_TOKEN
Valor: [Cole aqui o token da API Lemit]
```

```
Nome: ERP_TOKEN
Valor: [Cole aqui o token da API do ERP]
```

```
Nome: ERP_URL (opcional)
Valor: https://odontoart.s4e.com.br/api/vendedor/NovoUsuario2
```

### Passo 4: Salve e Reinicie
1. Clique em **Save** para cada secret
2. Se necessário, reinicie as Edge Functions

---

## Verificação

Para verificar se os tokens foram configurados corretamente:

1. **Teste a verificação de duplicidade no ERP:**
   - Acesse o módulo Cadastro
   - Digite um CPF que você sabe que já existe no ERP
   - Clique em "Consultar"
   - Se aparecer o modal "CPF já possui plano ativo", o ERP_TOKEN está correto para `erp-check-associado`

2. **Teste a consulta de CPF (Lemit):**
   - Acesse o módulo Cadastro
   - Digite um CPF válido que NÃO existe no ERP
   - Clique em "Consultar"
   - Se retornar dados da pessoa, o LEMIT_TOKEN está correto

3. **Teste a consulta de CEP (ERP):**
   - Após consultar um CPF com sucesso
   - Observe se o endereço foi preenchido automaticamente
   - Ou edite o campo CEP no modal (digite 8 dígitos)
   - Se o endereço for preenchido automaticamente, o ERP_TOKEN está correto para `erp-endereco-cep`

4. **Teste o envio para o ERP:**
   - Complete um cadastro
   - Clique em "Cadastrar"
   - Se enviar com sucesso, o ERP_TOKEN está correto para `erp-novo-usuario2`

---

## Troubleshooting

### Erro: "LEMIT_TOKEN not configured"
- Verifique se o secret `LEMIT_TOKEN` foi adicionado no Supabase Dashboard
- Confirme que o nome está correto (case-sensitive)
- Reinicie as Edge Functions

### Erro: "ERP_TOKEN not configured"
- Verifique se o secret `ERP_TOKEN` foi adicionado no Supabase Dashboard
- Confirme que o nome está correto (case-sensitive)
- Reinicie as Edge Functions

### Erro: "Erro ao consultar CPF"
- Verifique se o token da Lemit está válido
- Confirme que sua conta Lemit tem créditos/acesso ativo
- Verifique se o CPF é válido

### Erro: "Erro ao verificar CPF no ERP"
- Verifique se o ERP_TOKEN está configurado corretamente
- Confirme que a URL do ERP está acessível
- Verifique os logs da Edge Function `erp-check-associado`

### Erro: "Erro ao consultar CEP no ERP"
- Verifique se o ERP_TOKEN está configurado corretamente
- Confirme que o CEP tem 8 dígitos válidos
- Verifique os logs da Edge Function `erp-endereco-cep`

### Erro: "Erro ao enviar para o ERP"
- Verifique se o token do ERP está válido
- Confirme que o payload está no formato correto
- Verifique se os IDs do endereço foram preenchidos corretamente
- Verifique os logs da Edge Function `erp-novo-usuario2`

---

## Contatos de Suporte

**API Lemit:** [Adicione contato do suporte Lemit]

**API ERP OdontoArt:** [Adicione contato do suporte ERP]

---

## Segurança

⚠️ **IMPORTANTE:**
- NUNCA commite tokens no repositório Git
- NUNCA exponha tokens no código frontend
- Sempre use as Edge Functions para chamadas de API que requerem autenticação
- Mantenha os tokens seguros e atualizados
- Revogue tokens antigos quando não estiverem mais em uso
