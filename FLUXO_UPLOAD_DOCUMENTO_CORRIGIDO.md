# Fluxo de Upload de Documento - CORRIGIDO

## Resumo das Alterações

O fluxo de upload de documentos foi corrigido para seguir a estratégia correta:

**ANTES:**
- Upload do arquivo → Bucket
- Cadastro → Enfileira DIRETO para processamento
- Cron processa a fila

**AGORA (CORRETO):**
- Upload do arquivo → Bucket
- Cadastro → **TENTA ENVIAR DIRETO** para `erp-upload-documento`
- Se **SUCESSO** → Remove do bucket e termina
- Se **ERRO** → Enfileira para processamento posterior
- Cron processa a fila a cada 2 minutos

---

## Fluxo Detalhado

### 1. Upload do Arquivo na Página

Quando o usuário seleciona um arquivo:

1. Arquivo é validado (tamanho máximo 10MB)
2. Upload para bucket `cadastros-temp-files`
3. Path do arquivo é armazenado temporariamente

### 2. Ao Clicar em "Cadastrar"

#### 2.1. Tentativa Direta ao ERP

Primeiro, o sistema **tenta enviar diretamente** para o ERP:

```typescript
const uploadPayload = {
  idFuncionario: funcionarioCadastroId,
  idDependente: parseInt(dependenteCodigo),
  arquivo: arquivo.base64,
  arquivoNome: arquivo.nome,
};

const uploadResponse = await fetch(
  `${SUPABASE_URL}/functions/v1/erp-upload-documento`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(uploadPayload),
  }
);
```

#### 2.2. Se der SUCESSO

- ✅ Documento foi enviado ao ERP
- ✅ Arquivo é **removido do bucket** (não precisa mais)
- ✅ Processo termina com sucesso

```typescript
if (uploadResponse.ok && uploadResult.success) {
  console.log('Documento enviado com sucesso ao ERP!');

  // Remove do bucket
  await supabase.storage
    .from('cadastros-temp-files')
    .remove([arquivo.path]);
}
```

#### 2.3. Se der ERRO

- ⚠️ Falha ao enviar ao ERP
- ⚠️ Arquivo **permanece no bucket**
- ⚠️ Sistema **enfileira** para tentativa posterior

```typescript
else {
  console.warn('Falha ao enviar documento, enfileirando...');

  const enqueuePayload = {
    cadastroId: cadastroAtual.id,
    idFuncionario: funcionarioCadastroId,
    idDependente: parseInt(dependenteCodigo),
    arquivoPath: arquivo.path,
    arquivoNome: arquivo.nome,
    tipo: 'titular', // ou 'dependente'
  };

  await fetch(
    `${SUPABASE_URL}/functions/v1/erp-enqueue-upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enqueuePayload),
    }
  );
}
```

### 3. Fila de Processamento

#### 3.1. Item na Fila

Quando um arquivo é enfileirado, é criado um registro em `erp_upload_queue`:

```sql
{
  "id": "uuid",
  "cadastro_id": "uuid ou null",
  "created_by": "user_id",
  "id_funcionario": 123,
  "id_dependente": 456,
  "arquivo_path": "cadastros/uuid/arquivo.pdf",
  "arquivo_nome": "documento.pdf",
  "bucket": "cadastros-temp-files",
  "tipo": "titular" ou "dependente",
  "status": "queued",
  "attempts": 0,
  "next_attempt_at": "2024-01-01T10:00:00Z"
}
```

#### 3.2. Processamento pelo Cron

A cada **2 minutos**, o cron executa:

```sql
SELECT cron.schedule(
  'process-erp-upload-queue',
  '*/2 * * * *',
  $$SELECT process_erp_upload_queue();$$
);
```

Esta função chama a edge function `erp-process-upload-queue`.

#### 3.3. Edge Function `erp-process-upload-queue`

Para cada item na fila:

1. Baixa o arquivo do bucket
2. Converte para base64
3. Envia para `erp-upload-documento`
4. **Se SUCESSO:**
   - Status → `success`
   - Remove arquivo do bucket
   - Item não é mais processado
5. **Se ERRO:**
   - Incrementa `attempts`
   - Se `attempts < 5`:
     - Status → `retry_wait`
     - `next_attempt_at` → +10 minutos
   - Se `attempts >= 5`:
     - Status → `failed`
     - Não tenta mais

#### 3.4. Intervalo Entre Uploads

Há um delay de **10 segundos** entre cada upload para evitar sobrecarga no ERP:

```typescript
await new Promise(resolve => setTimeout(resolve, 10000));
```

---

## Estados da Fila

### Estados Possíveis

- `queued`: Item aguardando processamento
- `processing`: Item sendo processado agora
- `retry_wait`: Item aguardando próxima tentativa
- `success`: Item processado com sucesso
- `failed`: Item falhou após 5 tentativas

### Transições de Estado

```
queued → processing → success (arquivo deletado)
                  ↓
                retry_wait (aguarda 10min)
                  ↓
                processing → success
                  ↓
                retry_wait (tenta até 5x)
                  ↓
                failed (desiste)
```

---

## Como Monitorar

### 1. Via SQL Editor no Supabase

#### Ver itens na fila

```sql
SELECT
  id,
  status,
  attempts,
  arquivo_nome,
  created_at,
  next_attempt_at,
  last_error
FROM erp_upload_queue
WHERE status IN ('queued', 'processing', 'retry_wait')
ORDER BY created_at DESC;
```

#### Ver itens processados com sucesso

```sql
SELECT
  id,
  status,
  attempts,
  arquivo_nome,
  created_at,
  last_attempt_at
FROM erp_upload_queue
WHERE status = 'success'
ORDER BY last_attempt_at DESC
LIMIT 20;
```

#### Ver itens com erro

```sql
SELECT
  id,
  status,
  attempts,
  last_error,
  last_status_code,
  arquivo_nome,
  created_at
FROM erp_upload_queue
WHERE status IN ('failed', 'retry_wait')
ORDER BY last_attempt_at DESC;
```

### 2. Via Tela de Monitoramento

O sistema possui uma tela dedicada:

**Menu > Fila Upload ERP**

Esta tela mostra:
- Total de itens na fila
- Itens em processamento
- Sucessos e falhas
- Detalhes de cada item

### 3. Logs da API

Para ver todas as chamadas ao endpoint:

```sql
SELECT
  id,
  user_email,
  endpoint,
  created_at,
  status_code,
  success,
  error_message,
  duration_ms
FROM api_logs
WHERE endpoint = 'erp-upload-documento'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Verificar se o Cron está Funcionando

### 1. Verificar Job Ativo

```sql
SELECT jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'process-erp-upload-queue';
```

### 2. Verificar Última Execução

```sql
SELECT
  j.jobname,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-erp-upload-queue'
ORDER BY jrd.start_time DESC
LIMIT 5;
```

### 3. Forçar Execução Manual

Para testar:

```sql
SELECT process_erp_upload_queue();
```

---

## Arquivos Alterados

### Frontend

1. **src/components/cadastro/CadastroModal.tsx**
   - Tenta `erp-upload-documento` primeiro
   - Enfileira apenas se falhar
   - Remove do bucket se sucesso

2. **src/components/cadastro/InclusaoDependenteModal.tsx**
   - Mesma lógica para inclusão de dependentes

3. **src/components/cadastro/ContinuarInclusaoDependenteModal.tsx**
   - Mesma lógica para continuação de inclusão

### Backend (Edge Functions)

1. **supabase/functions/erp-upload-documento/index.ts**
   - Endpoint que envia direto ao ERP
   - Registra logs em `api_logs`

2. **supabase/functions/erp-enqueue-upload/index.ts**
   - Enfileira item para processamento
   - Usado apenas quando falha o envio direto

3. **supabase/functions/erp-process-upload-queue/index.ts**
   - Processa a fila automaticamente
   - Respeita intervalo de 10s entre uploads
   - Implementa retry com backoff

### Database

1. **supabase/migrations/20260203165153_create_erp_upload_queue.sql**
   - Tabela da fila de uploads

2. **supabase/migrations/20260204133345_add_erp_upload_queue_cron.sql**
   - Configuração do cron
   - Função `process_erp_upload_queue()`

---

## Benefícios do Novo Fluxo

1. **Mais Rápido**: Tenta enviar imediatamente
2. **Menos Carga no Bucket**: Remove arquivo se sucesso
3. **Resiliente**: Enfileira apenas se necessário
4. **Monitorável**: Logs completos de todas as tentativas
5. **Automático**: Cron processa falhas sem intervenção

---

## Problemas e Soluções

### Problema: Cron não está executando

**Solução:**
```sql
-- Verificar se está ativo
SELECT * FROM cron.job WHERE jobname = 'process-erp-upload-queue';

-- Se não estiver, reagendar
SELECT cron.schedule(
  'process-erp-upload-queue',
  '*/2 * * * *',
  $$SELECT process_erp_upload_queue();$$
);
```

### Problema: Itens travados em "processing"

**Solução:**
```sql
-- Resetar itens travados
SELECT reset_stuck_queue_items(15);
```

### Problema: Arquivo não está sendo enviado

**Verificar:**
1. Item está na fila? (`erp_upload_queue`)
2. Cron está rodando? (ver execuções em `cron.job_run_details`)
3. Há erro no log? (campo `last_error`)
4. Arquivo existe no bucket? (verificar storage)

---

## Referências

- [COMO_VISUALIZAR_CRONS.md](./COMO_VISUALIZAR_CRONS.md) - Guia detalhado sobre Crons
- [FILA_UPLOAD_SETUP.md](./FILA_UPLOAD_SETUP.md) - Setup inicial da fila
- [API_REGRAS.md](./API_REGRAS.md) - Regras da API ERP
