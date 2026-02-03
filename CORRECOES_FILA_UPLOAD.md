# Correções da Fila de Upload ERP

## Problemas Identificados e Soluções

### 1. Nome do cliente não aparecia na tela "Fila Upload ERP"

**Problema:** A query estava usando `inner join` que só retornava itens com cadastro associado.

**Solução:**
- Alterado para `left join` usando `cadastros(nome, cpf, empresa_nome)` sem o `!inner`
- Adicionado fallback para dependentes sem cadastro: mostra "Dependente ID: {id_dependente}"
- Arquivo: `src/pages/FilaUploadERP.tsx` (linhas 52-93)

### 2. Botão "Processar Fila" processava todos os itens

**Observação:** O botão já estava correto! A Edge Function `erp-process-upload-queue` já filtra automaticamente apenas itens com:
- Status: `queued` ou `retry_wait`
- Tentativas: < 5
- Data da próxima tentativa: <= agora

Isso significa que itens com status `success`, `processing` e `failed` (após 5 tentativas) **NÃO** são processados.

### 3. Ações apareciam para itens com status "Sucesso"

**Problema:** Botões de download e reprocessar apareciam mesmo quando arquivo já foi enviado com sucesso.

**Solução:**
- Adicionado condicional: `{item.status !== 'success' ? ... : '-'}`
- Quando status é `success`, mostra apenas um traço (-)
- Arquivo: `src/pages/FilaUploadERP.tsx` (linhas 391-414)

### 4. Fluxo de inclusão de dependentes não usava a fila

**Problema:** O código estava tentando usar `cadastroId` mas esse campo não existe no contexto de inclusão de dependentes (não é criado um registro em `cadastros`).

**Soluções Aplicadas:**

#### a) Migration: Permitir `cadastro_id` NULL
- Arquivo: Migration `make_cadastro_id_nullable_in_queue`
- Tornou o campo `cadastro_id` opcional (nullable)
- Motivo: Dependentes incluídos diretamente no ERP não têm cadastro associado

#### b) Edge Function: Aceitar `cadastroId` null
- Arquivo: `supabase/functions/erp-enqueue-upload/index.ts`
- Interface `EnqueueRequest` agora aceita `cadastroId: string | null`
- Validação ajustada: `cadastroId` não é mais obrigatório
- Quando `cadastroId` é null, usa o `user.id` como `created_by`
- Quando `cadastroId` existe, busca o `created_by` do cadastro

#### c) Frontend: Enviar `cadastroId: null`
- Arquivo: `src/components/cadastro/InclusaoDependenteModal.tsx` (linha 900)
- Alterado de `cadastroId: cadastroId` para `cadastroId: null`
- Mensagem de sucesso atualizada: "Dependente(s) incluído(s) com sucesso! Arquivos em fila de envio."

#### d) Query da Fila: Suportar cadastros null
- Arquivo: `src/pages/FilaUploadERP.tsx`
- Usa `left join` para buscar cadastros
- Quando `cadastro_id` é null, mostra fallback: "Dependente ID: {id_dependente}"

## Fluxo Completo Atualizado

### Cadastro de Titular (com arquivo)
```
1. Usuário preenche formulário + faz upload do arquivo
2. Sistema envia cadastro para ERP (sem arquivo)
3. ERP retorna sucesso com ID do dependente
4. Sistema enfileira upload: cadastroId={uuid}, tipo='titular'
5. Mensagem: "Cadastro enviado com sucesso! Arquivo em fila de envio ao ERP."
6. Worker processa fila e envia arquivo
7. Após sucesso: arquivo é removido do bucket
```

### Inclusão de Dependente (com arquivo)
```
1. Usuário busca responsável financeiro
2. Adiciona dependente(s) + faz upload do arquivo
3. Sistema envia dependente para ERP (sem arquivo)
4. ERP retorna sucesso com ID do dependente
5. Sistema enfileira upload: cadastroId=null, tipo='dependente'
6. Mensagem: "Dependente(s) incluído(s) com sucesso! Arquivos em fila de envio."
7. Worker processa fila e envia arquivo
8. Após sucesso: arquivo é removido do bucket
```

## Resumo das Alterações

### Banco de Dados
- ✅ Campo `cadastro_id` agora é nullable

### Edge Functions
- ✅ `erp-enqueue-upload` aceita `cadastroId: null`
- ✅ Validação ajustada para não exigir `cadastroId`

### Frontend
- ✅ Tela de fila mostra nome do cliente (ou fallback para dependentes)
- ✅ Ações ocultadas quando status é `success`
- ✅ Inclusão de dependentes usa fila corretamente
- ✅ Mensagens adequadas para cada fluxo

## Validação

### Como Testar

1. **Cadastro de Titular com Arquivo:**
   - Criar novo cadastro com arquivo anexado
   - Verificar mensagem: "Cadastro enviado com sucesso! Arquivo em fila de envio ao ERP."
   - Acessar `/fila-upload-erp` e verificar item na fila
   - Nome do cliente deve aparecer corretamente

2. **Inclusão de Dependente com Arquivo:**
   - Buscar responsável financeiro existente
   - Adicionar dependente com arquivo
   - Verificar mensagem: "Dependente(s) incluído(s) com sucesso! Arquivos em fila de envio."
   - Acessar `/fila-upload-erp` e verificar item na fila
   - Deve mostrar "Dependente ID: {número}"

3. **Fila de Upload:**
   - Acessar `/fila-upload-erp` como ADMINISTRADOR
   - Verificar que nomes dos clientes aparecem
   - Verificar que itens com status "Sucesso" não têm botões de ação
   - Clicar em "Processar Fila" (deve processar apenas queued/retry_wait)

## Observações Importantes

1. O botão "Processar Fila" **já estava correto** - a lógica de filtro está na Edge Function
2. Worker automático pode ser configurado via cron (veja FILA_UPLOAD_SETUP.md)
3. Itens com status `success` não aparecem mais com ações (arquivo já foi enviado e removido)
4. Dependentes sem cadastro associado são identificados por "Dependente ID: {número}"
