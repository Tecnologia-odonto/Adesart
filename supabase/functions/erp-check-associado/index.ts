import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AssociadoResponse {
  totalRegistros: number;
  dados: Array<{
    empresa?: { codigo?: string | number; nome?: string };
    codigo?: string | number;
    codigoContrato?: string | number;
    nome?: string;
    cpf?: string;
    nomeFantasiaDaEmpresa?: string;
    [key: string]: unknown;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");
    const ERP_BASE_URL = Deno.env.get("ERP_BASE_URL") || "https://odontoart.s4e.com.br";

    if (!ERP_TOKEN) {
      throw new Error("ERP_TOKEN not configured");
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

    const erpUrl = `${ERP_BASE_URL}/v2/api/associados?token=${ERP_TOKEN}&cpfDependente=${cpfLimpo}&incluirAns=true`;

    const erpResponse = await fetch(erpUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!erpResponse.ok) {
      const errorText = await erpResponse.text();
      console.error("ERP API error:", errorText);

      return new Response(
        JSON.stringify({
          error: "Erro ao consultar ERP",
          details: errorText,
        }),
        {
          status: erpResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseData: AssociadoResponse = await erpResponse.json();

    const exists = responseData.totalRegistros > 0 || (responseData.dados && responseData.dados.length > 0);

    let summary = {
      empresa: null as string | null,
      codigo: null as string | number | null,
      nomeFantasiaDaEmpresa: null as string | null,
    };

    if (exists && responseData.dados && responseData.dados.length > 0) {
      const firstRecord = responseData.dados[0];

      summary.empresa = firstRecord.empresa?.nome ||
                       firstRecord.empresa?.codigo?.toString() ||
                       null;

      summary.codigo = firstRecord.codigoContrato ||
                      firstRecord.codigo ||
                      null;

      summary.nomeFantasiaDaEmpresa = firstRecord.nomeFantasiaDaEmpresa || null;
    }

    return new Response(
      JSON.stringify({
        exists,
        totalRegistros: responseData.totalRegistros,
        dados: responseData.dados,
        summary,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in erp-check-associado:", error);

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
