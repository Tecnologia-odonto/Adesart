import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Idempotency-Key, X-Cadastro-Id",
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

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractErpMessage = (payload: any): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const candidates = [
    payload.message,
    payload.mensagem,
    payload.error,
    payload.data?.message,
    payload.data?.mensagem,
    payload.details?.message,
    payload.details?.mensagem,
    Array.isArray(payload.errors) ? payload.errors[0] : null,
    Array.isArray(payload.data?.errors) ? payload.data.errors[0] : null,
    Array.isArray(payload.details?.errors) ? payload.details.errors[0] : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

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
  let errorMessage: string | undefined;

  const idempotencyKey = req.headers.get("X-Idempotency-Key")?.trim() || req.headers.get("x-idempotency-key")?.trim() || "";
  const cadastroIdHeader = req.headers.get("X-Cadastro-Id")?.trim() || req.headers.get("x-cadastro-id")?.trim() || "";

  const enrichRequestBodyForLog = (body: any) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return {
        ...body,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        ...(cadastroIdHeader ? { cadastro_id: cadastroIdHeader } : {}),
      };
    }

    return {
      payload: body,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      ...(cadastroIdHeader ? { cadastro_id: cadastroIdHeader } : {}),
    };
  };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    }

    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");
    const ERP_URL = Deno.env.get("ERP_URL") || "https://odontoart.s4e.com.br/api/vendedor/NovoUsuario2";

    if (!ERP_TOKEN) {
      throw new Error("ERP_TOKEN not configured");
    }

    requestBody = await req.json();

    if (!requestBody || !requestBody.dados) {
      statusCode = 400;
      errorMessage = "Payload invalido: campo 'dados' e obrigatorio";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-novo-usuario2",
        method: "POST",
        request_body: enrichRequestBodyForLog(requestBody),
        response_body: responseBody,
        status_code: statusCode,
        success: false,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify(responseBody), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!requestBody.dados.responsavelFinanceiro) {
      statusCode = 400;
      errorMessage = "Payload invalido: 'responsavelFinanceiro' e obrigatorio";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-novo-usuario2",
        method: "POST",
        request_body: enrichRequestBodyForLog(requestBody),
        response_body: responseBody,
        status_code: statusCode,
        success: false,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify(responseBody), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (cadastroIdHeader && isUuid(cadastroIdHeader)) {
      const { data: existingCadastro, error: existingCadastroError } = await supabase
        .from("cadastros")
        .select("status, erp_response")
        .eq("id", cadastroIdHeader)
        .maybeSingle();

      if (!existingCadastroError && existingCadastro?.status === "enviado" && existingCadastro?.erp_response) {
        const existingResponse = existingCadastro.erp_response;

        responseBody =
          typeof existingResponse === "object" && existingResponse !== null
            ? { ...existingResponse, idempotent: true, reused: true, reuseSource: "cadastros" }
            : { success: true, data: existingResponse, idempotent: true, reused: true, reuseSource: "cadastros" };

        await saveLog(supabase, {
          user_id: userId,
          user_email: userEmail,
          endpoint: "erp-novo-usuario2",
          method: "POST",
          request_body: enrichRequestBodyForLog(requestBody),
          response_body: responseBody,
          status_code: 200,
          success: true,
          duration_ms: Date.now() - startTime,
        });

        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (idempotencyKey) {
      const { data: existingLog } = await supabase
        .from("api_logs")
        .select("response_body")
        .eq("endpoint", "erp-novo-usuario2")
        .eq("success", true)
        .contains("request_body", { idempotency_key: idempotencyKey })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLog?.response_body) {
        responseBody =
          typeof existingLog.response_body === "object" && existingLog.response_body !== null
            ? { ...existingLog.response_body, idempotent: true, reused: true, reuseSource: "api_logs" }
            : { success: true, data: existingLog.response_body, idempotent: true, reused: true, reuseSource: "api_logs" };

        await saveLog(supabase, {
          user_id: userId,
          user_email: userEmail,
          endpoint: "erp-novo-usuario2",
          method: "POST",
          request_body: enrichRequestBodyForLog(requestBody),
          response_body: responseBody,
          status_code: 200,
          success: true,
          duration_ms: Date.now() - startTime,
        });

        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const erpResponse = await fetch(ERP_URL, {
      method: "POST",
      headers: {
        token: ERP_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await erpResponse.json();
    statusCode = erpResponse.status;

    const hasDadosCodigo = responseData?.dados?.codigo || responseData?.data?.dados?.codigo;

    if (!hasDadosCodigo) {
      if (!erpResponse.ok) {
        errorMessage = extractErpMessage(responseData) || "Erro ao enviar cadastro para o ERP";
      } else {
        errorMessage = extractErpMessage(responseData) || "Erro no cadastro: dados invalidos retornados pelo ERP";
      }

      responseBody = {
        error: errorMessage,
        details: responseData,
        status: statusCode,
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-novo-usuario2",
        method: "POST",
        request_body: enrichRequestBodyForLog(requestBody),
        response_body: responseBody,
        status_code: statusCode,
        success: false,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify(responseBody), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    responseBody = {
      success: true,
      data: responseData,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-novo-usuario2",
      method: "POST",
      request_body: enrichRequestBodyForLog(requestBody),
      response_body: responseBody,
      status_code: 200,
      success: true,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in erp-novo-usuario2:", error);
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    responseBody = {
      error: errorMessage,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-novo-usuario2",
      method: "POST",
      request_body: enrichRequestBodyForLog(requestBody),
      response_body: responseBody,
      status_code: statusCode,
      success: false,
      error_message: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify(responseBody), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
