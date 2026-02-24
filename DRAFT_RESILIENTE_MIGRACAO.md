# Migração para Draft Resiliente com Zustand

## 🎯 Objetivo
Implementar sistema de draft resiliente para evitar perda de dados quando Android recarrega página ao abrir câmera/galeria.

---

## ✅ ARQUIVOS CRIADOS

### 1. `/src/utils/draftKey.ts` ✅
Utilitários para gerar chaves padronizadas de draft.

**Funções**:
- `generateDraftKey(userId, modalName, cadastroId?)` - Gera chave única
- `parseDraftKey(key)` - Parse key para extrair componentes
- `getUserDraftKeys(userId)` - Lista todas as chaves de um usuário
- `clearUserDrafts(userId)` - Limpa todos os drafts de um usuário
- `clearOldDrafts(daysOld)` - Limpa drafts antigos (>7 dias)

**Formato da Chave**:
```
draft:{userId}:{modalName}
draft:{userId}:{modalName}:{cadastroId}
```

---

### 2. `/src/state/draftStore.ts` ✅
Store Zustand com persistência em localStorage.

**Store State**:
```typescript
{
  drafts: Record<string, ModalDraft>;
  upsertDraft: (userId, modalName, data, cadastroId?) => void;
  loadDraft: (userId, modalName, cadastroId?) => ModalDraft | null;
  clearDraft: (userId, modalName, cadastroId?) => void;
  clearAllUserDrafts: (userId) => void;
}
```

**Draft Types**:
- `CadastroModalDraft` - Adesão completa
- `InclusaoDependenteModalDraft` - Inclusão de dependente
- `ContinuarInclusaoDependenteModalDraft` - Continuar inclusão

**File Metadata** (NO BASE64!):
```typescript
{
  path: string;   // "dependentes-temp/12345678900/file.pdf"
  nome: string;   // "documento.pdf"
  size: number;   // 1024000
  mime: string;   // "application/pdf"
}
```

**Persistência**:
- ✅ Zustand persist middleware
- ✅ localStorage key: `modal-drafts-storage`
- ✅ Version: 1

---

### 3. `/src/hooks/useDraftPersistence.ts` ✅
Hook para persistência automática de draft.

**useDraftPersistence**:
```typescript
const { saveDraft, clearDraft } = useDraftPersistence(
  userId,
  'cadastro-modal',
  getDraftData,
  cadastroId,
  enabled
);
```

**Event Listeners**:
- ✅ `document.visibilitychange` - Tab hidden
- ✅ `window.pagehide` - Mobile going to background
- ✅ `window.beforeunload` - Page close/refresh

**useSaveBeforeFilePicker**:
```typescript
const handleSaveBeforePicker = useSaveBeforeFilePicker(saveDraft);

<button onPointerDown={handleSaveBeforePicker}>
  Anexar Arquivo
</button>
```

---

## 🔄 MIGRAÇÃO DOS MODAIS

### Status dos Modais

| Modal | Status | Observações |
|-------|--------|-------------|
| CadastroModal.tsx | 🔄 Pending | Usar draftStore |
| InclusaoDependenteModal.tsx | 🔄 Pending | Usar draftStore |
| ContinuarInclusaoDependenteModal.tsx | 🔄 Pending | Usar draftStore |

---

## 📋 CHECKLIST DE MIGRAÇÃO (POR MODAL)

### Para cada modal:

#### 1. Imports ✅
```typescript
import { useDraftStore, CadastroModalDraft } from '../../state/draftStore';
import { useDraftPersistence, useSaveBeforeFilePicker } from '../../hooks/useDraftPersistence';
```

#### 2. Remover imports antigos ❌
```typescript
// REMOVER:
import { saveDraft, loadDraft, clearDraft, setupAutosave } from '../../utils/draftStorage';
```

#### 3. Setup hooks no componente ✅
```typescript
const { loadDraft, clearDraft: clearDraftStore } = useDraftStore();

const getDraftData = useCallback((): Partial<CadastroModalDraft> => ({
  formData: { ...formData },
  dependentes: [...dependentes],
  arquivo: arquivo ? {
    path: arquivo.path,
    nome: arquivo.nome,
    size: arquivo.size,
    mime: arquivo.mime
  } : null,
  selectedEmpresa,
  step: currentStep,
  currentTab: currentTab,
}), [formData, dependentes, arquivo, selectedEmpresa, currentStep, currentTab]);

const { saveDraft, clearDraft } = useDraftPersistence(
  profile?.id,
  'cadastro-modal',
  getDraftData,
  undefined, // ou cadastro.id para continuar
  isOpen
);

const handleSaveBeforePicker = useSaveBeforeFilePicker(saveDraft);
```

#### 4. Carregar draft no useEffect ✅
```typescript
useEffect(() => {
  if (!profile?.id || !isOpen) return;

  const draft = loadDraft(profile.id, 'cadastro-modal');

  if (draft && draft.modalName === 'cadastro-modal') {
    const cadastroDraft = draft as CadastroModalDraft;

    // Restaurar formData
    if (cadastroDraft.formData) {
      setFormData(cadastroDraft.formData);
    }

    // Restaurar dependentes
    if (cadastroDraft.dependentes) {
      setDependentes(cadastroDraft.dependentes);
    }

    // Restaurar arquivo (apenas metadata)
    if (cadastroDraft.arquivo) {
      setArquivo(cadastroDraft.arquivo);
    }

    // Restaurar step/tab
    if (cadastroDraft.step !== undefined) {
      setCurrentStep(cadastroDraft.step);
    }

    console.log('✅ Draft restored', cadastroDraft);
  }
}, [profile?.id, isOpen, loadDraft]);
```

#### 5. Salvar draft em mudanças ✅
```typescript
// Salvar ao mudar formData
useEffect(() => {
  if (!initialLoadComplete) return;
  saveDraft();
}, [formData, saveDraft, initialLoadComplete]);

// Salvar ao mudar dependentes
useEffect(() => {
  if (!initialLoadComplete) return;
  saveDraft();
}, [dependentes, saveDraft, initialLoadComplete]);

// Salvar ao fazer upload de arquivo
const handleFileUpload = async (file: File) => {
  // ... upload logic ...
  setArquivo(uploadedFile);
  saveDraft(); // ← Salvar imediatamente
};
```

#### 6. Adicionar onPointerDown nos inputs de arquivo ✅
```typescript
<input
  type="file"
  id="file-upload"
  onChange={handleFileUpload}
  className="hidden"
/>
<label
  htmlFor="file-upload"
  onPointerDown={handleSaveBeforePicker} // ← CRÍTICO!
  className="..."
>
  Anexar Arquivo
</label>
```

#### 7. Limpar draft ao fechar com sucesso ✅
```typescript
const handleSuccess = () => {
  clearDraft(); // ← Limpar draft
  onSuccess();
  onClose();
};
```

#### 8. VERIFICAR: Nenhum base64 ❌
```bash
# Buscar base64 no arquivo
grep -i "base64\|FileReader\|readAsDataURL" CadastroModal.tsx
# Resultado deve ser vazio!
```

---

## 🔍 VERIFICAÇÕES DE SEGURANÇA

### 1. Arquivo Metadata (NO BASE64!) ✅
```typescript
// ✅ CORRETO
const arquivo: FileMetadata = {
  path: 'dependentes-temp/12345678900/doc.pdf',
  nome: 'documento.pdf',
  size: 1024000,
  mime: 'application/pdf'
};

// ❌ ERRADO
const arquivo = {
  base64: 'data:application/pdf;base64,...', // NUNCA!
  content: file.arrayBuffer() // NUNCA!
};
```

### 2. Upload para ERP ✅
```typescript
// ✅ CORRETO - Enviar apenas path/nome
const payload = {
  idFuncionario: 123,
  idDependente: 456,
  arquivoPath: arquivo.path, // ← Path no Storage
  arquivoNome: arquivo.nome,
  bucket: 'cadastros-temp-files'
};

// Edge function vai buscar do Storage usando path
```

### 3. Visualizar Arquivo ✅
```typescript
// VisualizarArquivoModal continua usando base64
// MAS apenas para visualização (não para persistência!)

// Buscar do Storage quando necessário
const { data } = await supabase.storage
  .from('cadastros-temp-files')
  .download(arquivo.path);

const base64 = await fileToBase64(data); // Apenas para exibir
```

---

## 🧪 TESTES CRÍTICOS

### Teste 1: Reload ao Abrir Câmera ✅
```
1. Preencher formulário de cadastro
2. Adicionar 2 dependentes
3. Clicar em "Anexar Arquivo"
4. Android recarrega página ao abrir câmera
5. ✅ Verificar: Formulário mantém dados
6. ✅ Verificar: Dependentes mantidos
7. ✅ Verificar: Step/tab correto
```

### Teste 2: Tab Oculta ✅
```
1. Preencher formulário
2. Trocar de tab no navegador
3. Voltar para tab do app
4. ✅ Verificar: Draft foi salvo
5. ✅ Verificar: localStorage contém draft
```

### Teste 3: Arquivo Upload ✅
```
1. Fazer upload de arquivo
2. Verificar localStorage
3. ✅ Verificar: Apenas {path, nome, size, mime}
4. ❌ Verificar: NÃO contém base64
5. Recarregar página
6. ✅ Verificar: Arquivo ainda associado
7. ✅ Verificar: Nome exibido corretamente
```

### Teste 4: Limpeza ao Sucesso ✅
```
1. Preencher formulário
2. Enviar com sucesso
3. ✅ Verificar: Draft foi removido
4. ✅ Verificar: localStorage limpo
5. Reabrir modal
6. ✅ Verificar: Formulário vazio
```

### Teste 5: Múltiplos Modais ✅
```
1. Abrir CadastroModal, preencher, fechar
2. Abrir InclusaoDependenteModal, preencher, fechar
3. ✅ Verificar: 2 drafts diferentes no localStorage
4. Reabrir CadastroModal
5. ✅ Verificar: Draft correto carregado
6. Reabrir InclusaoDependenteModal
7. ✅ Verificar: Draft correto carregado
```

### Teste 6: Expiração de Drafts ✅
```
1. Criar draft
2. Modificar timestamp para >7 dias atrás
3. Recarregar página
4. ✅ Verificar: Draft expirado foi removido
5. ✅ Verificar: Formulário vazio
```

---

## 📊 ANTES vs DEPOIS

### ANTES (draftStorage.ts) ❌

**Problemas**:
- ❌ Salvo apenas em alguns eventos
- ❌ Não salva antes de abrir file picker
- ❌ Chaves não padronizadas
- ❌ Sem suporte a múltiplos cadastros
- ❌ Limpeza manual necessária

**Formato**:
```
localStorage:
  draft_cadastro-modal_user123 = { formData, dependentes, ... }
```

### DEPOIS (Zustand Store) ✅

**Melhorias**:
- ✅ Salvo em TODOS os eventos críticos
- ✅ Salvo ANTES de abrir file picker
- ✅ Chaves padronizadas e únicas
- ✅ Suporte a múltiplos cadastros (com cadastroId)
- ✅ Limpeza automática de drafts antigos
- ✅ Type-safe com TypeScript

**Formato**:
```
localStorage:
  modal-drafts-storage = {
    "draft:user123:cadastro-modal": { ... },
    "draft:user123:inclusao-dependente-modal": { ... },
    "draft:user123:continuar-inclusao-dependente-modal:cad789": { ... }
  }
```

---

## 🚀 ROLLOUT PLAN

### Fase 1: Setup ✅
- ✅ Instalar Zustand
- ✅ Criar draftKey.ts
- ✅ Criar draftStore.ts
- ✅ Criar useDraftPersistence.ts

### Fase 2: Migração (Em Progresso)
- 🔄 Migrar CadastroModal.tsx
- 🔄 Migrar InclusaoDependenteModal.tsx
- 🔄 Migrar ContinuarInclusaoDependenteModal.tsx

### Fase 3: Validação
- ⏳ Remover draftStorage.ts antigo
- ⏳ Testar em Android
- ⏳ Testar reload ao abrir câmera
- ⏳ Testar múltiplos modais

### Fase 4: Cleanup
- ⏳ Documentar nova API
- ⏳ Adicionar migration script (converter drafts antigos)
- ⏳ Deploy

---

## 📝 COMMITS

```bash
# Commit 1: Setup
feat(draft): add persisted draft store for modals

- Install Zustand for state management
- Create draftKey.ts for standardized key generation
- Create draftStore.ts with Zustand + persist middleware
- Create useDraftPersistence hook for auto-save
- Support file metadata (path/nome/size/mime) without base64

# Commit 2: Refactor modals
refactor(upload): persist only file paths and remove base64

- Migrate CadastroModal to use draftStore
- Migrate InclusaoDependenteModal to use draftStore
- Migrate ContinuarInclusaoDependenteModal to use draftStore
- Store only file metadata, never base64
- Remove old draftStorage.ts imports

# Commit 3: Mobile fix
fix(mobile): save draft on pagehide/visibilitychange and before file picker

- Add pagehide listener (mobile background)
- Add visibilitychange listener (tab hidden)
- Add beforeunload listener (page close)
- Save draft onPointerDown before file input opens
- Prevent data loss on Android camera/gallery open
```

---

## 🎯 STATUS ATUAL

### ✅ Completo
- [x] Zustand instalado
- [x] draftKey.ts criado
- [x] draftStore.ts criado
- [x] useDraftPersistence.ts criado
- [x] Documentação completa

### 🔄 Em Progresso
- [ ] Migrar CadastroModal.tsx
- [ ] Migrar InclusaoDependenteModal.tsx
- [ ] Migrar ContinuarInclusaoDependenteModal.tsx

### ⏳ Pendente
- [ ] Remover draftStorage.ts antigo
- [ ] Testes em Android
- [ ] Migration script
- [ ] Deploy

---

**Data**: 2026-02-24
**Status**: 🔄 EM PROGRESSO
