# Refatoração de Upload - Resumo Técnico

## Objetivo
Eliminar armazenamento de base64 no frontend para evitar tela branca/reload em dispositivos Android.

## Mudanças Implementadas

### 1. Utilitário de Upload (`src/utils/uploadFile.ts`)
- ✅ Criado utilitário centralizado para upload de arquivos
- ✅ Validação de tipo e tamanho
- ✅ Sanitização de nomes de arquivo
- ✅ Upload direto para Supabase Storage
- ✅ Retorna apenas metadados leves: `{ nome, path, mime, size }`
- ✅ **SEM base64 no retorno**

### 2. Utilitário de Draft/Autosave (`src/utils/draftStorage.ts`)
- ✅ Sistema de autosave em localStorage
- ✅ Salva apenas dados leves (NUNCA base64)
- ✅ Listeners para `visibilitychange`, `pagehide`, `beforeunload`
- ✅ Expiração automática de drafts antigos (7 dias)
- ✅ Recovery de drafts ao reabrir modal

### 3. Edge Function - erp-upload-documento
- ✅ **ATUALIZADA** para aceitar `arquivoPath` OU `arquivo` (base64)
- ✅ Quando recebe `arquivoPath`:
  - Baixa arquivo do Storage usando service role
  - Converte para base64 no servidor
  - Envia para ERP no formato esperado
- ✅ Mantém compatibilidade com formato antigo (base64 direto)
- ✅ **Conversão base64 acontece APENAS no backend**

## Arquivos que Precisam Refatoração

### Frontend - Remover base64 dos componentes:

1. **src/components/cadastro/CadastroModal.tsx**
   - ❌ Remove `readAsDataURL` e armazenamento de base64
   - ✅ Usa `uploadToStorage()` utility
   - ✅ Armazena apenas `UploadedFile` (sem base64)
   - ✅ Ao carregar arquivo existente, não faz download + conversão
   - ✅ Implementa autosave/draft recovery
   - ✅ Envia `arquivoPath` para backend

2. **src/components/cadastro/InclusaoDependenteModal.tsx**
   - Mesmas mudanças do CadastroModal

3. **src/components/cadastro/ContinuarInclusaoDependenteModal.tsx**
   - Mesmas mudanças do CadastroModal

### Padrão de Refatoração

#### ANTES (❌ Ruim):
```typescript
const [arquivo, setArquivo] = useState<{
  base64: string;  // ❌ BASE64 NO FRONTEND
  nome: string;
  path: string;
} | null>(null);

// Upload com FileReader
const reader = new FileReader();
reader.onload = () => {
  const base64 = reader.result as string;
  const base64Puro = base64.split(',')[1];
  setArquivo({ base64: base64Puro, nome, path });  // ❌ ARMAZENA BASE64
};
reader.readAsDataURL(file);  // ❌ LEITURA BASE64

// Envio para API
const payload = {
  arquivo: arquivo.base64,  // ❌ ENVIA BASE64
  arquivoNome: arquivo.nome
};
```

#### DEPOIS (✅ Correto):
```typescript
import { uploadToStorage, UploadedFile } from '../../utils/uploadFile';

const [arquivo, setArquivo] = useState<UploadedFile | null>(null);
// UploadedFile = { nome, path, mime, size } - SEM base64

// Upload direto
const uploadedFile = await uploadToStorage(file, userId, bucket, prefix);
setArquivo(uploadedFile);  // ✅ SEM BASE64

// Envio para API
const payload = {
  arquivoPath: arquivo.path,  // ✅ ENVIA APENAS PATH
  arquivoNome: arquivo.nome,
  bucket: 'cadastros-temp-files'
};
// Backend faz conversão base64 internamente
```

## Mudanças nas Chamadas da API

### Envio de Documento ao ERP

#### ANTES:
```typescript
const uploadPayload = {
  idFuncionario: funcionarioCadastroId,
  idDependente: parseInt(codigo),
  arquivo: arquivo.base64,  // ❌ base64 do frontend
  arquivoNome: arquivo.nome,
};
```

#### DEPOIS:
```typescript
const uploadPayload = {
  idFuncionario: funcionarioCadastroId,
  idDependente: parseInt(codigo),
  arquivoPath: arquivo.path,  // ✅ apenas path
  arquivoNome: arquivo.nome,
  bucket: 'cadastros-temp-files'  // opcional
};
// Backend baixa do storage e converte
```

## Benefícios

1. **Performance Android**: Sem processamento de base64 pesado no device
2. **Memória**: Não mantém arquivos grandes em memória
3. **Reload-Safe**: Autosave garante recuperação após reload
4. **Compatibilidade**: Backend aceita ambos os formatos
5. **Separação de Responsabilidades**: Backend faz conversão pesada

## Próximos Passos

1. ⏳ Completar refatoração de CadastroModal.tsx
2. ⏳ Refatorar InclusaoDependenteModal.tsx
3. ⏳ Refatorar ContinuarInclusaoDependenteModal.tsx
4. ⏳ Testar em dispositivo Android
5. ⏳ Build e deploy

## Notas Importantes

- **NUNCA** usar `FileReader.readAsDataURL` no frontend
- **NUNCA** armazenar base64 em state/localStorage
- **SEMPRE** usar `uploadToStorage()` utility
- **SEMPRE** enviar `arquivoPath` para backend
- Backend faz conversão base64 quando necessário

## Compatibilidade

A Edge Function aceita AMBOS os formatos:
- Novo: `{ arquivoPath, arquivoNome, bucket? }`
- Antigo: `{ arquivo, arquivoNome }` (base64)

Isso garante que código existente continue funcionando durante transição.
