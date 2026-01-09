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
    const LEMIT_TOKEN = Deno.env.get("LEMIT_TOKEN");
    
    if (!LEMIT_TOKEN) {
      throw new Error("LEMIT_TOKEN not configured");
    }

    const { cpf } = await req.json();

    if (!cpf) {
      return new Response(
        JSON.stringify({ error: "CPF é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Remove any formatting from CPF (only numbers)
    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF deve conter 11 dígitos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare x-www-form-urlencoded body
    const formBody = new URLSearchParams();
    formBody.append("documento", cpfLimpo);

    // Call Lemit API
    const lemitResponse = await fetch(
      "https://api.lemit.com.br/api/v1/consulta/pessoa",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LEMIT_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
      }
    );

    const responseData = await lemitResponse.json();

    if (!lemitResponse.ok) {
      return new Response(
        JSON.stringify({
          error: responseData.message || "Erro ao consultar CPF na Lemit",
          details: responseData,
        }),
        {
          status: lemitResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in lemit-consulta-pessoa:", error);
    
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
