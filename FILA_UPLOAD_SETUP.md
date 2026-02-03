# Sistema de Fila de Upload para o ERP

## Visão Geral

O sistema de fila de upload foi implementado para melhorar a performance e resiliência do fluxo de envio de documentos ao ERP. Agora, ao invés de enviar documentos de forma síncrona durante o cadastro, os arquivos são enfileirados e processados de forma assíncrona com retry automático.

## Componentes Implementados

### 1. Banco de Dados

**Tabela: `erp_upload_queue`**

Armazena todos os itens da fila de upload com as seguintes informações:
- Status do upload (queued, processing, retry_wait, success, failed)
- Número de tentativas (máximo 5)
- Informações do arquivo (path, nome, bucket)
- Dados do cadastro e dependente
- Logs de erro e resposta do ERP

**Índices criados para performance:**
- `(status, next_attempt_at)` - Para buscar itens elegíveis
- `(cadastro_id)` - Para consultas por cadastro
- `(id_dependente)` - Para consultas por dependente
- `(created_at DESC)` - Para paginação

**RLS (Row Level Security):**
- SELECT/UPDATE/DELETE: Somente ADMINISTRADOR
- INSERT: Usuários autenticados (via service role nas Edge Functions)

### 2. Edge Functions

#### `erp-enqueue-upload`
Enfileira um novo upload de documento.

**Endpoint:** `POST /functions/v1/erp-enqueue-upload`

**Payload:**
```json
{
  "cadastroId": "uuid",
  "idFuncionario": 123,
  "idDependente": 456,
  "arquivoPath": "path/no/bucket",
  "arquivoNome": "documento.pdf",
  "tipo": "titular" | "dependente"
}
```

**Resposta:**
```json
{
  "queued": true,
  "queue_id": "uuid",
  "message": "Arquivo enfileirado para envio ao ERP..."
}
```

#### `erp-process-upload-queue`
Processa itens elegíveis da fila de upload.

**Endpoint:** `POST /functions/v1/erp-process-upload-queue`

**Comportamento:**
1. Busca até 10 itens elegíveis (status: queued/retry_wait, tentativas < 5, next_attempt_at <= now)
2. Para cada item:
   - Baixa o arquivo do Storage
   - Converte para base64
   - Envia para o ERP via endpoint existente
   - Em caso de sucesso: marca como success e remove arquivo do bucket
   - Em caso de falha: incrementa tentativas, agenda próximo retry em 10 minutos
   - Após 5 falhas: marca como failed

**Resposta:**
```json
{
  "message": "Processamento concluído",
  "processed": 10,
  "success": 8,
  "failed": 1,
  "retry": 1,
  "errors": [...]
}
```

### 3. Frontend

#### Ajustes no `CadastroModal.tsx`
- Remove upload direto de documento
- Enfileira arquivo após cadastro bem-sucedido no ERP
- NÃO deleta mais o arquivo do bucket
- Mostra mensagem: "Cadastro enviado com sucesso! Arquivo em fila de envio ao ERP."

#### Ajustes no `InclusaoDependenteModal.tsx`
- Remove upload direto de documentos dos dependentes
- Enfileira arquivos após inclusão bem-sucedida no ERP
- NÃO deleta mais os arquivos do bucket
- Mostra mensagem: "Dependente(s) incluído(s) com sucesso! Arquivos em fila de envio."

#### Nova Página: `FilaUploadERP` (Admin)
Painel administrativo para gerenciar a fila de upload.

**Recursos:**
- Visualização paginada da fila (20 itens por página)
- Filtro por status (todos, aguardando, processando, retry, sucesso, falhou)
- Atualização em tempo real via Supabase Realtime
- Download de arquivos (URL assinada)
- Botão para processar fila manualmente
- Reprocessar itens que falharam
- Informações detalhadas sobre cada item

**Acesso:** `/fila-upload-erp` (somente ADMINISTRADOR)

## Configuração do Worker Automático

### Opção 1: Cron Job Externo (Recomendado)

Configure um cron job para chamar a Edge Function a cada 10 minutos:

```bash
*/10 * * * * curl -X POST \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  https://SEU_PROJETO.supabase.co/functions/v1/erp-process-upload-queue
```

### Opção 2: GitHub Actions

Crie `.github/workflows/process-queue.yml`:

```yaml
name: Process Upload Queue

on:
  schedule:
    - cron: '*/10 * * * *'  # A cada 10 minutos
  workflow_dispatch:  # Permite execução manual

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Process Queue
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/erp-process-upload-queue
```

### Opção 3: Vercel Cron (se hospedado no Vercel)

Crie `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/process-queue",
    "schedule": "*/10 * * * *"
  }]
}
```

E crie `api/process-queue.ts`:

```typescript
export default async function handler(req: any, res: any) {
  const response = await fetch(
    `${process.env.VITE_SUPABASE_URL}/functions/v1/erp-process-upload-queue`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const result = await response.json();
  res.status(200).json(result);
}
```

## Fluxo Completo

### 1. Cadastro/Inclusão de Dependente
```
Usuário preenche formulário com arquivo
    ↓
Faz upload do arquivo para bucket cadastros-temp-files
    ↓
Envia dados para ERP (sem arquivo)
    ↓
ERP retorna sucesso com ID do dependente
    ↓
Enfileira upload do arquivo via erp-enqueue-upload
    ↓
Usuário recebe confirmação: "Cadastro OK. Arquivo em fila."
```

### 2. Processamento Assíncrono
```
Worker executa a cada 10 minutos (ou manualmente via painel)
    ↓
Busca itens elegíveis da fila
    ↓
Para cada item:
    ├─ Baixa arquivo do bucket
    ├─ Converte para base64
    ├─ Envia para ERP
    ├─ Se sucesso: marca success e deleta arquivo
    └─ Se falha: incrementa tentativas, agenda retry

Após 5 falhas: marca como failed (intervenção manual)
```

### 3. Monitoramento (Admin)
```
Admin acessa /fila-upload-erp
    ↓
Visualiza status de todos os uploads
    ↓
Pode:
    ├─ Baixar arquivos que falharam
    ├─ Reprocessar itens manualmente
    └─ Processar fila sob demanda
```

## Regras de Negócio

1. **Tentativas**: Máximo de 5 tentativas por item
2. **Intervalo de Retry**: 10 minutos entre tentativas
3. **Batch Size**: Processa até 10 itens por vez
4. **Concorrência**: Lock otimista para evitar processamento duplicado
5. **Limpeza**: Arquivos são removidos do bucket APENAS após envio bem-sucedido
6. **Idempotência**: Status 'processing' evita reprocessamento do mesmo item

## Monitoramento e Logs

### Logs da Fila
Todos os itens ficam registrados na tabela `erp_upload_queue` com:
- Data de criação e última tentativa
- Status atual e número de tentativas
- Último erro e código de status HTTP
- Resposta completa do ERP

### Logs de API
A Edge Function `erp-upload-documento` já registra em `api_logs`:
- Request/response completos
- Duração da chamada
- Erros detalhados

### Painel Admin
O painel `/fila-upload-erp` mostra em tempo real:
- Quantos itens estão na fila
- Quantos tiveram sucesso/falharam
- Detalhes de erros para intervenção manual

## Recuperação de Falhas

### Falhas Temporárias
Itens com falhas temporárias (rede, timeout, etc.) são automaticamente reprocessados até 5 vezes.

### Falhas Permanentes
Após 5 tentativas, o item é marcado como "failed":
1. Admin é notificado via painel
2. Admin pode baixar o arquivo
3. Admin pode fazer upload manual no ERP
4. Ou reprocessar o item (reseta tentativas)

## Benefícios

1. **Performance**: Cadastros não travam aguardando upload de arquivo
2. **Resiliência**: Retry automático em caso de falhas temporárias
3. **Rastreabilidade**: Histórico completo de todas as tentativas
4. **Gestão**: Painel para monitorar e intervir quando necessário
5. **Segurança**: Arquivos não são perdidos em caso de erro

## Troubleshooting

### Item não processa
- Verificar se está no status 'queued' ou 'retry_wait'
- Verificar se `next_attempt_at` já passou
- Verificar se `attempts < 5`
- Processar manualmente via painel

### Arquivo não encontrado
- Verificar se o arquivo ainda existe no bucket
- Verificar se o path está correto na tabela
- Se necessário, fazer upload manual

### Muitos itens falhando
- Verificar logs em `api_logs` para entender o erro
- Verificar conectividade com ERP
- Verificar se ERP_TOKEN está válido
- Verificar se endpoint do ERP está correto

## Próximos Passos (Opcional)

1. **Notificações**: Email para admin quando item falha permanentemente
2. **Dashboard**: Métricas de sucesso/falha por período
3. **Priorização**: Fila prioritária para casos urgentes
4. **Limpeza**: Job para remover itens antigos com sucesso
5. **Logs detalhados**: Integrar com ferramenta de APM/monitoring
