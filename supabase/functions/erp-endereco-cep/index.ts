import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EnderecoERPResponse {
  dados: {
    IdTipoLogradouro: number;
    TipoLogradouro: string;
    Logradouro: string;
    IdBairro: number;
    Bairro: string;
    IdMunicipio: number;
    Municipio: string;
    IdUf: number;
    Uf: string;
    CodigoMunicipioIBGE: string;
  };
}

const UF_MAP: Record<string, string> = {
  'ACRE': 'AC',
  'ALAGOAS': 'AL',
  'AMAPA': 'AP',
  'AMAZONAS': 'AM',
  'BAHIA': 'BA',
  'CEARA': 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  'GOIAS': 'GO',
  'MARANHAO': 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  'PARA': 'PA',
  'PARAIBA': 'PB',
  'PARANA': 'PR',
  'PERNAMBUCO': 'PE',
  'PIAUI': 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  'RONDONIA': 'RO',
  'RORAIMA': 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  'SERGIPE': 'SE',
  'TOCANTINS': 'TO',
};

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
  console.log('[erp-endereco-cep] Request received:', req.method, req.url);

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

    if (req.method !== "POST") {
      console.error('[erp-endereco-cep] Method not allowed:', req.method);
      statusCode = 405;
      errorMessage = `Method ${req.method} not allowed. Use POST.`;
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-endereco-cep",
        method: req.method,
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

    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");

    if (!ERP_TOKEN) {
      throw new Error("ERP_TOKEN not configured");
    }

    const bodyText = await req.text();
    console.log('[erp-endereco-cep] Request body:', bodyText);

    try {
      requestBody = JSON.parse(bodyText);
    } catch (e) {
      console.error('[erp-endereco-cep] Invalid JSON:', e);
      statusCode = 400;
      errorMessage = "Invalid JSON in request body";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-endereco-cep",
        method: "POST",
        request_body: { raw: bodyText },
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

    const { cep } = requestBody;
    console.log('[erp-endereco-cep] CEP received:', cep);

    if (!cep) {
      statusCode = 400;
      errorMessage = "CEP é obrigatório";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-endereco-cep",
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

    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      statusCode = 400;
      errorMessage = "CEP deve conter 8 dígitos";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-endereco-cep",
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

    const erpUrl = `https://odontoart.s4e.com.br/api/redeatendimento/Endereco?token=${ERP_TOKEN}&cep=${cepLimpo}`;

    console.log('[erp-endereco-cep] Calling ERP API:', erpUrl.replace(ERP_TOKEN, '***'));

    const erpResponse = await fetch(erpUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    statusCode = erpResponse.status;
    console.log('[erp-endereco-cep] ERP response status:', statusCode);

    if (!erpResponse.ok) {
      const errorText = await erpResponse.text();
      console.error("[erp-endereco-cep] ERP API error:", errorText);
      errorMessage = "Erro ao consultar CEP no ERP";
      responseBody = {
        error: errorMessage,
        details: errorText,
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-endereco-cep",
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

    const responseText = await erpResponse.text();
    console.log('[erp-endereco-cep] ERP raw response:', responseText);

    let responseData: EnderecoERPResponse;
    try {
      responseData = JSON.parse(responseText);
      console.log('[erp-endereco-cep] Parsed response data:', JSON.stringify(responseData, null, 2));
    } catch (parseError) {
      console.error('[erp-endereco-cep] Failed to parse ERP response:', parseError);
      console.error('[erp-endereco-cep] Response was:', responseText);
      statusCode = 500;
      errorMessage = "Resposta do ERP não está em formato JSON válido";
      responseBody = {
        error: errorMessage,
        details: responseText.substring(0, 500),
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-endereco-cep",
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

    console.log('[erp-endereco-cep] responseData.dados exists?', !!responseData.dados);
    console.log('[erp-endereco-cep] responseData structure:', Object.keys(responseData));

    if (!responseData.dados) {
      statusCode = 404;
      errorMessage = "CEP não encontrado no ERP";
      responseBody = {
        error: errorMessage,
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-endereco-cep",
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

    const ufNormalizado = responseData.dados.Uf.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const ufSigla = UF_MAP[ufNormalizado] || responseData.dados.Uf.substring(0, 2).toUpperCase();

    console.log('[erp-endereco-cep] Success! Returning data for CEP:', cepLimpo);

    success = true;
    responseBody = {
      ok: true,
      dados: {
        ...responseData.dados,
        UfSigla: ufSigla,
      },
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-endereco-cep",
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
    console.error("[erp-endereco-cep] Error in erp-endereco-cep:", error);
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    responseBody = {
      error: errorMessage,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-endereco-cep",
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
