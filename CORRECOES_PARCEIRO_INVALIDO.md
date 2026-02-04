# Correções: Parceiro Inválido e Status Erro_Envio

## Problemas Corrigidos

### 1. Status "erro_envio" Não Aparecia nas Listas

**Problema:** Quando ocorria um erro no envio do cadastro, o status ficava como "erro_envio", mas esse status não tinha uma tela de listagem. Os cadastros com erro ficavam "perdidos" e não apareciam nas adesões pendentes.

**Solução:** Todos os cadastros que antes ficariam com status "erro_envio" agora ficam com status "incompleto", fazendo com que apareçam nas **Adesões Pendentes** onde podem ser corrigidos e reenviados.

**Arquivos Alterados:**
- `src/hooks/useCadastros.ts`:
  - Removido status "erro_envio" do tipo Cadastro
  - Linhas 395 e 410: Alterado de `status: 'erro_envio'` para `status: 'incompleto'`

### 2. Erro "Parceiro Inválido" Sem Solução

**Problema:** Alguns cadastros não tinham o campo vendedor preenchido corretamente, causando erro "Parceiro inválido" no ERP. O cadastro ficava travado sem possibilidade de correção fácil.

**Solução:** Implementado um **modal de seleção de vendedor** que aparece automaticamente quando o erro "Parceiro inválido" é detectado. O usuário pode selecionar o vendedor correto e tentar novamente imediatamente.

## Fluxo Corrigido

### Cadastro de Novo Usuário

```
1. Usuário preenche cadastro
2. Clica em "Enviar para ERP"
3. Sistema tenta enviar
   ↓
   Se houver erro "Parceiro inválido":
   ↓
4. Modal aparece automaticamente
   - Lista todos os vendedores ativos
   - Mostra código de cada vendedor
   - Permite selecionar o vendedor correto
5. Usuário seleciona vendedor
6. Sistema atualiza cadastro com novo vendedor
7. Reenvia automaticamente para o ERP
   ↓
   Se bem-sucedido:
   - Status muda para "enviado"
   - Cadastro sai das pendentes
   ↓
   Se outro erro:
   - Status fica "incompleto"
   - Aparece nas pendentes para correção
```

### Inclusão de Dependente

```
1. Usuário busca responsável financeiro
2. Adiciona dependentes
3. Clica em "Incluir Dependentes"
4. Sistema tenta enviar
   ↓
   Se houver erro "Parceiro inválido":
   ↓
5. Modal aparece automaticamente
   - Lista todos os vendedores ativos
   - Permite selecionar o vendedor correto
6. Usuário seleciona vendedor
7. Sistema tenta enviar novamente automaticamente
```

## Componentes Criados

### ParceiroInvalidoModal.tsx

Modal reutilizável que:
- Busca automaticamente todos os vendedores ativos do sistema
- Filtra apenas vendedores com `external_id` (código) preenchido
- Mostra nome e código de cada vendedor
- Valida seleção antes de tentar novamente
- Retorna o código e nome do vendedor selecionado

**Localização:** `src/components/cadastro/ParceiroInvalidoModal.tsx`

## Implementação Técnica

### Detecção do Erro

O sistema detecta o erro verificando se a mensagem contém as palavras "parceiro" e "inválido" (case-insensitive):

```typescript
if (errorMessage.toLowerCase().includes('parceiro') &&
    errorMessage.toLowerCase().includes('inválido')) {
  setShowParceiroInvalidoModal(true);
}
```

Isso funciona para variações como:
- "Parceiro inválido"
- "parceiro invalido"
- "Código do parceiro é inválido"
- E outras variações similares

### Integração com CadastroModal

**Arquivos Alterados:** `src/components/cadastro/CadastroModal.tsx`

1. **Import do modal:**
   ```typescript
   import { ParceiroInvalidoModal } from './ParceiroInvalidoModal';
   ```

2. **State para controlar modal:**
   ```typescript
   const [showParceiroInvalidoModal, setShowParceiroInvalidoModal] = useState(false);
   ```

3. **Função de retry:**
   ```typescript
   const handleRetryWithVendedor = async (vendedorCodigo: string, vendedorNome: string) => {
     // Atualiza cadastro com novo vendedor
     // Reconstrói payload com vendedor correto
     // Reenvia para o ERP
   }
   ```

4. **Renderização do modal:**
   ```typescript
   {showParceiroInvalidoModal && (
     <ParceiroInvalidoModal
       onClose={() => setShowParceiroInvalidoModal(false)}
       onRetry={handleRetryWithVendedor}
     />
   )}
   ```

### Integração com InclusaoDependenteModal

**Arquivos Alterados:** `src/components/cadastro/InclusaoDependenteModal.tsx`

1. **Import e state:** Mesma estrutura do CadastroModal

2. **Função de retry:**
   ```typescript
   const handleRetryWithVendedor = async (vendedorCodigo: string, vendedorNome: string) => {
     // Encontra vendedor na lista local
     // Atualiza selectedVendedor
     // Chama handleEnviar() novamente
   }
   ```

3. **Renderização do modal:** Mesmo padrão

## Vantagens da Solução

### Para o Usuário

1. ✅ **Erro claro e acionável**: Modal explica exatamente o problema
2. ✅ **Correção imediata**: Não precisa sair da tela ou reabrir o cadastro
3. ✅ **Lista completa**: Vê todos os vendedores disponíveis com códigos
4. ✅ **Fluxo contínuo**: Após selecionar, o envio continua automaticamente

### Para o Sistema

1. ✅ **Sem cadastros perdidos**: Status "incompleto" garante visibilidade
2. ✅ **Reutilizável**: Mesmo modal funciona em cadastro e inclusão de dependente
3. ✅ **Detecção flexível**: Funciona com diferentes variações da mensagem de erro
4. ✅ **Dados sempre atualizados**: Busca vendedores em tempo real do banco

### Para Administração

1. ✅ **Menos suporte**: Usuários resolvem o problema sozinhos
2. ✅ **Rastreabilidade**: Cadastros sempre aparecem nas pendentes
3. ✅ **Auditoria**: Mantém histórico com payload_erp e erp_response
4. ✅ **Flexibilidade**: Fácil adicionar outros erros específicos no futuro

## Possíveis Extensões

O padrão implementado pode ser facilmente estendido para outros erros específicos:

```typescript
// Exemplo: Erro de plano inválido
if (errorMessage.toLowerCase().includes('plano') &&
    errorMessage.toLowerCase().includes('inválido')) {
  setShowPlanoInvalidoModal(true);
}

// Exemplo: Erro de empresa inválida
if (errorMessage.toLowerCase().includes('empresa') &&
    errorMessage.toLowerCase().includes('inválida')) {
  setShowEmpresaInvalidaModal(true);
}
```

## Testes Recomendados

### Cenário 1: Cadastro sem vendedor
1. Criar cadastro sem vendedor ou com vendedor inválido
2. Tentar enviar para ERP
3. Verificar se modal aparece
4. Selecionar vendedor válido
5. Verificar se envia com sucesso

### Cenário 2: Inclusão de dependente sem vendedor
1. Buscar responsável financeiro
2. Adicionar dependente
3. Não selecionar vendedor (ou selecionar inválido)
4. Tentar incluir
5. Verificar se modal aparece
6. Selecionar vendedor válido
7. Verificar se envia com sucesso

### Cenário 3: Outros erros
1. Criar cadastro com outro tipo de erro (ex: plano inválido)
2. Tentar enviar
3. Verificar se fica com status "incompleto"
4. Verificar se aparece nas pendentes
5. Verificar se mostra mensagem de erro clara

## Observações Importantes

1. **Vendedores Válidos**: O modal só mostra vendedores com `external_id` preenchido e role = 'VENDEDOR'

2. **Estado do Cadastro**: Mesmo quando o modal é exibido, o cadastro já foi salvo com status "incompleto" e o erro registrado em `erp_response`

3. **Retry Automático**: Após selecionar o vendedor no modal, o envio é automático (não precisa clicar em "Enviar" novamente)

4. **Arquivo na Fila**: Se houver arquivo anexado, ele será enfileirado corretamente após o envio bem-sucedido

5. **Compatibilidade**: A solução funciona tanto para novos cadastros quanto para inclusão de dependentes em cadastros existentes
