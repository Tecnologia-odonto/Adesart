import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EnqueueRequest {
  cadastroId: string | null;
  idFuncionario: number;
  idDependente: number;
  arquivoPath: string;
  arquivoNome: string;
  tipo: 'titular' | 'dependente';
  bucket?: string;
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autorização necessária" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: EnqueueRequest = await req.json();

    if (!body.idFuncionario || !body.idDependente || !body.arquivoPath || !body.arquivoNome || !body.tipo) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios faltando" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let createdBy = user.id;

    if (body.cadastroId) {
      const { data: cadastro } = await supabaseClient
        .from("cadastros")
        .select("id, created_by")
        .eq("id", body.cadastroId)
        .single();

      if (cadastro) {
        createdBy = cadastro.created_by || user.id;
      }
    }

    const queueItem = {
      cadastro_id: body.cadastroId,
      created_by: createdBy,
      id_funcionario: body.idFuncionario,
      id_dependente: body.idDependente,
      arquivo_path: body.arquivoPath,
      arquivo_nome: body.arquivoNome,
      bucket: body.bucket || 'cadastros-temp-files',
      tipo: body.tipo,
      status: 'queued',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
    };

    const { data: queueData, error: queueError } = await supabaseClient
      .from("erp_upload_queue")
      .insert(queueItem)
      .select()
      .single();

    if (queueError) {
      console.error("Erro ao enfileirar upload:", queueError);
      return new Response(
        JSON.stringify({ error: "Erro ao enfileirar upload", details: queueError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        queued: true,
        queue_id: queueData.id,
        message: "Arquivo enfileirado para envio ao ERP. O processamento será realizado automaticamente."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro na função erp-enqueue-upload:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
