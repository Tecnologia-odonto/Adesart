import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Idempotency-Key, X-Cadastro-Id",
};

type CadastroContato = {
  tipo: "celular" | "fixo" | "email" | "whatsapp";
  valor: string;
  principal?: boolean;
};

type CadastroEndereco = {
  cep: string;
  tipoLogradouro?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  idTipoLogradouro?: number;
  idBairro?: number;
  idMunicipio?: number;
  idUf?: number;
  ufSigla?: string;
};

type Dependente = {
  tipo: number;
  nome: string;
  dataNascimento: string;
  cpf: string;
  sexo: number;
  sexoDescricao: string;
  plano: number;
  planoValor: string;
  nomeMae: string;
  carenciaAtendimento: number;
  funcionarioCadastro: number;
};

type PublicCadastroPayload = {
  cpf: string;
  nome: string;
  dataNascimento: string;
  sexoCodigo: number;
  contatos: CadastroContato[];
  endereco: CadastroEndereco;
  nomeMae: string;
  numeroMatricula?: string;
  dependentes: Dependente[];
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const formatCpf = (cpf: string) => {
  const digits = normalizeDigits(cpf);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatDateFromISO = (isoDate: string) => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
};

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const checkCpfAlreadyCompletedOnLink = async (
  supabase: ReturnType<typeof createClient>,
  linkId: string,
  cpf: string,
) => {
  const { data, error } = await supabase
    .from("cadastros")
    .select("id")
    .eq("origem_link_id", linkId)
    .eq("cpf", cpf)
    .eq("status", "enviado")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};

const checkLocalBlockedCpf = async (
  supabase: ReturnType<typeof createClient>,
  cpf: string,
) => {
  const { data, error } = await supabase.rpc("check_public_link_blocked_cpf", {
    p_cpf: cpf,
  });

  if (error) {
    throw error;
  }

  return data as { blocked?: boolean; reason?: string | null; code?: string | null } | null;
};

const checkErpAssociado = async (
  supabaseUrl: string,
  cpf: string,
) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/erp-check-associado`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cpf }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error || "Erro ao validar CPF no ERP");
  }

  return result;
};

const formatDependentesForSync = (dependentes: Dependente[]) =>
  dependentes.map((dep) => ({
    cpf: normalizeDigits(dep.cpf),
    nome: dep.nome,
    dataNascimento: dep.dataNascimento,
    sexo: dep.sexo,
    sexoDescricao: dep.sexoDescricao,
    tipo: dep.tipo,
    plano: dep.plano,
    planoValor: dep.planoValor,
    nomeMae: dep.nomeMae,
    carenciaAtendimento: dep.carenciaAtendimento,
    funcionarioCadastro: dep.funcionarioCadastro,
  }));

const isValidSellerCode = (value?: string | null) => {
  const numeric = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(numeric) && numeric > 0;
};

const resolveVendedorCodigo = async (
  supabase: ReturnType<typeof createClient>,
  link: {
    vendedor_codigo?: string | null;
    vendedor_id?: string | null;
    created_by?: string | null;
  },
) => {
  if (isValidSellerCode(link.vendedor_codigo)) {
    return String(link.vendedor_codigo).trim();
  }

  const candidateIds = [link.vendedor_id, link.created_by].filter(Boolean) as string[];

  for (const profileId of candidateIds) {
    const { data, error } = await supabase
      .from("profiles")
      .select("external_id")
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (isValidSellerCode(data?.external_id)) {
      return String(data?.external_id).trim();
    }
  }

  return null;
};

const buildErpPayload = (
  cadastro: PublicCadastroPayload,
  empresaCodigo: number,
  vendedorCodigo: string,
) => {
  const funcionarioCadastroCode = Number.parseInt(vendedorCodigo, 10) || 0;
  const codigoVendedor = Number.parseInt(vendedorCodigo, 10) || 0;

  const contatosRespFin = cadastro.contatos.map((contato) => {
    let tipo = 8;

    if (contato.tipo === "fixo") tipo = 1;
    if (contato.tipo === "email") tipo = 50;
    if (contato.tipo === "whatsapp") tipo = 10;

    return {
      tipo,
      dado: contato.valor,
    };
  });

  return {
    dados: {
      parceiro: {
        codigo: codigoVendedor,
        tipoCobranca: 1,
      },
      parcelaRetidaComissao: "0",
      responsavelFinanceiro: {
        codigoContrato: empresaCodigo.toString(),
        nome: cadastro.nome,
        dataNascimento: formatDateFromISO(cadastro.dataNascimento),
        cpf: formatCpf(cadastro.cpf),
        sexo: cadastro.sexoCodigo,
        grupoFaturamento: 0,
        sexoDescricao: cadastro.sexoCodigo === 1 ? "Masculino" : "Feminino",
        identidadeNumero: "123456789",
        identidadeOrgaoExpeditor: "SSPDS",
        endereco: {
          cep: cadastro.endereco.cep,
          tipoLogradouro: cadastro.endereco.idTipoLogradouro?.toString() || "816",
          logradouro: cadastro.endereco.logradouro,
          numero: cadastro.endereco.numero,
          complemento: cadastro.endereco.complemento || "N/D",
          bairro: cadastro.endereco.idBairro?.toString() || "1262",
          municipio: cadastro.endereco.idMunicipio?.toString() || "2",
          uf: cadastro.endereco.idUf?.toString() || "5",
          descricaoUf: cadastro.endereco.ufSigla || cadastro.endereco.uf,
        },
        contatoResponsavelFinanceiro: contatosRespFin,
        fl_AlteraSituacao: 1,
        ...(cadastro.numeroMatricula ? { Matricula: cadastro.numeroMatricula } : {}),
        dataApresentacao: new Date().toISOString(),
      },
      dependente: cadastro.dependentes.map((dep) => ({
        tipo: dep.tipo,
        nome: dep.nome,
        dataNascimento: formatDateFromISO(dep.dataNascimento),
        cpf: formatCpf(dep.cpf),
        sexo: dep.sexo,
        sexoDescricao: dep.sexoDescricao,
        plano: dep.plano,
        planoValor: dep.planoValor,
        nomeMae: dep.nomeMae,
        carenciaAtendimento: dep.carenciaAtendimento,
        funcionarioCadastro: funcionarioCadastroCode,
      })),
    },
    empresa: empresaCodigo.toString(),
  };
};

const validatePayload = (cadastro?: PublicCadastroPayload) => {
  if (!cadastro) return "Dados do cadastro obrigatorios";
  if (!normalizeDigits(cadastro.cpf) || normalizeDigits(cadastro.cpf).length !== 11) return "CPF invalido";
  if (!cadastro.nome) return "Nome obrigatorio";
  if (!cadastro.nomeMae) return "Nome da mae obrigatorio";
  if (!cadastro.dataNascimento) return "Data de nascimento obrigatoria";
  if (cadastro.sexoCodigo !== 0 && cadastro.sexoCodigo !== 1) return "Sexo obrigatorio";
  if (!Array.isArray(cadastro.contatos) || cadastro.contatos.length === 0) return "Informe ao menos um contato";

  const telefones = cadastro.contatos.filter((contato) =>
    ["celular", "fixo", "whatsapp"].includes(contato.tipo)
  );

  if (telefones.length === 0) return "Informe ao menos um telefone";
  if (!cadastro.endereco?.cep) return "CEP obrigatorio";
  if (!cadastro.endereco?.logradouro) return "Logradouro obrigatorio";
  if (!cadastro.endereco?.numero) return "Numero obrigatorio";
  if (!cadastro.endereco?.bairro) return "Bairro obrigatorio";
  if (!cadastro.endereco?.cidade) return "Cidade obrigatoria";
  if (!cadastro.endereco?.uf) return "UF obrigatoria";
  if (!Array.isArray(cadastro.dependentes) || cadastro.dependentes.length === 0) return "Dependentes obrigatorios";

  const titulares = cadastro.dependentes.filter((dep) => Number(dep.tipo) === 1);
  if (titulares.length !== 1) return "O cadastro precisa ter exatamente um titular";

  for (const dependente of cadastro.dependentes) {
    if (!dependente.nome) return "Todos os dependentes precisam de nome";
    if (!dependente.dataNascimento) return "Todos os dependentes precisam de data de nascimento";
    if (!dependente.nomeMae) return "Todos os dependentes precisam de nome da mae";
    if (!dependente.plano) return "Todos os dependentes precisam de plano";
  }

  return null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido" }, 405);
  }

  try {
    const { token, cadastro } = await req.json() as {
      token?: string;
      cadastro?: PublicCadastroPayload;
    };

    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "Token obrigatorio" }, 400);
    }

    const validationError = validatePayload(cadastro);
    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const tokenHash = await hashToken(token.trim());

    const { data: link, error: linkError } = await supabase
      .from("cadastro_links")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (linkError) {
      console.error("[cadastro-public-submit] link error:", linkError);
      return jsonResponse({ error: "Erro ao validar link" }, 500);
    }

    if (!link) {
      return jsonResponse({ error: "Link nao encontrado ou invalido" }, 404);
    }

    if (!link.is_active) {
      return jsonResponse({ error: "Link inativo" }, 410);
    }

    const alreadyCompletedOnLink = await checkCpfAlreadyCompletedOnLink(supabase, link.id, normalizeDigits(cadastro!.cpf));
    if (alreadyCompletedOnLink) {
      return jsonResponse({
        error: "Este CPF ja concluiu uma adesao por este link e nao pode reutiliza-lo.",
      }, 409);
    }

    if (Number(link.empresa_exige_matricula) === 1 && !cadastro?.numeroMatricula) {
      return jsonResponse({ error: "Matricula obrigatoria para esta empresa" }, 400);
    }

    const normalizedCpf = normalizeDigits(cadastro!.cpf);
    const localBlockedCpf = await checkLocalBlockedCpf(supabase, normalizedCpf);
    if (localBlockedCpf?.blocked) {
      return jsonResponse({
        error: localBlockedCpf.reason || "Este CPF nao pode utilizar este link.",
      }, 409);
    }

    try {
      const erpCheck = await checkErpAssociado(supabaseUrl, normalizedCpf);
      if (erpCheck?.exists && erpCheck?.shouldBlock) {
        return jsonResponse({
          error: erpCheck.blockReason || "Cliente ja cadastrado no sistema",
        }, 409);
      }
    } catch (erpValidationError) {
      console.warn("[cadastro-public-submit] ERP validation failed during final submit, continuing with ERP send:", erpValidationError);
    }

    const vendedorCodigoResolvido = await resolveVendedorCodigo(supabase, link);
    if (!vendedorCodigoResolvido) {
      return jsonResponse({
        error: "Link sem codigo de vendedor valido. Gere um novo link com um usuario que possua codigo externo configurado.",
      }, 400);
    }

    const dependentesNormalizados = formatDependentesForSync(cadastro!.dependentes);
    const erpPayload = buildErpPayload(cadastro!, link.empresa_codigo, vendedorCodigoResolvido);

    const { data: insertedCadastro, error: insertError } = await supabase
      .from("cadastros")
      .insert({
        status: "incompleto",
        tipo_cadastro: "cadastro",
        created_by: link.created_by,
        team_id: link.team_id,
        cpf: normalizedCpf,
        nome: cadastro!.nome,
        data_nascimento: cadastro!.dataNascimento,
        sexo: cadastro!.sexoCodigo === 1 ? "M" : "F",
        sexo_codigo: cadastro!.sexoCodigo,
        nome_mae: cadastro!.nomeMae,
        contatos: cadastro!.contatos,
        endereco: cadastro!.endereco,
        cliente_sera_usuario: true,
        empresa_id: link.empresa_codigo,
        empresa_codigo: link.empresa_codigo,
        empresa_nome: link.empresa_nome,
        empresa_cnpj: link.empresa_cnpj,
        empresa_raw: link.empresa_raw,
        empresa_exige_matricula: link.empresa_exige_matricula,
        planos_raw: link.planos_raw,
        dependentes: dependentesNormalizados,
        numero_matricula: cadastro!.numeroMatricula || null,
        vendedor_id: link.vendedor_id,
        vendedor_codigo: vendedorCodigoResolvido,
        vendedor_nome: link.vendedor_nome,
        origem_link_id: link.id,
        fluxo_publico: true,
      })
      .select("id")
      .single();

    if (insertError || !insertedCadastro) {
      console.error("[cadastro-public-submit] insert error:", insertError);
      return jsonResponse({ error: "Nao foi possivel criar o cadastro" }, 500);
    }

    const functionUrl = `${supabaseUrl}/functions/v1/erp-novo-usuario2`;
    const erpResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": `public-link:${link.id}:${normalizedCpf}`,
        "X-Cadastro-Id": insertedCadastro.id,
      },
      body: JSON.stringify(erpPayload),
    });

    const erpResult = await erpResponse.json();

    if (!erpResponse.ok || erpResult?.error) {
      await supabase
        .from("cadastros")
        .update({
          status: "incompleto",
          payload_erp: erpPayload,
          erp_response: erpResult,
        })
        .eq("id", insertedCadastro.id);

      return jsonResponse({
        error: erpResult?.error || erpResult?.details?.mensagem || erpResult?.details?.message || "Erro ao enviar cadastro para o ERP",
        details: erpResult,
        cadastroId: insertedCadastro.id,
      }, 400);
    }

    const dependentesParaSync = formatDependentesForSync(cadastro!.dependentes);

    const { error: updateCadastroError } = await supabase
      .from("cadastros")
      .update({
        status: "enviado",
        payload_erp: erpPayload,
        erp_response: erpResult,
        dependentes: dependentesParaSync,
        data_envio: new Date().toISOString(),
      })
      .eq("id", insertedCadastro.id);

    if (updateCadastroError) {
      console.error("[cadastro-public-submit] update cadastro error:", updateCadastroError);
      return jsonResponse({
        error: "Cadastro enviado ao ERP, mas falhou a sincronizacao local",
        cadastroId: insertedCadastro.id,
      }, 500);
    }

    const { error: updateLinkError } = await supabase
      .from("cadastro_links")
      .update({
        used_at: new Date().toISOString(),
        used_cpf: normalizedCpf,
        used_cadastro_id: insertedCadastro.id,
      })
      .eq("id", link.id);

    if (updateLinkError) {
      console.error("[cadastro-public-submit] update link error:", updateLinkError);
      return jsonResponse({
        error: "Cadastro concluido, mas o historico do link nao foi atualizado corretamente",
        cadastroId: insertedCadastro.id,
      }, 500);
    }

    return jsonResponse({
      ok: true,
      cadastroId: insertedCadastro.id,
      message: "Cadastro concluido com sucesso",
    });
  } catch (error) {
    console.error("[cadastro-public-submit] unexpected error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
