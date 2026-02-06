# Verificação de CPF Duplicado

## Visão Geral

O sistema agora verifica se o CPF já existe na tabela `cadastros` **ANTES** de fazer qualquer consulta no ERP ou Lemmit. Isso evita duplicações e garante que cada vendedor só veja/edite seus próprios cadastros.

---

## Fluxo de Verificação

### Ordem de Verificação

Quando o usuário digita um CPF e clica em "Consultar":

1. ✅ **Valida CPF** - Verifica se é válido
2. ✅ **Busca na tabela `cadastros`** - NOVA verificação
3. ✅ **Busca no ERP** - Verifica se já tem plano ativo
4. ✅ **Consulta Lemmit** - Busca dados pessoais (se ativo)
5. ✅ **Busca histórico** - Mescla com dados anteriores

---

## Regras de Negócio

### Para VENDEDOR

Quando um **VENDEDOR** digita um CPF:

1. Sistema busca na tabela `cadastros` por aquele CPF
2. Se encontrar cadastro:
   - Verifica se `vendedor_codigo` do cadastro = `external_id` do vendedor logado
   - **Se NÃO for o mesmo vendedor:**
     - ❌ **BLOQUEIA** o acesso
     - Exibe modal informando que já existe pré-cadastro
     - Mensagem: *"Este CPF já possui um pré-cadastro vinculado a outro vendedor. Entre em contato com o assistente comercial."*
     - **Não permite** continuar
   - **Se for o mesmo vendedor:**
     - ✅ **Permite** continuar o cadastro existente
     - Exibe modal com opção de continuar
     - Botão: "Continuar Cadastro"
3. Se não encontrar: Segue fluxo normal (ERP, Lemmit, etc)

### Para CADASTRO, ADMINISTRADOR, GESTOR, SUPERVISOR

Quando um usuário desses perfis digita um CPF:

1. Sistema busca na tabela `cadastros` por aquele CPF
2. Se encontrar cadastro:
   - ✅ **Sempre permite** continuar
   - Exibe modal informativo
   - Mensagem: *"Você pode continuar este cadastro existente."*
   - Botão: "Continuar Cadastro"
3. Se não encontrar: Segue fluxo normal (ERP, Lemmit, etc)

---

## Modal: Cadastro Existente

### Informações Exibidas

O modal exibe:
- CPF consultado
- Nome (se preenchido)
- Status do cadastro (Incompleto, Enviado, Bloqueado, Rascunho)
- Vendedor responsável
- Empresa (se selecionada)
- Data de criação

### Ações Disponíveis

**Se NÃO pode continuar (vendedor diferente):**
- ❌ Apenas botão "Fechar"
- Mensagem de bloqueio em vermelho

**Se PODE continuar:**
- ✅ Botão "Fechar"
- ✅ Botão "Continuar Cadastro"

---

## Implementação Técnica

### Query de Verificação

```typescript
const { data: cadastrosExistentes } = await supabase
  .from('cadastros')
  .select(`
    id,
    cpf,
    nome,
    status,
    created_at,
    vendedor_codigo,
    empresa_razao_social,
    profiles!cadastros_vendedor_codigo_fkey (
      name
    )
  `)
  .eq('cpf', cpfLimpo)
  .order('created_at', { ascending: false })
  .limit(1);
```

### Lógica de Permissão

```typescript
if (cadastrosExistentes && cadastrosExistentes.length > 0) {
  const cadastroEncontrado = cadastrosExistentes[0];

  // VENDEDOR: verifica se é dono
  if (profile?.role === 'VENDEDOR') {
    const vendedorCodigo = profile.external_id;
    const cadastroVendedorCodigo = cadastroEncontrado.vendedor_codigo;

    if (vendedorCodigo !== cadastroVendedorCodigo) {
      // BLOQUEIA
      setCadastroExistente({
        cpf,
        cadastro: { ... },
        canContinue: false,
      });
      return;
    }
  }

  // OUTROS PERFIS: sempre permite
  if (['CADASTRO', 'ADMINISTRADOR', 'GESTOR', 'SUPERVISOR'].includes(profile?.role || '')) {
    setCadastroExistente({
      cpf,
      cadastro: { ... },
      canContinue: true,
    });
    return;
  }
}
```

### Continuar Cadastro Existente

Quando o usuário clica em "Continuar Cadastro":

```typescript
const handleContinuarCadastroExistente = async () => {
  const { data: cadastroCompleto } = await supabase
    .from('cadastros')
    .select('*')
    .eq('id', cadastroExistente.cadastro.id)
    .single();

  // Abre o modal de edição com os dados preenchidos
  onSuccess(cadastroCompleto);
};
```

---

## Casos de Uso

### Caso 1: Vendedor A tenta acessar cadastro do Vendedor B

**Cenário:**
- Vendedor A (código 123) digita CPF 111.222.333-44
- CPF já tem cadastro vinculado ao Vendedor B (código 456)

**Resultado:**
- ❌ Sistema BLOQUEIA
- Modal exibe: "Este CPF já possui um pré-cadastro vinculado a outro vendedor"
- Vendedor não consegue prosseguir
- Deve entrar em contato com assistente comercial

### Caso 2: Vendedor acessa seu próprio cadastro incompleto

**Cenário:**
- Vendedor A (código 123) digita CPF 111.222.333-44
- CPF tem cadastro incompleto vinculado ao próprio Vendedor A

**Resultado:**
- ✅ Sistema PERMITE
- Modal exibe: "Você pode continuar este cadastro existente"
- Botão "Continuar Cadastro" disponível
- Ao clicar, abre modal de edição com dados já preenchidos

### Caso 3: Administrador acessa cadastro de qualquer vendedor

**Cenário:**
- Administrador digita CPF 111.222.333-44
- CPF tem cadastro vinculado ao Vendedor A

**Resultado:**
- ✅ Sistema PERMITE
- Modal exibe informações do cadastro incluindo vendedor responsável
- Botão "Continuar Cadastro" disponível
- Pode editar e finalizar o cadastro

### Caso 4: CPF não existe na tabela cadastros

**Cenário:**
- Qualquer usuário digita CPF 999.888.777-66
- CPF não existe na tabela cadastros

**Resultado:**
- ✅ Sistema continua fluxo normal
- Verifica no ERP
- Consulta Lemmit (se ativo)
- Cria novo cadastro

---

## Benefícios

1. **Evita duplicação** - Não cria cadastro duplicado se já existe
2. **Segurança** - Vendedores só veem seus próprios cadastros
3. **Continuidade** - Permite continuar cadastros incompletos
4. **Auditoria** - Gestores podem ver e editar qualquer cadastro
5. **Performance** - Verifica no banco local primeiro (mais rápido)

---

## Arquivos Alterados

### Novos Arquivos

- `src/components/cadastro/CadastroExistenteModal.tsx` - Modal de cadastro duplicado

### Arquivos Modificados

- `src/components/cadastro/NovoCadastroCard.tsx` - Adicionada verificação antes do ERP/Lemmit

---

## Testes Recomendados

### Teste 1: Vendedor Bloqueado
1. Vendedor A cria cadastro incompleto com CPF X
2. Faz logout
3. Vendedor B faz login
4. Vendedor B tenta consultar CPF X
5. ✅ Deve ser bloqueado com mensagem

### Teste 2: Vendedor Continua Próprio Cadastro
1. Vendedor A cria cadastro incompleto com CPF X
2. Vendedor A consulta CPF X novamente
3. ✅ Deve poder continuar o cadastro

### Teste 3: Administrador Acessa Qualquer Cadastro
1. Vendedor A cria cadastro com CPF X
2. Administrador faz login
3. Administrador consulta CPF X
4. ✅ Deve poder continuar/editar o cadastro

### Teste 4: CPF Novo
1. Qualquer usuário consulta CPF que não existe
2. ✅ Deve seguir fluxo normal (ERP, Lemmit, etc)

---

## Mensagens de Console

O sistema registra logs detalhados no console:

```
🔍 Verificando se CPF já existe na tabela cadastros...
⚠️ CPF já possui cadastro: {...}
❌ Vendedor não é dono do cadastro - BLOQUEADO
✅ Vendedor é dono do cadastro - pode continuar
ℹ️ Usuário pode continuar o cadastro existente
✅ CPF não encontrado na tabela cadastros - pode criar novo
```

Esses logs facilitam o debug e o entendimento do fluxo.

---

## Perguntas Frequentes

### P: O que acontece se o cadastro estiver com status "enviado"?

**R:** O sistema permite continuar o cadastro (se o usuário tiver permissão). Porém, o cadastro já foi enviado ao ERP, então qualquer alteração será apenas no banco local e não afetará o ERP.

### P: Adesionista pode ver cadastros de outros vendedores?

**R:** Não. Adesionista segue a mesma regra de VENDEDOR - só pode ver/editar seus próprios cadastros.

### P: E se houver múltiplos cadastros com o mesmo CPF?

**R:** O sistema retorna o mais recente (ORDER BY created_at DESC LIMIT 1). Isso não deveria acontecer, mas se acontecer, usa o último criado.

### P: Essa verificação substitui a verificação no ERP?

**R:** Não! Ela é executada ANTES da verificação no ERP. As duas verificações continuam acontecendo:
1. Verifica na tabela `cadastros` (local)
2. Verifica no ERP (externo)

---

## Próximas Melhorias

Possíveis melhorias futuras:

1. Adicionar filtro na lista de cadastros para mostrar apenas os do vendedor logado
2. Adicionar relatório de cadastros por vendedor
3. Permitir transferência de cadastro entre vendedores (com aprovação)
4. Notificar vendedor quando seu cadastro for editado por gestor
