# Fluxo de Cadastro Atualizado - Módulo "Cadastro (Vidas)"

## Visão Geral

O fluxo de cadastro foi atualizado com duas novas validações/consultas que garantem:
1. Verificação de duplicidade no ERP antes de consultar a Lemit
2. Enriquecimento automático do endereço com IDs do ERP necessários para o payload final

## Novo Fluxo de Consulta de CPF

### 1. Verificação no ERP (ANTES da Lemit)

**Edge Function:** `erp-check-associado`

**Endpoint ERP:** `GET /v2/api/associados?token={ERP_TOKEN}&cpfDependente={CPF}&incluirAns=true`

**Comportamento:**
- Ao clicar em "Consultar CPF", o sistema primeiro verifica se o CPF já existe no ERP
- Se `exists = true`:
  - Exibe modal de duplicidade com informações:
    - Empresa
    - Código do contrato
    - Opção de ver detalhes completos (JSON)
  - BLOQUEIA a continuação do fluxo
  - Não chama a API Lemit
- Se `exists = false`:
  - Continua normalmente para a consulta Lemit

**Componente:** `AlreadyExistsModal.tsx`

---

### 2. Consulta Lemit (se não houver duplicidade)

**Edge Function:** `lemit-consulta-pessoa` (já existente)

**Comportamento:**
- Consulta dados da pessoa na Lemit
- Preenche campos: nome, nascimento, sexo, contatos, endereço inicial

---

### 3. Enriquecimento do Endereço com IDs do ERP

**Edge Function:** `erp-endereco-cep`

**Endpoint ERP:** `GET /api/redeatendimento/Endereco?token={ERP_TOKEN}&cep={CEP}`

**Quando ocorre:**
- Automaticamente após a Lemit retornar um CEP válido
- Quando o usuário editar o campo CEP no modal (ao completar 8 dígitos)

**Dados retornados e mapeamento:**
```javascript
{
  IdTipoLogradouro: 816,    // Usado no payload ERP
  TipoLogradouro: "RUA",
  Logradouro: "...",
  IdBairro: 1262,           // Usado no payload ERP
  Bairro: "...",
  IdMunicipio: 41,          // Usado no payload ERP
  Municipio: "...",
  IdUf: 5,                  // Usado no payload ERP
  Uf: "CEARA",
  UfSigla: "CE",            // Gerado automaticamente
  CodigoMunicipioIBGE: "2304400"
}
```

**Campos enriquecidos no objeto `endereco`:**
- `idTipoLogradouro` → usado como `tipoLogradouro` no payload
- `idBairro` → usado como `bairro` no payload
- `idMunicipio` → usado como `municipio` no payload
- `idUf` → usado como `uf` no payload
- `ufSigla` → usado como `descricaoUf` no payload

---

## Arquivos Criados/Modificados

### Edge Functions (Supabase)

#### 1. `supabase/functions/erp-check-associado/index.ts`
- Verifica se CPF já existe no ERP
- Retorna flag `exists` e dados resumidos
- Usa variáveis de ambiente: `ERP_TOKEN`, `ERP_BASE_URL`

#### 2. `supabase/functions/erp-endereco-cep/index.ts`
- Consulta endereço no ERP por CEP
- Retorna IDs necessários para o payload
- Mapeia nome completo da UF para sigla (ex: "CEARA" → "CE")
- Usa variável de ambiente: `ERP_TOKEN`

### Frontend Components

#### 3. `src/components/cadastro/AlreadyExistsModal.tsx` (NOVO)
- Modal exibido quando CPF já existe no ERP
- Mostra empresa e código do contrato
- Botão para expandir detalhes completos
- Impede continuação do cadastro

#### 4. `src/components/cadastro/NovoCadastroCard.tsx` (ATUALIZADO)
- Adicionada verificação ERP antes da Lemit
- Estado para controlar modal de duplicidade
- Consulta automática de endereço após Lemit
- Enriquecimento do objeto `endereco` com IDs do ERP

#### 5. `src/components/cadastro/CadastroModal.tsx` (ATUALIZADO)
- Consulta automática de CEP ao editar (quando completar 8 dígitos)
- Loading indicator no campo CEP
- Atualização automática de logradouro, bairro, cidade, UF
- Preserva campos editáveis: número, complemento

### Hooks e Utilitários

#### 6. `src/hooks/useCadastros.ts` (ATUALIZADO)
- Novo método: `checkERPAssociado(cpf)`
- Novo método: `consultarEnderecoCEP(cep)`
- Exporta ambos no retorno do hook

#### 7. `src/lib/mappers.ts` (ATUALIZADO)
- Interface `CadastroEndereco` estendida com:
  - `idTipoLogradouro?: number`
  - `idBairro?: number`
  - `idMunicipio?: number`
  - `idUf?: number`
  - `ufSigla?: string`
- Função `buildERPPayload` atualizada para usar IDs do ERP:
  - `tipoLogradouro`: usa `idTipoLogradouro` ou fallback "816"
  - `bairro`: usa `idBairro` ou fallback "1262"
  - `municipio`: usa `idMunicipio` ou fallback "2"
  - `uf`: usa `idUf` ou fallback "5"
  - `descricaoUf`: usa `ufSigla` ou `uf`

---

## Variáveis de Ambiente

### Tokens do ERP (Configurar no Supabase Dashboard)

```
ERP_TOKEN=ADICIONAR_TOKEN
ERP_BASE_URL=https://odontoart.s4e.com.br (opcional, já tem default)
```

**Como configurar:**
1. Acesse Supabase Dashboard
2. Navegue até Edge Functions > Secrets
3. Adicione os tokens acima

Ver `TOKENS_SETUP.md` para instruções detalhadas.

---

## Ordem de Execução do Fluxo "Consultar"

```
1. Usuário digita CPF
2. Clica em "Consultar"
3. → checkERPAssociado(cpf)
   ├─ exists = true  → Modal de duplicidade → PARA AQUI
   └─ exists = false → CONTINUA
4. → consultarCPF(cpf) [Lemit]
5. → Se houver CEP no retorno:
   └─ consultarEnderecoCEP(cep)
   └─ Enriquece objeto endereco com IDs
6. → Salva rascunho no banco
7. → Abre modal de edição
```

---

## Tratamento de Erros

### Erro na verificação ERP
- Exibe mensagem de erro ao usuário
- NÃO continua para a Lemit

### Erro na consulta Lemit
- Exibe mensagem de erro
- NÃO salva rascunho

### Erro na consulta de CEP (ERP)
- **Não bloqueia o fluxo**
- Apenas loga warning no console
- Permite continuar com endereço da Lemit
- Usuário pode editar CEP manualmente no modal para tentar novamente

---

## Validações no Envio Final (Cadastrar)

Antes de enviar para o ERP, o sistema valida:
- ✅ Nome preenchido
- ✅ Data de nascimento preenchida
- ✅ Sexo selecionado
- ✅ Pelo menos um telefone marcado como principal
- ✅ CEP preenchido
- ✅ Logradouro preenchido

**Observação:** Se os IDs do ERP não estiverem presentes no objeto `endereco`, o payload usará os valores de fallback configurados no mapper.

---

## Melhorias Futuras Sugeridas

1. **Validação de IDs obrigatórios:**
   - Bloquear envio se IDs do ERP não estiverem presentes
   - Forçar usuário a informar CEP válido consultado no ERP

2. **Cache de CEPs:**
   - Armazenar CEPs consultados em cache local
   - Evitar consultas duplicadas

3. **Histórico de verificações:**
   - Registrar no banco tentativas de cadastro duplicado
   - Permitir auditoria e análise

4. **Feedback visual melhorado:**
   - Indicar visualmente campos preenchidos automaticamente
   - Destacar campos que vieram do ERP vs Lemit

---

## Documentação Adicional

- `TOKENS_SETUP.md` - Guia completo de configuração de tokens
- `MODULO_CADASTRO.md` - Documentação original do módulo
- `.env.example` - Template de variáveis de ambiente

---

## Status

✅ **Implementado e testado**
- Edge Functions deployadas no Supabase
- Frontend atualizado
- Build executado com sucesso
- Tipos TypeScript atualizados
- Fluxo completo integrado
