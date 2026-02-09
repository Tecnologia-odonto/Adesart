import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BuscaEmpresaRequest {
  cnpj?: string;
  nome?: string;
  empresaId?: string;
}

interface ERPEmpresa {
  Id: number;
  RazaoSocial: string;
  NomeFantazia: string;
  Cnpj: string;
  Cep: string;
  Uf: string;
  Municipio: string;
  Bairro: string;
  IdTipoLogradouro: number;
  Logradouro: string;
  Numero: string;
  Complemento: string;
  CentroCusto: string;
  ExigeMatricula?: number;
  ObservacaoComercial?: string;
  PrecoPlano: Array<{
    Id: number;
    Plano: number;
    ValorTitular: number;
    ValorDependente: number;
    ValorAgregado: number;
    [key: string]: any;
  }>;
  [key: string]: any;
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
  let requestBody: BuscaEmpresaRequest = {};
  let responseBody: any;
  let statusCode = 200;
  let success = false;
  let errorMessage: string | undefined;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[ERP Search] Starting request');

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email;
        console.log(`[ERP Search] User authenticated: ${userEmail}`);
      }
    }

    requestBody = await req.json();
    console.log('[ERP Search] Request body:', JSON.stringify(requestBody));
    const { cnpj, nome, empresaId } = requestBody;

    if (!cnpj && !nome && !empresaId) {
      statusCode = 400;
      errorMessage = "É necessário informar CNPJ, Nome ou ID da empresa";
      responseBody = { ok: false, error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-search-empresa",
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

    let ERP_BASE_URL = Deno.env.get("ERP_BASE_URL");
    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");

    console.log('[ERP Search] ERP_BASE_URL:', ERP_BASE_URL);
    console.log('[ERP Search] ERP_TOKEN:', ERP_TOKEN ? 'exists' : 'missing');

    if (!ERP_BASE_URL || !ERP_TOKEN) {
      statusCode = 500;
      errorMessage = "Configuração do ERP não encontrada";
      responseBody = { ok: false, error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-search-empresa",
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

    if (!ERP_BASE_URL.startsWith('http://') && !ERP_BASE_URL.startsWith('https://')) {
      ERP_BASE_URL = `https://${ERP_BASE_URL}`;
    }

    const params = new URLSearchParams();
    params.append('token', ERP_TOKEN);

    if (cnpj) {
      const cnpjLimpo = cnpj.replace(/\D/g, "");
      if (cnpjLimpo.length !== 14) {
        statusCode = 400;
        errorMessage = "CNPJ inválido";
        responseBody = { ok: false, error: errorMessage };

        await saveLog(supabase, {
          user_id: userId,
          user_email: userEmail,
          endpoint: "erp-search-empresa",
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
      params.append('cnpj', cnpjLimpo);
    } else if (nome) {
      params.append('nome', nome);
    } else if (empresaId) {
      params.append('empresaId', empresaId);
    }

    const url = `${ERP_BASE_URL}/api/empresa/BuscaEmpresas?${params.toString()}`;

    console.log(`[ERP Search] User: ${userEmail}`);
    console.log(`[ERP Search] Making GET request to: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    statusCode = response.status;
    console.log(`[ERP Search] Response status: ${statusCode}`);

    const responseText = await response.text();
    console.log(`[ERP Search] Response body (raw): ${responseText}`);

    let erpResponse;
    try {
      erpResponse = JSON.parse(responseText);
      console.log('[ERP Search] Parsed response:', JSON.stringify(erpResponse));
    } catch (parseError) {
      console.error('[ERP Search] Failed to parse response as JSON:', parseError);
      errorMessage = 'Resposta inválida da API do ERP';
      responseBody = {
        ok: false,
        error: errorMessage,
        rawResponse: responseText,
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-search-empresa",
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
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const temDados = erpResponse.dados && Array.isArray(erpResponse.dados) && erpResponse.dados.length > 0;

    if (!temDados) {
      statusCode = 400;
      errorMessage = erpResponse.mensagem || "Nenhuma empresa encontrada";
      console.log(`[ERP Search] No data found: ${errorMessage}`);
      responseBody = {
        ok: false,
        error: errorMessage,
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-search-empresa",
        method: "POST",
        request_body: requestBody,
        response_body: { ...responseBody, erpRawResponse: erpResponse },
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

    console.log(`[ERP Search] Processing ${erpResponse.dados?.length || 0} empresas`);

    const empresas = (erpResponse.dados || []).map((empresa: ERPEmpresa) => ({
      id: empresa.Id,
      codigo: empresa.Id,
      razaoSocial: empresa.RazaoSocial,
      nomeFantasia: empresa.NomeFantazia,
      cnpj: empresa.Cnpj,
      codigoSituacao: empresa.CodigoSituacao || null,
      enderecoEmpresa: {
        cep: empresa.Cep,
        uf: empresa.Uf,
        municipio: empresa.Municipio,
        bairro: empresa.Bairro,
        idTipoLogradouro: empresa.IdTipoLogradouro,
        logradouro: empresa.Logradouro,
        numero: empresa.Numero,
        complemento: empresa.Complemento,
        centroCusto: empresa.CentroCusto,
      },
      exigeMatricula: empresa.ExigeMatricula || 0,
      observacoes: empresa.ObservacaoComercial || '',
      observacao: empresa.ObservacaoComercial || '',
      precoPlano: empresa.PrecoPlano || [],
      raw: empresa,
    }));

    success = true;
    responseBody = {
      ok: true,
      empresas,
    };

    console.log(`[ERP Search] Success! Returning ${empresas.length} empresas`);

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-search-empresa",
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
    console.error("Error in erp-search-empresa:", error);
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    responseBody = {
      ok: false,
      error: errorMessage,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-search-empresa",
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