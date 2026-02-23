import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    const ERP_ENDPOINT = Deno.env.get("ERP_ENDPOINT") || "https://odontoart.s4e.com.br";
    const ERP_URL = `${ERP_ENDPOINT}/api/dependente/UploadDocDependente?token=${ERP_TOKEN}`;

    if (!ERP_TOKEN) {
      throw new Error("ERP_TOKEN not configured");
    }

    requestBody = await req.json();

    if (!requestBody.idFuncionario || !requestBody.idDependente) {
      statusCode = 400;
      errorMessage = "Campos obrigatórios: idFuncionario, idDependente";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-upload-documento",
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

    let arquivoBase64: string;
    let arquivoNome: string;

    if (requestBody.arquivoPath) {
      const bucket = requestBody.bucket || 'cadastros-temp-files';
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(requestBody.arquivoPath);

      if (downloadError || !fileData) {
        statusCode = 400;
        errorMessage = `Erro ao baixar arquivo do storage: ${downloadError?.message || 'Arquivo não encontrado'}`;
        responseBody = { error: errorMessage };

        await saveLog(supabase, {
          user_id: userId,
          user_email: userEmail,
          endpoint: "erp-upload-documento",
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

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }

      arquivoBase64 = btoa(binaryString);
      arquivoNome = requestBody.arquivoNome || requestBody.arquivoPath.split('/').pop() || 'documento.pdf';
    } else if (requestBody.arquivo) {
      arquivoBase64 = requestBody.arquivo;
      arquivoNome = requestBody.arquivoNome;

      if (!arquivoNome) {
        statusCode = 400;
        errorMessage = "Campo obrigatório: arquivoNome (quando usar arquivo base64)";
        responseBody = { error: errorMessage };

        await saveLog(supabase, {
          user_id: userId,
          user_email: userEmail,
          endpoint: "erp-upload-documento",
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
    } else {
      statusCode = 400;
      errorMessage = "É necessário fornecer 'arquivo' (base64) ou 'arquivoPath' (storage path)";
      responseBody = { error: errorMessage };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-upload-documento",
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

    const erpPayload = {
      idFuncionario: requestBody.idFuncionario,
      idDependente: requestBody.idDependente,
      arquivo: arquivoBase64,
      arquivoNome: arquivoNome,
    };

    const erpResponse = await fetch(ERP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(erpPayload),
    });

    const responseData = await erpResponse.json();
    statusCode = erpResponse.status;

    if (!erpResponse.ok) {
      errorMessage = responseData.message || responseData?.mensagem || "Erro ao enviar documento para o ERP";
      responseBody = {
        error: errorMessage,
        details: responseData,
        status: statusCode,
      };

      await saveLog(supabase, {
        user_id: userId,
        user_email: userEmail,
        endpoint: "erp-upload-documento",
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

    success = true;
    responseBody = {
      success: true,
      data: responseData,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-upload-documento",
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
    console.error("Error in erp-upload-documento:", error);
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    responseBody = {
      error: errorMessage,
    };

    await saveLog(supabase, {
      user_id: userId,
      user_email: userEmail,
      endpoint: "erp-upload-documento",
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
