# Sistema de Fila de Upload para ERP

## Visão Geral

O sistema de fila de upload é uma solução robusta e automatizada para gerenciar o envio de documentos para o ERP. Ele garante processamento sequencial, retry automático em caso de falhas e monitoramento completo do status de cada upload.

## Características Principais

### 1. Processamento Automático
- **Frequência**: A cada 2 minutos (configurável via pg_cron)
- **Intervalo entre uploads**: 10 segundos entre cada documento
- **Processamento sequencial**: Um documento por vez para evitar sobrecarga no ERP
- **Sem intervenção manual**: Funciona 24/7 automaticamente

### 2. Sistema de Retry Inteligente
- **Até 5 tentativas** automáticas por item
- **Intervalo entre retries**: 10 minutos
- **Status de retry**: `retry_wait` indica aguardando nova tentativa
- **Falha permanente**: Após 5 tentativas, status muda para `failed`

### 3. Proteção contra Congestionamento
- **Lock otimista**: Previne processamento duplicado
- **Status `processing`**: Item marcado como em processamento
- **Timeout configurável**: 10 minutos por requisição
- **Delay entre uploads**: 10 segundos fixo

## Arquitetura

### Componentes

1. **Tabela `erp_upload_queue`**
   - Armazena todos os documentos pendentes
   - Rastreia status, tentativas e erros
   - Índices otimizados para performance

2. **Edge Function `erp-process-upload-queue`**
   - Processa itens da fila
   - Implementa delay de 10s entre uploads
   - Gerencia retry e atualização de status

3. **pg_cron Job**
   - Executa a cada 2 minutos
   - Dispara a edge function automaticamente
   - Registra execuções no log

4. **Interface Admin**
   - Visualização em tempo real (realtime habilitado)
   - Filtros por status
   - Botão de processamento manual
   - Reprocessamento de itens falhados

## Fluxo de Processamento

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Documento Adicionado à Fila                              │
│    Status: queued                                            │
│    next_attempt_at: now()                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. pg_cron dispara (a cada 2 minutos)                       │
│    → Chama edge function                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Edge Function Processa                                    │
│    → Busca itens elegíveis (queued/retry_wait)              │
│    → Ordena por created_at (FIFO)                           │
│    → Processa sequencialmente                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Para cada item:                                           │
│    a) Marca como processing                                  │
│    b) Download do arquivo do bucket                          │
│    c) Converte para base64                                   │
│    d) Envia para ERP                                         │
│    e) Aguarda 10 segundos                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                     ┌──────┴──────┐
                     │             │
                Sucesso?      Falha?
                     │             │
                     ↓             ↓
         ┌────────────────┐  ┌────────────────┐
         │ Status: success│  │ attempts++     │
         │ Remove arquivo │  │ < 5 tentativas?│
         └────────────────┘  └────────┬───────┘
                                      │
                              ┌───────┴────────┐
                              │                │
                            Sim              Não
                              │                │
                              ↓                ↓
                    ┌──────────────────┐  ┌───────────┐
                    │ Status:retry_wait│  │Status:    │
                    │ next_attempt:    │  │failed     │
                    │ now() + 10min    │  │           │
                    └──────────────────┘  └───────────┘
```

## Estados da Fila

| Status | Descrição | Ação Automática |
|--------|-----------|-----------------|
| `queued` | Aguardando processamento inicial | Será processado no próximo ciclo |
| `processing` | Em processamento no momento | Lock ativo, não será reprocessado |
| `retry_wait` | Aguardando retry após falha | Será reprocessado após 10 minutos |
| `success` | Enviado com sucesso | Nenhuma, arquivo removido |
| `failed` | Falhou após 5 tentativas | Requer intervenção manual |

## Configuração do pg_cron

### Job Atual
```sql
-- Executa a cada 2 minutos
SELECT cron.schedule(
  'process-erp-upload-queue',
  '*/2 * * * *',
  $$SELECT process_erp_upload_queue();$$
);
```

### Visualizar Jobs Ativos
```sql
SELECT * FROM cron.job;
```

### Modificar Frequência (se necessário)
```sql
-- Remover job existente
SELECT cron.unschedule('process-erp-upload-queue');

-- Criar novo com frequência diferente
-- Exemplo: a cada 5 minutos = '*/5 * * * *'
SELECT cron.schedule(
  'process-erp-upload-queue',
  '*/5 * * * *',
  $$SELECT process_erp_upload_queue();$$
);
```

## Monitoramento

### Via Interface Admin
1. Acesse: `/fila-upload-erp`
2. Visualize status em tempo real
3. Filtre por status específico
4. Reprocesse itens falhados manualmente

### Via SQL
```sql
-- Estatísticas gerais
SELECT
  status,
  COUNT(*) as total,
  AVG(attempts) as avg_attempts
FROM erp_upload_queue
GROUP BY status;

-- Itens com erro
SELECT
  id,
  arquivo_nome,
  attempts,
  last_error,
  last_attempt_at
FROM erp_upload_queue
WHERE status IN ('failed', 'retry_wait')
ORDER BY created_at DESC;

-- Histórico do cron
SELECT * FROM erp_upload_queue_cron_log
ORDER BY executed_at DESC
LIMIT 20;
```

## Sistema de Reset Automático de Itens Travados

### O que são itens travados?

Itens ficam no status "processing" quando:
- A edge function é interrompida (timeout, crash)
- Erro não tratado durante o processamento
- Interrupção do servidor durante execução

### Proteções Implementadas

**1. Reset Automático na Edge Function**
- Antes de processar a fila, reseta itens travados há mais de 15 minutos
- Executado automaticamente a cada 2 minutos (junto com o processamento)
- Não incrementa contador de attempts (processamento real não aconteceu)

**2. Job Cron Independente**
- Executa a cada 30 minutos como backup
- Garante que itens não fiquem permanentemente travados
- Funciona mesmo se a edge function falhar

**3. Botão Manual na Interface**
- Botão "Resetar Travados" na página `/fila-upload-erp`
- Permite reset imediato de itens travados
- Útil para situações de urgência

### Como Usar o Reset Manual

1. Acesse `/fila-upload-erp`
2. Clique no botão "Resetar Travados" (ao lado de "Processar Fila")
3. Confirme a ação
4. Itens travados há mais de 15 minutos serão resetados para "queued"
5. Serão reprocessados automaticamente no próximo ciclo (máx 2 minutos)

### Função SQL Disponível

```sql
-- Resetar itens travados manualmente via SQL
SELECT * FROM reset_stuck_queue_items(15);

-- Resultado mostra quantos itens foram resetados
-- { reset_count: 3, reset_ids: [uuid1, uuid2, uuid3] }
```

## Troubleshooting

### Fila não está processando automaticamente

1. **Verificar se pg_cron está ativo:**
```sql
SELECT cron.schedule_in_database('process-erp-upload-queue');
```

2. **Verificar últimas execuções:**
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-erp-upload-queue')
ORDER BY start_time DESC
LIMIT 10;
```

3. **Testar edge function manualmente:**
```bash
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/erp-process-upload-queue \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json"
```

### Itens travados em "processing"

**SOLUÇÃO AUTOMÁTICA:** O sistema agora reseta automaticamente itens travados:
- A cada 2 minutos (antes de processar a fila)
- A cada 30 minutos (job cron backup)
- Via botão "Resetar Travados" na interface

Se ainda assim precisar resetar manualmente via SQL:
```sql
SELECT * FROM reset_stuck_queue_items(15);
```

### Muitos itens falhando

1. Verificar logs da edge function no Supabase Dashboard
2. Verificar conectividade com o ERP
3. Verificar se `ERP_TOKEN` está configurado corretamente
4. Verificar formato dos arquivos

### Processamento muito lento

Se há muitos documentos na fila:

**Opção 1: Reduzir frequência do cron (mais rápido)**
```sql
-- Mudar para a cada 1 minuto
SELECT cron.unschedule('process-erp-upload-queue');
SELECT cron.schedule(
  'process-erp-upload-queue',
  '*/1 * * * *',
  $$SELECT process_erp_upload_queue();$$
);
```

**Opção 2: Reduzir delay entre uploads**
- Editar `supabase/functions/erp-process-upload-queue/index.ts`
- Alterar linha do setTimeout de 10000 para 5000 (5 segundos)
- Fazer deploy: Apenas salvar o arquivo e o sistema faz deploy automaticamente

## Manutenção

### Limpar itens bem-sucedidos antigos
```sql
-- Deletar sucesso com mais de 30 dias
DELETE FROM erp_upload_queue
WHERE status = 'success'
AND created_at < NOW() - INTERVAL '30 days';
```

### Resetar item específico para retry
```sql
UPDATE erp_upload_queue
SET
  status = 'queued',
  attempts = 0,
  next_attempt_at = NOW(),
  last_error = NULL
WHERE id = 'UUID_DO_ITEM';
```

## Segurança

- RLS habilitado: Apenas ADMINISTRADOR pode visualizar/modificar
- Edge function usa SERVICE_ROLE_KEY internamente
- Arquivos armazenados temporariamente no bucket `cadastros-temp-files`
- Arquivos removidos automaticamente após envio bem-sucedido

## Performance

- **Índices otimizados** para queries de processamento
- **Realtime habilitado** para atualizações instantâneas na UI
- **Paginação** na interface (20 itens por página)
- **Batch size**: 100 itens por execução (configurável)

## Considerações Finais

Este sistema foi projetado para ser:
- ✅ **Resiliente**: Retry automático e tratamento de erros
- ✅ **Escalável**: Processa centenas de documentos sem sobrecarga
- ✅ **Observável**: Logs detalhados e interface de monitoramento
- ✅ **Automático**: Zero intervenção manual necessária
- ✅ **Seguro**: RLS e validações em todas as camadas

O processamento sequencial com delay de 10 segundos garante que o ERP não seja sobrecarregado, enquanto o sistema de retry inteligente garante que todos os documentos sejam eventualmente processados.
