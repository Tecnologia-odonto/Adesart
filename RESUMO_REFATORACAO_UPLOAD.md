# Refatoração de Upload - Resumo Executivo

## 🎯 Objetivo
Eliminar processamento de base64 no frontend para evitar tela branca/reload em dispositivos Android (ex: Samsung A15).

---

## ✅ O Que Foi Implementado

### 1. Infraestrutura Backend ✅
**Arquivo**: `supabase/functions/erp-upload-documento/index.ts`

**Status**: ✅ **DEPLOYADO E FUNCIONANDO**

**Mudanças**:
- Aceita `arquivoPath` (novo) OU `arquivo` (base64 - antigo)
- Quando recebe `arquivoPath`:
  1. Baixa arquivo do Supabase Storage (service role)
  2. Converte para base64 NO SERVIDOR
  3. Envia para ERP no formato esperado
- Mantém compatibilidade com código antigo

**Benefício**: Conversão base64 acontece no servidor, não no device Android.

---

### 2. Utilitário de Upload ✅
**Arquivo**: `src/utils/uploadFile.ts`

**Status**: ✅ **CRIADO E PRONTO PARA USO**

**Funções**:
- `uploadToStorage()` - Upload direto para Supabase Storage
- `validateFile()` - Validação de tipo e tamanho
- `deleteFromStorage()` - Limpeza de arquivos antigos

**Interface**:
```typescript
interface UploadedFile {
  nome: string;
  path: string;
  mime: string;
  size: number;
  // ⚠️ SEM base64!
}
```

**Uso**:
```typescript
const uploadedFile = await uploadToStorage(file, userId, bucket, prefix);
setArquivo(uploadedFile);  // Sem base64
```

---

### 3. Sistema de Draft/Autosave ✅
**Arquivo**: `src/utils/draftStorage.ts`

**Status**: ✅ **CRIADO E PRONTO PARA USO**

**Funções**:
- `saveDraft()` - Salva rascunho em localStorage (sem base64)
- `loadDraft()` - Carrega rascunho ao reabrir
- `clearDraft()` - Limpa após sucesso
- `setupAutosave()` - Autosave automático em eventos:
  - `visibilitychange` (ao trocar de aba)
  - `pagehide` (ao fechar)
  - `beforeunload` (antes de sair)

**Benefício**: Recovery automático após reload/crash.

---

### 4. Parcial: CadastroModal.tsx ⚠️
**Arquivo**: `src/components/cadastro/CadastroModal.tsx`

**Status**: ⚠️ **IMPORTS ADICIONADOS, TIPO ATUALIZADO**

**Feito**:
- ✅ Imports dos utilitários adicionados
- ✅ Tipo de `arquivo` mudado para `UploadedFile`
- ✅ Carregamento de arquivo existente SEM download

**Falta**:
- ⏳ Refatorar função de upload (remover FileReader)
- ⏳ Mudar payload para ERP (usar `arquivoPath`)
- ⏳ Implementar autosave/recovery

---

## ⏳ O Que Falta Fazer

### Arquivos Pendentes de Refatoração

| Arquivo | Status | Prioridade |
|---------|--------|------------|
| `CadastroModal.tsx` | ⚠️ Parcial | 🔴 Alta |
| `InclusaoDependenteModal.tsx` | ❌ Não iniciado | 🔴 Alta |
| `ContinuarInclusaoDependenteModal.tsx` | ⚠️ Parcial* | 🔴 Alta |

*\*Já tem busca de empresa adicionada, mas upload ainda usa base64*

---

## 📋 Checklist de Refatoração

Para **cada um dos 3 modals**, aplicar:

### Frontend - Remover Base64

- [ ] **Imports**: Adicionar `uploadFile` e `draftStorage`
- [ ] **State**: Mudar `arquivo` para `UploadedFile` (sem base64)
- [ ] **Carregar Existente**: Não fazer download + conversão, apenas metadados
- [ ] **Upload**: Usar `uploadToStorage()`, sem `FileReader`
- [ ] **Envio ERP**: Usar `arquivoPath` em vez de `arquivo.base64`
- [ ] **Autosave**: Implementar com `setupAutosave()`
- [ ] **Recovery**: Carregar draft ao montar componente
- [ ] **Cleanup**: Limpar draft após sucesso

### Validação

- [ ] Buscar `readAsDataURL` - deve retornar 0 resultados
- [ ] Buscar `arquivo.base64` - deve retornar 0 resultados
- [ ] Buscar `btoa|atob` - deve retornar 0 resultados
- [ ] `npm run build` - sem erros
- [ ] Teste em Android - sem travamentos

---

## 📚 Documentação Criada

1. **`REFATORACAO_UPLOAD.md`** - Conceitos e explicação técnica
2. **`MIGRACAO_MODALS_UPLOAD.md`** - Guia passo-a-passo de migração
3. **`RESUMO_REFATORACAO_UPLOAD.md`** - Este arquivo (resumo executivo)

---

## 🔧 Como Aplicar a Refatoração

### Opção 1: Manual (Recomendado)
1. Abrir `MIGRACAO_MODALS_UPLOAD.md`
2. Seguir checklist para cada modal
3. Testar após cada arquivo
4. Commit: `refactor(upload): remove base64 from [MODAL_NAME]`

### Opção 2: Buscar e Substituir
Ver seção "Substituições Rápidas" em `MIGRACAO_MODALS_UPLOAD.md`

---

## 🎯 Benefícios Esperados

### Antes (❌ Problema)
- Upload de 2MB congela device Android
- FileReader consome muita memória
- Base64 em state causa reloads
- Perda de dados ao recarregar página

### Depois (✅ Solução)
- Upload direto para Storage (sem processing no device)
- Sem FileReader = sem travamento
- State leve (apenas metadados)
- Recovery automático via draft

---

## 📊 Status Atual

```
Infraestrutura:     [████████████████████] 100% ✅
Utilitários:        [████████████████████] 100% ✅
Backend:            [████████████████████] 100% ✅
CadastroModal:      [████████░░░░░░░░░░░░]  40% ⚠️
InclusaoDepModal:   [░░░░░░░░░░░░░░░░░░░░]   0% ❌
ContinuarModal:     [██░░░░░░░░░░░░░░░░░░]  10% ⚠️
                    ──────────────────────
Total:              [████████████░░░░░░░░]  60%
```

---

## 🚀 Próximos Passos

1. **Completar CadastroModal.tsx**
   - Refatorar handleFileUpload
   - Mudar payload para ERP
   - Adicionar autosave

2. **Refatorar InclusaoDependenteModal.tsx**
   - Aplicar mesmo padrão
   - Array de dependentes com arquivos

3. **Completar ContinuarInclusaoDependenteModal.tsx**
   - Já tem EmpresaSearchCard
   - Falta upload sem base64

4. **Testar em Android**
   - Samsung A15 ou similar
   - Upload de arquivos 2-5MB
   - Reload forçado

5. **Deploy**
   - Backend já deployado ✅
   - Frontend: após concluir modals

---

## ⚠️ Notas Importantes

### Durante Migração
- Backend aceita AMBOS formatos (antigo e novo)
- Pode migrar um modal por vez
- Testar cada modal após refatoração

### Regras de Ouro
- ❌ **NUNCA** usar `FileReader.readAsDataURL`
- ❌ **NUNCA** armazenar base64 em state
- ❌ **NUNCA** armazenar base64 em localStorage
- ✅ **SEMPRE** usar `uploadToStorage()`
- ✅ **SEMPRE** enviar `arquivoPath` para backend

---

## 🐛 Troubleshooting

### "Arquivo não encontrado no storage"
- Verificar se `arquivoPath` está correto
- Verificar se arquivo foi realmente uploaded
- Verificar permissões do bucket

### "Base64 inválido no backend"
- Verificar se está enviando `arquivoPath` e não `arquivo`
- Verificar se backend está usando versão atualizada

### "Draft não carrega"
- Verificar se `profile.id` está disponível
- Verificar localStorage do browser
- Draft expira após 7 dias

---

## 📞 Suporte

- **Conceitos**: Ver `REFATORACAO_UPLOAD.md`
- **Passo-a-passo**: Ver `MIGRACAO_MODALS_UPLOAD.md`
- **Código Exemplo**: Ver `src/utils/uploadFile.ts` e `draftStorage.ts`
- **Backend**: Ver `supabase/functions/erp-upload-documento/index.ts`

---

## ✨ Conclusão

A infraestrutura está **100% pronta e funcionando**.

Falta apenas aplicar o padrão nos 3 modals seguindo o guia em `MIGRACAO_MODALS_UPLOAD.md`.

**Tempo estimado**: 2-3 horas para os 3 modals.

**Resultado**: App funcionando perfeitamente em Android sem travamentos.
