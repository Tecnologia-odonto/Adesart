import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QueueItem {
  id: string;
  cadastro_id: string;
  id_funcionario: number;
  id_dependente: number;
  arquivo_path: string;
  arquivo_nome: string;
  bucket: string;
  tipo: string;
  attempts: number;
  status: string;
}

async function processQueueItem(
  supabase: any,
  item: QueueItem
): Promise<{ success: boolean; error?: string; statusCode?: number; response?: any }> {
  try {
    console.log(`Processando item ${item.id} - tentativa ${item.attempts + 1}/5`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(item.bucket)
      .download(item.arquivo_path);

    if (downloadError || !fileData) {
      console.error(`Erro ao baixar arquivo ${item.arquivo_path}:`, downloadError);
      return {
        success: false,
        error: `Erro ao baixar arquivo: ${downloadError?.message || 'Arquivo não encontrado'}`,
        statusCode: 404,
      };
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");
    const ERP_ENDPOINT = Deno.env.get("ERP_ENDPOINT") || "https://odontoart.s4e.com.br";
    const ERP_URL = `${ERP_ENDPOINT}/api/dependente/UploadDocDependente?token=${ERP_TOKEN}`;

    if (!ERP_TOKEN) {
      return {
        success: false,
        error: "ERP_TOKEN não configurado",
        statusCode: 500,
      };
    }

    const erpPayload = {
      idFuncionario: item.id_funcionario,
      idDependente: item.id_dependente,
      arquivo: base64,
      arquivoNome: item.arquivo_nome,
    };

    console.log(`Enviando documento para ERP: ${item.arquivo_nome}`);

    const erpResponse = await fetch(ERP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(erpPayload),
    });

    const responseData = await erpResponse.json();
    const statusCode = erpResponse.status;

    if (!erpResponse.ok) {
      const errorMsg = responseData.message || responseData?.mensagem || "Erro ao enviar documento para o ERP";
      console.error(`Erro no ERP (${statusCode}):`, errorMsg);
      return {
        success: false,
        error: errorMsg,
        statusCode,
        response: responseData,
      };
    }

    console.log(`Documento enviado com sucesso! Removendo do bucket...`);

    const { error: deleteError } = await supabase.storage
      .from(item.bucket)
      .remove([item.arquivo_path]);

    if (deleteError) {
      console.warn(`Aviso: Não foi possível deletar arquivo ${item.arquivo_path}:`, deleteError);
    }

    return {
      success: true,
      statusCode: 200,
      response: responseData,
    };
  } catch (error) {
    console.error(`Erro ao processar item ${item.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      statusCode: 500,
    };
  }
}

async function processQueueInBackground(supabaseClient: any, queueItems: QueueItem[]) {
  console.log(`Processando ${queueItems.length} itens em background com intervalo de 10s entre uploads...`);

  const results = {
    processed: 0,
    success: 0,
    failed: 0,
    retry: 0,
    errors: [] as any[],
  };

  for (const item of queueItems) {
    const { error: lockError } = await supabaseClient
      .from("erp_upload_queue")
      .update({ status: "processing", last_attempt_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("status", item.status);

    if (lockError) {
      console.log(`Item ${item.id} já está sendo processado`);
      continue;
    }

    results.processed++;

    const result = await processQueueItem(supabaseClient, item);

    const newAttempts = item.attempts + 1;

    if (result.success) {
      await supabaseClient
        .from("erp_upload_queue")
        .update({
          status: "success",
          attempts: newAttempts,
          last_attempt_at: new Date().toISOString(),
          erp_response: result.response,
          last_status_code: result.statusCode,
        })
        .eq("id", item.id);

      results.success++;
      console.log(`✓ Item ${item.id} processado com sucesso`);
    } else {
      const isFinalFailure = newAttempts >= 5;
      const newStatus = isFinalFailure ? "failed" : "retry_wait";

      const nextAttempt = new Date();
      nextAttempt.setMinutes(nextAttempt.getMinutes() + 10);

      await supabaseClient
        .from("erp_upload_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_attempt_at: new Date().toISOString(),
          next_attempt_at: isFinalFailure ? null : nextAttempt.toISOString(),
          last_error: result.error,
          last_status_code: result.statusCode,
          erp_response: result.response,
        })
        .eq("id", item.id);

      if (isFinalFailure) {
        results.failed++;
        console.error(`✗ Item ${item.id} falhou permanentemente após 5 tentativas`);
      } else {
        results.retry++;
        console.warn(`⟳ Item ${item.id} falhará nova tentativa em 10 minutos (tentativa ${newAttempts}/5)`);
      }

      results.errors.push({
        id: item.id,
        error: result.error,
        attempts: newAttempts,
        final_failure: isFinalFailure,
      });
    }

    if (queueItems.indexOf(item) < queueItems.length - 1) {
      console.log(`Aguardando 10 segundos antes do próximo upload...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  console.log(`Processamento em background concluído:`, results);
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("Verificando e resetando itens travados...");
    const { data: resetResult, error: resetError } = await supabaseClient
      .rpc("reset_stuck_queue_items", { stuck_threshold_minutes: 15 });

    if (resetError) {
      console.warn("Aviso: Erro ao resetar itens travados:", resetError);
    } else if (resetResult && resetResult.length > 0) {
      const { reset_count } = resetResult[0];
      if (reset_count > 0) {
        console.log(`✓ ${reset_count} item(ns) travado(s) foram resetados`);
      }
    }

    const now = new Date().toISOString();

    const { data: queueItems, error: fetchError } = await supabaseClient
      .from("erp_upload_queue")
      .select("*")
      .in("status", ["queued", "retry_wait"])
      .lt("attempts", 5)
      .lte("next_attempt_at", now)
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error("Erro ao buscar itens da fila:", fetchError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar fila", details: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("Nenhum item elegível para processamento");
      return new Response(
        JSON.stringify({
          message: "Nenhum item na fila para processar",
          queued_count: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Encontrados ${queueItems.length} itens na fila. Iniciando processamento em background...`);

    const ctx = (req as any).ctx;
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(processQueueInBackground(supabaseClient, queueItems));
    } else {
      processQueueInBackground(supabaseClient, queueItems);
    }

    return new Response(
      JSON.stringify({
        message: "Processamento iniciado em background",
        queued_count: queueItems.length,
        estimated_time_seconds: queueItems.length * 10,
        note: "Os itens serão processados automaticamente. Acompanhe o status na tela."
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro no worker de processamento:", error);
    return new Response(
      JSON.stringify({
        error: "Erro no worker",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
