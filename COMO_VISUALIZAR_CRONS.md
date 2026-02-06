# Como Visualizar e Acompanhar Crons no Supabase

## Visão Geral

O sistema utiliza **pg_cron** para executar tarefas agendadas automaticamente. O cron principal processa a fila de upload de documentos para o ERP a cada 2 minutos.

## Como Acessar os Crons no Supabase Dashboard

### 1. Via SQL Editor

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor** no menu lateral
3. Execute a seguinte query para ver todos os crons configurados:

```sql
SELECT * FROM cron.job;
```

Você verá os detalhes do job incluindo:
- `jobid`: ID único do job
- `schedule`: Expressão cron (ex: `*/2 * * * *` = a cada 2 minutos)
- `command`: Comando SQL que é executado
- `nodename`: Nome do nó onde o job roda
- `nodeport`: Porta do nó
- `database`: Database onde o job executa
- `username`: Usuário que executa o job
- `active`: Se o job está ativo ou não
- `jobname`: Nome amigável do job

### 2. Verificar Execuções Recentes

Execute esta query para ver o histórico de execuções:

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-erp-upload-queue')
ORDER BY start_time DESC
LIMIT 50;
```

Isso mostrará:
- `runid`: ID da execução
- `start_time`: Quando começou
- `end_time`: Quando terminou
- `status`: Status (succeeded, failed, etc)
- `return_message`: Mensagens de retorno
- `job_pid`: ID do processo

### 3. Verificar Log Personalizado (Se Implementado)

O sistema pode ter uma tabela de log personalizada:

```sql
SELECT * FROM erp_upload_queue_cron_log
ORDER BY executed_at DESC
LIMIT 50;
```

## Como Verificar se o Cron Está Funcionando

### Teste 1: Verificar se o Job Está Ativo

```sql
SELECT jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'process-erp-upload-queue';
```

Se `active = true`, o cron está ativo.

### Teste 2: Verificar Última Execução

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
LIMIT 1;
```

### Teste 3: Forçar Execução Manual

Para testar se o processamento funciona:

```sql
SELECT process_erp_upload_queue();
```

Ou chamar a edge function diretamente via HTTP.

## Monitorar a Fila de Upload

### Ver Itens na Fila

```sql
SELECT
  id,
  status,
  attempts,
  created_at,
  next_attempt_at,
  last_error,
  arquivo_nome
FROM erp_upload_queue
WHERE status IN ('queued', 'processing', 'retry_wait')
ORDER BY created_at DESC;
```

### Ver Itens Processados com Sucesso

```sql
SELECT
  id,
  status,
  attempts,
  created_at,
  last_attempt_at,
  arquivo_nome
FROM erp_upload_queue
WHERE status = 'success'
ORDER BY last_attempt_at DESC
LIMIT 20;
```

### Ver Itens com Erro

```sql
SELECT
  id,
  status,
  attempts,
  last_error,
  last_status_code,
  created_at,
  arquivo_nome
FROM erp_upload_queue
WHERE status IN ('failed', 'retry_wait')
ORDER BY last_attempt_at DESC;
```

## Problemas Comuns e Soluções

### Problema: Cron Não Está Executando

**Possíveis causas:**
1. Extensão pg_cron não habilitada
2. Job não está ativo
3. Configurações de ambiente incorretas

**Soluções:**
```sql
-- Verificar se pg_cron está habilitado
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Se não estiver, habilitar (requer permissões de admin)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verificar se o job está ativo
SELECT active FROM cron.job WHERE jobname = 'process-erp-upload-queue';

-- Se não estiver ativo, reativar
SELECT cron.schedule(
  'process-erp-upload-queue',
  '*/2 * * * *',
  $$SELECT process_erp_upload_queue();$$
);
```

### Problema: Edge Function Não Está Sendo Chamada

**Verificar configuração de variáveis:**
```sql
-- A função process_erp_upload_queue() precisa destas variáveis:
-- app.settings.supabase_url
-- app.settings.service_role_key
```

No Supabase Dashboard, configure em **Settings > API > Project Settings**.

### Problema: Itens Travados em "processing"

Se itens ficarem travados, use a função de reset:

```sql
SELECT reset_stuck_queue_items(15); -- Reset itens travados por mais de 15 minutos
```

## Logs da API ERP

Para verificar todas as chamadas ao endpoint erp-upload-documento:

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

## Fluxo Esperado

1. **Upload do arquivo** → Salvou no bucket `cadastros-temp-files`
2. **Clique em Cadastrar** → Tenta enviar para `erp-upload-documento`
3. **Se der erro** → Enfileira em `erp_upload_queue` com status `queued`
4. **Cron a cada 2 minutos** → Chama `erp-process-upload-queue`
5. **Edge Function** → Processa itens da fila com intervalo de 10s entre uploads
6. **Se sucesso** → Status vira `success` e arquivo é deletado do bucket
7. **Se erro** → Tenta novamente em 10 minutos (até 5 tentativas)
8. **Após 5 falhas** → Status vira `failed`

## Painel de Monitoramento

O sistema possui uma tela de monitoramento da fila em:
**Menu > Fila Upload ERP**

Esta tela mostra em tempo real:
- Itens na fila
- Itens em processamento
- Sucessos e falhas
- Detalhes de cada item
