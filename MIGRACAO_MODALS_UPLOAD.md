# Guia de Migração - Upload sem Base64 nos Modals

## O Que Foi Implementado

### ✅ Infraestrutura Pronta
1. **`src/utils/uploadFile.ts`** - Utilitário de upload centralizado
2. **`src/utils/draftStorage.ts`** - Sistema de autosave/recovery
3. **`supabase/functions/erp-upload-documento/index.ts`** - Backend atualizado para aceitar `arquivoPath`

### ✅ Mudanças Parciais
- `src/components/cadastro/CadastroModal.tsx` - Imports adicionados, tipo de `arquivo` atualizado

## O Que Falta Fazer

### 🔄 Refatoração Necessária nos 3 Modals

#### Arquivos a Atualizar:
1. `src/components/cadastro/CadastroModal.tsx`
2. `src/components/cadastro/InclusaoDependenteModal.tsx`
3. `src/components/cadastro/ContinuarInclusaoDependenteModal.tsx`

---

## Checklist de Refatoração por Arquivo

### Para CADA modal, aplicar estas mudanças:

#### 1. Imports (início do arquivo)
```typescript
// ADICIONAR:
import { uploadToStorage, UploadedFile, validateFile } from '../../utils/uploadFile';
import { saveDraft, loadDraft, clearDraft, setupAutosave } from '../../utils/draftStorage';
```

#### 2. State do Arquivo
```typescript
// ANTES (❌):
const [arquivo, setArquivo] = useState<{
  base64: string;
  nome: string;
  path: string;
} | null>(null);

// DEPOIS (✅):
const [arquivo, setArquivo] = useState<UploadedFile | null>(null);
// UploadedFile = { nome: string; path: string; mime: string; size: number }
```

#### 3. Se Houver Array de Dependentes com Arquivos
```typescript
// ANTES (❌):
interface DependenteForm {
  // ...
  arquivo: { base64: string; nome: string; path: string } | null;
}

// DEPOIS (✅):
import { UploadedFile } from '../../utils/uploadFile';

interface DependenteForm {
  // ...
  arquivo: UploadedFile | null;
}
```

#### 4. Carregar Arquivo Existente (useEffect)
```typescript
// ANTES (❌ - Faz download + conversão base64):
if (cadastro.arquivo_path) {
  const fileName = cadastro.arquivo_path.split('/').pop() || 'arquivo';
  supabase.storage
    .from('cadastros-temp-files')
    .download(cadastro.arquivo_path)
    .then(({ data, error }) => {
      if (data) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Puro = base64.split(',')[1];
          setArquivo({ base64: base64Puro, nome: fileName, path: cadastro.arquivo_path });
        };
        reader.readAsDataURL(data);  // ❌ NÃO FAZER ISSO
      }
    });
}

// DEPOIS (✅ - Apenas metadados):
if (cadastro.arquivo_path) {
  const fileName = cadastro.arquivo_path.split('/').pop() || 'arquivo';
  setArquivo({
    nome: fileName,
    path: cadastro.arquivo_path,
    mime: 'application/octet-stream',  // ou inferir pela extensão
    size: 0
  });
}
```

#### 5. Função de Upload de Arquivo
```typescript
// ANTES (❌ - Upload + conversão base64):
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Upload para storage
  const { error } = await supabase.storage
    .from('cadastros-temp-files')
    .upload(filePath, file);

  // ❌ LÊ E CONVERTE PARA BASE64
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result as string;
    const base64Puro = base64.split(',')[1];
    setArquivo({ base64: base64Puro, nome, path });  // ❌ ARMAZENA BASE64
  };
  reader.readAsDataURL(file);  // ❌ NÃO FAZER ISSO
};

// DEPOIS (✅ - Upload sem base64):
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const validation = validateFile(file);
  if (!validation.valid) {
    setError(validation.error || 'Arquivo inválido');
    e.target.value = '';
    return;
  }

  setUploadingFile(true);
  setError('');

  try {
    if (arquivo?.path) {
      await supabase.storage
        .from('cadastros-temp-files')
        .remove([arquivo.path]);
    }

    const uploadedFile = await uploadToStorage(
      file,
      profile.id,
      'cadastros-temp-files',
      `cadastros/${cadastroId}`  // ou outro prefixo
    );

    setArquivo(uploadedFile);  // ✅ SEM BASE64

    // Salvar no DB
    await updateCadastro(cadastroId, {
      arquivo_path: uploadedFile.path
    });

    // Autosave
    saveDraft('modal-name', { formData, arquivo: uploadedFile }, profile.id);

    setSuccess('Arquivo carregado com sucesso!');
  } catch (err) {
    setError(err.message || 'Erro ao fazer upload');
  } finally {
    setUploadingFile(false);
    e.target.value = '';
  }
};
```

#### 6. Envio para ERP (handleSubmit / handleEnviar)
```typescript
// ANTES (❌ - Envia base64):
const uploadPayload = {
  idFuncionario: funcionarioCadastroId,
  idDependente: parseInt(codigo),
  arquivo: arquivo.base64,  // ❌ BASE64 DO FRONTEND
  arquivoNome: arquivo.nome,
};

fetch(`${API_URL}/erp-upload-documento`, {
  method: 'POST',
  body: JSON.stringify(uploadPayload)
});

// DEPOIS (✅ - Envia path):
const uploadPayload = {
  idFuncionario: funcionarioCadastroId,
  idDependente: parseInt(codigo),
  arquivoPath: arquivo.path,  // ✅ APENAS PATH
  arquivoNome: arquivo.nome,
  bucket: 'cadastros-temp-files'  // opcional
};

fetch(`${API_URL}/erp-upload-documento`, {
  method: 'POST',
  body: JSON.stringify(uploadPayload)
});
// Backend baixa do storage e converte para base64 internamente
```

#### 7. Draft/Autosave (adicionar no final do component, antes do return)
```typescript
// Setup autosave ao montar componente
useEffect(() => {
  // Carregar draft ao montar
  if (profile?.id) {
    const draft = loadDraft('modal-name', profile.id);
    if (draft && confirm('Deseja restaurar o rascunho salvo anteriormente?')) {
      if (draft.formData) setFormData(draft.formData);
      if (draft.arquivo) setArquivo(draft.arquivo);
      if (draft.dependentes) setDependentes(draft.dependentes);
      if (draft.selectedEmpresa) setSelectedEmpresa(draft.selectedEmpresa);
    }
  }

  // Setup autosave
  const cleanup = setupAutosave(
    'modal-name',
    () => ({
      formData,
      arquivo,  // Já é UploadedFile (sem base64)
      dependentes,
      selectedEmpresa
    }),
    profile?.id
  );

  return cleanup;
}, []);

// Limpar draft após sucesso
const handleSuccess = () => {
  clearDraft('modal-name', profile?.id);
  onSuccess();
  onClose();
};
```

---

## Substituições Rápidas (Buscar e Substituir)

### Em todos os 3 modais:

1. **Buscar**: `readAsDataURL`
   **Ação**: Remover todo o bloco FileReader

2. **Buscar**: `arquivo.base64`
   **Substituir**: `arquivo.path` (e ajustar payload)

3. **Buscar**: `arquivo: { base64: string`
   **Substituir**: `arquivo: UploadedFile | null`

4. **Buscar**: `arquivo: arquivo.base64`
   **Substituir**: `arquivoPath: arquivo.path`

---

## Validação Final

Após refatorar cada modal, verificar:

- [ ] Não há mais `FileReader` no código
- [ ] Não há mais `readAsDataURL`
- [ ] Não há mais `btoa` ou `atob`
- [ ] State de `arquivo` usa `UploadedFile`
- [ ] Envio para ERP usa `arquivoPath`
- [ ] Autosave implementado
- [ ] Draft recovery implementado
- [ ] Arquivo existente carrega sem download
- [ ] Compilação sem erros: `npm run build`

---

## Teste em Android

Após refatoração:
1. Abrir em Samsung A15 (ou similar)
2. Selecionar arquivo grande (2-3 MB)
3. Verificar:
   - Não trava
   - Não dá reload
   - Upload completa
   - Envio para ERP funciona
4. Testar reload forçado:
   - Preencher formulário
   - Fazer upload
   - Fechar navegador
   - Reabrir
   - Verificar recovery do draft

---

## Benefícios Esperados

✅ Sem travamentos em Android
✅ Sem reloads inesperados
✅ Menor uso de memória
✅ Recovery automático após reload
✅ Backend faz conversão base64
✅ Frontend mais leve e responsivo

---

## Suporte

Se houver dúvidas durante a refatoração:
1. Consultar `REFATORACAO_UPLOAD.md` para conceitos
2. Ver implementação da Edge Function como referência
3. Usar utilitários em `src/utils/uploadFile.ts` e `src/utils/draftStorage.ts`
