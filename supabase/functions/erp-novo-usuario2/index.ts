import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");
    const ERP_URL = Deno.env.get("ERP_URL") || "https://odontoart.s4e.com.br/api/vendedor/NovoUsuario2";
    
    if (!ERP_TOKEN) {
      throw new Error("ERP_TOKEN not configured");
    }

    const payload = await req.json();

    // Basic validation
    if (!payload || !payload.dados) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: campo 'dados' é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!payload.dados.responsavelFinanceiro) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: 'responsavelFinanceiro' é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call ERP API
    const erpResponse = await fetch(ERP_URL, {
      method: "POST",
      headers: {
        "token": ERP_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await erpResponse.json();

    if (!erpResponse.ok) {
      return new Response(
        JSON.stringify({
          error: responseData.message || "Erro ao enviar cadastro para o ERP",
          details: responseData,
          status: erpResponse.status,
        }),
        {
          status: erpResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in erp-novo-usuario2:", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno do servidor",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
