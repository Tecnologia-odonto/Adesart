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

type ErpDependente = {
  codigoDependente: number;
  nomeDependente: string;
  numeroCpfDependente: string;
  codigoPlano: number;
  nomePlano: string;
  codigoSituacao: number;
  nomeSituacao: string;
};

type ErpAssociado = {
  codigo: number;
  nome: string;
  cpf: string;
  codigoDaEmpresa: number;
  nomeFantasiaDaEmpresa: string;
  dependentes: ErpDependente[];
};

type ErpAssociadoResponse = {
  totalRegistros: number;
  dados: ErpAssociado[];
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

const extractMessage = (payload: any): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const candidates = [
    payload.error,
    payload.message,
    payload.mensagem,
    payload.details?.error,
    payload.details?.message,
    payload.details?.mensagem,
    payload.details?.details?.message,
    payload.details?.details?.mensagem,
    Array.isArray(payload.errors) ? payload.errors[0] : null,
    Array.isArray(payload.details?.errors) ? payload.details.errors[0] : null,
    Array.isArray(payload.details?.details?.errors) ? payload.details.details.errors[0] : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
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

const saveApiLog = async (
  supabase: ReturnType<typeof createClient>,
  logData: {
    endpoint: string;
    method: string;
    request_body: any;
    response_body?: any;
    status_code?: number;
    success: boolean;
    error_message?: string;
    duration_ms: number;
  },
) => {
  try {
    await supabase.from("api_logs").insert(logData);
  } catch (error) {
    console.error("[cadastro-public-submit] failed to save api log:", error);
  }
};

const checkErpAssociado = async (
  supabase: ReturnType<typeof createClient>,
  cpf: string,
) => {
  const ERP_TOKEN = Deno.env.get("ERP_TOKEN");
  const ERP_BASE_URL = Deno.env.get("ERP_BASE_URL") || "https://odontoart.s4e.com.br";

  if (!ERP_TOKEN) {
    throw new Error("ERP_TOKEN not configured");
  }

  const startedAt = Date.now();
  const cpfLimpo = normalizeDigits(cpf);
  const erpUrl = `${ERP_BASE_URL}/v2/api/associados?token=${ERP_TOKEN}&cpfAssociado=${cpfLimpo}&incluirAns=true`;
  const response = await fetch(erpUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    await saveApiLog(supabase, {
      endpoint: "erp-check-associado-public",
      method: "GET",
      request_body: { cpf: cpfLimpo },
      response_body: { error: "Erro ao consultar ERP", details: errorText },
      status_code: response.status,
      success: false,
      error_message: "Erro ao consultar ERP",
      duration_ms: Date.now() - startedAt,
    });

    throw new Error("Erro ao validar CPF no ERP");
  }

  const result = await response.json() as ErpAssociadoResponse;

  const { data: config } = await supabase
    .from("cadastro_config")
    .select("situacoes_que_barram, planos_validos")
    .eq("id", 1)
    .maybeSingle();

  const situacoesQueBarram = config?.situacoes_que_barram || [1, 4, 6];
  const planosValidos = config?.planos_validos || [4, 11, 3, 26];
  const exists = result.totalRegistros > 0 || (Array.isArray(result.dados) && result.dados.length > 0);

  let shouldBlock = false;
  let blockReason = "";
  const summary = {
    empresa: null as string | null,
    codigo: null as number | null,
    nomeFantasiaDaEmpresa: null as string | null,
    codigoPlano: null as number | null,
    codigoSituacao: null as number | null,
    nomeSituacao: null as string | null,
  };

  if (exists && Array.isArray(result.dados)) {
    for (const associado of result.dados) {
      if (!Array.isArray(associado.dependentes)) continue;

      for (const dependente of associado.dependentes) {
        if (situacoesQueBarram.includes(dependente.codigoSituacao) && !planosValidos.includes(dependente.codigoPlano)) {
          shouldBlock = true;
          blockReason = `Associado ja cadastrado na empresa ${associado.nomeFantasiaDaEmpresa} com situacao "${dependente.nomeSituacao}" (codigo ${dependente.codigoSituacao}) e plano ${dependente.codigoPlano} que nao permite recadastro`;
          summary.empresa = associado.codigoDaEmpresa?.toString() || null;
          summary.codigo = associado.codigo;
          summary.nomeFantasiaDaEmpresa = associado.nomeFantasiaDaEmpresa;
          summary.codigoPlano = dependente.codigoPlano;
          summary.codigoSituacao = dependente.codigoSituacao;
          summary.nomeSituacao = dependente.nomeSituacao;
          break;
        }
      }

      if (shouldBlock) break;
    }

    if (!shouldBlock && result.dados.length > 0) {
      const firstRecord = result.dados[0];
      summary.empresa = firstRecord.codigoDaEmpresa?.toString() || null;
      summary.codigo = firstRecord.codigo;
      summary.nomeFantasiaDaEmpresa = firstRecord.nomeFantasiaDaEmpresa;

      if (Array.isArray(firstRecord.dependentes) && firstRecord.dependentes.length > 0) {
        const firstDep = firstRecord.dependentes[0];
        summary.codigoPlano = firstDep.codigoPlano;
        summary.codigoSituacao = firstDep.codigoSituacao;
        summary.nomeSituacao = firstDep.nomeSituacao;
      }
    }
  }

  const normalizedResult = {
    exists,
    shouldBlock,
    blockReason,
    totalRegistros: result.totalRegistros || 0,
    dados: result.dados || [],
    summary,
  };

  await saveApiLog(supabase, {
    endpoint: "erp-check-associado-public",
    method: "GET",
    request_body: { cpf: cpfLimpo },
    response_body: normalizedResult,
    status_code: 200,
    success: true,
    duration_ms: Date.now() - startedAt,
  });

  return normalizedResult;
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

const resolveProfileContext = async (
  supabase: ReturnType<typeof createClient>,
  userId?: string | null,
) => {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role, external_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { role?: string | null; external_id?: string | null } | null;
};

const buildErpPayload = (
  cadastro: PublicCadastroPayload,
  empresaCodigo: number,
  vendedorCodigo: string,
  funcionarioCadastroId?: number | null,
  userRole?: string | null,
  userExternalId?: string | null,
  adesionistaCodigo?: string | null,
) => {
  const sexoDescricao = cadastro.sexoCodigo === 1 ? "Masculino" : "Feminino";
  let codigoVendedor = 0;
  let codigoAdesionista = 0;

  if (userRole === "VENDEDOR" && userExternalId) {
    codigoVendedor = Number.parseInt(userExternalId, 10) || 0;
  } else if (vendedorCodigo) {
    codigoVendedor = Number.parseInt(vendedorCodigo, 10) || 0;
  }

  if (adesionistaCodigo) {
    codigoAdesionista = Number.parseInt(adesionistaCodigo, 10) || 0;
  }

  const funcionarioCadastroCode = userExternalId
    ? Number.parseInt(userExternalId, 10) || 0
    : (funcionarioCadastroId || 0);

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

  const responsavelFinanceiro: Record<string, unknown> = {
    codigoContrato: empresaCodigo.toString(),
    nome: cadastro.nome,
    dataNascimento: formatDateFromISO(cadastro.dataNascimento),
    cpf: formatCpf(cadastro.cpf),
    sexo: cadastro.sexoCodigo,
    grupoFaturamento: 0,
    sexoDescricao,
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
  };

  if (cadastro.numeroMatricula) {
    (responsavelFinanceiro as { Matricula?: string }).Matricula = cadastro.numeroMatricula;
  }

  (responsavelFinanceiro as { dataApresentacao?: string }).dataApresentacao = new Date().toISOString();

  const parceiro: Record<string, unknown> = {
    codigo: codigoVendedor,
    tipoCobranca: 1,
  };

  if (codigoAdesionista > 0) {
    parceiro.adesionista = codigoAdesionista;
  }

  const payload = {
    dados: {
      parceiro,
      parcelaRetidaComissao: "0",
      responsavelFinanceiro,
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

  return payload;
};

const sendCadastroToErp = async (
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  cadastroId: string,
) => {
  const ERP_TOKEN = Deno.env.get("ERP_TOKEN");
  const ERP_URL = Deno.env.get("ERP_URL") || "https://odontoart.s4e.com.br/api/vendedor/NovoUsuario2";

  if (!ERP_TOKEN) {
    throw new Error("ERP_TOKEN not configured");
  }

  const startedAt = Date.now();
  const response = await fetch(ERP_URL, {
    method: "POST",
    headers: {
      token: ERP_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  const hasDadosCodigo = result?.dados?.codigo || result?.data?.dados?.codigo;

  if (!response.ok || !hasDadosCodigo) {
    const errorMessage = extractMessage(result) ||
      (!response.ok ? "Erro ao enviar cadastro para o ERP" : "Erro no cadastro: dados invalidos retornados pelo ERP");

    const responseBody = {
      error: errorMessage,
      details: result,
      status: response.status,
    };

    await saveApiLog(supabase, {
      endpoint: "erp-novo-usuario2-public",
      method: "POST",
      request_body: { ...payload, cadastro_id: cadastroId },
      response_body: responseBody,
      status_code: response.status,
      success: false,
      error_message: errorMessage,
      duration_ms: Date.now() - startedAt,
    });

    return {
      ok: false,
      status: response.status,
      result: responseBody,
    };
  }

  const responseBody = {
    success: true,
    data: result,
  };

  await saveApiLog(supabase, {
    endpoint: "erp-novo-usuario2-public",
    method: "POST",
    request_body: { ...payload, cadastro_id: cadastroId },
    response_body: responseBody,
    status_code: 200,
    success: true,
    duration_ms: Date.now() - startedAt,
  });

  return {
    ok: true,
    status: 200,
    result: responseBody,
  };
};

const syncCadastroEnviado = async (
  supabase: ReturnType<typeof createClient>,
  cadastroId: string,
  erpPayload: Record<string, unknown>,
  erpResult: Record<string, unknown>,
  dependentes: Dependente[],
) => {
  const syncPayloadBase = {
    status: "enviado",
    payload_erp: erpPayload,
    erp_response: erpResult,
    dependentes: formatDependentesForSync(dependentes),
  };

  let { error, count } = await supabase
    .from("cadastros")
    .update({
      ...syncPayloadBase,
      data_envio: new Date().toISOString(),
    }, { count: "exact" })
    .eq("id", cadastroId);

  if (error?.message?.includes("data_envio")) {
    console.warn("[cadastro-public-submit] data_envio not available, retrying sync without the column");

    const retry = await supabase
      .from("cadastros")
      .update(syncPayloadBase, { count: "exact" })
      .eq("id", cadastroId);

    error = retry.error;
    count = retry.count;
  }

  if (error) {
    throw new Error(`Falha ao sincronizar cadastro local apos envio ao ERP: ${error.message}`);
  }

  if (!count || count < 1) {
    throw new Error(`Nenhum cadastro local foi atualizado apos envio ao ERP (cadastro ${cadastroId}).`);
  }
};

const syncLinkUsage = async (
  supabase: ReturnType<typeof createClient>,
  linkId: string,
  cpf: string,
  cadastroId: string,
) => {
  const { error } = await supabase
    .from("cadastro_links")
    .update({
      used_at: new Date().toISOString(),
      used_cpf: cpf,
      used_cadastro_id: cadastroId,
    })
    .eq("id", linkId);

  if (error) {
    throw new Error(`Falha ao atualizar historico do link: ${error.message}`);
  }
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
      const erpCheck = await checkErpAssociado(supabase, normalizedCpf);
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

    const ownerContext = await resolveProfileContext(supabase, link.vendedor_id || link.created_by);
    const dependentesNormalizados = formatDependentesForSync(cadastro!.dependentes);
    const erpPayload = buildErpPayload(
      cadastro!,
      link.empresa_codigo,
      vendedorCodigoResolvido,
      ownerContext?.external_id ? Number.parseInt(ownerContext.external_id, 10) || 0 : 0,
      ownerContext?.role || null,
      ownerContext?.external_id || null,
      ownerContext?.role === "ADESIONISTA" ? ownerContext?.external_id || null : null,
    );

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

    const { ok: erpOk, result: erpResult } = await sendCadastroToErp(supabase, erpPayload, insertedCadastro.id);

    if (!erpOk || erpResult?.error) {
      await supabase
        .from("cadastros")
        .update({
          status: "incompleto",
          payload_erp: erpPayload,
          erp_response: erpResult,
        })
        .eq("id", insertedCadastro.id);

      return jsonResponse({
        error: extractMessage(erpResult) || "Erro ao enviar cadastro para o ERP",
        details: erpResult,
        cadastroId: insertedCadastro.id,
      }, 400);
    }

    try {
      await syncCadastroEnviado(
        supabase,
        insertedCadastro.id,
        erpPayload,
        erpResult,
        cadastro!.dependentes,
      );
    } catch (syncError) {
      console.error("[cadastro-public-submit] cadastro sync error after ERP success:", syncError);

      return jsonResponse({
        ok: true,
        warning: syncError instanceof Error
          ? syncError.message
          : "Cadastro enviado ao ERP, mas houve uma divergencia na sincronizacao local",
        cadastroId: insertedCadastro.id,
        message: "Cadastro concluido com sucesso",
      });
    }

    try {
      await syncLinkUsage(supabase, link.id, normalizedCpf, insertedCadastro.id);
    } catch (linkSyncError) {
      console.error("[cadastro-public-submit] link sync warning after ERP success:", linkSyncError);

      return jsonResponse({
        ok: true,
        warning: linkSyncError instanceof Error
          ? linkSyncError.message
          : "Cadastro concluido, mas o historico do link nao foi atualizado corretamente",
        cadastroId: insertedCadastro.id,
        message: "Cadastro concluido com sucesso",
      });
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
