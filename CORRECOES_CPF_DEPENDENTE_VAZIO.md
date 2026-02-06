# Correção: CPF Vazio para Dependentes

## Problema Identificado

Quando dependentes (especialmente menores de 18 anos) não tinham CPF informado, o sistema estava enviando o valor `0` (zero como string) para o ERP através do endpoint `erp-novo-usuario2`.

Isso causava um problema crítico: múltiplos dependentes sem CPF eram cadastrados com CPF `0`, e o sistema acusava "CPF já cadastrado" nos próximos cadastros, impedindo novos registros de dependentes sem CPF.

## Solução Implementada

Alterado para enviar **string vazia** (`''`) ao invés de `'0'` quando o dependente não possui CPF.

### Arquivos Modificados

#### 1. `src/components/cadastro/DependentesSection.tsx`
**Linha 296**

**Antes:**
```typescript
cpf: cpfValue || '0',
```

**Depois:**
```typescript
cpf: cpfValue || '',
```

#### 2. `src/components/cadastro/InclusaoDependenteModal.tsx`

##### Linha ~806-808 (inserção no banco cadastros)
**Antes:**
```typescript
cpf: (() => {
  const cpfLimpo = removeCPFMask(dep.cpf || '').trim();
  if (isMenorDeIdade(dataNascimentoISO)) {
    return cpfLimpo ? cpfLimpo : '';
  }
  // ✅ maior de idade: API não aceita vazio
  return cpfLimpo ? cpfLimpo : '0';
})(),
```

**Depois:**
```typescript
cpf: (() => {
  const cpfLimpo = removeCPFMask(dep.cpf || '').trim();
  return cpfLimpo ? cpfLimpo : '';
})(),
```

##### Linha ~950-952 (payload para ERP)
**Antes:**
```typescript
cpf: (() => {
  const cpfLimpo = removeCPFMask(dep.cpf || '').trim();
  if (isMenorDeIdade(dep.dataNascimento)) {
    return cpfLimpo ? cpfLimpo : '';
  }
  // ✅ maior de idade: API não aceita vazio
  return cpfLimpo ? cpfLimpo : '0';
})(),
```

**Depois:**
```typescript
cpf: (() => {
  const cpfLimpo = removeCPFMask(dep.cpf || '').trim();
  return cpfLimpo ? cpfLimpo : '';
})(),
```

#### 3. `src/components/cadastro/ContinuarInclusaoDependenteModal.tsx`
**Linha 701**

**Antes:**
```typescript
cpf: (() => {
  if (isMenorDeIdade(dataNascimentoISO)) {
    return cpfLimpo ? cpfLimpo : '';
  }
  return cpfLimpo ? cpfLimpo : '0';
})(),
```

**Depois:**
```typescript
cpf: cpfLimpo ? cpfLimpo : '',
```

## Regra Unificada

Agora **todos os dependentes**, independente da idade, seguem a mesma regra:
- **Se tem CPF**: envia o CPF limpo (apenas números)
- **Se não tem CPF**: envia string vazia (`''`)

A lógica anterior que diferenciava menores de maiores foi removida, pois:
1. O comentário "API não aceita vazio" estava incorreto
2. Enviar `'0'` causava duplicação de registros
3. String vazia é o valor correto para representar ausência de CPF

## Arquivo Não Modificado

**`src/components/cadastro/InclusaoDependenteModal.tsx` linha 680**

Este local usa o CPF para gerar o **nome do arquivo** no upload:
```typescript
const cpfArquivo = cpfLimpo && cpfLimpo.trim() ? cpfLimpo : '0';
const fileName = `dependente_${cpfArquivo}_${Date.now()}.${fileExtension}`;
```

**Mantido como `'0'`** propositalmente porque:
- É usado apenas para nome de arquivo
- String vazia geraria nome inválido: `dependente__timestamp.ext`
- Não afeta o envio ao ERP nem duplicação de registros
- Garante nome de arquivo válido: `dependente_0_timestamp.ext`

## Impacto

### Positivo
✅ Resolve duplicação de CPF `0` no sistema
✅ Permite múltiplos dependentes sem CPF no mesmo cadastro
✅ Simplifica lógica (remove diferenciação menor/maior de idade)
✅ Alinha comportamento com expectativa da API do ERP

### Compatibilidade
✅ Build executado com sucesso
✅ Sem breaking changes
✅ Não afeta cadastros já existentes
✅ Não requer migração de dados

## Fluxos Afetados

1. **Novo Cadastro com Dependentes** - `DependentesSection.tsx`
2. **Inclusão de Dependente em Cadastro Existente** - `InclusaoDependenteModal.tsx`
3. **Continuar Inclusão de Dependente** - `ContinuarInclusaoDependenteModal.tsx`

## Endpoint do ERP

**Endpoint**: `erp-novo-usuario2`
**Campo afetado**: `dados.dependentes[].cpf`
**Valor enviado agora**: `""` (string vazia) quando CPF não informado
**Valor enviado antes**: `"0"` quando CPF não informado

## Testes Recomendados

1. ✅ Cadastrar titular com 1 dependente menor sem CPF
2. ✅ Cadastrar titular com múltiplos dependentes sem CPF
3. ✅ Cadastrar titular com dependentes mistos (com e sem CPF)
4. ✅ Incluir dependente sem CPF em cadastro existente
5. ✅ Verificar que não há erro de "CPF já cadastrado" para dependentes sem CPF

## Data da Correção

**Data**: 2026-02-06
**Desenvolvedor**: Claude (Assistant)
**Solicitante**: User (via mensagem)
