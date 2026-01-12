import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Dependente {
  codigoDependente: number;
  nomeDependente: string;
  numeroCpfDependente: string;
  codigoPlano: number;
  nomePlano: string;
  codigoSituacao: number;
  nomeSituacao: string;
  [key: string]: unknown;
}

interface Associado {
  codigo: number;
  nome: string;
  cpf: string;
  codigoDaEmpresa: number;
  nomeFantasiaDaEmpresa: string;
  dependentes: Dependente[];
  [key: string]: unknown;
}

interface AssociadoResponse {
  totalRegistros: number;
  dados: Associado[];
}

async function saveLog(
  supabase: any,
  logData: {
    user_id?: string;
    user_email?: string;
    endpoint: string;
    method: string;
    request_body: any;
    response_body?: any;
    status_code?: number;
    success: boolean;
    error_message?: string;
    duration_ms: number;
  }
) {
  try {
    await supabase.from("api_logs").insert(logData);
  } catch (error) {
    console.error("Error saving log:", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let userId: string | undefined;
  let userEmail: string | undefined;
  let requestBody: any = {};
  let responseBody: any;
  let statusCode = 200;
  let success = false;
  let errorMessage: string | undefined;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    }

    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");
    const ERP_BASE_URL = Deno.env.get("ERP_BASE_URL") || "https://odontoart.s4e.com.br";

    if (!ERP_TOKEN) {
      throw new Error("ERP_TOKEN not configured");
    }

    requestBody = await req.json();
    const { cpf } = requestBody;

    if (!cpf) {
      statusCode = 400;
      errorMessage = "CPF é obrigatório";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-check-associado",
        method: "POST",
        request_body: requestBody,
        response_body: responseBody,
        status_code: statusCode,
        success: false,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify(responseBody),
        {
          status: statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      statusCode = 400;
      errorMessage = "CPF deve conter 11 dígitos";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-check-associado",
        method: "POST",
        request_body: requestBody,
        response_body: responseBody,
        status_code: statusCode,
        success: false,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify(responseBody),
        {
          status: statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const erpUrl = `${ERP_BASE_URL}/v2/api/associados?token=${ERP_TOKEN}&cpfDependente=${cpfLimpo}`;

    const erpResponse = await fetch(erpUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    statusCode = erpResponse.status;

    if (!erpResponse.ok) {
      const errorText = await erpResponse.text();
      console.error("ERP API error:", errorText);
      errorMessage = "Erro ao consultar ERP";
      responseBody = {
        error: errorMessage,
        details: errorText,
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-check-associado",
        method: "POST",
        request_body: requestBody,
        response_body: responseBody,
        status_code: statusCode,
        success: false,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify(responseBody),
        {
          status: statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseData: AssociadoResponse = await erpResponse.json();

    const exists = responseData.totalRegistros > 0 || (responseData.dados && responseData.dados.length > 0);

    let summary = {
      empresa: null as string | null,
      codigo: null as number | null,
      nomeFantasiaDaEmpresa: null as string | null,
      codigoPlano: null as number | null,
      codigoSituacao: null as number | null,
      nomeSituacao: null as string | null,
    };

    let shouldBlock = false;
    let blockReason = '';

    if (exists && responseData.dados && responseData.dados.length > 0) {
      const { data: config } = await supabase
        .from('cadastro_config')
        .select('situacoes_que_barram, planos_validos')
        .eq('id', 1)
        .maybeSingle();

      const situacoesQueBarram = config?.situacoes_que_barram || [1, 4, 6];
      const planosValidos = config?.planos_validos || [4, 11, 3, 26];

      for (const associado of responseData.dados) {
        if (!associado.dependentes || associado.dependentes.length === 0) {
          continue;
        }

        for (const dependente of associado.dependentes) {
          const codigoSituacao = dependente.codigoSituacao;
          const codigoPlano = dependente.codigoPlano;

          if (situacoesQueBarram.includes(codigoSituacao)) {
            if (!planosValidos.includes(codigoPlano)) {
              shouldBlock = true;
              blockReason = `Associado já cadastrado na empresa ${associado.nomeFantasiaDaEmpresa} com situação "${dependente.nomeSituacao}" (código ${codigoSituacao}) e plano ${codigoPlano} que não permite recadastro`;

              summary.empresa = associado.codigoDaEmpresa?.toString() || null;
              summary.codigo = associado.codigo;
              summary.nomeFantasiaDaEmpresa = associado.nomeFantasiaDaEmpresa;
              summary.codigoPlano = codigoPlano;
              summary.codigoSituacao = codigoSituacao;
              summary.nomeSituacao = dependente.nomeSituacao;

              break;
            }
          }
        }

        if (shouldBlock) break;
      }

      if (!shouldBlock && responseData.dados.length > 0) {
        const firstRecord = responseData.dados[0];
        summary.empresa = firstRecord.codigoDaEmpresa?.toString() || null;
        summary.codigo = firstRecord.codigo;
        summary.nomeFantasiaDaEmpresa = firstRecord.nomeFantasiaDaEmpresa;

        if (firstRecord.dependentes && firstRecord.dependentes.length > 0) {
          const firstDep = firstRecord.dependentes[0];
          summary.codigoPlano = firstDep.codigoPlano;
          summary.codigoSituacao = firstDep.codigoSituacao;
          summary.nomeSituacao = firstDep.nomeSituacao;
        }
      }
    }

    success = true;
    responseBody = {
      exists,
      shouldBlock,
      blockReason,
      totalRegistros: responseData.totalRegistros,
      dados: responseData.dados,
      summary,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-check-associado",
      method: "POST",
      request_body: requestBody,
      response_body: responseBody,
      status_code: 200,
      success: true,
      duration_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify(responseBody),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in erp-check-associado:", error);
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    responseBody = {
      error: errorMessage,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-check-associado",
      method: "POST",
      request_body: requestBody,
      response_body: responseBody,
      status_code: statusCode,
      success: false,
      error_message: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify(responseBody),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});